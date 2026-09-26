import { canonical, hubHash, sha256 } from "./package.ts";
export type Candidate = {
  name: string; version: string; entry: string; commit: string;
  files: Record<string,string>; assets: Record<string,Uint8Array>;
  dependencies: Record<string,string>; toolchain: Record<string,string>;
};
export type Receipt = {
  schema: 1; name: string; version: string; entry: string; hash: string; commit: string;
  dependencies: Record<string,string>; toolchain: Record<string,string>; assets: Record<string,string>;
};
export type GitHubState = { commit: string; receipt: Receipt | null; assets: Record<string,Uint8Array> };
export interface ReleasePort {
  named(c: Candidate): Promise<string|null>;
  hubFiles(hash: string): Promise<Record<string,string>|null>;
  github(c: Candidate): Promise<GitHubState|null>;
  preflight(c: Candidate): Promise<void>;
  upload(c: Candidate): Promise<string>;
  verify(c: Candidate, reference: string): Promise<void>;
  createRelease(c: Candidate, receipt: Receipt): Promise<void>;
  uploadAsset(c: Candidate, name: string, bytes: Uint8Array): Promise<void>;
  verifyAssets(c: Candidate, assets: Record<string,Uint8Array>): Promise<void>;
  link(c: Candidate, hash: string): Promise<void>;
}
export const tag = (c: Pick<Candidate,"name"|"version">) => `${c.name}-v${c.version}`;
export const receiptFor = (c: Candidate): Receipt => ({ schema:1, name:c.name, version:c.version,
  entry:c.entry, hash:hubHash(c.files), commit:c.commit, dependencies:c.dependencies, toolchain:c.toolchain,
  assets:Object.fromEntries(Object.entries(c.assets).map(([name,data]) => [name,sha256(data)])) });
function compatible(a: Receipt, b: Receipt) {
  // A rerun preserves the original build provenance when the released bytes are identical.
  return canonical({...a,commit:"",toolchain:{}}) === canonical({...b,commit:"",toolchain:{}});
}
function validateAssets(c: Candidate, state: GitHubState, complete: boolean) {
  for (const [name,data] of Object.entries(state.assets)) {
    if (!(name in c.assets) || sha256(data) !== sha256(c.assets[name])) throw new Error(`Conflicting or corrupted asset ${name}; never overwrite it. Raise VERSION for changed content.`);
  }
  if (complete && Object.keys(c.assets).some(name => !(name in state.assets))) throw new Error("Release assets are incomplete");
}
export async function inspect(c: Candidate, port: ReleasePort) {
  const expected = receiptFor(c);
  const [named, github] = await Promise.all([port.named(c), port.github(c)]);
  if (named && named !== expected.hash) throw new Error(`${c.name}@${c.version} differs on BendHub: raise VERSION`);
  if (github) {
    if (github.receipt ? !compatible(expected,github.receipt) : github.commit !== c.commit)
      throw new Error(`Existing release differs: raise VERSION, or resume its original commit ${github.commit}`);
    if (github.receipt && github.receipt.commit !== github.commit) throw new Error("Release tag and receipt commit disagree");
    validateAssets(c,github,false);
  }
  return { expected, named, github };
}

/** Every phase is reconstructible from remote state; an interrupted write is reconciled on rerun. */
export async function release(c: Candidate, port: ReleasePort): Promise<Receipt> {
  const initial = await inspect(c,port);
  const hash = initial.expected.hash;
  const existing = await port.hubFiles(hash);
  if (existing && canonical(existing) !== canonical(c.files)) throw new Error("Hub files do not match the prepared hash");
  const complete = initial.named === hash && initial.github?.receipt
    && Object.keys(c.assets).every(name => name in initial.github!.assets);
  if (!complete) {
    await port.preflight(c);
    // Recheck after acquiring credentials / waiting for another publisher.
    await inspect(c,port);
    if (!existing) {
      const got = await port.upload(c);
      if (got !== hash) throw new Error(`Publisher returned ${got}, expected ${hash}`);
    }
  }
  const uploaded = await port.hubFiles(hash);
  if (!uploaded || canonical(uploaded) !== canonical(c.files)) throw new Error("Downloaded Hub files differ from prepared files");
  await port.verify(c,hash);
  if (!initial.github?.receipt) await port.createRelease(c,initial.expected);
  let github = await port.github(c);
  if (!github?.receipt || !compatible(initial.expected,github.receipt)) throw new Error("GitHub release receipt differs");
  for (const [name,bytes] of Object.entries(c.assets)) {
    if (!(name in github.assets)) await port.uploadAsset(c,name,bytes);
  }
  github = await port.github(c);
  if (!github) throw new Error("GitHub release disappeared");
  validateAssets(c,github,true);
  await port.verifyAssets(c,github.assets);
  const named = await port.named(c);
  if (named !== null && named !== hash) throw new Error("Concurrent version conflict: raise VERSION");
  if (named === null) await port.link(c,hash);
  if (await port.named(c) !== hash) throw new Error("Named package does not resolve to the verified hash");
  await port.verify(c,`${c.name}@${c.version}`);
  return github.receipt!;
}
