import fs from 'fs';

function checkFile(path, name) {
  if (!fs.existsSync(path)) return null;
  const content = fs.readFileSync(path, 'utf8');
  return {
    name,
    path,
    tables: [...new Set([...content.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g)].map(m => m[1]))],
    lsKeys: [...content.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(['"]([^'"]+)['"]/g)].map(m => m[1]),
    mathRandom: [...content.matchAll(/Math\.random\(\)/g)].length,
    hardcodedMatches: content.includes('mock') || content.includes('dummy') || content.includes('demo') || content.includes('fallback')
  };
}

const files = [
  ['src/pages/admin-tabs/WeeklyChallengesAdminTab.tsx', 'Admin Weekly Challenges'],
  ['src/pages/admin-tabs/BadgesAdminTab.tsx', 'Admin Badges'],
  ['src/pages/admin-tabs/SyllabusAdminTab.tsx', 'Admin Syllabus / Taxonomy'],
  ['src/pages/admin-tabs/SubjectsTab.tsx', 'Admin Subjects'],
  ['src/pages/admin-tabs/MaterialsTab.tsx', 'Admin Resource Library / Materials'],
  ['src/pages/admin-tabs/AdminLiteratureTab.tsx', 'Admin Literature Hub'],
  ['src/pages/admin-tabs/QuestionBankTab.tsx', 'Admin Question Bank'],
  ['src/pages/admin-tabs/ContentStudioTab.tsx', 'Admin Content Studio'],
  ['src/pages/admin-tabs/StudentsTab.tsx', 'Admin Users Directory'],
  ['src/pages/admin-tabs/SupportTab.tsx', 'Admin Support Center'],
  ['src/pages/admin-tabs/CorrectionQueueTab.tsx', 'Admin Correction Queue'],
  ['src/pages/admin-tabs/AdminTournamentsTab.tsx', 'Admin Tournaments'],
  ['src/pages/admin-tabs/AICommandCenterTab.tsx', 'Admin AI Command Center'],
  ['src/pages/admin-tabs/RevenueReportingTab.tsx', 'Admin Revenue & Sales'],
  ['src/pages/admin-tabs/PaymentsTab.tsx', 'Admin Payments'],
  ['src/pages/admin-tabs/ScholarshipTab.tsx', 'Admin Scholarships'],
  ['src/pages/admin-tabs/ReferralTab.tsx', 'Admin Referrals'],
  ['src/pages/admin-tabs/AnnouncementsTab.tsx', 'Admin Announcements'],
  ['src/pages/admin-tabs/BulkEmailTab.tsx', 'Admin Bulk Email'],
  ['src/pages/admin-tabs/ContentCalendarTab.tsx', 'Admin Content Calendar'],
  ['src/pages/admin-tabs/SecurityTab.tsx', 'Admin Security & Auth'],
  ['src/pages/admin-tabs/LogsTab.tsx', 'Admin Audit Logs'],
  ['src/pages/admin-tabs/SystemHealthTab.tsx', 'Admin System Health'],
  ['src/pages/admin-tabs/DatabaseDiagnosticsTab.tsx', 'Admin DB Diagnostics'],
  ['src/pages/admin-tabs/BackupsTab.tsx', 'Admin Backups'],
  ['src/pages/admin-tabs/EnvironmentCleanupTab.tsx', 'Admin Env Cleanup'],
  ['src/pages/admin-tabs/SettingsTab.tsx', 'Admin Settings'],
  ['src/pages/admin-tabs/DashboardTab.tsx', 'Admin Dashboard'],
  ['src/pages/admin-tabs/AnalyticsTab.tsx', 'Admin Analytics'],
  ['src/pages/admin-tabs/StudentInsightsTab.tsx', 'Admin Student Insights'],
  ['src/pages/admin-tabs/TelemetryTab.tsx', 'Admin Platform Telemetry'],
  ['src/pages/CareerGuide.tsx', 'Student Career Guide'],
  ['src/pages/CourseEligibilityChecker.tsx', 'Student Course Eligibility'],
  ['src/pages/Flashcards.tsx', 'Student Flashcards'],
  ['src/pages/WeaknessDrill.tsx', 'Student Weakness Drill'],
  ['src/pages/WeeklyMocks.tsx', 'Student Weekly Mocks'],
  ['src/pages/TournamentArena.tsx', 'Student Tournament Arena'],
  ['src/pages/OfflinePackManager.tsx', 'Student Offline Packs'],
  ['src/pages/Library.tsx', 'Student Resource Library'],
  ['src/pages/Leaderboard.tsx', 'Student Leaderboard'],
  ['src/pages/JambNovelHub.tsx', 'Student JAMB Novel Hub'],
  ['src/pages/CBTCenter.tsx', 'Student CBT Center'],
  ['src/pages/PracticeSetup.tsx', 'Student Practice Setup'],
  ['src/pages/StudyPlan.tsx', 'Student Study Plan'],
  ['src/pages/EducationalJourneyMapPage.tsx', 'Student Journey Map'],
  ['src/pages/AdaptiveLearningPathPage.tsx', 'Student Adaptive Path'],
  ['src/pages/PeerStudyRoomPage.tsx', 'Student Peer Study Rooms']
];

files.forEach(([p, n]) => {
  const res = checkFile(p, n);
  if (res) {
    console.log(`=== ${res.name} (${res.path}) ===`);
    console.log(`  Tables: ${res.tables.join(', ') || 'NONE'}`);
    console.log(`  LocalStorage Keys: ${res.lsKeys.join(', ') || 'NONE'}`);
    console.log(`  Math.random count: ${res.mathRandom}`);
    console.log(`  Contains fallback/mock flags: ${res.hardcodedMatches}\n`);
  }
});
