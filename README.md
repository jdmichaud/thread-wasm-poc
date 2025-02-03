# Notes

## Resources:
 - https://web.dev/articles/webassembly-threads

## Feature detection

To detect thread support, the function `detectThreadSupport`:
- Checks that `MessageChannel` exists and can send a message with an `SharedArrayBuffer`.
- Loads a wasm module containing an atomic instruction.

The wasm module is compiled with wat2wasm using the `--enable-thread` flag.

In order for `SharedArrayBuffer` API to be available, the server must include
the following header in the response of the main document:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

## Modules

Loading the worker with a local URL that depends on the URL of the caller script
allows bundler to optimize the package[^1]. Make your main script a module:
```html
<script type="module" src="main.js"></script>
```
When creating the Worker, pass a URL with the module url as option:
```js
const worker = new Worker(new URL('worker.js', import.meta.url), { type: 'module' });
```

The worker itself, will be loaded as a module thanks to the option `{ type: 'module' }`.
It means that it can import other Javascript modules with an import statement.

## Shared memory

In order to share memory with the wasm module, you need a few things:
- When instantiating the module in javascript, include an `env` field in the
  import object which itself must contain the `memory` field containing the
  `WebAssembly.Memory`.
- When creating the `WebAssembly.Memory`, it must be created with the
  `shared` option.
- The wasm source must be compiled with a few options (for cland and the equivalent
  with other compilers):
  - `--import-memory`
  - `-matomics`
  - `-mbulk-memory`
- The module must be linked with a few options (for ldd and the equivalent with
  other linkers):
  - `--import-memory`
  - `--shared-memory`
  - `--max-memory=value`: value must be 65536-byte aligned and greater than the
  size of the `WebAssembly.Memory` object.

⚠️ The memory limits set when creating the `WebAssembly.Memory` object must
match the compilation parameters of the wasm module. `WebAssembly.Memory`
constructor parameters are in "pages" and each page is 64K. Whereas the compiler
parameters will most probably be in byte. So for example:
```js
new WebAssembly.Memory({ initial: 131072 / 65536, maximum: 131072 / 65536, shared: true }),
```
will initialize an object with an initial amount of 2 pages and a max of 2 pages.
When compiling, the ld options are going to be:
```bash
-Wl,--initial-memory=131072,--max-memory=131072
```
Note that the initial memory might be constraints by the module itself.

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker#parameters
