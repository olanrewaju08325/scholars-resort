import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runPhase7() {
  console.log("==================================================");
  console.log("PHASE 7 TAXONOMY REALITY CHECK INVESTIGATION");
  console.log("==================================================");

  // 1. Check topics table directly
  const { data: topics, error: tErr } = await supabase.from('topics').select('*, subjects(name, is_active)');
  const { data: subjects, error: sErr } = await supabase.from('subjects').select('*').order('name');

  console.log(`Subjects fetched: ${subjects?.length}`);
  console.log(`Topics fetched: ${topics?.length}`);

  // Fetch all questions to count per topic & per subject
  let allQuestions = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, subject_id, topic_id, is_active, year, correct_answer, options')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    allQuestions = allQuestions.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`Total questions fetched: ${allQuestions.length}`);

  // Topics stats
  const topicQuestionCounts = new Map();
  allQuestions.forEach(q => {
    if (q.topic_id) {
      topicQuestionCounts.set(q.topic_id, (topicQuestionCounts.get(q.topic_id) || 0) + 1);
    }
  });

  const subjectQuestionCounts = new Map();
  const subjectActiveQCounts = new Map();
  allQuestions.forEach(q => {
    subjectQuestionCounts.set(q.subject_id, (subjectQuestionCounts.get(q.subject_id) || 0) + 1);
    if (q.is_active) {
      subjectActiveQCounts.set(q.subject_id, (subjectActiveQCounts.get(q.subject_id) || 0) + 1);
    }
  });

  const topicsBySubj = new Map();
  topics.forEach(t => {
    if (!topicsBySubj.has(t.subject_id)) topicsBySubj.set(t.subject_id, []);
    topicsBySubj.get(t.subject_id).push(t);
  });

  console.log("\n--- COMPLETE SUBJECT & TOPIC HIERARCHY ---");
  const subjHierarchy = subjects.map(s => {
    const sTopics = topicsBySubj.get(s.id) || [];
    const topicsWithQ = sTopics.filter(t => (topicQuestionCounts.get(t.id) || 0) > 0).length;
    const topicsWithoutQ = sTopics.filter(t => (topicQuestionCounts.get(t.id) || 0) === 0).length;
    return {
      subject: s.name,
      subject_id: s.id,
      is_active: s.is_active,
      total_questions: subjectQuestionCounts.get(s.id) || 0,
      active_questions: subjectActiveQCounts.get(s.id) || 0,
      topic_count: sTopics.length,
      topics_with_questions: topicsWithQ,
      topics_without_questions: topicsWithoutQ
    };
  });
  console.table(subjHierarchy);

  console.log("\n--- ALL TOPICS IN DATABASE ---");
  const topicList = topics.map(t => ({
    topic_id: t.id,
    topic_name: t.name,
    subject_id: t.subject_id,
    subject_name: t.subjects?.name,
    is_active: t.is_active,
    question_count: topicQuestionCounts.get(t.id) || 0
  }));
  console.table(topicList);

  // 2. Validate stage_b_high_proposals.json
  let proposals = [];
  try {
    proposals = JSON.parse(fs.readFileSync('stage_b_high_proposals.json', 'utf8'));
    console.log(`\nLoaded ${proposals.length} proposals from stage_b_high_proposals.json`);
  } catch (e) {
    console.error("Could not read stage_b_high_proposals.json", e.message);
  }

  const qMap = new Map(allQuestions.map(q => [q.id, q]));
  const tMap = new Map(topics.map(t => [t.id, t]));
  const sMap = new Map(subjects.map(s => [s.id, s]));

  let validCount = 0;
  let invalidQId = 0;
  let invalidTId = 0;
  let crossSubj = 0;
  let inactiveTopic = 0;
  let placeholderId = 0;
  let contentMismatch = 0;

  const invalidProposals = [];

  proposals.forEach((p, idx) => {
    // Check placeholder
    if (p.question_id.includes('0123456-789a') || p.topic_id.includes('0123456-789a')) {
      placeholderId++;
      invalidProposals.push({ idx, p, reason: 'Placeholder ID' });
      return;
    }

    const q = qMap.get(p.question_id);
    if (!q) {
      invalidQId++;
      invalidProposals.push({ idx, p, reason: 'Question ID does not exist in DB' });
      return;
    }

    const t = tMap.get(p.topic_id);
    if (!t) {
      invalidTId++;
      invalidProposals.push({ idx, p, reason: 'Topic ID does not exist in DB' });
      return;
    }

    if (q.subject_id !== p.subject_id || q.subject_id !== t.subject_id) {
      crossSubj++;
      invalidProposals.push({ idx, p, reason: `Cross-subject mismatch: q.subj=${q.subject_id}, p.subj=${p.subject_id}, t.subj=${t.subject_id}` });
      return;
    }

    if (t.is_active === false) {
      inactiveTopic++;
      invalidProposals.push({ idx, p, reason: 'Topic is inactive in DB' });
      return;
    }

    validCount++;
  });

  console.log("\nPROPOSAL VALIDATION RESULTS:");
  console.log(`Total proposals: ${proposals.length}`);
  console.log(`Valid: ${validCount}`);
  console.log(`Invalid Question IDs: ${invalidQId}`);
  console.log(`Invalid Topic IDs: ${invalidTId}`);
  console.log(`Cross-Subject: ${crossSubj}`);
  console.log(`Inactive Topics: ${inactiveTopic}`);
  console.log(`Placeholder/Example IDs: ${placeholderId}`);
  console.log(`Genuinely Valid High Confidence: ${validCount}`);

  // 3. Check the 40 mismatches
  const activeQuestions = allQuestions.filter(q => q.is_active);
  let mismatchCount = 0;
  activeQuestions.forEach(q => {
    let opts = q.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch { opts = []; }
    }
    const ca = String(q.correct_answer || '').trim();
    if (['A', 'B', 'C', 'D', 'E'].includes(ca.toUpperCase()) || ['0', '1', '2', '3', '4'].includes(ca)) return;
    const caClean = ca.toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim();
    const matched = opts.some(o => String(o).trim().toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim() === caClean);
    if (!matched) mismatchCount++;
  });
  console.log(`\nActive Mismatches Verification: ${mismatchCount} (Expected 40)`);

  // 4. Check Year data
  const yearCount = allQuestions.filter(q => q.year !== null && q.year !== undefined && String(q.year).trim() !== '').length;
  console.log(`Year mapped questions: ${yearCount} (Expected 0)`);
}

runPhase7();
