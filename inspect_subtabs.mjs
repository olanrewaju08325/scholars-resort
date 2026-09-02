import fs from 'fs';

console.log("=== QuestionBankContentStudioTab.tsx ===");
const qbcs = fs.readFileSync('src/pages/admin-tabs/QuestionBankContentStudioTab.tsx', 'utf8');
console.log(qbcs.slice(0, 600));

console.log("\n=== AcademicTaxonomyHubTab.tsx ===");
const ath = fs.readFileSync('src/pages/admin-tabs/AcademicTaxonomyHubTab.tsx', 'utf8');
console.log(ath.slice(0, 600));

console.log("\n=== AICommandCenterTab.tsx ===");
const aic = fs.readFileSync('src/pages/admin-tabs/AICommandCenterTab.tsx', 'utf8');
console.log(aic.slice(0, 600));
