import { mkdir, cp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(import.meta.dir, "..");
export async function buildSQLiteBrowser({ tests = false } = {}) {
  const compiler = resolve(process.env.BEND_SOURCE ?? join(root, ".refs/bend"));
  const Bend = await import(pathToFileURL(join(compiler, "bend2/bend.ts")).href);
  const Comp = await import(pathToFileURL(join(compiler, "bend2/comp.ts")).href);
  const out = join(root,"dist/sqlite");
  await mkdir(join(out,"vendor"),{recursive:true});
  async function compile(file: string, entry: string) {
    const book=Bend.book_nil();
    try {
      await Bend.book_load(book,join(root,file),"",new Map()); Bend.book_valid(book);
      if(book.hols) throw new Error("Unfilled Bend proof holes.");
      return Comp.js_lib(book,[entry],null);
    } catch(e:any) { throw new Error(e?.$ === "Err" ? Bend.err_show(e) : String(e)); }
  }
  await Bun.write(join(out,"counter.js"), `import {runBrowserIO} from './runner.js';\nexport async function runCounter(path, increment) {\n${await compile("packages/sqlite/examples/counter.bend","counter")}\nreturn runBrowserIO(() => run_loop($counter$(path,increment)), $0eff);\n}\n`);
  if(tests) await Bun.write(join(out,"contract.js"),`import {runBrowserIO} from './runner.js';\nexport async function runContract(){\n${await compile("tests/fixtures/sqlite/contract.bend","main")}\n$0eff['IO.print'].run = () => ({$: 'Unit'});\nreturn runBrowserIO(() => run_loop($main$()), $0eff);\n}\n`);
  await cp(join(root,"packages/sqlite/examples/web"),out,{recursive:true});
  await cp(join(root,"packages/sqlite/host.js"),join(out,"host.js"));
  await cp(join(root,"packages/browser-io/runner.js"),join(out,"runner.js"));
  for(const name of ["index.mjs","sqlite3.wasm"]) await cp(join(root,"node_modules/@sqlite.org/sqlite-wasm/dist",name),join(out,"vendor",name));
  await cp(join(root,"packages/sqlite/THIRD_PARTY_NOTICES.md"),join(out,"vendor/THIRD_PARTY_NOTICES.md"));
  return out;
}
if(import.meta.main) console.log(await buildSQLiteBrowser({tests:process.argv.includes("--tests")}));
