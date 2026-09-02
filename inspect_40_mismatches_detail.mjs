import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect40() {
  let page = 0;
  let allQuestions = [];
  while (true) {
    const { data } = await supabase
      .from('questions')
      .select('id, question_text, options, correct_answer, is_active, subjects(name)')
      .eq('is_active', true)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allQuestions = allQuestions.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  const mismatches = [];

  allQuestions.forEach(q => {
    let opts = q.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch { opts = []; }
    }
    const ca = String(q.correct_answer || '').trim();

    if (['A', 'B', 'C', 'D', 'E'].includes(ca.toUpperCase())) return;
    if (['0', '1', '2', '3', '4'].includes(ca)) return;

    const caClean = ca.toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim();

    let matchedOption = null;
    opts.forEach((o, idx) => {
      const oClean = String(o).trim().toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim();
      if (caClean === oClean) {
        matchedOption = o;
      }
    });

    if (!matchedOption) {
      mismatches.push({
        id: q.id,
        subject: q.subjects?.name || q.subject_id,
        qText: q.question_text,
        ca,
        opts
      });
    }
  });

  console.log(`Total Mismatches Found: ${mismatches.length}`);
  console.log(JSON.stringify(mismatches, null, 2));
}

inspect40();
