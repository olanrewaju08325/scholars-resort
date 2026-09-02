import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectConfigs() {
  const { data: settings } = await supabase.from('admin_settings').select('*');
  console.log("=== admin_settings ===");
  console.log(JSON.stringify(settings, null, 2));

  const { data: pConfig } = await supabase.from('platform_config').select('*');
  console.log("\n=== platform_config ===");
  console.log(JSON.stringify(pConfig, null, 2));

  const { data: badges } = await supabase.from('badges').select('*');
  console.log("\n=== badges ===");
  console.log(JSON.stringify(badges, null, 2));

  const { data: announcements } = await supabase.from('announcements').select('*');
  console.log("\n=== announcements ===");
  console.log(JSON.stringify(announcements, null, 2));

  const { data: mockExams } = await supabase.from('mock_exams').select('*');
  console.log("\n=== mock_exams ===");
  console.log(JSON.stringify(mockExams, null, 2));
}

inspectConfigs();
