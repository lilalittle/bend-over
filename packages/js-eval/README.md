# JavaScript evaluation for Bend

Evaluate a Bend `String` as JavaScript and get a typed JSON value back.
Version `0.1.0.0`, released as `bend-over-js-eval` on BendHub.
The package carries an explicit MIT-0 license.

```python
import Base
import bend-over-js-eval@0.1.0.0/js.bend as JS
import bend-kit-json@0.3.0.0/json.bend as Json

def show(result: Result<&2, &2, String, Json.Val>) -> IO(Unit):
  match result:
    case Done{value}:
      IO.print(Json.encode(value))
    case Fail{message}:
      IO.print(message)

def main() -> IO(Unit):
  do IO<Unit>:
    result : Result<&2, &2, String, Json.Val> <- JS.eval("({answer: 6 * 7})")
    show(result)
```

For local development, use `import ./packages/js-eval/js.bend as JS` from the
repository root. The included [`example.bend`](example.bend) uses `./js.bend`.
Release receipts include the immutable hash import alternative. See
[release instructions](../../RELEASING.md) and
[downloads](https://github.com/subtleGradient/bend-over/releases/tag/bend-over-js-eval-v0.1.0.0).

## API

```python
def eval(source: String) -> IO(Result<&2, &2, String, Json.Val>)
def eval_json(source: String) -> IO(Result<&2, &2, String, String>)
```

`eval` evaluates once, serializes the completion value with `JSON.stringify`,
and parses the JSON text with `bend-kit-json@0.3.0.0`. Successful values are
`Done{Json.Val}`; errors are `Fail{message}`. `eval_json` is the lower-level
effect and returns the serialized text without parsing it in Bend.

This is **synchronous indirect JavaScript eval in the host's global scope**.
Expressions and statement sequences work; an object literal needs parentheses,
as in `"({answer: 42})"`. The host may be Bun or a browser running the compiled
Bend program. The code can access that host's globals and perform side effects.
It is intended for trusted code, has no sandbox or timeout, and does not roll
back effects when evaluation or serialization fails. Browser CSP must permit
dynamic evaluation; a CSP rejection becomes `Fail`.

## Results and errors

| JavaScript result | Bend result |
| --- | --- |
| `null`, booleans, finite numbers, strings, arrays, objects | `Done` with the corresponding JSON value |
| Syntax error or thrown value | `Fail` beginning with `eval:` |
| Top-level `undefined`, function, or symbol | `Fail` beginning with `serialize:` |
| BigInt, circular object, throwing getter / `toJSON` | `Fail` beginning with `serialize:` |
| Promise or thenable | `Fail` beginning with `serialize:`; it is not awaited |
| Invalid JSON received from the host effect | `Fail` beginning with `decode:` |

Standard `JSON.stringify` rules apply, including `toJSON`: undefined/function/
symbol object fields are omitted, those array entries become `null`, non-finite
numbers become `null`, and negative zero becomes zero. This is a JSON snapshot,
not a live JS reference; prototypes, functions, Map/Set contents, and identity
are not preserved. JS numbers already have JavaScript's precision before they
reach `Json.Num` (which retains the serialized number text).

Thrown values with an unprintable message still become `Fail`. Rejected Promise
results get a rejection handler so an unsupported result does not become an
unhandled rejection; this does not cancel asynchronous work already started by
the evaluated code. Exception text after the prefix is engine-dependent.

## Run and verify

From the repository root, with Bend 2.0.29 and Bun installed:

```sh
BEND_LIB="$PWD/.cache/bend" bend packages/js-eval/example.bend
BEND_LIB="$PWD/.cache/bend" bend packages/js-eval/PROOF.bend
bun test tests/unit/js-eval.test.ts
```

The first command prints a JSON object with `answer: 42`. A normal Bend run
uses the JS target. An explicit JS build also works:

```sh
BEND_LIB="$PWD/.cache/bend" bend packages/js-eval/example.bend -o /tmp/bend-js-eval-example.js
bun /tmp/bend-js-eval-example.js
```

Bend fetches and verifies the pinned JSON package on the first run. Its resolved
hub hash is `0xaaa10a97bf5ac6990143da2c863f8a3f`. `BEND_LIB` keeps the dependency
cache in this repository; omit it to use Bend's normal user cache. Tests honor
`BEND_SOURCE` for the compiler checkout, as described in the root README.

The tests compile an actual Bend consumer, evaluate JavaScript, and encode the
returned `Json.Val` back in Bend. They cover value conversion, errors, reuse
after failure, global scope, single evaluation, and the official JS runtime.
[`LAWS.bend`](LAWS.bend) / [`PROOF.bend`](PROOF.bend) prove that the pure decoding
layer preserves host errors and parsed values and rejects a failed parse. They
do not prove the behavior of the JavaScript host.

## Later: a C backend

There is deliberately no `.c` implementation yet. Native compilation fails
with Bend's missing-C-import diagnostic. The existing boundary is ready for one:

1. Add a C import alongside `eval.js` in `eval_json`.
2. Evaluate the input source in a JavaScript engine, such as JavaScriptCore.
3. Return either `Done{json_text}` or `Fail{message}`, matching the synchronous
   completion-value and serialization contract above.
4. Keep JSON parsing in Bend and run the same conformance cases against both
   backends. Context lifetime and available globals need an explicit decision
   for an embedded engine; browser globals are not supplied automatically.

No browser adapter or `browserHost` object is needed by this package. In the
existing web demo's sequential runner, `eval_json` is just another registered
effect returning an ordinary Bend `Result` constructor.
