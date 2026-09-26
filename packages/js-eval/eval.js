// This script runs in Bend's per-file effect closure. Indirect eval executes
// in the host's global scope and cannot see these lexical handler variables.
const evaluate = (0, eval);
const stringify = JSON.stringify;
const settle = Promise.resolve.bind(Promise);

function error_text(error) {
  try {
    return typeof error?.message === "string" ? error.message : String(error);
  } catch {
    return "JavaScript threw an unprintable value.";
  }
}

function js_eval_json(source) {
  let value;
  try {
    value = evaluate(source);
  } catch (error) {
    return { $: CID(Fail), error: "eval: " + error_text(error) };
  }

  try {
    if (value !== null && (typeof value === "object" || typeof value === "function")
        && typeof value.then === "function") {
      // Do not let an unsupported, already-rejected Promise become unhandled.
      settle(value).catch(() => {});
      return { $: CID(Fail), error: "serialize: Promise/thenable results are not supported by synchronous eval." };
    }
    const text = stringify(value);
    if (text === undefined) {
      return { $: CID(Fail), error: "serialize: the result has no JSON representation (undefined, function, or symbol)." };
    }
    return { $: CID(Done), value: text };
  } catch (error) {
    return { $: CID(Fail), error: "serialize: " + error_text(error) };
  }
}

io_eff(CID(eval_json), js_eval_json);
