import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const email = 'admitwise2@gmail.com';
  const password = 'Halimot08*';

  console.log("Signing up...");
  let { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) {
    if (error.message.includes('already registered')) {
        console.log("User already registered. Logging in...");
        const loginRes = await supabase.auth.signInWithPassword({ email, password });
        if (loginRes.error) {
            console.error("Login failed:", loginRes.error);
            return;
        }
        data = loginRes.data;
    } else {
        console.error("Signup failed:", error);
        return;
    }
  }

  const userId = data.user.id;
  console.log("User ID:", userId);

  // Check if profile exists
  console.log("Fetching profile...");
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  
  if (!profile) {
      console.log("Creating profile...");
      const insertRes = await supabase.from('profiles').insert({
          id: userId,
          full_name: 'Admin User',
          email: email,
          role: 'admin'
      });
      if (insertRes.error) console.error("Error creating profile:", insertRes.error);
      else console.log("Profile created with admin role!");
  } else {
      console.log("Updating profile to admin...");
      const updateRes = await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
      if (updateRes.error) console.error("Error updating profile:", updateRes.error);
      else console.log("Profile updated to admin!");
  }
}

main();
