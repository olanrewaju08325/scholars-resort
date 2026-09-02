import fs from 'fs';

const sqlFiles = fs.readdirSync('.').filter(f => f.endsWith('.sql'));
console.log("SQL files found:", sqlFiles);
sqlFiles.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes('profiles') && c.includes('POLICY')) {
    console.log(`\n=== RLS Policies in ${f} ===`);
    const lines = c.split('\n').filter(l => l.toLowerCase().includes('policy') || l.includes('profiles'));
    console.log(lines.slice(0, 15).join('\n'));
  }
});
