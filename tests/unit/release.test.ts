import { expect, test } from "bun:test";
import { hubHash, manifest, deterministicArchive } from "../../scripts/release/package.ts";
import { release, type Candidate, type ReleasePort } from "../../scripts/release/core.ts";

const candidate = (): Candidate => ({
  name: "bend-over-fixture", version: "0.1.0.0", entry: "main.bend", commit: "a".repeat(40),
  files: { "main.bend": "import Base\n" }, assets: { "fixture.tar.gz": Buffer.from("archive") },
  dependencies: {}, toolchain: { bend: "2.0.29", bun: "1.4.2" },
});

function fake() {
  let named: string | null = null, files: Record<string,string> | null = null;
  let github: any = null, writes = 0, failAt = "", rejected = false;
  const event = (name: string) => { writes++; if (failAt === name) { failAt = ""; throw new Error("interrupted " + name); } };
  const port: ReleasePort = {
    named: async () => named, hubFiles: async () => files, github: async () => github,
    preflight: async () => { if (rejected) throw new Error("missing credentials or unavailable name"); },
    upload: async c => { files = c.files; event("upload"); return hubHash(c.files); },
    verify: async () => {},
    createRelease: async (c, receipt) => { github = { commit: c.commit, receipt, assets: {} }; event("release"); },
    uploadAsset: async (_, name, bytes) => { github.assets[name] = bytes; event("asset"); },
    verifyAssets: async () => {},
    link: async (_, hash) => { named = hash; event("link"); },
  };
  return { port, get writes() { return writes; }, interrupt: (at: string) => { failAt = at; },
    reject: () => { rejected = true; }, corrupt: () => { github.assets["fixture.tar.gz"] = Buffer.from("bad"); },
    wrongHash: () => { named = "0x" + "f".repeat(32); } };
}

test("Hub hash ignores insertion order but includes paths and content", () => {
  expect(hubHash({ b: "2", a: "1" })).toBe(hubHash({ a: "1", b: "2" }));
  expect(hubHash({ a: "1" })).not.toBe(hubHash({ b: "1" }));
  expect(manifest({ a: "1" })).toMatch(/^[a-f0-9]{64} a\n$/);
});

test("release archives are deterministic across insertion order", () => {
  expect(deterministicArchive({ b: Buffer.from("2"), a: Buffer.from("1") }))
    .toEqual(deterministicArchive({ a: Buffer.from("1"), b: Buffer.from("2") }));
});

test("first release and identical rerun after unrelated commits", async () => {
  const f = fake(), c = candidate();
  await release(c, f.port);
  const writes = f.writes;
  await release({ ...c, commit: "b".repeat(40) }, f.port);
  expect(f.writes).toBe(writes);
});

for (const phase of ["upload", "release", "asset", "link"]) {
  test(`resume interruption after ${phase} without replacing content`, async () => {
    const f = fake(); f.interrupt(phase);
    try { await release(candidate(), f.port); } catch {}
    await release(candidate(), f.port);
    const writes = f.writes;
    await release(candidate(), f.port);
    expect(f.writes).toBe(writes);
  });
}

test("changed Hub content and companion content require a new version", async () => {
  const f = fake(); await release(candidate(), f.port);
  await expect(release({ ...candidate(), files: { "main.bend": "changed" } }, f.port)).rejects.toThrow("VERSION");
  await expect(release({ ...candidate(), assets: { "fixture.tar.gz": Buffer.from("changed") } }, f.port)).rejects.toThrow("VERSION");
});

test("missing credentials or an unavailable name prevents every write", async () => {
  const f = fake(); f.reject();
  await expect(release(candidate(), f.port)).rejects.toThrow("credentials");
  expect(f.writes).toBe(0);
});

test("corrupted assets and conflicting named hashes are never overwritten", async () => {
  const f = fake(); await release(candidate(), f.port); const writes = f.writes;
  f.corrupt(); await expect(release(candidate(), f.port)).rejects.toThrow("asset");
  expect(f.writes).toBe(writes);
  f.wrongHash(); await expect(release(candidate(), f.port)).rejects.toThrow("VERSION");
});
