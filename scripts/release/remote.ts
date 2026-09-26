import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { canonical, hubHash, manifest, sha256 } from "./package.ts";
import { tag, type Candidate, type Receipt, type ReleasePort, type GitHubState } from "./core.ts";

export class HTTPError extends Error {
  constructor(public status: number, url: string) {super(`HTTP ${status}: ${url}`);}
}
export class HTTP {
  constructor(private transport: typeof fetch = fetch, private sleep = (ms:number) => Bun.sleep(ms)) {}
  async request(url: string, init: RequestInit = {}, absent = false) {
    const read = !init.method || init.method === "GET";
    for(let attempt=0;;attempt++) {
      try {
        const res=await this.transport(url,{...init,signal:AbortSignal.timeout(30000)});
        if(absent && res.status===404) return null;
        if(!res.ok) throw new HTTPError(res.status,url);
        return res;
      } catch(e) {
        const transient=!(e instanceof HTTPError) || e.status===429 || e.status>=500;
        if(!read || !transient || attempt===2) throw e;
        await this.sleep(1000*2**attempt);
      }
    }
  }
}

type Options = {
  hub: string; repository: string; api?: string; http?: HTTP;
  credentials?: () => Promise<{key:string;github:string}>;
  command: (args:string[]) => Promise<string>;
  entry: (c:Candidate) => string;
  verify: ReleasePort["verify"]; verifyAssets: ReleasePort["verifyAssets"];
};
export class Remote implements ReleasePort {
  private http: HTTP; private api: string; private githubKey = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  private hubKey = "";
  constructor(private options: Options) {this.http=options.http??new HTTP();this.api=options.api??"https://api.github.com";}
  private headers(token: string, extra: Record<string,string> = {}) {return {...(token?{authorization:`Bearer ${token}`}:{ }),...extra};}
  private repo(path: string) {return `${this.api}/repos/${this.options.repository}${path}`;}
  private async json(url: string, token: string, body?:unknown, absent=false) {
    const res=await this.http.request(url,{method:body===undefined?"GET":"POST",headers:this.headers(token,{accept:"application/vnd.github+json","content-type":"application/json"}),...(body===undefined?{}:{body:JSON.stringify(body)})},absent);
    return res===null?null:await res.json();
  }
  async named(c: Candidate) {
    const res=await this.http.request(`${this.options.hub}/name/${c.name}@${c.version}`,{},true);
    if(!res)return null;
    const hash=(await res.text()).trim();if(!/^0x[0-9a-f]{32}$/.test(hash))throw new Error("Malformed Hub name response");return hash;
  }
  async hubFiles(hash: string) {
    const res=await this.http.request(`${this.options.hub}/${hash}/manifest`,{},true);if(!res)return null;
    const text=await res.text();
    if("0x"+sha256(text).slice(0,32)!==hash)throw new Error("Corrupted Hub manifest");
    const files:Record<string,string>={};
    for(const line of text.trimEnd().split("\n")) {
      const m=/^([0-9a-f]{64}) ([A-Za-z0-9_./-]+)$/.exec(line);
      if(!m || m[2].startsWith("/") || m[2].split("/").some(x=>x===".."||x===".") || m[2] in files)throw new Error("Malformed Hub manifest path");
      const file=await (await this.http.request(`${this.options.hub}/${hash}/${m[2]}`))!.text();
      if(sha256(file)!==m[1])throw new Error(`Corrupted Hub file ${m[2]}`);files[m[2]]=file;
    }
    if(manifest(files)!==text)throw new Error("Noncanonical Hub manifest");return files;
  }
  private async tagCommit(c: Candidate) {
    const ref=await this.json(this.repo(`/git/ref/tags/${tag(c)}`),this.githubKey,undefined,true);if(!ref)return null;
    let object=ref.object;
    for(let depth=0;object?.type==="tag"&&depth<4;depth++)object=(await this.json(this.repo(`/git/tags/${object.sha}`),this.githubKey)).object;
    if(object?.type!=="commit"||! /^[a-f0-9]{40}$/.test(object.sha))throw new Error("Malformed GitHub tag");return object.sha as string;
  }
  private releaseInfo(c: Candidate) {return this.json(this.repo(`/releases/tags/${tag(c)}`),this.githubKey,undefined,true);}
  async github(c: Candidate): Promise<GitHubState|null> {
    const [commit,release]=await Promise.all([this.tagCommit(c),this.releaseInfo(c)]);
    if(!commit&&!release)return null;
    if(!commit)throw new Error("GitHub release has no tag");
    if(!release)return {commit,receipt:null,assets:{}};
    if(release.draft)throw new Error("Existing release is a draft; finish or remove that draft before automatic publication");
    const marker=/<!-- bend-release\n([\s\S]*?)\n-->/.exec(release.body??"");
    if(!marker)throw new Error("Existing GitHub release has no Bend receipt; refusing to adopt it");
    const receipt=JSON.parse(marker[1]) as Receipt;
    if(receipt.schema!==1 || receipt.name!==c.name || receipt.version!==c.version)throw new Error("Malformed GitHub release receipt");
    const assets:Record<string,Uint8Array>={};
    // The list endpoint is paginated independently of release metadata.
    for(let page=1;;page++) {
      const rows=await this.json(this.repo(`/releases/${release.id}/assets?per_page=100&page=${page}`),this.githubKey);
      if(!Array.isArray(rows))throw new Error("Malformed GitHub assets response");
      for(const asset of rows) {
        if(asset.name in assets)throw new Error("Duplicate GitHub asset");
        const res=await this.http.request(this.repo(`/releases/assets/${asset.id}`),{headers:this.headers(this.githubKey,{accept:"application/octet-stream"})});
        assets[asset.name]=new Uint8Array(await res!.arrayBuffer());
      }
      if(rows.length<100)break;
    }
    return {commit,receipt,assets};
  }
  async preflight(c: Candidate) {
    if(this.options.credentials) {
      const credentials=await this.options.credentials();this.hubKey=credentials.key;this.githubKey=credentials.github;
    } else {
      try {this.hubKey=JSON.parse(await readFile(join(homedir(),".bend/bender.json"),"utf8")).key??"";} catch {}
      if(!this.githubKey) {
        try {this.githubKey=await this.options.command(["gh","auth","token"]);} catch {throw new Error("GitHub authentication is missing; run gh auth login");}
      }
    }
    if(!this.hubKey || !this.githubKey)throw new Error("Release credentials are missing: run bend login and configure the GitHub Actions secret BEND_BENDER_JSON");
    if(await this.named(c)===null) {
      const check=await this.json(`${this.options.hub}/publish-check?name=${c.name}&version=${c.version}`,this.hubKey);
      if(!["yours","free"].includes(check?.name)||check.version_ok!==true)throw new Error(`Hub preflight: ${check?.reason??"name or version unavailable"}`);
    }
    const repo=await this.json(this.repo(""),this.githubKey);
    // GitHub Actions tokens do not always include a permissions object in this response.
    if(repo?.permissions && repo.permissions.push!==true)throw new Error("GitHub token cannot write releases");
  }
  async upload(c: Candidate) {
    try {
      const out=await this.options.command([process.env.BEND_CLI??"bend",this.options.entry(c),"--publish"]);
      const hash=out.match(/^0x[0-9a-f]{32}$/m)?.[0];if(!hash)throw new Error("Bend publisher returned no hash");return hash;
    } catch(e) {
      if(canonical(await this.hubFiles(hubHash(c.files)))===canonical(c.files))return hubHash(c.files);throw e;
    }
  }
  verify(c: Candidate, reference: string) {return this.options.verify(c,reference);}
  verifyAssets(c: Candidate, assets: Record<string,Uint8Array>) {return this.options.verifyAssets(c,assets);}
  async createRelease(c: Candidate, receipt: Receipt) {
    const body=`BendHub: \`import ${receipt.hash}/${c.entry} as Package\`\n\nNamed import after promotion: \`import ${c.name}@${c.version}/${c.entry} as Package\`\n\nSource commit: ${receipt.commit}. Verify downloads with SHA256SUMS.\n\n<!-- bend-release\n${JSON.stringify(receipt,null,2)}\n-->`;
    try {await this.json(this.repo("/releases"),this.githubKey,{tag_name:tag(c),target_commitish:c.commit,name:`${c.name} ${c.version}`,body,draft:false,prerelease:c.version.startsWith("0."),make_latest:"false"});}
    catch(e) {const state=await this.github(c);if(!state?.receipt||canonical(state.receipt)!==canonical(receipt))throw e;}
  }
  async uploadAsset(c: Candidate, name: string, bytes: Uint8Array) {
    const info=await this.releaseInfo(c);if(!info)throw new Error("Missing GitHub release");
    const base=info.upload_url?.replace(/\{.*$/,"");
    if(typeof base!=="string" || !(base.startsWith("https://uploads.github.com/") || base.startsWith(this.api+"/")))throw new Error("Unexpected asset upload URL");
    try {await this.http.request(base+"?name="+encodeURIComponent(name),{method:"POST",headers:this.headers(this.githubKey,{"content-type":"application/octet-stream"}),body:bytes as BodyInit});}
    catch(e) {const state=await this.github(c);if(!state?.assets[name]||sha256(state.assets[name])!==sha256(bytes))throw e;}
  }
  async link(c: Candidate, hash: string) {
    try {await this.options.command([process.env.BEND_CLI??"bend","link",`${c.name}@${c.version}`,hash]);}
    catch(e) {if(await this.named(c)!==hash)throw e;}
  }
}
