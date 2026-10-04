# Wishes for the `releasing` skill

Skill-specific wishes: what "a release done right" means. Parent:
[root WISHES.md](../../WISHES.md). Changes need Tom's (@subtleGradient)
recorded approval via PR.

### W-BO-REL-1 · invariant · active
**Wish:** Names and versions are immutable release coordinates. `VERSION`
holds four numbers; it is edited explicitly when any published file or
archive content changes (Bend APIs, host files, docs, licenses, examples,
generated companions). Unrelated repo changes never force a bump.
**Source:** releasing skill ("Names and versions are immutable release coordinates").
**Check:** no release tag's content differs from what its `VERSION` names.

### W-BO-REL-2 · invariant · active
**Wish:** CI is the normal release path: it checks macOS **and** Linux,
builds and tests the downloadable archives, and requires **identical
archive checksums on both platforms** before anything is published.
**Source:** releasing skill.
**Check:** every release's receipt shows matching SHA-256 across platforms.

### W-BO-REL-3 · invariant · active
**Wish:** The release check performs **no public writes**. Pull requests
never receive the BendHub credential; only the publishing job on `main`
restores it, and removes the temporary file afterward. Credentials never
appear in issues, logs, or commits.
**Source:** releasing skill ("It performs no public writes"; publishing setup).
**Check:** a PR run leaves no Hub-side trace; secrets appear in no log.

### W-BO-REL-4 · invariant · active
**Wish:** Publishing is serialized and reconciled against remote state:
identical existing content is verified and skipped, changed content under
an existing version fails (bump `VERSION`), and interrupted uploads resume
by reading remote state — never by blindly duplicating writes.
**Source:** releasing skill ("Retry and recovery").
**Check:** rerunning a failed publish converges instead of duplicating.

### W-BO-REL-5 · invariant · active
**Wish:** Every release records a machine-readable receipt: source commit,
Hub hash, toolchain, dependency hashes, and asset SHA-256 — embedded in
the GitHub release description and kept in the workflow artifact.
**Source:** releasing skill ("What a release contains").
**Check:** `shasum -a 256 -c SHA256SUMS` passes on a downloaded archive;
the receipt names the exact source commit.

### W-BO-REL-6 · invariant · active
**Wish:** The compiler used in release automation is pinned
(`toolchain.json`: Bend binaries by checksum, compiler source by commit and
checksum). No moving installer in release automation.
**Source:** releasing skill ("Do not use a moving compiler installer").
**Check:** a release built today rebuilds byte-identically tomorrow.
