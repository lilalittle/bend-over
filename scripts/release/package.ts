import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFileSync, realpathSync, readdirSync } from "node:fs";
import { basename, dirname, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
export const manifest = (files: Record<string, string>) => Object.keys(files).sort()
  .map(p => `${sha256(files[p])} ${p}\n`).join("");
export const hubHash = (files: Record<string, string>) => "0x" + sha256(manifest(files)).slice(0, 32);
export const canonical = (value: any): string => JSON.stringify(value, (_, v) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);

/** Mirrors Bend 2.0.29 main.ts pkg_files using the actual loader, never regex import discovery. */
export async function packageFiles(entry: string, source: string) {
  const Bend = await import(pathToFileURL(resolve(source, "bend2/bend.ts")).href);
  const book = Bend.book_nil(), seen = new Map<string, string | null>();
  try {
    await Bend.book_load(book, resolve(entry), "", seen);
    Bend.book_valid(book);
    if (book.hols) throw new Error("Unfilled Bend proof holes");
  } catch (e: any) { throw new Error(e?.$ === "Err" ? Bend.err_show(e) : String(e)); }
  const dir = realpathSync(dirname(entry)) + "/";
  const raws: [string, string][] = [
    ...[...seen].flatMap(([real, ns]): [string,string][] =>
      real === Bend.BASE_BEND || ns === null || ns.startsWith("0x") ? [] : [[ns === "" ? basename(entry) : ns + ".bend", real]]),
    ...Object.entries(book.tlds).flatMap(([k, tld]: [string, any]): [string,string][] =>
      tld.$ !== "Def" || tld.i === undefined || tld.b === true || k.startsWith("0x") ? []
        : tld.i.map((f: string) => [f.startsWith(dir) ? f.slice(dir.length) : f, f])),
  ];
  const ups = raws.map(([p]) => posix.normalize(p).split("/").filter(s => s === "..").length);
  const ancestors = realpathSync(dirname(entry)).split("/").slice(-Math.max(0, ...ups) || Infinity);
  const files: Record<string,string> = {};
  for (const [raw, real] of raws) {
    const p = posix.join(...ancestors, raw);
    if (p.startsWith("/") || p.startsWith("..") || p.split("/").slice(0,-1).some(s => s.toLowerCase() === "license"))
      throw new Error(`Unpublishable package path: ${p}`);
    files[p] = readFileSync(real, "utf8");
    if (readdirSync(dirname(real)).includes("LICENSE"))
      files[posix.join(posix.dirname(p), "LICENSE")] = readFileSync(resolve(dirname(real), "LICENSE"), "utf8");
  }
  return files;
}

/** Portable USTAR + gzip, with sorted paths, fixed permissions and zero timestamps/owners. */
export function deterministicArchive(files: Record<string, Uint8Array>): Buffer {
  const blocks: Buffer[] = [];
  for (const name of Object.keys(files).sort()) {
    if (!name || name.startsWith("/") || name.split("/").some(p => p === ".." || p === ".") || Buffer.byteLength(name) > 100)
      throw new Error(`Unsafe or overlong archive path: ${name}`);
    const data = Buffer.from(files[name]), header = Buffer.alloc(512);
    const put = (s: string, at: number, length: number) => header.write(s, at, length, "ascii");
    const oct = (n: number, at: number, length: number) => put(n.toString(8).padStart(length-1, "0") + "\0", at, length);
    put(name,0,100); oct(0o644,100,8); oct(0,108,8); oct(0,116,8); oct(data.length,124,12); oct(0,136,12);
    header.fill(32,148,156); put("0",156,1); put("ustar\0",257,6); put("00",263,2);
    const sum = header.reduce((a,b) => a+b,0);
    put(sum.toString(8).padStart(6,"0") + "\0 ",148,8);
    blocks.push(header,data,Buffer.alloc((512-data.length%512)%512));
  }
  blocks.push(Buffer.alloc(1024));
  const archive = gzipSync(Buffer.concat(blocks), { level: 9 });
  // RFC 1952 OS=255 (unknown): Bun/zlib otherwise writes 19 on macOS and 3 on Linux.
  archive[9] = 255;
  return archive;
}

if (import.meta.main) {
  const [entry, source] = process.argv.slice(2);
  if (!entry || !source) throw new Error("Usage: package.ts entry.bend compiler-source");
  console.log(JSON.stringify(await packageFiles(entry,source)));
}
