import { beforeAll, describe, expect, test } from "bun:test";
import { buildDemo } from "../../scripts/build.ts";

let runDemo: (host: any, options?: any) => Promise<unknown>;

beforeAll(async () => {
  await buildDemo();
  ({ runDemo } = await import("../../dist/demo.js"));
});

function fixture(overrides = {}) {
  const calls: unknown[][] = [];
  const host = {
    message: () => "Hello from Bend",
    palette: async () => 166,
    paint: (message: string, hue: number) => calls.push(["paint", message, hue]),
    delay: () => 20,
    sleep: async (ms: number) => {
      calls.push(["sleep", ms]);
      await Bun.sleep(ms);
      calls.push(["awake"]);
    },
    save: (message: string) => { calls.push(["save", message]); return true; },
    finish: (message: string) => calls.push(["finish", message]),
    ...overrides,
  };
  return { host, calls };
}

describe("compiled Bend → registered JavaScript effects", () => {
  test("passes returned values back to Bend and waits before saving", async () => {
    const { host, calls } = fixture();
    const trace: any[] = [];
    await runDemo(host, { onEffect: (event: any) => trace.push(event) });
    expect(calls).toEqual([
      ["paint", "Hello from Bend", 166], ["sleep", 20], ["awake"],
      ["save", "Hello from Bend"], ["finish", "Saved to this browser."],
    ]);
    expect(trace.filter(e => e.phase === "start").map(e => e.name)).toEqual([
      "Web.message", "Web.palette", "Web.paint", "Web.delay", "Web.sleep", "Web.save", "Web.finish",
    ]);
    expect(trace.filter(e => e.phase === "complete")).toHaveLength(7);
  });

  test("Bend handles the false result when storage is unavailable", async () => {
    const { host, calls } = fixture({ save: () => false });
    await runDemo(host);
    expect(calls.at(-1)).toEqual(["finish", "Storage is unavailable. Your signal still ran."]);
  });

  test("a rejected network effect stops the sequence and reports its name", async () => {
    const { host, calls } = fixture({ palette: async () => { throw new Error("Network unavailable"); } });
    const trace: any[] = [];
    await expect(runDemo(host, { onEffect: (e: any) => trace.push(e) })).rejects.toThrow("Network unavailable");
    expect(calls).toEqual([]);
    expect(trace.at(-1)).toMatchObject({ name: "Web.palette", phase: "error" });
  });

  test("concurrent runs keep their host and values separate", async () => {
    const a = fixture({ message: () => "one" });
    const b = fixture({ message: () => "two", palette: async () => 32 });
    await Promise.all([runDemo(a.host), runDemo(b.host)]);
    expect(a.calls[0]).toEqual(["paint", "one", 166]);
    expect(b.calls[0]).toEqual(["paint", "two", 32]);
  });
});
