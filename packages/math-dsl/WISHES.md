# Wishes for `packages/math-dsl` — semantic equation DSL for Bend

Package wishes for the semantic math IR and its renderers. Parent:
[root WISHES.md](../../WISHES.md). (Package name provisional — Tom's call.)
Changes need Tom's (@subtleGradient) recorded approval via PR.

### W-BO-MD-1 · outcome · active
**Wish:** The IR covers the working mathematician's toolkit: arithmetic,
fractions, roots, sub/superscripts, sums/products/integrals with binders,
total and partial derivatives, limits, matrices, indexed tensors, Greek and
common symbols, and text annotations.
**Source:** Tom, chat 2026-10-03 ("capturing complex equations and stuff").
**Check:** the seed corpus renders without dropping to raw strings.

### W-BO-MD-2 · invariant · active
**Wish:** Binders bind. A bound variable (∫…dx, Σ over i, ∂/∂x) is a proper
binding in the IR — alpha-renamable, not a string convention.
**Source:** semantic-IR design (W-BO-10).
**Check:** a law states binder hygiene; renaming a bound variable changes
no rendering.

### W-BO-MD-3 · outcome · active
**Wish:** `latex.bend` renders any IR term to compilable LaTeX; `mathml.bend`
renders any IR term to valid MathML. Adding a backend never changes the IR.
**Source:** W-BO-11.
**Check:** the corpus builds in CI — LaTeX compiles, MathML validates.

### W-BO-MD-4 · invariant · active
**Wish:** The important rules live in `LAWS.bend` and are proven in
`PROOF.bend`; `bend PROOF.bend` passes before any commit touching this
package. First laws: binder hygiene, renderer totality (every IR term
renders), LaTeX/MathML agreement on structure.
**Source:** W-BO-6; repo AGENTS.md.
**Check:** CI proof step green for this package's laws.

### W-BO-MD-5 · standing-duty · active
**Wish:** `VERSION` is bumped explicitly whenever published content changes,
per the releasing skill. Hub name follows the `bend-over-*` convention
(`bend-over-math-dsl` proposed; Tom confirms).
**Source:** releasing skill; W-BO-5.
**Check:** a release's receipt matches its tag's content, byte for byte.

### W-BO-MD-6 · invariant · active
**Wish:** Node names, operator conventions, and binder forms follow
mathlib/physlib where those libraries define them. Where the DSL must
innovate (concepts with no shared convention), the deviation is documented
in the package with rationale — and proposed back upstream where feasible.
**Source:** W-BO-14.
**Check:** a newcomer fluent in mathlib recognizes the IR's naming without
a translation table.
