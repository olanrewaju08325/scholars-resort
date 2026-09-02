import fs from 'fs';

console.log("=== CHECKING NOVEL FILES ===");
console.log("novelService.ts exists:", fs.existsSync('src/services/novelService.ts'));
console.log("JambNovelHub.tsx exists:", fs.existsSync('src/pages/JambNovelHub.tsx'));
console.log("AdminLiteratureTab.tsx exists:", fs.existsSync('src/pages/admin-tabs/AdminLiteratureTab.tsx'));

console.log("\n=== CHECKING BADGE FILES ===");
console.log("Badges.tsx exists:", fs.existsSync('src/components/Badges.tsx'));
console.log("studentAchievementsService.ts exists:", fs.existsSync('src/services/studentAchievementsService.ts'));
console.log("BadgesAdminTab.tsx exists:", fs.existsSync('src/pages/admin-tabs/BadgesAdminTab.tsx'));

console.log("\n=== CHECKING WEEKLY CHALLENGE FILES ===");
console.log("WeeklyChallenge.tsx exists:", fs.existsSync('src/components/WeeklyChallenge.tsx'));
console.log("WeeklyChallengesAdminTab.tsx exists:", fs.existsSync('src/pages/admin-tabs/WeeklyChallengesAdminTab.tsx'));

console.log("\n=== CHECKING CAREER & COURSE FILES ===");
console.log("CareerGuide.tsx exists:", fs.existsSync('src/pages/CareerGuide.tsx'));
console.log("CourseEligibilityChecker.tsx exists:", fs.existsSync('src/pages/CourseEligibilityChecker.tsx'));
console.log("AcademicTaxonomyHubTab.tsx exists:", fs.existsSync('src/pages/admin-tabs/AcademicTaxonomyHubTab.tsx'));
