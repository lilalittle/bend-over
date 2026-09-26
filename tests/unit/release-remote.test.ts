import {test,expect} from "bun:test";
import {HTTP,Remote} from "../../scripts/release/remote.ts";
import {release,type Candidate} from "../../scripts/release/core.ts";
import {hubHash,manifest} from "../../scripts/release/package.ts";

function mock() {
  const c:Candidate={name:"bend-over-fixture",version:"0.1.0.0",entry:"main.bend",commit:"a".repeat(40),files:{"main.bend":"import Base\n"},assets:{"fixture.tgz":Buffer.from("archive")},dependencies:{},toolchain:{bend:"2.0.29"}};
  let uploaded=false,named:string|null=null,info:any=null,commit:string|null=null,writes=0;
  const assets:any[]=[]; let fault="", failure="", reads=0;
  const server=Bun.serve({hostname:"127.0.0.1",port:0,async fetch(req){
    const url=new URL(req.url),p=url.pathname;
    if(failure&&p.includes(failure))return new Response("failed",{status:503});
    if(req.method!=="GET")writes++;else reads++;
    if(p==="/hub/publish-check")return Response.json({name:"free",version_ok:true});
    if(p.startsWith("/hub/name/"))return named?new Response(named):new Response("missing",{status:404});
    if(p===`/hub/${hubHash(c.files)}/manifest`)return uploaded?new Response(manifest(c.files)):new Response("missing",{status:404});
    if(p===`/hub/${hubHash(c.files)}/main.bend`)return new Response(fault==="corrupt"?"tampered":c.files["main.bend"]);
    const at=p.replace("/api/repos/test/repo","");
    // Actions installation tokens can create releases with contents:write even
    // though this collaborator-oriented field reports false.
    if(at==="")return Response.json({full_name:"test/repo",permissions:{push:false}});
    if(at.startsWith("/git/ref/tags/"))return commit?Response.json({object:{type:"commit",sha:commit}}):new Response("missing",{status:404});
    if(at.startsWith("/releases/tags/"))return info?Response.json(info):new Response("missing",{status:404});
    if(at==="/releases"&&req.method==="POST"){
      const body=await req.json();commit=body.target_commitish;info={...body,id:1,upload_url:server.url+"api/upload{?name}"};
      if(fault==="release"){fault="";return new Response("lost reply",{status:502});}return Response.json(info);
    }
    if(at==="/releases/1/assets")return Response.json(assets.map(({data,...meta})=>meta));
    if(at.startsWith("/releases/assets/")){const asset=assets.find(a=>a.id===Number(at.split("/").at(-1)));return asset?new Response(asset.data):new Response("missing",{status:404});}
    if(p==="/api/upload"){
      assets.push({id:assets.length+1,name:url.searchParams.get("name"),data:new Uint8Array(await req.arrayBuffer())});
      if(fault==="asset"){fault="";return new Response("lost reply",{status:502});}return Response.json(assets.at(-1));
    }
    return new Response("missing",{status:404});
  }});
  const port=new Remote({hub:server.url+"hub",api:server.url+"api",repository:"test/repo",http:new HTTP(fetch,async()=>{}),credentials:async()=>({key:"fixture",github:"fixture"}),entry:()=>"main.bend",verify:async()=>{},verifyAssets:async()=>{},command:async args=>{
    if(args.includes("--publish")){writes++;uploaded=true;if(fault==="upload"){fault="";throw new Error("lost reply");}return hubHash(c.files);}
    if(args.includes("link")){writes++;named=hubHash(c.files);if(fault==="link"){fault="";throw new Error("lost reply");}return "linked";}throw new Error("unexpected command");
  }});
  return {c,port,stop:()=>server.stop(true),fault:(s:string)=>fault=s,fail:(s:string)=>failure=s,get writes(){return writes;},get reads(){return reads;}};
}

for(const phase of ["none","upload","release","asset","link"])test(`HTTP release reconciles ${phase} lost response and reruns without writes`,async()=>{
  const m=mock();try{m.fault(phase);await release(m.c,m.port);const writes=m.writes;await release({...m.c,commit:"b".repeat(40)},m.port);expect(m.writes).toBe(writes);}finally{m.stop();}
});

test("a 503 is retried, never interpreted as an absent version",async()=>{
  const m=mock();try{m.fail("/name/");await expect(release(m.c,m.port)).rejects.toThrow("HTTP 503");expect(m.writes).toBe(0);expect(m.reads).toBeLessThan(12);}finally{m.stop();}
});

test("a corrupt downloaded file prevents promotion",async()=>{
  const m=mock();try{m.fault("corrupt");await expect(release(m.c,m.port)).rejects.toThrow("Corrupted Hub file");expect(await m.port.named(m.c)).toBeNull();}finally{m.stop();}
});

test("authentication errors are not retried",async()=>{
  let calls=0;const http=new HTTP(async()=>{calls++;return new Response("no",{status:401});},async()=>{});
  await expect(http.request("https://example.invalid")).rejects.toThrow("401");expect(calls).toBe(1);
});

test("malformed name responses fail closed",async()=>{
  const port=new Remote({hub:"https://example.invalid",repository:"test/repo",http:new HTTP(async()=>new Response("<html>oops</html>")),command:async()=>"",entry:()=>"",verify:async()=>{},verifyAssets:async()=>{}});
  await expect(port.named({name:"bend-over-fixture",version:"0.1.0.0"} as Candidate)).rejects.toThrow("Malformed");
});
