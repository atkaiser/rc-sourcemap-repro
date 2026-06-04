# Title

React Compiler + Turbopack: client→client import produces a browser source map whose `sourcesContent` is the compiler output (wrong line numbers)

# Which area(s) are affected?

Turbopack, SWC, React Compiler, Output (sourcemaps)

# Link to the code that reproduces this issue

<paste your repro repo / sandbox link here>

# Description

When `reactCompiler` is enabled and `productionBrowserSourceMaps: true`, a
**`'use client'` component that is imported by another `'use client'`
component** produces a browser source map whose `sourcesContent` for that
module is the **React Compiler output** (it begins with
`import { c as _c } from "react/compiler-runtime"` and contains hoisted
`_temp` helpers), not the original source file.

Because the compiler output is 2–3× longer than the source, every stack frame
resolves to a line number **past the end of the real file**. Any source-map
consumer (browser devtools "original source", error trackers such as Datadog /
Sentry, and the "open in repository" deep links they generate) then points at
non-existent lines.

Setting `reactCompiler: false` makes the source map correct again, so the
extra (compiler) transform's map is not being chained back to the original
source across the client→client import boundary.

The bug specifically requires a **client → client import edge**:

- a single `'use client'` component (e.g. the page itself), or
- a `'use client'` component imported by a **server** component

…both map correctly. Only "client component imported by a client component"
breaks. (This is easy to miss in a tiny app but affects most modules in a
large client-heavy one.)

# Minimal reproduction

`next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  productionBrowserSourceMaps: true,
};
export default nextConfig;
```

`app/page.tsx` — a client component that imports another client component

```tsx
'use client';
import Widget from './widget';

export default function Page() {
  return (
    <main>
      <h1>repro</h1>
      <Widget />
    </main>
  );
}
```

`app/widget.tsx` — the imported client component (9 lines)

```tsx
'use client';
import { useState } from 'react';

export default function Widget() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

Then:

```bash
next build
# inspect .next/static/chunks/*.js.map for the entry whose `sources`
# includes app/widget.tsx and read its `sourcesContent`
```

# Current vs. Expected behavior

**Current** (`reactCompiler: true`): the map entry for `app/widget.tsx` has
`sourcesContent` = **27 lines** of React Compiler output (contains
`import { c as _c } from "react/compiler-runtime"`). Stack frames resolve to
lines that don't exist in the 9-line source.

**Expected**: `sourcesContent` should be the original 9-line `app/widget.tsx`,
with line numbers mapping back to the real source — which is exactly what
happens with `reactCompiler: false` (`sourcesContent` = 9 lines, identical to
the file).

| `reactCompiler` | `app/widget.tsx` `sourcesContent` | line numbers |
| --- | --- | --- |
| `true`  | 27 lines (compiler output, `c as _c`) | wrong |
| `false` | 9 lines (= the real file) | correct |

# Provide environment information

```
Operating System: macOS
Binaries:
  Node: 24.x
  npm/bun: bun 1.3.x
Relevant Packages:
  next: 16.2.6
  react: 19.2.6
  react-dom: 19.2.6
  babel-plugin-react-compiler: 1.0.0
Bundler: Turbopack (default)
```

<replace with the output of `next info`>

# Additional context

- Repro is deterministic on a clean install; `next build` only (not dev).
- `cacheComponents`, custom Turbopack loaders, `transpilePackages`, and app
  scale are **not** required — the only ingredients are `reactCompiler: true`,
  `productionBrowserSourceMaps: true`, and a client→client import edge.
- Hypothesis: the React Compiler (Babel pass) emits an intermediate
  source map (compiler-output → original), but across the client→client import
  boundary Turbopack/SWC does not consume that as an `inputSourceMap` and chain
  it, so the final browser map treats the compiler output as the original
  source. Compare swc-project/swc#4097 ("`sourcesContent` in `inputSourceMap`
  not used in some cases").
