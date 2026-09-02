import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('admin_settings').select('*').limit(5);
  console.log("admin_settings rows:", { error, keys: data ? Object.keys(data[0] || {}) : [] });
}

check();
