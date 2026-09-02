import fs from 'fs';

const adminPage = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
console.log("=== ADMIN.TSX TABS AND SIDEBAR NAVIGATION ===");
const tabMatches = [...adminPage.matchAll(/id:\s*['"]([^'"]+)['"],\s*label:\s*['"]([^'"]+)['"]/g)];
tabMatches.forEach((m, idx) => console.log(`${idx + 1}. Tab ID: ${m[1].padEnd(25)} | Label: ${m[2]}`));

console.log("\n=== COMPONENT IMPORTS IN ADMIN.TSX ===");
const importMatches = adminPage.split('\n').filter(l => l.includes('import ') && l.includes('admin-tabs'));
importMatches.forEach(i => console.log(i));
