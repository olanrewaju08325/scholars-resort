import fs from 'fs';
import path from 'path';

function listAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== '.git' && item.name !== 'dist') {
        results = results.concat(listAllFiles(fullPath));
      }
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

const all = listAllFiles('.');
console.log("Novel files:", all.filter(f => f.toLowerCase().includes('novel')));
console.log("Badge files:", all.filter(f => f.toLowerCase().includes('badge')));
console.log("Career files:", all.filter(f => f.toLowerCase().includes('career')));
console.log("Eligibility files:", all.filter(f => f.toLowerCase().includes('eligibility')));
console.log("Services:", all.filter(f => f.includes('services') || f.includes('service')));
