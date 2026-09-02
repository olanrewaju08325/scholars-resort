import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportCleanMismatches() {
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

  fs.writeFileSync('clean_mismatches_40.json', JSON.stringify(mismatches, null, 2));

  const results = mismatches.map((m, idx) => {
    const { id, subject, qText, ca, opts } = m;
    let matchedOpt = null;
    let matchIndex = -1;

    opts.forEach((o, i) => {
      const oTrim = String(o).trim().toLowerCase();
      const caTrim = String(ca).trim().toLowerCase();

      if (oTrim === caTrim || oTrim.replace(/[^\w]/g, '') === caTrim.replace(/[^\w]/g, '')) {
        matchedOpt = o;
        matchIndex = i;
      }
    });

    let classification = 'NEEDS HUMAN REVIEW';
    let confidence = 'LOW';
    let reason = '';

    if (matchedOpt) {
      classification = 'SAFE TO REPAIR';
      confidence = 'HIGH';
      reason = `Normalized text match with option ${String.fromCharCode(65 + matchIndex)}`;
    } else {
      if (opts.some(o => o.toLowerCase().includes(ca.toLowerCase()) || ca.toLowerCase().includes(o.toLowerCase()))) {
        classification = 'NEEDS HUMAN REVIEW';
        confidence = 'MEDIUM';
        reason = `Partial overlap found between stored answer "${ca}" and options, but no exact match.`;
      } else {
        classification = 'NEEDS HUMAN REVIEW';
        confidence = 'LOW';
        reason = `Stored answer "${ca}" is not present among the 4 options: ${JSON.stringify(opts)}.`;
      }
    }

    return {
      index: idx + 1,
      id,
      subject,
      qTextSnippet: qText.substring(0, 60) + '...',
      ca,
      opts,
      matchedOpt: matchedOpt || 'NONE',
      classification,
      confidence,
      reason
    };
  });

  console.log(`Total Mismatches: ${results.length}`);
  console.log(`SAFE TO REPAIR: ${results.filter(r => r.classification === 'SAFE TO REPAIR').length}`);
  console.log(`NEEDS HUMAN REVIEW: ${results.filter(r => r.classification === 'NEEDS HUMAN REVIEW').length}`);
  console.log(`CANNOT DETERMINE: ${results.filter(r => r.classification === 'CANNOT DETERMINE').length}`);

  fs.writeFileSync('stage_a_analysis.json', JSON.stringify(results, null, 2));
}

exportCleanMismatches();
