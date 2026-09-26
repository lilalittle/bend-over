import { beforeAll, describe, expect, test } from "bun:test";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dir, "../..");
const output = join(root, ".cache/js-eval-tests");
type Outcome = { $: "Done"; value: string } | { $: "Fail"; error: string };
let evaluate: (source: string) => Promise<Outcome>;

beforeAll(async () => {
  // A subprocess makes the compiler cache setting independent of other tests.
  const built = Bun.spawnSync(["bun", "tests/fixtures/js-eval/build.ts"], {
    cwd: root, env: { ...process.env, BEND_LIB: join(root, ".cache/bend") },
    stdout: "pipe", stderr: "pipe",
  });
  if (built.exitCode) throw new Error(built.stdout.toString() + built.stderr.toString());
  ({ evaluate } = await import(pathToFileURL(join(output, "compiled.js")).href));
}, 30000);

describe("JS.eval through compiled Bend and bend-kit-json", () => {
  test.each([
    ["6 * 7", 42],
    ['"Hello from JS"', "Hello from JS"],
    ["true", true],
    ["false", false],
    ["null", null],
    ['[1, "two", false, null, {deep: [3]}]', [1, "two", false, null, { deep: [3] }]],
    ['({answer: 42, nested: {ok: true}, message: "é😀\\n"})', { answer: 42, nested: { ok: true }, message: "é😀\n" }],
    ["let x = 20; x * 2 + 2", 42],
    ["JSON.parse('{\"__proto__\":{\"polluted\":true}}')", JSON.parse('{"__proto__":{"polluted":true}}')],
  ])("evaluates %s and returns a Bend JSON value", async (source, expected) => {
    const result = await evaluate(source as string);
    expect(result.$).toBe("Done");
    if (result.$ === "Done") expect(JSON.parse(result.value)).toEqual(expected);
  });

  test.each([
    ["(()", "eval:"],
    ['throw new Error("boom")', "eval: boom"],
    ['throw "oops"', "eval: oops"],
    ['throw {toString() {throw 1}}', "eval:"],
    ["undefined", "serialize:"],
    ["() => 42", "serialize:"],
    ["Symbol('s')", "serialize:"],
    ["42n", "serialize:"],
    ["(() => { const a = {}; a.self = a; return a; })()", "serialize:"],
    ['({toJSON() {throw new Error("no JSON")}})', "serialize: no JSON"],
    ["Promise.resolve(42)", "serialize:"],
    ['Promise.reject(new Error("async failure"))', "serialize:"],
  ])("returns Fail for %s without breaking the next call", async (source, error) => {
    const result = await evaluate(source);
    expect(result.$).toBe("Fail");
    if (result.$ === "Fail") expect(result.error).toStartWith(error);
    expect(await evaluate("1 + 1")).toEqual({ $: "Done", value: "2" });
  });

  test("uses standard JSON.stringify conversion rules", async () => {
    const result = await evaluate("({finite: Infinity, missing: undefined, array: [undefined, NaN]})");
    expect(result.$).toBe("Done");
    if (result.$ === "Done") expect(JSON.parse(result.value)).toEqual({ finite: null, array: [null, null] });
  });

  test("evaluates once, in global scope, without exposing handler locals", async () => {
    try {
      expect(await evaluate("globalThis.__bendEvalTestCounter = 0; ++globalThis.__bendEvalTestCounter"))
        .toEqual({ $: "Done", value: "1" });
      expect(await evaluate("globalThis.__bendEvalTestCounter"))
        .toEqual({ $: "Done", value: "1" });
      expect(await evaluate("typeof js_eval_json"))
        .toEqual({ $: "Done", value: '"undefined"' });
    } finally {
      delete (globalThis as any).__bendEvalTestCounter;
    }
  });

  test("runs using the official Bend JS runtime without the browser adapter", async () => {
    const result = Bun.spawnSync(["bun", join(output, "example.js")], { stdout: "pipe", stderr: "pipe" });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toEqual({ answer: 42, language: "JavaScript", values: [true, null] });
  });
});
