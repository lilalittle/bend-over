# Bend browser experiments

A working web demo of **Bend 2 calling JavaScript effects**. Type a message,
choose a color and delay, and run a real compiled Bend program. The page shows
the source and a live trace of arguments, return values, failures, and timings.

## Run

Requires [Bun](https://bun.sh) and the Bend source checkout linked at `.refs/bend`.
There are no npm dependencies.

```sh
bun run dev
```

Open **http://127.0.0.1:3000**. The command checks and compiles Bend, then serves
the generated static files. After editing source, restart it to rebuild.
Use `PORT=3001 bun run dev` for another port.

The existing `.refs/bend` symlink points outside this repository. On a fresh
machine, supply a compiler checkout with `BEND_SOURCE`:

```sh
git clone https://github.com/bendlang/bend.git /tmp/bend-effects-compiler
git -C /tmp/bend-effects-compiler checkout 574b6d39a235b539eb19a5c532993a0abb3d11ad
BEND_SOURCE=/tmp/bend-effects-compiler bun run dev
```

Tested with Bun 1.4.2 and Bend 2.0.29 at that revision. The adapter uses compiler
internals; keep this revision pinned when reproducing the demo.

## Try it

1. Change the message, select a color, and click **Run effects**.
2. Watch the fetched hue and message cross into the DOM effect, then the timer
   finish before the message is saved to `localStorage`.
3. Reload: the last saved signal persists. **Clear** removes only this demo's key.
4. Enable **Simulate a failed fetch**. The real request receives a 404 and the
   sequence stops before painting or saving. Disable it to recover.
5. Switch source tabs to inspect the actual build inputs, or copy a whole file.

The palette is a same-origin JSON file, so no third-party API or key is needed.
Only the optional Inter font stylesheet uses an external request; system fonts
work when it is unavailable.

## How it works

- [`main.bend`](demos/js-effects/main.bend) sequences typed `IO` effects and
  branches on the storage result.
- [`web.bend`](demos/js-effects/web.bend) declares the foreign effect signatures.
- [`effects.js`](demos/js-effects/effects.js) registers JavaScript handlers using
  Bend's `io_eff` and compiler-resolved constructor IDs.
- [`host.js`](demos/js-effects/web/host.js) implements the browser operations:
  `fetch`, DOM callbacks, `setTimeout`, and `localStorage`.
- [`runner.js`](packages/browser-io/runner.js) resumes each compiled continuation
  only after its handler returns. Each run has its own host and effect registry.
- [`build.ts`](scripts/build.ts) loads and checks the Bend program, uses the
  compiler's `js_lib` output, and emits a static ES module. It does not rewrite
  generated source or evaluate strings in the browser.

[`LAWS.bend`](demos/js-effects/LAWS.bend) and
[`PROOF.bend`](demos/js-effects/PROOF.bend) establish the pure part of storage
reporting: `False` produces the unavailable-storage message and `True` the
saved message. The JavaScript-to-Bend boolean conversion is covered separately
by the compiled integration tests.

The JavaScript target represents Bend `String`, `U32`, and `Bool` with JavaScript
strings, numbers, and booleans. `Unit` is a tagged constructor. The integration
tests cover those conversions, including `False` selecting the storage-error
branch in Bend.

This is a **small sequential browser IO adapter**, not Bend's native event loop.
Promise-returning effects are an adapter extension. Native parked effects,
file descriptors, `IO.spawn`, and channels are not implemented. The browser
logic is JavaScript and is not covered by Bend proof guarantees. See the
[upstream effects guide](https://github.com/bendlang/bend/blob/main/guide/EFFECTS.md)
for the native effect interface.

## Build and check

```sh
bun test           # compiles Bend and exercises the actual generated module
bend demos/js-effects/PROOF.bend  # verify both storage-reporting laws
bun run build     # produces dist/, suitable for any static web host
bun start         # serves the existing build; no compilation
```

`BEND_SOURCE` also applies to tests and builds. Tests exercise value passing,
async effect ordering, network rejection, the unavailable-storage branch,
and isolation between concurrent runs. Serve `dist/` over HTTP rather than
opening `index.html` with a `file:` URL, so modules and JSON fetches work.

The UI supports keyboard submission, arrow-key source tabs, narrow viewports,
and reduced-motion preferences. Source, messages, and trace values are rendered
as text, never interpreted as user-provided HTML.
