import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value, updated_at')
    .eq('setting_key', 'jamb_novels_db');

  console.log("admin_settings for jamb_novels_db:", { error, data });
}

check();
