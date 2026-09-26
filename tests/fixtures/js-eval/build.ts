import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dir, "../../..");
const compiler = resolve(process.env.BEND_SOURCE ?? join(root, ".refs/bend"));
const Bend = await import(pathToFileURL(join(compiler, "bend2/bend.ts")).href);
const Comp = await import(pathToFileURL(join(compiler, "bend2/comp.ts")).href);
const output = join(root, ".cache/js-eval-tests");

async function load(file: string) {
  const book = Bend.book_nil();
  await Bend.book_load(book, file, "", new Map());
  Bend.book_valid(book);
  if (book.hols) throw new Error("Unfilled Bend proof holes.");
  return book;
}

try {
  await mkdir(output, { recursive: true });
  const book = await load(join(import.meta.dir, "main.bend"));
  const runner = pathToFileURL(join(root, "packages/browser-io/runner.js")).href;
  await Bun.write(join(output, "compiled.js"), `import { runBrowserIO } from ${JSON.stringify(runner)};
export async function evaluate(testSource) {
${Comp.js_lib(book, ["main"], null)}
return runBrowserIO(() => run_loop($main$()), $0eff);
}
`);
  const example = await load(join(root, "packages/js-eval/example.bend"));
  await Bun.write(join(output, "example.js"), Comp.js_book(example));
} catch (error: any) {
  console.error(error?.$ === "Err" ? Bend.err_show(error) : String(error));
  process.exitCode = 1;
}
