# Wishes for `packages/browser-io` — browser IO runner

Package wishes, grounded in what this package does. Parent: [root WISHES.md](../../WISHES.md).
Changes need Tom's (@subtleGradient) recorded approval via PR.

### W-BO-BIO-1 · outcome · active
**Wish:** The runner executes compiled Bend programs with asynchronous
JavaScript effects in the browser (module worker), with a visible trace of
effect arguments, results, and failures.
**Source:** repo README ("Browser effects demo… live trace of effect
arguments, results, and failures"); `demos/js-effects/`.
**Check:** the demo shows the trace for a program that calls browser APIs.

### W-BO-BIO-2 · outcome · active
**Wish:** The runner ships inside the SQLite companion archive so the
browser demo works from a release with no repo checkout.
**Source:** RELEASING.md → `skills/releasing/SKILL.md` ("distributed with
SQLite rather than named separately on BendHub").
**Check:** the archive's `serve.js` path runs the OPFS counter demo.

### W-BO-BIO-3 · proposed · active
**Wish:** This package gets a README documenting what the runner does, its
JS API surface, and how to use it standalone — it is currently the only
package without one.
**Source:** gap found while writing package wishes (2026-10-01).
**Check:** `packages/browser-io/README.md` exists and a newcomer can run it.
