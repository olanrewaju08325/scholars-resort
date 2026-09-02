import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: badgesTable, error: err1 } = await supabase.from('badges').select('*');
  console.log("badges table count:", badgesTable?.length, "error:", err1, "sample:", badgesTable?.slice(0, 3));

  const { data: adminSettings, error: err2 } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', 'gamification_badges_config');
  console.log("admin_settings gamification_badges_config:", { err2, adminSettings });
}

check();
