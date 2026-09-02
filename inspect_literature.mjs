import fs from 'fs';

const c = fs.readFileSync('src/pages/admin-tabs/AdminLiteratureTab.tsx', 'utf8');
console.log("AdminLiteratureTab imports:");
console.log(c.slice(0, 1000));
console.log("\nNovelService check:");
const ns = fs.readFileSync('src/services/novelService.ts', 'utf8');
console.log(ns.slice(0, 1000));
