// Runs in a fresh process so Bend reads this build's isolated BEND_LIB.
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const [file,out,kind]=process.argv.slice(2);
const source=resolve(process.env.BEND_SOURCE ?? ".refs/bend");
const Bend=await import(pathToFileURL(join(source,"bend2/bend.ts")).href);
const Comp=await import(pathToFileURL(join(source,"bend2/comp.ts")).href);
const book=Bend.book_nil();
try {
  await Bend.book_load(book,resolve(file),"",new Map()); Bend.book_valid(book);
  if(book.hols) throw new Error("Unfilled Bend proof holes");
  const code=kind==="cli" ? Comp.js_book(book) : `import {runBrowserIO} from '../runner.js';\nexport async function ${kind==="counter"?"runCounter(path, increment)":"runContract()"} {\n${Comp.js_lib(book,[kind==="counter"?"counter":"main"],null)}\n${kind==="counter"?"":"$0eff['IO.print'].run = () => ({$: 'Unit'});\n"}return runBrowserIO(() => run_loop(${kind==="counter"?"$counter$(path, increment)":"$main$()"}), $0eff);\n}\n`;
  await Bun.write(out,code);
} catch(e:any) { console.error(e?.$==="Err"?Bend.err_show(e):String(e));process.exitCode=1; }
