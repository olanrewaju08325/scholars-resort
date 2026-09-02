import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInactive() {
  const { data: inactiveQs } = await supabase
    .from('questions')
    .select('id, is_active, subject_id, subjects(name)')
    .eq('is_active', false);

  console.log(`Total Inactive Questions: ${inactiveQs.length}`);
  const bySubj = {};
  inactiveQs.forEach(q => {
    const name = q.subjects?.name || q.subject_id;
    bySubj[name] = (bySubj[name] || 0) + 1;
  });
  console.log("Inactive Questions by Subject:", bySubj);
}

checkInactive();
