import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: badgesTable } = await supabase.from('badges').select('*');
  console.log("=== BADGES TABLE (count: " + badgesTable?.length + ") ===");
  console.log(JSON.stringify(badgesTable, null, 2));

  const { data: adminSettings } = await supabase
    .from('admin_settings')
    .select('*')
    .eq('setting_key', 'gamification_badges_config');
  console.log("=== ADMIN_SETTINGS gamification_badges_config ===");
  console.log(JSON.stringify(adminSettings, null, 2));
}

check();
