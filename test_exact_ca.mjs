import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testExact() {
  let page = 0;
  let all = [];
  while (true) {
    const { data } = await supabase.from('questions').select('id, options, correct_answer, subjects(name)').range(page*1000, (page+1)*1000-1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  let totalMismatches = 0;
  let letterCount = 0;
  let indexCount = 0;
  let textMatchCount = 0;
  let unparseableOpts = 0;

  const realMismatches = [];

  all.forEach(q => {
    let opts = q.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch { opts = []; }
    }
    if (!Array.isArray(opts) || opts.length === 0) {
      unparseableOpts++;
      return;
    }

    const ca = String(q.correct_answer || '').trim();
    if (['A', 'B', 'C', 'D', 'E'].includes(ca.toUpperCase())) {
      letterCount++;
      return;
    }
    if (['0', '1', '2', '3', '4'].includes(ca)) {
      indexCount++;
      return;
    }

    // It's text. Let's clean and compare with options
    const caClean = ca.toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim();
    
    let matched = false;
    opts.forEach((o, i) => {
      const oClean = String(o).trim().toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim();
      if (caClean === oClean) {
        matched = true;
      }
    });

    if (matched) {
      textMatchCount++;
    } else {
      totalMismatches++;
      realMismatches.push({
        id: q.id,
        subject: q.subjects?.name,
        ca,
        opts
      });
    }
  });

  console.log({
    totalQuestions: all.length,
    letterCount,
    indexCount,
    textMatchCount,
    totalMismatches,
    unparseableOpts
  });

  if (realMismatches.length > 0) {
    console.log("Real Mismatches Samples:", realMismatches.slice(0, 5));
  }
}

testExact();
