import fs from 'fs';

console.log("CareerGuide.tsx snippet:");
const cg = fs.readFileSync('src/pages/CareerGuide.tsx', 'utf8');
console.log(cg.slice(0, 800));

console.log("\nCourseEligibilityChecker.tsx snippet:");
const cec = fs.readFileSync('src/pages/CourseEligibilityChecker.tsx', 'utf8');
console.log(cec.slice(0, 800));
