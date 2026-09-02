import fs from 'fs';
import path from 'path';

function searchFiles(dir, keyword) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const fullPath = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name !== 'node_modules' && f.name !== '.git' && f.name !== 'dist') {
        searchFiles(fullPath, keyword);
      }
    } else if (f.isFile() && (f.name.endsWith('.ts') || f.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        console.log(`Found "${keyword}" in ${fullPath}`);
      }
    }
  }
}

console.log("=== Searching for weekly_challenges ===");
searchFiles('src', 'weekly_challenges');
searchFiles('server.ts' ? '.' : 'src', 'weekly_challenges');

console.log("\n=== Searching for WeeklyChallenge ===");
searchFiles('src', 'WeeklyChallenge');
searchFiles('src', 'weekly-challenge');
