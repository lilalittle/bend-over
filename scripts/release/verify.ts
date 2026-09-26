import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { ROOT, run } from "./process.ts";
import { consumerSource, seed } from "./bundle.ts";
import type { Candidate } from "./core.ts";
import config from "../../release.config.json";

export async function extracted<T>(c: Candidate, assets: Record<string,Uint8Array>, action:(dir:string)=>Promise<T>): Promise<T> {
  const dir=await mkdtemp(join(tmpdir(),"bend-release-consumer-"));
  try {
    const name=`${c.name}-${c.version}.tar.gz`, bytes=assets[name];
    if(!bytes)throw new Error(`Missing archive ${name}`);
    await Bun.write(join(dir,"bundle.tar.gz"),bytes);
    await run(["tar","-xzf",join(dir,"bundle.tar.gz"),"-C",dir]);
    return await action(dir);
  } finally {await rm(dir,{recursive:true,force:true});}
}
export async function verifyConsumers(c: Candidate, reference: string, source: string, hub: string, staged=false) {
  const pkg=Object.values(config.packages).find(p=>p.name===c.name)!;
  await extracted(c,c.assets,async dir=>{
    const lib=join(dir,"lib"), env={BEND_LIB:lib,BEND_HUB:hub,BEND_SOURCE:source};
    if(staged)await seed(c.files,lib);
    for(const fixture of pkg.consumers) {
      const file=join(dir,"probe-"+basename(fixture));
      await Bun.write(file,consumerSource(await Bun.file(join(ROOT,fixture)).text(),reference,c.entry));
      const output=file+".js";
      await run([process.env.BEND_CLI??"bend",file,"-o",output],{cwd:dir,env});
      const text=await run(pkg.companion?["bun",join(dir,"launch.js"),output]:["bun",output],{cwd:dir,env});
      if(!text.includes(pkg.companion?": ok":"\"answer\":42"))throw new Error(`Consumer ${fixture} failed: ${text}`);
      if(pkg.companion) {
        const binary=file+".native";
        await run([process.env.BEND_CLI??"bend",file,"-o",binary],{cwd:dir,env});
        if(!(await run([binary],{cwd:dir,env})).includes(": ok"))throw new Error(`Native consumer ${fixture} failed`);
      }
    }
  });
}
export async function verifyAssets(c: Candidate, assets: Record<string,Uint8Array>) {
  if(c.name!==config.packages.sqlite.name)return;
  await extracted(c,assets,async dir=>{
    const answer=await run(["bun","launch.js","counter.js"],{cwd:dir});
    if(!answer.includes("Counter: 1"))throw new Error("Extracted SQLite Bun example failed");
    console.log(await run(["bunx","--no-install","playwright","test","--config","playwright.release.config.ts"],{env:{BEND_RELEASE_DIR:dir}}));
  });
}
