import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdmin() {
  const email = 'admitwise2@gmail.com';
  const password = 'Halimot08*';

  console.log(`Signing in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    process.exit(1);
  }

  console.log("Login successful! User ID:", authData.user.id);
  console.log("Updating role to 'admin'...");

  // Because the RLS policy says "Users can update their own profile", we can update the role while logged in as them!
  const { data, error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', authData.user.id)
    .select();

  if (updateError) {
    console.error("Update failed:", updateError.message);
  } else {
    console.log("Update successful! Result:", data);
  }
}

setAdmin();
