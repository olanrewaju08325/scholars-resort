import fs from 'fs';

// 1. Check Hardcoded Data files
const hardcodedFindings = [];

// CareerGuide.tsx
if (fs.existsSync('src/pages/CareerGuide.tsx')) {
  const c = fs.readFileSync('src/pages/CareerGuide.tsx', 'utf8');
  if (c.includes('CAREER_CATEGORIES') || c.includes('CAREERS =') || c.includes('const careers')) {
    hardcodedFindings.push({ file: 'src/pages/CareerGuide.tsx', desc: 'Hardcoded career paths, cut-off marks, and course advice arrays.' });
  }
}

// CourseEligibilityChecker.tsx
if (fs.existsSync('src/pages/CourseEligibilityChecker.tsx')) {
  const c = fs.readFileSync('src/pages/CourseEligibilityChecker.tsx', 'utf8');
  if (c.includes('INSTITUTIONS') || c.includes('COURSES') || c.includes('ELIGIBILITY')) {
    hardcodedFindings.push({ file: 'src/pages/CourseEligibilityChecker.tsx', desc: 'Hardcoded universities, polytechnics, colleges, and JAMB subject combination requirements.' });
  }
}

// jambNovelsData.ts
if (fs.existsSync('src/data/jambNovelsData.ts')) {
  const c = fs.readFileSync('src/data/jambNovelsData.ts', 'utf8');
  hardcodedFindings.push({ file: 'src/data/jambNovelsData.ts', desc: 'Hardcoded DEFAULT_JAMB_BOOKS (The Life Changer, Sweet Sixteen) used as fallback for Literature/Novel Hub.' });
}

// Badges.tsx / BadgesAndAchievements.tsx
if (fs.existsSync('src/components/Badges.tsx')) {
  const c = fs.readFileSync('src/components/Badges.tsx', 'utf8');
  hardcodedFindings.push({ file: 'src/components/Badges.tsx', desc: 'Static BADGE_DEFINITIONS array hardcoded in frontend component.' });
}

// subjectTaxonomy.ts
if (fs.existsSync('src/utils/subjectTaxonomy.ts')) {
  hardcodedFindings.push({ file: 'src/utils/subjectTaxonomy.ts', desc: 'CANONICAL_SYLLABUS_DETAILS (69 topics) defined in code instead of fully loaded in Supabase topics table.' });
}

console.log("=== HARDCODED DATA FINDINGS ===");
console.log(JSON.stringify(hardcodedFindings, null, 2));

