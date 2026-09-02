import fs from 'fs';

const studentModules = [
  { name: 'Dashboard', file: 'src/pages/Dashboard.tsx' },
  { name: 'Journey Map', file: 'src/pages/EducationalJourneyMapPage.tsx' },
  { name: 'Adaptive Path', file: 'src/pages/AdaptiveLearningPathPage.tsx' },
  { name: 'Peer Study Rooms', file: 'src/pages/PeerStudyRoomPage.tsx' },
  { name: 'Study Plan', file: 'src/pages/StudyPlan.tsx' },
  { name: 'CBT Exam Center', file: 'src/pages/CBTCenter.tsx' },
  { name: 'Practice Setup', file: 'src/pages/PracticeSetup.tsx' },
  { name: 'Weakness Drill', file: 'src/pages/WeaknessDrill.tsx' },
  { name: 'Flashcards', file: 'src/pages/Flashcards.tsx' },
  { name: 'Weekly Mocks', file: 'src/pages/WeeklyMocks.tsx' },
  { name: 'Tournament Arena', file: 'src/pages/TournamentArena.tsx' },
  { name: 'JAMB Novel Hub', file: 'src/pages/JambNovelHub.tsx' },
  { name: 'Career Guide', file: 'src/pages/CareerGuide.tsx' },
  { name: 'Course Eligibility', file: 'src/pages/CourseEligibilityChecker.tsx' },
  { name: 'Offline Packs', file: 'src/pages/OfflinePackManager.tsx' },
  { name: 'Resource Library', file: 'src/pages/Library.tsx' },
  { name: 'Leaderboard', file: 'src/pages/Leaderboard.tsx' },
  { name: 'My Profile', file: 'src/pages/Profile.tsx' },
  { name: 'Support & Help', file: 'src/pages/Support.tsx' }
];

const adminModules = [
  { name: 'Admin Dashboard', file: 'src/pages/admin-tabs/DashboardTab.tsx' },
  { name: 'Analytics', file: 'src/pages/admin-tabs/AnalyticsTab.tsx' },
  { name: 'Student Insights', file: 'src/pages/admin-tabs/StudentInsightsTab.tsx' },
  { name: 'Platform Telemetry', file: 'src/pages/admin-tabs/TelemetryTab.tsx' },
  { name: 'Question Bank', file: 'src/pages/admin-tabs/QuestionBankTab.tsx' },
  { name: 'Content Studio', file: 'src/pages/admin-tabs/ContentStudioTab.tsx' },
  { name: 'Academic Taxonomy Hub', file: 'src/pages/admin-tabs/AcademicTaxonomyHubTab.tsx' },
  { name: 'Subjects Tab', file: 'src/pages/admin-tabs/SubjectsTab.tsx' },
  { name: 'Syllabus Admin Tab', file: 'src/pages/admin-tabs/SyllabusAdminTab.tsx' },
  { name: 'Literature & Novel Hub', file: 'src/pages/admin-tabs/AdminLiteratureTab.tsx' },
  { name: 'Materials / Resource Library', file: 'src/pages/admin-tabs/MaterialsTab.tsx' },
  { name: 'Users Directory (Students)', file: 'src/pages/admin-tabs/StudentsTab.tsx' },
  { name: 'Support Center', file: 'src/pages/admin-tabs/SupportTab.tsx' },
  { name: 'Correction Queue', file: 'src/pages/admin-tabs/CorrectionQueueTab.tsx' },
  { name: 'Platform Health / Flow Validator', file: 'src/pages/admin-tabs/PlatformHealthTab.tsx' },
  { name: 'Tournaments', file: 'src/pages/admin-tabs/AdminTournamentsTab.tsx' },
  { name: 'Weekly Challenges', file: 'src/pages/admin-tabs/WeeklyChallengesAdminTab.tsx' },
  { name: 'Badges Admin', file: 'src/pages/admin-tabs/BadgesAdminTab.tsx' },
  { name: 'AI Command Center', file: 'src/pages/admin-tabs/AICommandCenterTab.tsx' },
  { name: 'Revenue Reporting', file: 'src/pages/admin-tabs/RevenueReportingTab.tsx' },
  { name: 'Payments', file: 'src/pages/admin-tabs/PaymentsTab.tsx' },
  { name: 'Scholarships', file: 'src/pages/admin-tabs/ScholarshipTab.tsx' },
  { name: 'Referrals', file: 'src/pages/admin-tabs/ReferralTab.tsx' },
  { name: 'Announcements', file: 'src/pages/admin-tabs/AnnouncementsTab.tsx' },
  { name: 'Bulk Email', file: 'src/pages/admin-tabs/BulkEmailTab.tsx' },
  { name: 'Content Calendar', file: 'src/pages/admin-tabs/ContentCalendarTab.tsx' },
  { name: 'Security & Auth', file: 'src/pages/admin-tabs/SecurityTab.tsx' },
  { name: 'Audit Logs', file: 'src/pages/admin-tabs/LogsTab.tsx' },
  { name: 'System Health', file: 'src/pages/admin-tabs/SystemHealthTab.tsx' },
  { name: 'Database Diagnostics', file: 'src/pages/admin-tabs/DatabaseDiagnosticsTab.tsx' },
  { name: 'Database Backups', file: 'src/pages/admin-tabs/BackupsTab.tsx' },
  { name: 'Environment Cleanup', file: 'src/pages/admin-tabs/EnvironmentCleanupTab.tsx' },
  { name: 'Settings & Config', file: 'src/pages/admin-tabs/SettingsTab.tsx' }
];

function analyzeFile(mod) {
  if (!fs.existsSync(mod.file)) {
    return { ...mod, exists: false };
  }
  const content = fs.readFileSync(mod.file, 'utf8');
  
  // Tables queried
  const tableMatches = [...content.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g)].map(m => m[1]);
  const uniqueTables = [...new Set(tableMatches)];

  // LocalStorage / SessionStorage
  const usesLocalStorage = content.includes('localStorage.') || content.includes('sessionStorage.');

  // Math.random
  const usesMathRandom = content.includes('Math.random()');

  // Hardcoded arrays / static imports
  const importsData = content.includes('from \'@/data/') || content.includes('from "@/data/');

  return {
    ...mod,
    exists: true,
    tables: uniqueTables,
    usesLocalStorage,
    usesMathRandom,
    importsData,
    size: content.length
  };
}

console.log("=== STUDENT MODULES ANALYSIS ===");
studentModules.map(analyzeFile).forEach(res => {
  console.log(`${res.name.padEnd(22)} | Tables: ${res.tables.join(', ') || 'NONE'} | LS: ${res.usesLocalStorage} | Rand: ${res.usesMathRandom} | DataImports: ${res.importsData}`);
});

console.log("\n=== ADMIN MODULES ANALYSIS ===");
adminModules.map(analyzeFile).forEach(res => {
  console.log(`${res.name.padEnd(30)} | Tables: ${res.tables.join(', ') || 'NONE'} | LS: ${res.usesLocalStorage} | Rand: ${res.usesMathRandom} | DataImports: ${res.importsData}`);
});
