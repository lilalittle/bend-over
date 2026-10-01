# Wishes for `bend-over`

The source of truth for what this repo is and what it should become.
Each wish states a desired state, where it came from, and how we'd check it.
**Reality is compared against these wishes; every gap becomes an issue.**
A wish changes only by pull request with Tom's (@subtleGradient) recorded approval.

Format: `W-BO-N · kind · status` — kind is `outcome` (a state to reach),
`invariant` (must always hold), or `standing-duty` (ongoing work).

## The wish-gap loop (how this repo is run)

1. **Wishes** (here, plus per-package and per-skill files) say what should be true.
2. **Reality** is captured fresh before planning — the repo, its issues, its CI.
3. **Distance** is tracked per wish as met / unmet / unknown, with evidence —
   never a single percent.
4. **Gaps** become GitHub issues with native blocked-by edges (the source of
   truth for dependencies — no prose relationship sections; prose goes stale).
5. **Work** is delegated in small red-green-refactor loops.
6. **Garbage collection** is mark-and-sweep rooted in these wishes: an issue
   that serves no wish and blocks nothing is proposed for closure, history
   intact, and Tom approves the sweep.

## Wishes

### W-BO-1 · invariant · active
**Wish:** This repo is run on the wish-gap system described above. Wishes
authorize outcomes; nothing consequential happens on silence.
**Source:** Tom, chat 2026-10-01 ("I wish that bend-over used the wish gap system").
**Check:** open work traces to a wish; blocked-on-Tom items are focused
issues assigned to @subtleGradient.

### W-BO-2 · invariant · active
**Wish:** This file is the single root wishes file — the source of truth
for repo-level wishes. No copy elsewhere overrides it.
**Source:** Tom, chat 2026-10-01 ("one root wishes file").
**Check:** repo-level direction questions are answered by citing a W-BO wish.

### W-BO-3 · invariant · active
**Wish:** Every package carries its own wishes in `packages/<name>/WISHES.md`,
grounded in what that package actually does.
**Source:** Tom, chat 2026-10-01 ("each package also had their own package specific wishes").
**Check:** `packages/sqlite/WISHES.md`, `packages/js-eval/WISHES.md`,
`packages/browser-io/WISHES.md` exist and are current.

### W-BO-4 · invariant · active
**Wish:** Repeatable workflows live in `skills/`, one folder per skill, each
with a `SKILL.md` (how to do it) and a `WISHES.md` (what "done right" means).
No more random process files at the repo root.
**Source:** Tom, chat 2026-10-01 ("a skills folder and each skill has its own skill specific wishes"; "RELEASING.md should be a skill instead of a random file").
**Check:** `skills/releasing/SKILL.md` exists; root has no process docs.

### W-BO-5 · outcome · active
**Wish:** Releases go through the releasing skill: a package `VERSION` bump
merges to `main`; CI checks macOS and Linux, requires identical archive
checksums on both platforms, publishes by hash, verifies fresh consumers,
and attaches the Hub name. PRs never perform public writes.
**Source:** RELEASING.md (moved to `skills/releasing/`).
**Check:** every `bend-over-*-v*` tag has a matching receipt and identical
cross-platform checksums.

### W-BO-6 · invariant · active
**Wish:** Proofs stay green: `LAWS.bend` keeps the important rules,
`PROOF.bend` fills them, and `bend PROOF.bend` passes before committing.
**Source:** repo AGENTS.md (Tom's standing Bend rule).
**Check:** CI's proof step passes on every merge to main.

### W-BO-7 · invariant · active
**Wish:** Everything built here decomposes into packages others can rely on —
one concern per package, published to BendHub with a `LICENSE` opening
`SPDX-License-Identifier: MIT`.
**Source:** Tom's standing rule (2026-09-30).
**Check:** each package dir has an entrypoint, `VERSION`, `LICENSE`, proofs,
and consumer tests.

### W-BO-8 · invariant · active
**Wish:** Work is tracked as GitHub issues; dependencies are native
blocked-by edges only — no prose relationship sections. A PR approval is
the decision; no separate "approve this PR" issues.
**Source:** Tom's process rules (2026-10-01).
**Check:** issues carry no Blocked-by prose; planning derives from edges.

### W-BO-9 · invariant · active
**Wish:** Public attribution points to Tom (@subtleGradient) for his work.
**Source:** Tom's attribution rule (2026-10-01).
**Check:** package authorship and release credits name the human.
