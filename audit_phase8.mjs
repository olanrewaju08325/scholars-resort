import fs from 'fs';
import path from 'path';

function searchPatterns() {
  const codeFiles = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      codeFiles.push(dir);
      return;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (['node_modules', '.git', 'dist', '.temp'].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (['.ts', '.tsx', '.js', '.mjs'].some(ext => e.name.endsWith(ext))) {
        codeFiles.push(full);
      }
    }
  }
  walk('./src');
  walk('./server.ts');

  console.log(`Total code files scanned: ${codeFiles.length}`);

  const mathRandomHits = [];
  const localStorageHits = [];
  const fallbackPatterns = [];

  codeFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      if (line.includes('Math.random()')) {
        mathRandomHits.push({ file, lineNum, line: line.trim() });
      }
      if (line.includes('localStorage.') || line.includes('sessionStorage.')) {
        localStorageHits.push({ file, lineNum, line: line.trim() });
      }
      if (line.match(/fallback/i) || line.match(/mock/i) || line.match(/demo/i)) {
        if (!file.includes('audit') && !file.includes('test')) {
          fallbackPatterns.push({ file, lineNum, line: line.trim() });
        }
      }
    });
  });

  console.log(`\n=== Math.random() Hits: ${mathRandomHits.length} ===`);
  mathRandomHits.forEach(h => console.log(`${h.file}:${h.lineNum} -> ${h.line}`));

  console.log(`\n=== localStorage / sessionStorage Hits: ${localStorageHits.length} ===`);
  localStorageHits.forEach(h => console.log(`${h.file}:${h.lineNum} -> ${h.line}`));

  console.log(`\n=== Fallback / Mock / Demo Patterns Total: ${fallbackPatterns.length} ===`);
  fallbackPatterns.slice(0, 30).forEach(h => console.log(`${h.file}:${h.lineNum} -> ${h.line}`));
}

searchPatterns();
