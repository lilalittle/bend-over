import { cp, mkdir, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dir, "..");
const demo = join(root, "demos/js-effects");
const output = join(root, "dist");

export async function buildDemo() {
  const source = resolve(process.env.BEND_SOURCE ?? join(root, ".refs/bend"));
  try {
    await access(join(source, "bend2/comp.ts"));
  } catch {
    throw new Error("Bend source is missing. See README.md for setup, or set BEND_SOURCE to a Bend 2 checkout.");
  }
  const Bend = await import(pathToFileURL(join(source, "bend2/bend.ts")).href);
  const Comp = await import(pathToFileURL(join(source, "bend2/comp.ts")).href);
  const book = Bend.book_nil();
  try {
    await Bend.book_load(book, join(demo, "main.bend"), "", new Map());
    Bend.book_valid(book);
    if (book.hols) throw new Error("Bend source contains unfilled proof holes.");
    const compiled = Comp.js_lib(book, ["main"], null);
    // js_lib omits the CLI runtime. Each call gets its own effect registry and
    // host; no globals, source rewriting, eval, or browser-side compiler needed.
    if (!compiled.includes("function $main$(")) {
      throw new Error("Bend's compiler ABI changed: expected $main$. Use the pinned checkout in README.md.");
    }
    await mkdir(output, { recursive: true });
    await Bun.write(join(output, "demo.js"), `// Generated from main.bend; do not edit.\nimport { runBrowserIO } from "./runner.js";\nexport async function runDemo(browserHost, options) {\n${compiled}\nreturn runBrowserIO(() => run_loop($main$()), $0eff, options);\n}\n`);
  } catch (error: any) {
    throw new Error(error?.$ === "Err" ? Bend.err_show(error) : String(error));
  }
  await cp(join(root, "packages/browser-io/runner.js"), join(output, "runner.js"));
  await cp(join(demo, "web"), output, { recursive: true });
  await Bun.write(join(output, "sources.json"), JSON.stringify({
    "main.bend": await Bun.file(join(demo, "main.bend")).text(),
    "effects.js": await Bun.file(join(demo, "effects.js")).text(),
    "host.js": await Bun.file(join(demo, "web/host.js")).text(),
    "runner.js": await Bun.file(join(root, "packages/browser-io/runner.js")).text(),
  }));
}

if (import.meta.main) {
  await buildDemo();
  console.log("Bend checked and compiled → dist/");
}
