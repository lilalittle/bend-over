import { afterAll, beforeAll, expect, test } from "bun:test";
import { initializeSQLite } from "../../packages/sqlite/host.js";
let host: Awaited<ReturnType<typeof initializeSQLite>>;
let invoke: (name: string, args: any[]) => any;
beforeAll(async () => { host = await initializeSQLite(); invoke = host.runtime.invoke.bind(host.runtime); });
afterAll(() => host?.dispose());
const integer = (value: bigint) => ({kind:"integer", value});
function withDb(body: (db: object) => void) {
  const db = invoke("open", [":memory:", false]);
  try { body(db); } finally { try { invoke("dispose", [db]); } catch {} }
}
function code(f: () => unknown, expected: number) {
  let thrown: any;
  try { f(); } catch (e) { thrown = e; }
  expect(thrown?.code & 255).toBe(expected);
}

test("Wasm keeps exact 64-bit values and byte lengths", () => withDb(db => {
  const values = [integer(-(1n<<63n)),integer((1n<<63n)-1n),integer(9007199254740993n),
    {kind:"real", value:1.2345678901234567}, {kind:"text",value:"é😀\0tail"},
    {kind:"blob",value:[0,128,255]}, {kind:"blob",value:[]}, {kind:"null"}];
  expect(invoke("query", [db, "select ?,?,?,?,?,?,?,?", values]).rows[0]).toEqual(values);
}));

test("parameter metadata, invalid binding and statement states", () => withDb(db => {
  const stmt = invoke("prepare", [db,"select :x as name"]);
  expect(invoke("column_names",[stmt])).toEqual(["name"]);
  expect(invoke("parameter_index",[stmt,":missing"])).toBe(0);
  code(() => invoke("bind_named",[stmt,":missing",integer(1n)]),25);
  code(() => invoke("bind",[stmt,0,integer(1n)]),25);
  invoke("bind",[stmt,1,integer(42n)]);
  expect(invoke("step",[stmt])).toEqual([integer(42n)]);
  code(() => invoke("bind",[stmt,1,integer(43n)]),21);
  expect(invoke("step",[stmt])).toBeNull();
  code(() => invoke("step",[stmt]),21);
  invoke("reset",[stmt]); expect(invoke("step",[stmt])).toEqual([integer(42n)]);
  code(() => invoke("close",[db]),5);
  invoke("finalize",[stmt]);
  code(() => invoke("step",[stmt]),21);
  code(() => invoke("finalize",[stmt]),21);
}));

test("constraint errors survive reset/finalize and handles remain recoverable", () => withDb(db => {
  invoke("script",[db,"create table t(n unique); insert into t values(1)"]);
  let stmt = invoke("prepare",[db,"insert into t values(1)"]);
  code(() => invoke("step",[stmt]),19);
  code(() => invoke("reset",[stmt]),19);
  // reset succeeded mechanically even though it reports the previous error.
  code(() => invoke("step",[stmt]),19);
  code(() => invoke("finalize",[stmt]),19);
  code(() => invoke("step",[stmt]),21);
  expect(invoke("query",[db,"select n from t",[]]).rows).toEqual([[integer(1n)]]);
}));

test("scope disposal finalizes leaked statements and invalidates all handles", () => {
  const db = invoke("open",[":memory:",false]), stmt = invoke("prepare",[db,"select 1"]);
  invoke("dispose",[db]);
  code(() => invoke("step",[stmt]),21);
  code(() => invoke("query",[db,"select 1",[]]),21);
  code(() => invoke("step",[{}]),21);
});

test("rejects accidental scripts, malformed values and unsupported persistence", () => withDb(db => {
  for (const sql of ["select 1; select 2", "", "-- comment", "select 1\0;drop table x"]) code(() => invoke("query",[db,sql,[]]),21);
  expect(invoke("query",[db,"select 1 as x; /* comment */",[]]).rows).toEqual([[integer(1n)]]);
  code(() => invoke("query",[db,"select ?",[]]),25);
  code(() => invoke("query",[db,"select ?",[{kind:"blob",value:[256]}]]),21);
  code(() => invoke("busy_timeout",[db,0xffffffff]),21);
  code(() => invoke("open",["accidentally-persistent.db",false]),14);
  code(() => invoke("import",[[1,2,3]]),26);
}));

test("database images roundtrip independently", () => withDb(db => {
  invoke("script",[db,"create table t(n); insert into t values(42)"]);
  const image = invoke("export",[db]);
  const copy = invoke("import",[image]);
  try { expect(invoke("query",[copy,"select n from t",[]]).rows).toEqual([[integer(42n)]]); }
  finally { invoke("close",[copy]); }
}));
