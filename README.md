# React Compiler + Turbopack: client→client import breaks browser source maps

Minimal reproduction. With `reactCompiler: true`, when a **`'use client'`
component imports another `'use client'` component**, the imported component's
browser source map has its `sourcesContent` set to the **React Compiler output**
(`import { c as _c } from "react/compiler-runtime"`, etc.) instead of the
original file. Because the compiler output is ~2–3× longer than the source,
stack frames resolve to line numbers **past the end of the real file**, so
"open in repo" links (e.g. from Datadog Error Tracking) point to non-existent
lines.

Setting `reactCompiler: false` fixes it.

## Versions

- `next@16.2.6`, `react@19.2.6`, `react-dom@19.2.6`
- `babel-plugin-react-compiler@1.0.0`
- Default bundler (Turbopack), `productionBrowserSourceMaps: true`

## The trigger

The bug needs a **client → client import edge**:

- `app/page.tsx` is `'use client'` and imports…
- `app/widget.tsx`, also `'use client'`, with a hook (so the compiler transforms it).

A single client component (the page itself), or a client component imported by
a **server** component, maps correctly. Only the client-imported-by-client case
breaks. (This is why it shows up all over a large client-heavy app but is easy
to miss in a tiny one.)

## Run

```bash
bun install   # or npm install

REACT_COMPILER=true  bun run build && node inspect-sourcemap.mjs
REACT_COMPILER=false bun run build && node inspect-sourcemap.mjs
```

## Observed output

```
# reactCompiler: true
raw app/widget.tsx lines : 9
sourcesContent lines     : 27
has React Compiler output: true
VERDICT                  : BUG ❌  sourcesContent is the compiler output (line numbers wrong)

# reactCompiler: false
raw app/widget.tsx lines : 9
sourcesContent lines     : 9
has React Compiler output: false
VERDICT                  : OK  ✅  sourcesContent === real file (line numbers correct)
```

## Root cause (hypothesis)

The React Compiler (a Babel pass) transforms the client module and emits an
intermediate source map (transformed → original). Across a client→client import
boundary, Turbopack/SWC does not chain that intermediate map back to the
original source — so the final browser map treats the compiler output as the
"original," and its line numbers/`sourcesContent` are the transformed code.

`reactCompiler: false` removes the extra transform, so the map chains correctly.
