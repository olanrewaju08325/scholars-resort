import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectActive40() {
  let page = 0;
  let activeQuestions = [];
  while (true) {
    const { data } = await supabase
      .from('questions')
      .select('id, options, correct_answer, subjects(name)')
      .eq('is_active', true)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    activeQuestions = activeQuestions.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  const mismatches = [];

  activeQuestions.forEach(q => {
    let opts = q.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch { opts = []; }
    }
    const ca = String(q.correct_answer || '').trim();
    if (['A', 'B', 'C', 'D', 'E'].includes(ca.toUpperCase())) return;
    if (['0', '1', '2', '3', '4'].includes(ca)) return;

    const caClean = ca.toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim();
    
    let matched = false;
    opts.forEach(o => {
      const oClean = String(o).trim().toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim();
      if (caClean === oClean) matched = true;
    });

    if (!matched) {
      mismatches.push({
        id: q.id,
        subject: q.subjects?.name,
        ca,
        opts
      });
    }
  });

  console.log(`Active Mismatches Count: ${mismatches.length}`);
  if (mismatches.length > 0) {
    console.log("Sample Active Mismatches:", JSON.stringify(mismatches.slice(0, 5), null, 2));
  }
}

inspectActive40();
