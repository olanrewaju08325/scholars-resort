import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('admin_settings').select('setting_key, updated_at');
  console.log("all admin_settings keys:", { error, keys: data });
}

check();
