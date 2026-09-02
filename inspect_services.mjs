import fs from 'fs';

const filesToInspect = [
  'src/services/educationalJourneyService.ts',
  'src/services/adaptiveLearningPathService.ts',
  'src/services/novelService.ts',
  'src/pages/CareerGuide.tsx',
  'src/pages/CourseEligibilityChecker.tsx',
  'src/data/jambNovelsData.ts',
  'src/services/studentAchievementsService.ts',
  'src/services/systemUsageLimitService.ts',
  'src/pages/admin-tabs/WeeklyChallengesAdminTab.tsx',
  'src/pages/admin-tabs/SyllabusAdminTab.tsx',
  'src/pages/admin-tabs/AdminLiteratureTab.tsx',
  'src/pages/admin-tabs/BadgesAdminTab.tsx'
];

filesToInspect.forEach(f => {
  if (fs.existsSync(f)) {
    const c = fs.readFileSync(f, 'utf8');
    const tableMatches = [...c.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g)].map(m => m[1]);
    const uniqueTables = [...new Set(tableMatches)];
    const hasLS = c.includes('localStorage.') || c.includes('sessionStorage.');
    const hasMR = c.includes('Math.random()');
    console.log(`=== ${f} ===`);
    console.log(`Tables: ${uniqueTables.join(', ') || 'NONE'}`);
    console.log(`Uses LS: ${hasLS}, Uses Math.random: ${hasMR}`);
    console.log(`Lines: ${c.split('\n').length}, Size: ${c.length} bytes\n`);
  }
});
