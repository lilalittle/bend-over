// Included by Bend in a per-module closure. All constructor names are resolved by Bend.
const tuple = (fst, snd) => ({ $: CID(Tuple), fst, snd });
const done = value => ({ $: CID(Done), value });
const fail = error => ({ $: CID(Fail), error });
const unit = () => ({ $: CID(Unit) });
const list = xs => xs.reduceRight((tail, head) => ({ $: CID(Con), head, tail }), { $: CID(Nil) });
const array = xs => { const a = []; for (; xs.$ === CID(Con); xs = xs.tail) a.push(xs.head); return a; };
const i64 = n => ({ $: CID(I64), lo: Number(BigInt.asUintN(32, n)), hi: Number(BigInt.asUintN(32, n >> 32n)) });
const integer = n => BigInt.asIntN(64, BigInt(n.lo) | BigInt(n.hi) << 32n);
function real(n) { const b = new DataView(new ArrayBuffer(8)); b.setUint32(0, n.lo, true); b.setUint32(4, n.hi, true); return b.getFloat64(0, true); }
function f64(n) { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, n, true); return { $: CID(F64), lo: b.getUint32(0, true), hi: b.getUint32(4, true) }; }
function decode(v) {
  switch (v.$) {
    case CID(Null): return { kind: "null" };
    case CID(Integer): return { kind: "integer", value: integer(v.value) };
    case CID(Real): return { kind: "real", value: real(v.value) };
    case CID(Text): return { kind: "text", value: v.value };
    case CID(Blob): return { kind: "blob", value: array(v.bytes) };
    default: throw Object.assign(new Error("Invalid SQL value."), {code:21});
  }
}
function encode(v) {
  switch (v.kind) {
    case "integer": return { $: CID(Integer), value: i64(v.value) };
    case "real": return { $: CID(Real), value: f64(v.value) };
    case "text": return { $: CID(Text), value: v.value };
    case "blob": return { $: CID(Blob), bytes: list(v.value) };
    default: return { $: CID(Null) };
  }
}
const row = values => ({ $: CID(Row), values: list(values.map(encode)) });
function result(op, value) {
  if (op === "open" || op === "import" || op === "prepare" || op.startsWith("parameter_")) return value;
  if (op === "step") return value === null ? { $: CID(None) } : { $: CID(Some), value: row(value) };
  if (op === "column_names" || op === "export") return list(value);
  if (op === "query") return { $: CID(Rows), columns: list(value.columns), rows: list(value.rows.map(row)) };
  if (op === "execute") return { $: CID(Stats), changes: i64(value.changes), last_insert_rowid: i64(value.last_insert_rowid) };
  return unit();
}
function handler(op) {
  return (...args) => {
    const handle = args[0];
    let answer;
    try {
      const host = globalThis[Symbol.for("bend.sqlite.runtime.v1")];
      if (!host || host.version !== 1) throw Object.assign(new Error("Initialize SQLite Wasm before running Bend."), {code:21});
      // Bend's CLI appends its continuation; forward only actual arguments.
      const n = {open:2,import:1,close:1,finalize:1,prepare:2,bind:3,bind_named:3,step:1,reset:1,clear_bindings:1,column_names:1,parameter_count:1,parameter_index:2,script:2,execute:3,query:3,busy_timeout:2,export:1}[op];
      args = args.slice(0, n);
      if (op === "bind" || op === "bind_named") args[2] = decode(args[2]);
      if (op === "query" || op === "execute") args[2] = array(args[2]).map(decode);
      if (op === "import") args[0] = array(args[0]);
      answer = done(result(op, host.invoke(op, args)));
    } catch (error) {
      const e = tuple((error.code ?? error.resultCode ?? 1) >>> 0, String(error.message ?? error));
      answer = fail(op === "close" ? tuple(e, handle) : e);
    }
    return ["open", "import", "close", "finalize"].includes(op) ? answer : tuple(handle, answer);
  };
}
io_eff(CID(raw.open), handler("open"));
io_eff(CID(raw.import), handler("import"));
io_eff(CID(raw.close), handler("close"));
io_eff(CID(raw.finalize), handler("finalize"));
io_eff(CID(raw.prepare), handler("prepare"));
io_eff(CID(raw.bind), handler("bind"));
io_eff(CID(raw.bind_named), handler("bind_named"));
io_eff(CID(raw.step), handler("step"));
io_eff(CID(raw.reset), handler("reset"));
io_eff(CID(raw.clear_bindings), handler("clear_bindings"));
io_eff(CID(raw.column_names), handler("column_names"));
io_eff(CID(raw.parameter_count), handler("parameter_count"));
io_eff(CID(raw.parameter_index), handler("parameter_index"));
io_eff(CID(raw.script), handler("script"));
io_eff(CID(raw.execute), handler("execute"));
io_eff(CID(raw.query), handler("query"));
io_eff(CID(raw.busy_timeout), handler("busy_timeout"));
io_eff(CID(raw.export), handler("export"));
