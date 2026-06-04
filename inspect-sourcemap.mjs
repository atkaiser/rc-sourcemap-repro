// Finds the browser source map that contains app/widget.tsx (the imported
// client component) and compares its `sourcesContent` to the real file. If they
// differ — and the content carries React Compiler artifacts (`c as _c`) — the
// map's "original source" is the compiler output, so resolved line numbers
// point past the end of the real file. That is the bug.
import fs from 'node:fs';
import path from 'node:path';

const CHUNKS_DIR = '.next/static/chunks';
const TARGET = 'app/widget.tsx';

const rawSource = fs.readFileSync(TARGET, 'utf8');
const rawLines = rawSource.split('\n').length;

const mapFiles = fs
  .readdirSync(CHUNKS_DIR, { recursive: true })
  .filter((f) => typeof f === 'string' && f.endsWith('.js.map'));

let found = false;
for (const rel of mapFiles) {
  let map;
  try {
    map = JSON.parse(fs.readFileSync(path.join(CHUNKS_DIR, rel), 'utf8'));
  } catch {
    continue;
  }
  const sources = map.sources || [];
  const idx = sources.findIndex((s) => /(^|\/)app\/widget\.tsx$/.test(s));
  if (idx < 0) continue;

  const content = (map.sourcesContent && map.sourcesContent[idx]) || '';
  const scLines = content ? content.split('\n').length : 0;
  const hasCompilerArtifacts = /react\/compiler-runtime|c as _c|_temp\d/.test(
    content,
  );
  const matchesRaw = content === rawSource;

  console.log('map chunk                :', rel);
  console.log('raw app/widget.tsx lines :', rawLines);
  console.log('sourcesContent lines     :', scLines);
  console.log('has React Compiler output:', hasCompilerArtifacts);
  console.log(
    'VERDICT                  :',
    matchesRaw
      ? 'OK  ✅  sourcesContent === real file (line numbers correct)'
      : 'BUG ❌  sourcesContent is the compiler output (line numbers wrong)',
  );
  found = true;
  break;
}

if (!found) {
  console.log(`No source map referencing ${TARGET} found under ${CHUNKS_DIR}`);
  process.exit(1);
}
