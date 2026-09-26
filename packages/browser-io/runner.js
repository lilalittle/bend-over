/**
 * Sequential browser interpreter for Bend 2's compiled IO requests.
 * This deliberately supports only synchronous and Promise-returning effects.
 * Native read/time parking and spawn/channel scheduling are not implemented.
 */
export async function runBrowserIO(main, effects, { onEffect = () => {} } = {}) {
  let request = main()((value) => ({ $: "Emit", value }));
  const names = new Map(Object.entries(effects).map(([name, effect]) => [effect.run, name]));
  let index = 0;

  while (request?.$ !== "Emit") {
    if (request?.$ === "Halt") throw new Error(request.message);
    if (typeof request?.run !== "function" || typeof request?.kont !== "function") {
      throw new Error("Unsupported Bend IO request in the browser runner.");
    }
    if (request.need) throw new Error("Native parked effects are not supported in the browser.");
    const name = names.get(request.run);
    if (!name) throw new Error("Unregistered effect in the browser runner.");
    const event = { index: ++index, name, args: [...request.args] };
    const start = performance.now();
    onEffect({ ...event, phase: "start" });
    let value;
    try {
      value = await request.run(...request.args);
      if (value === undefined) throw new Error("Browser effects must return a value, not park.");
    } catch (error) {
      onEffect({ ...event, phase: "error", error: String(error), duration: performance.now() - start });
      throw error;
    }
    onEffect({ ...event, phase: "complete", value, duration: performance.now() - start });
    request = request.kont(value);
  }
  return request.value;
}
