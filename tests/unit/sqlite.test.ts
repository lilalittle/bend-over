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

for (const fixture of ["contract", "minimal", "scopes", "errors", "parallel"]) {
  test(`${fixture} runs with native SQLite and official Wasm`, async () => {
    await mkdir(out, { recursive: true });
    const file = `tests/fixtures/sqlite/${fixture}.bend`;
    run(["bend", file, "-o", `${out}/${fixture}.js`]);
    run(["bend", file, "-o", `${out}/${fixture}`]);
    expect(run([`${out}/${fixture}`])).toContain(`${fixture}: ok`);
    expect(run(["bun", "packages/sqlite/launch.js", `${out}/${fixture}.js`])).toContain(`${fixture}: ok`);
  }, 120000);
}

test("missing Wasm initialization is a Bend error, not a JS crash", () => {
  const p = Bun.spawnSync(["bun", `${out}/minimal.js`], {stdout:"pipe",stderr:"pipe"});
  expect(p.exitCode).not.toBe(0);
  expect(p.stderr.toString()).toContain("Initialize SQLite Wasm");
});

test("missing native library has a clear recoverable error", () => {
  const p = Bun.spawnSync([`${out}/minimal`], {env:{...process.env,BEND_SQLITE_LIBRARY:"/no/such/sqlite-library"},stdout:"pipe",stderr:"pipe"});
  expect(p.exitCode).not.toBe(0);
  expect(p.stderr.toString()).toContain("Cannot load SQLite");
});

test("native and Wasm exchange real SQLite database images", async () => {
  const {initializeSQLite} = await import("../../packages/sqlite/host.js");
  const host=await initializeSQLite();
  const call=host.runtime.invoke.bind(host.runtime);
  try {
    const db=call("open",[":memory:",false]);
    call("script",[db,"create table t(n); insert into t values(42)"]);
    await Bun.write(`${out}/interop.sqlite`,Uint8Array.from(call("export",[db])));
    call("close",[db]);
    run(["bend","tests/fixtures/sqlite/disk.bend","-o",`${out}/disk`]);
    expect(run([`${out}/disk`,`${out}/interop.sqlite`])).toContain("disk: ok");
    run(["bend","tests/fixtures/sqlite/readonly.bend","-o",`${out}/readonly`]);
    expect(run([`${out}/readonly`,`${out}/interop.sqlite`])).toContain("readonly: ok");
    const imported=call("import",[Array.from(new Uint8Array(await Bun.file(`${out}/interop.sqlite`).arrayBuffer()))]);
    expect(call("query",[imported,"select n from t order by n",[]]).rows).toEqual([
      [{kind:"integer",value:42n}],[{kind:"integer",value:43n}],
    ]);
    call("close",[imported]);
  } finally {host.dispose();}
},120000);
