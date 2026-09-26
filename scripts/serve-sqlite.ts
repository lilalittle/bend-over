import { resolve, sep } from "node:path";
const root=resolve(import.meta.dir,"../dist/sqlite");
const server=Bun.serve({hostname:"127.0.0.1",port:Number(process.env.PORT??3001),async fetch(request){
  let path;
  try { path=resolve(root,"."+decodeURIComponent(new URL(request.url).pathname)); } catch {return new Response("Bad path",{status:400});}
  if(path===root) path=resolve(root,"index.html");
  if(!path.startsWith(root+sep)) return new Response("Not found",{status:404});
  const file=Bun.file(path);
  return await file.exists()?new Response(file,{headers:{"Cache-Control":"no-store"}}):new Response("Not found",{status:404});
}});
console.log(`SQLite example: ${server.url}`);
