# SQLite for Bend

An idiomatic Bend 2 package with native SQLite C effects and the official SQLite
Wasm engine for JavaScript. The same typed API supports connections, bound
queries, prepared statements, transactions, and SQLite database images.

## Quick start

From the repository root:

```sh
bun install --frozen-lockfile
mkdir -p .cache
bend packages/sqlite/examples/counter.bend -o .cache/sqlite-counter
.cache/sqlite-counter

bend packages/sqlite/examples/counter.bend -o .cache/sqlite-counter.js
bun packages/sqlite/launch.js .cache/sqlite-counter.js

bun run dev:sqlite
# Open http://127.0.0.1:3001
```

The command-line example uses an in-memory database. The browser example runs
Bend and SQLite in a module worker and stores its counter in OPFS. Reloading
preserves the counter. **Release storage** closes the worker and lets another tab
use the database. Serve over HTTPS or localhost; OPFS needs a secure context.

Import locally:

```bend
import Base
import ./packages/sqlite/sqlite.bend as SQLite

def main() -> IO(Unit):
  do IO<Unit>:
    u : Unit <- IO.try(Unit, SQLite.with_connection(Unit, ":memory:", db =>
      SQLite.transaction(Unit, db, connection =>
        SQLite.script(connection, "create table greetings(message text); insert into greetings values('hello');"))))
    IO.print("Database transaction completed.")
```

The Bend entry file and its `effs/` directory are self-contained apart from Base
and host SQLite. This repository does not publish the package. JS consumers also
need `host.js`, the pinned npm dependency, and its Wasm asset; BendHub's source
packager does not automatically package these companion assets.

## API

All fallible operations use `Result<&1, &1, U32 & String, A>`. The error pair is
SQLite's extended result code and message. Compare `code .&. 255` for the primary
code. Messages can differ between system SQLite versions.

`Connection` and `Statement` are affine: an operation consumes a handle and
returns it alongside its result, including on failure. For example:

```bend
# prepare returns Connection & Result<error, Statement> inside IO.
# bind returns Statement & Result<error, Unit> inside IO.
# step returns Statement & Result<error, Maybe<&2, Row>> inside IO.
```

Bend's `do` bindings accept one variable; unpack returned pairs in a helper def.
See `examples/counter.bend` and the shared contract in `tests/fixtures/sqlite` for
complete examples of this style.

| Operations | Behavior |
|---|---|
| `memory()`, `open(path)`, `open_readonly(path)` | Open memory, read/write/create, or read-only storage. Empty paths and embedded NULs are rejected. |
| `close(db)` | Return `Done{Unit{}}`, or `Fail{((code, message), db)}` with the usable connection. Live statements yield `SQLITE_BUSY`. |
| `dispose(db)` | Consume a connection, finalize all its outstanding statements, then close it. A cleanup error is still reported. |
| `prepare(db, sql)` | Prepare exactly one statement. Trailing whitespace/comments are accepted; extra statements are rejected. |
| `bind(stmt, index, value)`, `bind_named(stmt, name, value)` | Bind a typed value. Indexes start at 1; names include their `:`, `@`, or `$` prefix. |
| `parameter_count`, `parameter_index`, `column_names` | Return parameter metadata and ordered column names. An unknown name has index 0. |
| `step(stmt)` | Return `Some{Row{values}}` or `None{}` on completion. Returned values are copied before advancing. |
| `reset`, `clear_bindings` | Reset execution while retaining bindings, or clear bindings to NULL. Reset can report the preceding execution error while still resetting the statement. |
| `finalize(stmt)` | Always consume the statement, even when reporting its last execution error. |
| `execute(db, sql, values)` | Bind positional values, drain one statement, return `Stats{changes, last_insert_rowid}`. |
| `query(db, sql, values)` | Return `Rows{columns, rows}`. Preserve column order, duplicate names, and metadata for an empty result. |
| `script(db, sql)` | Execute multiple statements without parameters. Earlier statements may remain committed if a later one fails; use a transaction when atomicity is required. |
| `begin`, `commit`, `rollback` | Explicit SQL transaction control (`BEGIN` is deferred). |
| `transaction(A, db, callback)` | Commit a returned success, roll back a returned failure. Callback returns the connection with its `Result<A>`. Nested transactions fail without executing the inner callback. |
| `with_connection(A, path, callback)` | Open, run callback, dispose on either returned outcome, including statements left open by the callback. |
| `with_statement(A, db, sql, callback)` | Prepare, run callback, finalize on either returned outcome. Return the original connection and result. |
| `busy_timeout(db, milliseconds)` | Configure SQLite's busy timeout; default is SQLite's zero timeout. Values above `INT_MAX` are rejected. |
| `export(db)`, `from_bytes(bytes)` | Export the main database, or import an image into a new independent memory connection. |

Binding after stepping and stepping after completion/error require `reset`.
Unbound prepared-statement parameters follow SQLite's NULL semantics. The
convenience query/execute helpers require exactly `parameter_count` values;
numbered parameters with gaps require placeholders for those slots.

Scopes operate on **returned Results**. `IO.die`, process termination, or a
callback which never returns prevents normal scoped cleanup. Keep transaction
control inside the transaction helper; issuing COMMIT/ROLLBACK in its callback
will cause the helper's own completion to report an error. Original failures
retain their code; a failing cleanup appends its message.

`raw.*`, `wrap.*`, and `scope.*` names are implementation details. Bend currently
cannot declare custom opaque handles, so the public wrappers contain Base's
`File`. Do not extract that field or pass it to filesystem effects. The SQLite
registries validate kind and lifetime, but this compiler limitation is not a
language-enforced capability boundary.

## Values without precision loss

`Value` is a reusable Data type:

- `Null{}`
- `Integer{I64{lo, hi}}`: signed two's-complement 64-bit bits in two U32 words.
- `Real{F64{lo, hi}}`: IEEE binary64 bits, low word first, independent of host byte order.
- `Text{String}`: UTF-8 at the C/Wasm boundary, including embedded NULs.
- `Blob{List<&2, U32>}`: bytes in `0..255`; invalid bytes are rejected, not masked.

`I64.from_u32`, checked `I64.to_u32`, `I64.neg`, `I64.is_eq`, `I64.read`, and
`I64.show` provide integer conveniences. `read` accepts an optional sign and ASCII
digits, rejects whitespace and overflow, and preserves the full signed range.
`neg` uses two's-complement semantics, so negating the minimum value yields itself.
`F64.from_f32` widens a Bend F32 exactly, including subnormals. Construct F64 words
directly for full-precision values; ordinary Bend floating literals are F32 and
cannot express every SQLite double. For human-readable real output, SQL's
`CAST(value AS TEXT)` or `printf` is available. SQLite maps NaN to NULL and may
normalize negative zero in storage; these are SQLite semantics.

`Row.get(row, index)` is zero-based and returns `None` outside the row. Query
results are fully collected in memory; use prepared statements and `step` for
incremental reads. Byte lists favor interoperability with Base over compact
representation, so large blobs and database images carry substantial overhead.
An untouched empty database may have no exportable image; create a schema before
exporting. Import validates the image header and reads the schema; it is not a
full corruption scan (`PRAGMA integrity_check` can be used explicitly).

## Hosts and initialization

Native builds need Clang, SQLite headers, and a shared SQLite library >= 3.37.
On Debian/Ubuntu install `clang libsqlite3-dev`. On macOS the developer tools
provide the SDK headers and the OS supplies SQLite. Linux requires glibc >= 2.34
for `dlopen` without extra linker flags. `BEND_SQLITE_LIBRARY=/absolute/library`
overrides discovery; a bad override fails rather than silently selecting another
library. Missing serialization APIs fail only import/export.

Native operations run on Bend IO workers. A connection mutex covers complete
operations, including stepping and copying columns; independent connections can
run concurrently. SQLite's journal mode, foreign-key setting, and transaction
defaults are preserved. Use explicit PRAGMAs to configure them.

JavaScript uses `@sqlite.org/sqlite-wasm@3.53.4-build1`, **never Bun's native
SQLite implementation**. The official Bend JS loop is synchronous, so await
initialization before importing/running a compiled program:

```js
import { initializeSQLite } from './packages/sqlite/host.js';
const host = await initializeSQLite();
// Run Bend IO after initialization; effects themselves are synchronous.
try { await import('./compiled-program.js'); }
finally { host.dispose(); }
```

Bend CLI programs may exit the process themselves; `launch.js` provides this
setup for them. Bare `bend program.bend` uses the JS backend without this setup
and reports an initialization error. `bend program.bend -o program` produces a
native executable without any Wasm initialization requirement.

| Host | Memory | Persistent named paths | Import/export |
|---|---|---|---|
| Native C | Yes | OS filesystem | Yes, if SQLite includes serialization |
| Bun + Wasm | Yes | Rejected | Yes |
| Browser worker + Wasm | Yes | OPFS handle pool | Yes |

For browsers, pass the browser module initializer explicitly (see the worker
example): `initializeSQLite({persistent:true, initModule:sqlite3InitModule})`.
The defaults are directory `/.bend-sqlite` and capacity 6 pool files; each database
also needs journal-file capacity. These are configurable with `directory` and
`capacity`. Paths are normalized to start with `/`. Changing the directory selects
a different store. Initialization never clears the store, and unavailable/busy
OPFS never falls back to memory.

One active worker owns the pool. `dispose()` releases the pool without deleting
its files. A competing tab must release/terminate its failed worker and initialize
a new one after the first releases storage. OPFS storage is origin-scoped and
subject to browser quota/eviction policy. The sample requires no COOP/COEP headers.

The browser runner is the repository's sequential IO adapter; it does not support
Base's spawn/channel scheduler. The Bun launcher uses the normal Bend JS runtime,
which does support those operations. C/Wasm callbacks, extension loading, custom
VFS implementations, and concurrent browser tabs are outside this version.

## Verification and compatibility

```sh
bend packages/sqlite/PROOF.bend
bun test
bun run test:sqlite:browser
```

Install the matching Chromium first with `bunx playwright install chromium`.
`PLAYWRIGHT_BROWSERS_PATH` can select a cache directory. Browser tests run real
Wasm/OPFS and check worker termination, reload, competing tabs, and lock release.
The shared Bend contract runs against native SQLite and Wasm, including deliberate
foreign-code attempts to reuse finalized handles. The interoperability test writes
an image from Wasm, modifies it with native SQLite, and reimports it into Wasm.

Pinned compiler: **Bend 2.0.29**, checkout
`574b6d39a235b539eb19a5c532993a0abb3d11ad`. `BEND_SOURCE` selects the compiler source
for browser builds; keep the `bend` executable on the matching revision. Foreign
C constructor layouts are compiler internals, so rerun the complete suite after
updating Bend. `LAWS.bend`/`PROOF.bend` prove pure numeric, row-access and error
propagation properties; they do not prove SQLite or host runtime behavior.

Verified locally on macOS ARM64 with system SQLite 3.54.0, Bun 1.4.2, and Chromium
153 with SQLite Wasm 3.53.4. Linux and other browsers require their own validation.
The official SQLite/WasM distribution includes its license notices; browser builds
preserve them alongside the copied assets.

An additional ASan/UBSan diagnostic run passed after disabling Bend's special
calling-convention attributes in a temporary emitted C file. Stock sanitizer
instrumentation conflicts with this compiler/runtime on the local toolchain
(the combined sanitizer failure also reproduces without SQLite). No compiler
or generated-runtime changes are part of this package.
