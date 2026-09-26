import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { sha256 } from "./package.ts";
import { ROOT, run } from "./process.ts";
import pin from "../../toolchain.json";

export async function assertToolchain(source: string, bend = "bend") {
  if (Bun.version !== pin.bun) throw new Error(`Use Bun ${pin.bun}, found ${Bun.version}`);
  if (await run([bend,"version"]) !== `bend ${pin.bend.version}`) throw new Error(`Use Bend ${pin.bend.version}`);
  for (const [file,expected] of Object.entries(pin.bend.files)) {
    if (sha256(await Bun.file(join(source,file)).bytes()) !== expected) throw new Error(`Compiler source mismatch: ${file}`);
  }
}

export async function installToolchain() {
  const root=join(ROOT,".cache/toolchain"), source=join(root,"source"), bin=join(root,"bin");
  const platform=`${process.platform === "darwin" ? "darwin" : process.platform}-${process.arch}`;
  const archive=(pin.bend.archives as Record<string,{file:string;sha256:string}>)[platform];
  if (!archive) throw new Error(`Unsupported Bend platform ${platform}`);
  await mkdir(root,{recursive:true});
  async function unpack(url: string, expected: string, destination: string, strip: number) {
    const res=await fetch(url); if(!res.ok) throw new Error(`Download failed: ${url}: ${res.status}`);
    const data=new Uint8Array(await res.arrayBuffer());
    if(sha256(data)!==expected) throw new Error(`Checksum mismatch: ${url}`);
    const scratch=await mkdtemp(join(tmpdir(),"bend-toolchain-"));
    try {
      await Bun.write(join(scratch,"archive.tgz"),data);
      await mkdir(join(scratch,"out"));
      await run(["tar","-xzf",join(scratch,"archive.tgz"),"-C",join(scratch,"out"),`--strip-components=${strip}`]);
      await rm(destination,{recursive:true,force:true});
      await rename(join(scratch,"out"),destination);
    } finally { await rm(scratch,{recursive:true,force:true}); }
  }
  // Always verify downloaded bytes; no moving installer or unchecked cached executable.
  await unpack(`https://github.com/bendlang/bend/releases/download/v${pin.bend.version}/${archive.file}`,archive.sha256,bin,0);
  await unpack(`https://codeload.github.com/bendlang/bend/tar.gz/${pin.bend.source}`,pin.bend.sourceSha256,source,1);
  const listing=await run(["find",bin,"-type","f","-name","bend"]);
  const executable=listing.split("\n").find(Boolean);
  if(!executable) throw new Error("Bend archive has no executable");
  await assertToolchain(source,executable);
  const env={BEND_SOURCE:source,BEND_CLI:executable,PATH:resolve(executable,"..")+":"+process.env.PATH};
  if(process.env.GITHUB_ENV) {
    await Bun.write(process.env.GITHUB_ENV,(await Bun.file(process.env.GITHUB_ENV).text().catch(()=>""))+`BEND_SOURCE=${source}\nBEND_CLI=${executable}\n`);
    await Bun.write(process.env.GITHUB_PATH,(await Bun.file(process.env.GITHUB_PATH).text().catch(()=>""))+resolve(executable,"..")+"\n");
  }
  console.log(JSON.stringify(env,null,2));
}
if(import.meta.main) await installToolchain();
