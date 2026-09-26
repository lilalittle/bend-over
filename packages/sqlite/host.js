/** SQLite's Wasm engine. This module never imports Bend compiler internals. */
export const runtimeKey = Symbol.for("bend.sqlite.runtime.v1");
export class SQLiteError extends Error {
  constructor(code, message) { super(message); this.name = "SQLiteError"; this.code = code; }
}
const bad = (message, code = 21) => { throw new SQLiteError(code, message); };
const text = new TextEncoder();
const decoder = new TextDecoder();

export function createRuntime(sqlite, { pool = null } = {}) {
  const c = sqlite.capi, w = sqlite.wasm;
  const registry = new Map();
  let disposed = false;
  const check = (rc, db) => {
    const extended = db ? c.sqlite3_extended_errcode(db) : rc;
    if (rc) throw new SQLiteError((extended & 255) === (rc & 255) ? extended : rc,
      db ? c.sqlite3_errmsg(db) : c.sqlite3_errstr(rc));
  };
  const register = (entry) => {
    const handle = Object.freeze({});
    registry.set(handle, entry);
    return handle;
  };
  const get = (handle, kind) => {
    const entry = registry.get(handle);
    if (!entry || entry.kind !== kind || disposed) bad("Invalid or expired SQLite " + kind + " handle.");
    return entry;
  };
  const validText = (s) => {
    if (typeof s !== "string" || s.includes("\0")) bad("SQLite paths, SQL and parameter names cannot contain NUL.");
    return s;
  };
  const bytes = (xs) => {
    if (xs.some(x => !Number.isInteger(x) || x < 0 || x > 255)) bad("A byte must be in 0..255.");
    return Uint8Array.from(xs);
  };
  const allocBytes = (data) => {
    const p = w.alloc(Math.max(1, data.length));
    w.heap8u().set(data, p);
    return p;
  };
  function open(path, readonly = false) {
    validText(path);
    if (!path) bad("An empty database path is not supported.", 14);
    if (path !== ":memory:" && !pool) bad("Persistent paths require browser OPFS; use memory or database import/export in Bun.", 14);
    if (path !== ":memory:" && !path.startsWith("/")) path = "/" + path;
    const pp = w.alloc(8);
    w.pokePtr(pp, 0);
    let db = 0;
    try {
      const rc = c.sqlite3_open_v2(path, pp, readonly ? 1 : 6, path === ":memory:" ? null : pool.vfsName);
      db = w.peekPtr(pp);
      check(rc, db);
      c.sqlite3_extended_result_codes(db, 1);
      return register({ kind: "connection", db, statements: new Set() });
    } catch (error) { if (db) c.sqlite3_close_v2(db); throw error; }
    finally { w.dealloc(pp); }
  }
  function prepare(entry, sql) {
    validText(sql);
    const [p, n] = w.allocCString(sql, true), out = w.alloc(16);
    let stmt = 0;
    try {
      w.pokePtr(out, 0); w.pokePtr(out + 8, 0);
      check(c.sqlite3_prepare_v2(entry.db, p, n + 1, out, out + 8), entry.db);
      stmt = w.peekPtr(out);
      if (!stmt) bad("Expected one SQL statement.");
      // Prepare the tail too: SQLite itself recognizes comments and whitespace.
      let tail = w.peekPtr(out + 8);
      while (tail < p + n) {
        w.pokePtr(out, 0);
        const rc = c.sqlite3_prepare_v2(entry.db, tail, p + n - tail + 1, out, out + 8);
        const extra = w.peekPtr(out), next = w.peekPtr(out + 8);
        if (extra) c.sqlite3_finalize(extra);
        check(rc, entry.db);
        if (extra) bad("Expected one SQL statement; use script for multiple statements.");
        if (next <= tail) break;
        tail = next;
      }
      const h = register({ kind: "statement", stmt, owner: entry, state: "ready" });
      entry.statements.add(h);
      return h;
    } catch (error) { if (stmt) c.sqlite3_finalize(stmt); throw error; }
    finally { w.dealloc(p); w.dealloc(out); }
  }
  function bind(entry, index, value) {
    if (entry.state !== "ready") bad("Reset the statement before binding.");
    let rc;
    if (value.kind === "null") rc = c.sqlite3_bind_null(entry.stmt, index);
    else if (value.kind === "integer") rc = c.sqlite3_bind_int64(entry.stmt, index, value.value);
    else if (value.kind === "real") rc = c.sqlite3_bind_double(entry.stmt, index, value.value);
    else {
      const data = value.kind === "text" ? text.encode(value.value) : bytes(value.value);
      const p = allocBytes(data);
      try { rc = value.kind === "text" ? c.sqlite3_bind_text(entry.stmt, index, p, data.length, -1)
        : c.sqlite3_bind_blob(entry.stmt, index, p, data.length, -1); }
      finally { w.dealloc(p); }
    }
    check(rc, entry.owner.db);
  }
  function row(stmt) {
    return Array.from({ length: c.sqlite3_column_count(stmt) }, (_, i) => {
      switch (c.sqlite3_column_type(stmt, i)) {
        case 1: return { kind: "integer", value: c.sqlite3_column_int64(stmt, i) };
        case 2: return { kind: "real", value: c.sqlite3_column_double(stmt, i) };
        case 3: {
          // The convenience string-returning wrapper truncates embedded NULs.
          const p = w.exports.sqlite3_column_text(stmt, i), n = c.sqlite3_column_bytes(stmt, i);
          return { kind: "text", value: decoder.decode(w.heap8u().subarray(p, p + n)) };
        }
        case 4: {
          const p = c.sqlite3_column_blob(stmt, i), n = c.sqlite3_column_bytes(stmt, i);
          return { kind: "blob", value: Array.from(w.heap8u().subarray(p, p + n)) };
        }
        default: return { kind: "null" };
      }
    });
  }
  function step(entry) {
    if (entry.state === "done" || entry.state === "failed") bad("Reset the statement before stepping again.");
    const rc = c.sqlite3_step(entry.stmt);
    if (rc === 100) { entry.state = "row"; return row(entry.stmt); }
    entry.state = rc === 101 ? "done" : "failed";
    if (rc !== 101) check(rc, entry.owner.db);
    return null;
  }
  function finalize(handle) {
    const entry = get(handle, "statement");
    registry.delete(handle); entry.owner.statements.delete(handle);
    const rc = c.sqlite3_finalize(entry.stmt);
    check(rc, entry.owner.db);
  }
  function query(entry, sql, values, collect) {
    const handle = prepare(entry, sql), stmt = get(handle, "statement");
    let error, result;
    try {
      if (values.length !== c.sqlite3_bind_parameter_count(stmt.stmt)) bad("Parameter count does not match supplied values.", 25);
      values.forEach((v, i) => bind(stmt, i + 1, v));
      const columns = names(stmt), rows = [];
      for (;;) { const r = step(stmt); if (r === null) break; if (collect) rows.push(r); }
      result = collect ? { columns, rows } : { changes: c.sqlite3_changes64(entry.db), last_insert_rowid: c.sqlite3_last_insert_rowid(entry.db) };
    } catch (e) { error = e; }
    try { finalize(handle); } catch (e) { if (!error) error = e; }
    if (error) throw error;
    return result;
  }
  const names = (entry) => Array.from({length:c.sqlite3_column_count(entry.stmt)}, (_, i) => c.sqlite3_column_name(entry.stmt, i));
  const connectionOps = new Set(["close", "dispose", "prepare", "script", "query", "execute", "busy_timeout", "export"]);
  return {
    version: 1,
    invoke(op, args) {
      if (disposed) bad("SQLite runtime has been disposed.");
      if (op === "open") return open(...args);
      if (op === "import") {
        const data = bytes(args[0]);
        if (data.length < 100 || decoder.decode(data.subarray(0, 16)) !== "SQLite format 3\0") bad("Invalid SQLite database image.", 26);
        const handle = open(":memory:"), entry = get(handle, "connection");
        const p = c.sqlite3_malloc64(BigInt(data.length));
        if (!p) { this.invoke("close", [handle]); bad("SQLite allocation failed.", 7); }
        w.heap8u().set(data, p);
        try {
          check(c.sqlite3_deserialize(entry.db, "main", p, BigInt(data.length), BigInt(data.length), 1 | 2), entry.db);
          // Force validation before handing ownership to the caller.
          query(entry, "PRAGMA schema_version", [], true);
          return handle;
        } catch (e) { this.invoke("close", [handle]); throw e; }
      }
      const [handle, ...a] = args;
      const entry = get(handle, connectionOps.has(op) ? "connection" : "statement");
      switch (op) {
        case "close": if (entry.statements.size) bad("Cannot close a connection with outstanding statements.", 5); check(c.sqlite3_close_v2(entry.db), entry.db); registry.delete(handle); return;
        case "dispose": {
          let error;
          for (const h of [...entry.statements]) { try { finalize(h); } catch (e) { error ??= e; } }
          check(c.sqlite3_close_v2(entry.db), entry.db); registry.delete(handle);
          if (error) throw error;
          return;
        }
        case "prepare": return prepare(entry, a[0]);
        case "bind": return bind(entry, a[0], a[1]);
        case "bind_named": {
          const index = c.sqlite3_bind_parameter_index(entry.stmt, validText(a[0]));
          if (!index) bad("Unknown parameter name.", 25);
          return bind(entry, index, a[1]);
        }
        case "step": return step(entry);
        case "reset": { const rc = c.sqlite3_reset(entry.stmt); entry.state = "ready"; check(rc, entry.owner.db); return; }
        case "clear_bindings": check(c.sqlite3_clear_bindings(entry.stmt), entry.owner.db); return;
        case "finalize": return finalize(handle);
        case "column_names": return names(entry);
        case "parameter_count": return c.sqlite3_bind_parameter_count(entry.stmt);
        case "parameter_index": return c.sqlite3_bind_parameter_index(entry.stmt, validText(a[0]));
        case "script": check(c.sqlite3_exec(entry.db, validText(a[0]), 0, 0, 0), entry.db); return;
        case "execute": return query(entry, a[0], a[1], false);
        case "query": return query(entry, a[0], a[1], true);
        case "busy_timeout": if (a[0] > 2147483647) bad("Busy timeout exceeds INT_MAX."); check(c.sqlite3_busy_timeout(entry.db, a[0]), entry.db); return;
        case "export": return Array.from(c.sqlite3_js_db_export(entry.db));
        default: bad("Unknown SQLite operation.");
      }
    },
    dispose() {
      for (const [h, e] of registry) if (e.kind === "statement") { try { finalize(h); } catch {} }
      for (const e of registry.values()) c.sqlite3_close_v2(e.db);
      registry.clear(); disposed = true;
      if (pool && !pool.isPaused()) pool.pauseVfs();
    },
  };
}

let initialization;
export async function initializeSQLite({ persistent = false, directory = "/.bend-sqlite", capacity = 6, moduleOptions = {}, initModule } = {}) {
  if (initialization) throw new Error("SQLite is already initialized in this realm. Dispose it before initializing again.");
  initialization = true;
  let runtime;
  try {
    const init = initModule ?? (await import("@sqlite.org/sqlite-wasm")).default;
    const sqlite = await init(moduleOptions);
    let pool = null;
    if (persistent) {
      if (typeof sqlite.installOpfsSAHPoolVfs !== "function") bad("Persistent storage requires OPFS in a browser worker.", 14);
      try { pool = await sqlite.installOpfsSAHPoolVfs({ directory, initialCapacity: capacity }); }
      catch (error) { bad("OPFS unavailable or busy in another tab: " + error.message, 14); }
    }
    runtime = createRuntime(sqlite, { pool });
    globalThis[runtimeKey] = runtime;
    return { sqlite, runtime, dispose() { runtime.dispose(); delete globalThis[runtimeKey]; initialization = false; } };
  } catch (error) { initialization = false; throw error; }
}
