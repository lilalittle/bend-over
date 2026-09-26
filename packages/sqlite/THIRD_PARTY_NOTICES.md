# Third-party components

- `@sqlite.org/sqlite-wasm` 3.53.4-build1 is the official npm wrapper maintained
  at https://github.com/sqlite/sqlite-wasm and declares Apache-2.0 licensing.
  License text: https://www.apache.org/licenses/LICENSE-2.0
- SQLite C and the SQLite-authored Wasm APIs are public domain:
  https://sqlite.org/copyright.html
- The generated Wasm JavaScript loader contains Emscripten code under MIT and
  University of Illinois/NCSA terms:
  https://emscripten.org/docs/introducing_emscripten/emscripten_license.html

The browser build copies the upstream JavaScript and Wasm without rewriting them.
The JavaScript file retains the upstream license header and SQLite blessing.
The package's own code is MIT-0 as stated in LICENSE. The release archive also
includes full Apache-2.0 and Emscripten license texts under licenses/. These
third-party components retain their original terms.
