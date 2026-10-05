# Wishes for `packages/sqlite` — SQLite for Bend

Package wishes, grounded in what this package does. Parent: [root WISHES.md](../../WISHES.md).
Changes need Tom's (@subtleGradient) recorded approval via PR.

### W-BO-SQLITE-1 · outcome · active
**Wish:** One typed Bend API covers connections, bound queries, prepared
statements, transactions, and database images — identical semantics on the
native C backend and the Wasm/JS backend.
**Source:** package README ("The same typed API…").
**Check:** the examples run unchanged against both backends.

### W-BO-SQLITE-2 · outcome · active
**Wish:** In the browser, a database opened in a module worker persists in
OPFS across reloads; release storage lets another tab take over the database.
**Source:** package README (browser counter example).
**Check:** the persistent browser counter demo survives reload and tab handoff.

### W-BO-SQLITE-3 · invariant · active
**Wish:** The important rules live in `LAWS.bend` and are proven in
`PROOF.bend`; `bend PROOF.bend` passes before any commit touching this package.
**Source:** W-BO-6; repo AGENTS.md.
**Check:** CI proof step green for this package's laws.

### W-BO-SQLITE-4 · invariant · active
**Wish:** Exact contracts stay exact: no silent conversion of exact-integer
semantics into U32/modular arithmetic anywhere in the API or tests.
**Source:** Tom's exact-arithmetic rule (2026-10-01).
**Check:** counterexamples in laws would fail loudly, not wrap.

### W-BO-SQLITE-5 · outcome · active
**Wish:** Each release ships a standalone companion archive (official SQLite
Wasm build, host initializer, launcher, proofs, source, examples, licenses)
that runs with no repo checkout and no npm install: `bun launch.js`, `bun serve.js`.
**Source:** RELEASING.md → `skills/releasing/SKILL.md`.
**Check:** extracting a release archive on a clean machine runs the counter.

### W-BO-SQLITE-6 · standing-duty · active
**Wish:** `VERSION` is bumped explicitly whenever published content changes
(Bend API, host files, docs, licenses, examples, generated companions).
Unrelated repo changes never require a bump.
**Source:** releasing skill (immutable release coordinates).
**Check:** a release's receipt matches its tag's content, byte for byte.
