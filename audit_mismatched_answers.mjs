import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMismatches() {
  let page = 0;
  let all = [];
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, subject_id, question_text, options, correct_answer, subjects(name)')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  const mismatches = [];

  all.forEach(q => {
    let opts = q.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch { opts = []; }
    }
    const caStr = String(q.correct_answer || '').trim();
    if (!['A', 'B', 'C', 'D', 'E', 'a', 'b', 'c', 'd', 'e', '0', '1', '2', '3', '4'].includes(caStr)) {
      // Check if caStr is in opts
      if (Array.isArray(opts)) {
        const caUpper = caStr.toUpperCase();
        const found = opts.some(o => String(o).trim().toUpperCase() === caUpper);
        if (!found) {
          mismatches.push({
            id: q.id,
            subject: q.subjects?.name || q.subject_id,
            question_text: q.question_text.substring(0, 80),
            options: opts,
            correct_answer: caStr
          });
        }
      }
    }
  });

  console.log(`Found ${mismatches.length} answer-text mismatches.`);
  if (mismatches.length > 0) {
    console.log("First 5 Mismatches:", JSON.stringify(mismatches.slice(0, 5), null, 2));
  }
}

checkMismatches();
