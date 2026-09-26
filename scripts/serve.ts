import { resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "../dist");
if (!(await Bun.file(resolve(root, "index.html")).exists())) {
  throw new Error("Build the demo first: bun run build");
}
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  async fetch(request) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response("Bad path", { status: 400 }); }
    const path = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!path.startsWith(root + sep)) return new Response("Not found", { status: 404 });
    const file = Bun.file(path);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    return new Response(file, { headers: { "Cache-Control": "no-store" } });
  },
});
console.log(`Bend effects playground: ${server.url}`);
