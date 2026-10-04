# Wishes for `packages/js-eval` — JavaScript evaluation for Bend

Package wishes, grounded in what this package does. Parent: [root WISHES.md](../../WISHES.md).
Changes need Tom's (@subtleGradient) recorded approval via PR.

### W-BO-JSEVAL-1 · outcome · active
**Wish:** `eval(source)` evaluates a Bend `String` as JavaScript and returns
a typed result: `Done{Json.Val}` on success, `Fail{message}` on error —
never a raw exception crossing into Bend.
**Source:** package README (API section).
**Check:** the example handles both cases through the `Result` type.

### W-BO-JSEVAL-2 · invariant · active
**Wish:** The trust boundary is explicit and documented: this is synchronous
indirect eval in the host's global scope, for **trusted code only** — no
sandbox, no timeout, no effect rollback on failure. Browser CSP rejections
surface as `Fail`, not hangs.
**Source:** package README ("intended for trusted code").
**Check:** the README states the boundary; no wish or doc implies sandboxing.

### W-BO-JSEVAL-3 · invariant · active
**Wish:** The important rules live in `LAWS.bend` and are proven in
`PROOF.bend`; `bend PROOF.bend` passes before any commit touching this package.
**Source:** W-BO-6; repo AGENTS.md.
**Check:** CI proof step green for this package's laws.

### W-BO-JSEVAL-4 · standing-duty · active
**Wish:** `VERSION` is bumped explicitly whenever published content changes.
`eval_json` stays the lower-level primitive; `eval` stays the parsed,
typed entry point — the two-layer shape is the API contract.
**Source:** releasing skill; package README.
**Check:** consumers can pin either layer by version without surprises.
