import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const tables = [
    'subjects', 'topics', 'questions', 'exam_sessions', 'session_answers',
    'profiles', 'flashcards', 'mock_exams', 'tournaments', 'tournament_participants',
    'weekly_challenges', 'badges', 'user_badges', 'support_tickets', 'ticket_replies',
    'reported_errors', 'announcements', 'admin_settings', 'admin_backups',
    'library_materials', 'materials', 'discount_codes', 'referrals',
    'manual_payments', 'subscriptions', 'activity_logs', 'device_sessions',
    'ai_usage', 'platform_config', 'platform_error_logs', 'communication_logs'
  ];

  console.log("Checking table existence and row counts in live Supabase:");
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`❌ ${table.padEnd(25)} : ERROR (${error.message})`);
      } else {
        console.log(`✅ ${table.padEnd(25)} : ${count} rows`);
      }
    } catch (e) {
      console.log(`⚠️ ${table.padEnd(25)} : EXCEPTION (${e.message})`);
    }
  }
}

checkSchema();
