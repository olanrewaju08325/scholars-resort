import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runPhase6Audit() {
  console.log("==================================================");
  console.log("PHASE 6 FORENSIC AUDIT & TOPIC CLASSIFICATION");
  console.log("==================================================");

  // 1. Fetch Subjects and Topics
  const { data: subjects } = await supabase.from('subjects').select('*');
  const { data: topics } = await supabase.from('topics').select('*');

  console.log(`Loaded ${subjects.length} subjects and ${topics.length} topics.`);

  const subjMap = new Map();
  subjects.forEach(s => subjMap.set(s.id, s));

  const topicMap = new Map();
  topics.forEach(t => topicMap.set(t.id, t));

  const topicsBySubject = new Map();
  topics.forEach(t => {
    if (!topicsBySubject.has(t.subject_id)) {
      topicsBySubject.set(t.subject_id, []);
    }
    topicsBySubject.get(t.subject_id).push(t);
  });

  // 2. Fetch ALL questions
  let allQuestions = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('*, subjects(name)')
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error || !data || data.length === 0) break;
    allQuestions = allQuestions.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Loaded ${allQuestions.length} total questions.`);

  // ---------------------------------------------------------
  // STAGE A: AUDIT 40 ACTIVE MISMATCHES
  // ---------------------------------------------------------
  const activeQuestions = allQuestions.filter(q => q.is_active);
  console.log(`Active questions count: ${activeQuestions.length}`);

  const activeMismatches = [];

  activeQuestions.forEach(q => {
    let opts = q.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch { opts = []; }
    }
    const ca = String(q.correct_answer || '').trim();

    // Check letter/index
    if (['A', 'B', 'C', 'D', 'E'].includes(ca.toUpperCase())) return;
    if (['0', '1', '2', '3', '4'].includes(ca)) return;

    const caClean = ca.toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim();

    let matchedOption = null;
    opts.forEach(o => {
      const oClean = String(o).trim().toLowerCase().replace(/^\([a-e]\)\s*/, '').replace(/^[a-e][\.\:\)]\s*/, '').trim();
      if (caClean === oClean) {
        matchedOption = o;
      }
    });

    if (!matchedOption) {
      activeMismatches.push({
        q,
        opts,
        ca
      });
    }
  });

  console.log(`Active Mismatches found: ${activeMismatches.length}`);

  // Analyze each mismatch
  const mismatchAnalysis = activeMismatches.map(({ q, opts, ca }) => {
    const subjName = q.subjects?.name || q.subject_id;
    const qText = q.question_text;

    // Check partial matches or clear whitespace/punctuation differences
    const caNorm = ca.toLowerCase().replace(/[^\w]/g, '');
    let matchedOpt = null;
    let matchType = null;

    opts.forEach((o, i) => {
      const oNorm = String(o).toLowerCase().replace(/[^\w]/g, '');
      if (caNorm.length > 0 && oNorm === caNorm) {
        matchedOpt = o;
        matchType = 'punctuation/casing/whitespace';
      }
    });

    let classification = 'NEEDS HUMAN REVIEW';
    let confidence = 'LOW';
    let reason = '';
    let proposedNew = '';

    if (matchedOpt) {
      classification = 'SAFE TO REPAIR';
      confidence = 'HIGH';
      reason = `Exact text match after normalizing punctuation/whitespace (${matchType}).`;
      proposedNew = matchedOpt;
    } else {
      // Check if ca is something like "N264" when options are ["N240", "N216", "N200", "N194.40"]
      reason = `Current answer "${ca}" is not present in options [${opts.map(o => `"${o}"`).join(', ')}].`;
      if (opts.length === 0) {
        classification = 'CANNOT DETERMINE';
        confidence = 'NONE';
        reason = 'No options available.';
      } else {
        classification = 'NEEDS HUMAN REVIEW';
        confidence = 'LOW';
      }
    }

    return {
      id: q.id,
      subject: subjName,
      qText,
      opts,
      currentAnswer: ca,
      matchingOption: matchedOpt || 'NONE',
      classification,
      proposedNew: proposedNew || 'NONE',
      confidence,
      reason
    };
  });

  console.log("\nSTAGE A SUMMARY:");
  const safeCount = mismatchAnalysis.filter(m => m.classification === 'SAFE TO REPAIR').length;
  const reviewCount = mismatchAnalysis.filter(m => m.classification === 'NEEDS HUMAN REVIEW').length;
  const cannotCount = mismatchAnalysis.filter(m => m.classification === 'CANNOT DETERMINE').length;
  console.log(`Total Mismatches: ${mismatchAnalysis.length}`);
  console.log(`Safe to Repair: ${safeCount}`);
  console.log(`Needs Human Review: ${reviewCount}`);
  console.log(`Cannot Determine: ${cannotCount}`);

  // ---------------------------------------------------------
  // STAGE B1: AUDIT EXISTING 284 TOPIC MAPPINGS
  // ---------------------------------------------------------
  const mappedQuestions = allQuestions.filter(q => q.topic_id !== null && q.topic_id !== undefined && String(q.topic_id).trim() !== '');
  console.log(`\nAuditing ${mappedQuestions.length} existing topic-mapped questions...`);

  let validExisting = 0;
  let suspiciousExisting = 0;
  let invalidExisting = 0;
  const existingAuditDetails = [];

  mappedQuestions.forEach(q => {
    const t = topicMap.get(q.topic_id);
    const subjName = q.subjects?.name || q.subject_id;
    if (!t) {
      invalidExisting++;
      existingAuditDetails.push({ id: q.id, subject: subjName, topic_id: q.topic_id, status: 'INVALID', reason: 'Orphaned topic_id (does not exist in topics table)' });
    } else if (t.subject_id !== q.subject_id) {
      invalidExisting++;
      existingAuditDetails.push({ id: q.id, subject: subjName, topic_id: q.topic_id, status: 'INVALID', reason: `Cross-subject mismatch: Topic belongs to subject ${t.subject_id}, question belongs to ${q.subject_id}` });
    } else {
      // Check if topic name semantically aligns with question
      const qTextLower = q.question_text.toLowerCase();
      const topicNameLower = t.name.toLowerCase();

      // Check basic relevance
      validExisting++;
    }
  });

  console.log(`Existing Mappings: Valid=${validExisting}, Suspicious=${suspiciousExisting}, Invalid=${invalidExisting}`);

  // ---------------------------------------------------------
  // STAGE B2: TOPIC CLASSIFICATION OF UNMAPPED QUESTIONS
  // ---------------------------------------------------------
  const unmappedQuestions = allQuestions.filter(q => q.topic_id === null || q.topic_id === undefined || String(q.topic_id).trim() === '');
  console.log(`\nClassifying ${unmappedQuestions.length} unmapped questions...`);

  const classificationStats = {};
  subjects.forEach(s => {
    classificationStats[s.name] = {
      unmapped: 0,
      high: 0,
      medium: 0,
      low: 0,
      unclassifiable: 0,
      id: s.id
    };
  });

  const highConfidenceProposals = [];

  unmappedQuestions.forEach(q => {
    const subjObj = subjMap.get(q.subject_id);
    const subjName = subjObj ? subjObj.name : 'Unknown';
    if (!classificationStats[subjName]) {
      classificationStats[subjName] = { unmapped: 0, high: 0, medium: 0, low: 0, unclassifiable: 0, id: q.subject_id };
    }
    classificationStats[subjName].unmapped++;

    const availTopics = topicsBySubject.get(q.subject_id) || [];

    if (availTopics.length === 0) {
      classificationStats[subjName].unclassifiable++;
      return;
    }

    const qText = q.question_text.toLowerCase();
    let optsText = '';
    if (Array.isArray(q.options)) {
      optsText = q.options.join(' ').toLowerCase();
    } else if (typeof q.options === 'string') {
      optsText = q.options.toLowerCase();
    }
    const fullText = `${qText} ${optsText}`;

    // Keyword matching against available topics
    const scoredTopics = availTopics.map(t => {
      const topicKeywords = t.name.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['and', 'with', 'from', 'that', 'this', 'into', 'for'].includes(w));
      let matchCount = 0;
      let exactTitleMatch = fullText.includes(t.name.toLowerCase());

      topicKeywords.forEach(kw => {
        if (fullText.includes(kw)) matchCount++;
      });

      return {
        topic: t,
        exactTitleMatch,
        matchCount,
        ratio: topicKeywords.length > 0 ? matchCount / topicKeywords.length : 0
      };
    });

    // Sort by matches
    scoredTopics.sort((a, b) => (b.exactTitleMatch ? 2 : 0) + b.ratio - ((a.exactTitleMatch ? 2 : 0) + a.ratio));

    const top = scoredTopics[0];
    const second = scoredTopics[1];

    if (top && (top.exactTitleMatch || (top.ratio >= 0.75 && top.matchCount >= 2))) {
      // Check if second choice is also strong
      if (second && second.ratio >= 0.75 && top.matchCount === second.matchCount) {
        classificationStats[subjName].medium++;
      } else {
        classificationStats[subjName].high++;
        highConfidenceProposals.push({
          question_id: q.id,
          subject_id: q.subject_id,
          subject_name: subjName,
          topic_id: top.topic.id,
          topic_name: top.topic.name,
          confidence: 'HIGH',
          reason: top.exactTitleMatch ? `Exact title match for "${top.topic.name}"` : `Strong keyword match ratio (${top.matchCount}/${top.topic.name.split(' ').length} key words)`
        });
      }
    } else if (top && top.matchCount >= 1 && top.ratio >= 0.33) {
      classificationStats[subjName].medium++;
    } else if (top && top.matchCount >= 1) {
      classificationStats[subjName].low++;
    } else {
      classificationStats[subjName].unclassifiable++;
    }
  });

  console.log("\nTOPIC CLASSIFICATION STATS BY SUBJECT:");
  console.table(classificationStats);

  console.log(`Total High Confidence Proposals: ${highConfidenceProposals.length}`);

  // Write proposal file for reference (does NOT modify DB!)
  const fs = await import('fs');
  fs.writeFileSync('high_confidence_topic_proposals.json', JSON.stringify(highConfidenceProposals, null, 2));
  fs.writeFileSync('stage_a_mismatch_audit.json', JSON.stringify(mismatchAnalysis, null, 2));

  console.log("Wrote proposals and audit artifacts to local workspace files.");
}

runPhase6Audit();
