import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTopics() {
  let page = 0;
  let allTopics = [];
  while (true) {
    const { data, error } = await supabase.from('topics').select('*, subjects(name)').range(page*1000, (page+1)*1000-1);
    if (error || !data || data.length === 0) break;
    allTopics = allTopics.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Total Topics in DB: ${allTopics.length}`);
  const bySubj = {};
  allTopics.forEach(t => {
    const sName = t.subjects?.name || t.subject_id;
    bySubj[sName] = (bySubj[sName] || 0) + 1;
  });
  console.log("Topics by Subject in DB:", bySubj);
}

checkTopics();
