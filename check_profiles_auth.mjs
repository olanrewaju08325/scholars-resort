import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkProfiles() {
  console.log("=== CHECKING PROFILES QUERY ===");
  const { data, error, count } = await supabase.from('profiles').select('*', { count: 'exact' });
  console.log("Anon key profiles select result:", { count, error, dataLength: data ? data.length : 0 });
  
  // Also check if there are RLS policies on profiles
  // Note: Anon key without user token queries profiles. Since RLS on profiles might be 'auth.uid() = id' or 'role = admin', an anon/unauthenticated select returns [] (0 rows)!
  console.log("Note on RLS: If profiles has RLS `auth.uid() = id` or admin role check, anon select will return 0 rows because no session token is passed.");
}

checkProfiles();
