import fs from 'fs';

const adminTabs = [
  { id: 1, name: 'Dashboard', file: 'src/pages/admin-tabs/DashboardTab.tsx', type: 'TYPE D — ANALYTICS/OBSERVABILITY' },
  { id: 2, name: 'Analytics', file: 'src/pages/admin-tabs/AnalyticsTab.tsx', type: 'TYPE D — ANALYTICS/OBSERVABILITY' },
  { id: 3, name: 'Student Insights', file: 'src/pages/admin-tabs/StudentInsightsTab.tsx', type: 'TYPE D — ANALYTICS/OBSERVABILITY' },
  { id: 4, name: 'Platform Telemetry', file: 'src/pages/admin-tabs/TelemetryTab.tsx', type: 'TYPE D — ANALYTICS/OBSERVABILITY' },
  { id: 5, name: 'Question Bank & Content Studio', file: 'src/pages/admin-tabs/QuestionBankContentStudioTab.tsx', type: 'TYPE A — CONTENT MANAGEMENT' },
  { id: 6, name: 'Academic Taxonomy Hub', file: 'src/pages/admin-tabs/AcademicTaxonomyHubTab.tsx', type: 'TYPE A — CONTENT MANAGEMENT' },
  { id: 7, name: 'Literature & Novel Hub', file: 'src/pages/admin-tabs/AdminLiteratureTab.tsx', type: 'TYPE A — CONTENT MANAGEMENT' },
  { id: 8, name: 'Resource Library', file: 'src/pages/admin-tabs/MaterialsTab.tsx', type: 'TYPE A — CONTENT MANAGEMENT' },
  { id: 9, name: 'Users Directory', file: 'src/pages/admin-tabs/StudentsTab.tsx', type: 'TYPE B — USER MANAGEMENT' },
  { id: 10, name: 'Support Center', file: 'src/pages/admin-tabs/SupportTab.tsx', type: 'TYPE C — STUDENT-GENERATED DATA' },
  { id: 11, name: 'Correction Queue', file: 'src/pages/admin-tabs/CorrectionQueueTab.tsx', type: 'TYPE C — STUDENT-GENERATED DATA' },
  { id: 12, name: 'CBT Flow Validator', file: 'src/pages/admin-tabs/PlatformHealthTab.tsx', type: 'TYPE F — OPERATIONAL TOOL' },
  { id: 13, name: 'Tournaments', file: 'src/pages/admin-tabs/AdminTournamentsTab.tsx', type: 'TYPE A — CONTENT MANAGEMENT' },
  { id: 14, name: 'Weekly Challenges', file: 'src/pages/admin-tabs/WeeklyChallengesAdminTab.tsx', type: 'TYPE A — CONTENT MANAGEMENT' },
  { id: 15, name: 'Gamification Badges', file: 'src/pages/admin-tabs/BadgesAdminTab.tsx', type: 'TYPE A — CONTENT MANAGEMENT' },
  { id: 16, name: 'AI Command Center', file: 'src/pages/admin-tabs/AICommandCenterTab.tsx', type: 'TYPE E — SYSTEM CONFIGURATION' },
  { id: 17, name: 'Revenue & Sales', file: 'src/pages/admin-tabs/RevenueReportingTab.tsx', type: 'TYPE D — ANALYTICS/OBSERVABILITY' },
  { id: 18, name: 'Payment Transactions', file: 'src/pages/admin-tabs/PaymentsTab.tsx', type: 'TYPE C — STUDENT-GENERATED DATA' },
  { id: 19, name: 'Scholarships', file: 'src/pages/admin-tabs/ScholarshipTab.tsx', type: 'TYPE A/B — BUSINESS MANAGEMENT' },
  { id: 20, name: 'Referrals', file: 'src/pages/admin-tabs/ReferralTab.tsx', type: 'TYPE C/D — BUSINESS OBSERVABILITY' },
  { id: 21, name: 'Announcements', file: 'src/pages/admin-tabs/AnnouncementsTab.tsx', type: 'TYPE A — CONTENT MANAGEMENT' },
  { id: 22, name: 'Bulk Email', file: 'src/pages/admin-tabs/BulkEmailTab.tsx', type: 'TYPE A/E — COMMUNICATION TOOL' },
  { id: 23, name: 'Content Calendar', file: 'src/pages/admin-tabs/ContentCalendarTab.tsx', type: 'TYPE A/F — EDITORIAL PLANNER' },
  { id: 24, name: 'Security & Auth', file: 'src/pages/admin-tabs/SecurityTab.tsx', type: 'TYPE E/F — SYSTEM SECURITY' },
  { id: 25, name: 'Audit Logs', file: 'src/pages/admin-tabs/LogsTab.tsx', type: 'TYPE D/F — SYSTEM LOGS' },
  { id: 26, name: 'System Health', file: 'src/pages/admin-tabs/SystemHealthTab.tsx', type: 'TYPE D/F — SYSTEM OBSERVABILITY' },
  { id: 27, name: 'Platform Monitor', file: 'src/pages/admin-tabs/PlatformHealthTab.tsx', type: 'TYPE F — OPERATIONAL TOOL' },
  { id: 28, name: 'Database Diagnostics', file: 'src/pages/admin-tabs/DatabaseDiagnosticsTab.tsx', type: 'TYPE F — DIAGNOSTIC TOOL' },
  { id: 29, name: 'Database Backups', file: 'src/pages/admin-tabs/BackupsTab.tsx', type: 'TYPE F — OPERATIONAL TOOL' },
  { id: 30, name: 'Environment Cleanup', file: 'src/pages/admin-tabs/EnvironmentCleanupTab.tsx', type: 'TYPE F — OPERATIONAL TOOL' },
  { id: 31, name: 'Settings & Config', file: 'src/pages/admin-tabs/SettingsTab.tsx', type: 'TYPE E — SYSTEM CONFIGURATION' }
];

adminTabs.forEach(t => {
  if (!fs.existsSync(t.file)) {
    console.log(`❌ Missing file: ${t.file}`);
    return;
  }
  const content = fs.readFileSync(t.file, 'utf8');
  const queries = [...new Set([...content.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g)].map(m => m[1]))];
  const apiCalls = [...new Set([...content.matchAll(/fetch\(['"]([^'"]+)['"]/g)].map(m => m[1]))];
  console.log(`[${t.id}] ${t.name.padEnd(30)} | Type: ${t.type.padEnd(32)} | Tables: ${queries.join(', ') || 'None'} | APIs: ${apiCalls.join(', ') || 'None'}`);
});
