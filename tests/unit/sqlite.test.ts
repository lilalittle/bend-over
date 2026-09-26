import { expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const out = resolve(root, ".cache/sqlite-tests");
function run(args: string[]) {
  const p = Bun.spawnSync(args, { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (p.exitCode) throw new Error(`${args.join(" ")}\n${p.stdout}\n${p.stderr}`);
  return p.stdout.toString();
}

test("SQLite contract runs through compiled C and Wasm", async () => {
  await mkdir(out, { recursive: true });
  const fixture = "tests/fixtures/sqlite/check.bend";
  run(["bend", fixture, "-o", `${out}/check.js`]);
  run(["bend", fixture, "-o", `${out}/check`]);
  expect(run([`${out}/check`])).toContain("sqlite: ok");
  expect(run(["bun", "packages/sqlite/launch.js", `${out}/check.js`])).toContain("sqlite: ok");
}, 120000);
