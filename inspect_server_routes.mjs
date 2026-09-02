import fs from 'fs';

const serverCode = fs.readFileSync('server.ts', 'utf8');
console.log("=== SERVER.TS ROUTES ===");
const routeMatches = [...serverCode.matchAll(/app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g)];
routeMatches.forEach(m => console.log(`${m[1].toUpperCase().padEnd(6)} ${m[2]}`));

console.log("\n=== TOTAL SERVER CODE LINES ===", serverCode.split('\n').length);
