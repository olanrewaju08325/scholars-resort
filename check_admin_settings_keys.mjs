import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectSettings() {
  const { data: settings } = await supabase.from('admin_settings').select('setting_key, updated_at');
  console.log("=== admin_settings keys ===");
  settings.forEach(s => console.log(`- ${s.setting_key} (updated: ${s.updated_at})`));
}

inspectSettings();
