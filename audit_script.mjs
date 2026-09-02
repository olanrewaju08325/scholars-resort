import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in process.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("=== PHASE 5 FORENSIC AUDIT SCRIPT ===");

  // 1. Inspect Table Columns / Sample Question Structure
  const { data: sampleQ, error: sampleErr } = await supabase
    .from('questions')
    .select('*')
    .limit(5);

  if (sampleErr) {
    console.error("Error fetching sample questions:", sampleErr);
    return;
  }

  console.log("Question Schema Keys:", Object.keys(sampleQ[0] || {}));
  console.log("Sample Question Record:", JSON.stringify(sampleQ[0], null, 2));

  // 2. Fetch all subjects
  const { data: subjects, error: subjErr } = await supabase
    .from('subjects')
    .select('*');
  console.log(`\nSubjects Table Count: ${subjects?.length || 0}`);
  const subjMap = new Map();
  (subjects || []).forEach(s => subjMap.set(s.id, s));

  // 3. Fetch all topics
  const { data: topics, error: topErr } = await supabase
    .from('topics')
    .select('*');
  console.log(`Topics Table Count: ${topics?.length || 0}`);
  const topicMap = new Map();
  (topics || []).forEach(t => topicMap.set(t.id, t));

  // 4. Fetch ALL questions (chunked by 1000 since Supabase default page size is 1000)
  let allQuestions = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: chunk, error: chunkErr } = await supabase
      .from('questions')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (chunkErr) {
      console.error(`Error fetching chunk ${page}:`, chunkErr);
      break;
    }
    if (!chunk || chunk.length === 0) break;
    allQuestions = allQuestions.concat(chunk);
    if (chunk.length < pageSize) break;
    page++;
  }

  console.log(`\nFetched Total Questions in DB: ${allQuestions.length}`);

  // Statistics accumulators
  let activeCount = 0;
  let inactiveCount = 0;
  let topicMappedCount = 0;
  let topicUnmappedCount = 0;
  let yearMappedCount = 0;
  let yearUnmappedCount = 0;
  let withExplanation = 0;
  let withoutExplanation = 0;
  let withImage = 0;
  let withoutImage = 0;

  const subjectCounts = {};
  const topicCounts = {};
  const yearCounts = {};
  const invalidOptions = [];
  const invalidAnswers = [];
  const orphanedSubjectQs = [];
  const invalidTopicQs = [];
  const crossSubjectTopicMismatches = [];

  const exactDupMap = new Map();
  const normalizedDupMap = new Map();

  // Answer format stats
  const answerFormatCounts = {
    letter_A_D: 0,
    index_0_3: 0,
    full_text: 0,
    null_or_empty: 0,
    other: 0
  };

  allQuestions.forEach((q, idx) => {
    // Active status
    if (q.is_active === true) activeCount++;
    else inactiveCount++;

    // Topic status
    if (q.topic_id !== null && q.topic_id !== undefined && String(q.topic_id).trim() !== '') {
      topicMappedCount++;
      topicCounts[q.topic_id] = (topicCounts[q.topic_id] || 0) + 1;

      // Audit topic mapping validity
      const tObj = topicMap.get(q.topic_id);
      if (!tObj) {
        invalidTopicQs.push({ id: q.id, topic_id: q.topic_id, reason: 'Orphaned topic_id (not in topics table)' });
      } else if (tObj.subject_id !== q.subject_id) {
        crossSubjectTopicMismatches.push({
          id: q.id,
          q_subject_id: q.subject_id,
          topic_id: q.topic_id,
          topic_subject_id: tObj.subject_id,
          topic_name: tObj.name
        });
      }
    } else {
      topicUnmappedCount++;
    }

    // Year status
    const yVal = q.year || q.exam_year || q.metadata?.year;
    if (yVal !== null && yVal !== undefined && String(yVal).trim() !== '' && String(yVal) !== '0') {
      yearMappedCount++;
      yearCounts[yVal] = (yearCounts[yVal] || 0) + 1;
    } else {
      yearUnmappedCount++;
    }

    // Subject count
    const sObj = subjMap.get(q.subject_id);
    const subjName = sObj ? sObj.name : `Orphaned (${q.subject_id})`;
    if (!sObj) {
      orphanedSubjectQs.push({ id: q.id, subject_id: q.subject_id });
    }
    if (!subjectCounts[subjName]) {
      subjectCounts[subjName] = { total: 0, active: 0, inactive: 0, topicMapped: 0, explanation: 0, images: 0, id: q.subject_id };
    }
    subjectCounts[subjName].total++;
    if (q.is_active) subjectCounts[subjName].active++;
    else subjectCounts[subjName].inactive++;
    if (q.topic_id) subjectCounts[subjName].topicMapped++;

    // Explanation
    const exp = q.explanation || q.solution;
    if (exp && String(exp).trim().length > 0) {
      withExplanation++;
      subjectCounts[subjName].explanation++;
    } else {
      withoutExplanation++;
    }

    // Image
    const img = q.image_url || q.image_path || q.question_image || (typeof q.question_text === 'string' && q.question_text.includes('<img'));
    if (img) {
      withImage++;
      subjectCounts[subjName].images++;
    } else {
      withoutImage++;
    }

    // Option parsing & validation
    let opts = q.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch { opts = null; }
    }
    if (!opts || !Array.isArray(opts) || opts.length === 0) {
      invalidOptions.push({ id: q.id, subject: subjName, reason: 'Options null, empty or invalid JSON', raw: q.options });
    } else if (opts.length < 4 || opts.length > 5) {
      invalidOptions.push({ id: q.id, subject: subjName, reason: `Abnormal options length: ${opts.length}`, raw: opts });
    } else {
      // Check if options have empty string elements
      const hasEmptyOpt = opts.some(o => typeof o === 'string' && o.trim() === '');
      if (hasEmptyOpt) {
        invalidOptions.push({ id: q.id, subject: subjName, reason: 'Contains blank/empty option text', raw: opts });
      }
    }

    // Correct Answer validation
    const ca = q.correct_answer;
    if (ca === null || ca === undefined || String(ca).trim() === '') {
      answerFormatCounts.null_or_empty++;
      invalidAnswers.push({ id: q.id, subject: subjName, reason: 'Correct answer null or empty' });
    } else {
      const caStr = String(ca).trim();
      if (['A', 'B', 'C', 'D', 'E', 'a', 'b', 'c', 'd', 'e'].includes(caStr)) {
        answerFormatCounts.letter_A_D++;
      } else if (['0', '1', '2', '3', '4'].includes(caStr)) {
        answerFormatCounts.index_0_3++;
      } else {
        answerFormatCounts.other++;
        // Check if caStr matches one of the options text exactly
        if (opts && Array.isArray(opts) && opts.includes(caStr)) {
          answerFormatCounts.full_text++;
        } else {
          invalidAnswers.push({ id: q.id, subject: subjName, reason: `Unrecognized correct_answer format: "${caStr}"` });
        }
      }
    }

    // Duplicate detection
    const qText = (q.question_text || '').trim();
    const optsStr = Array.isArray(opts) ? opts.map(o => String(o).trim()).join('||') : String(q.options);
    const exactKey = `${qText}::${optsStr}`;
    if (!exactDupMap.has(exactKey)) exactDupMap.set(exactKey, []);
    exactDupMap.get(exactKey).push(q.id);

    const normText = qText.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    if (!normalizedDupMap.has(normText)) normalizedDupMap.set(normText, []);
    normalizedDupMap.get(normText).push(q.id);
  });

  console.log("\n=== STATISTICAL SUMMARY ===");
  console.log(`Total Questions: ${allQuestions.length}`);
  console.log(`Active: ${activeCount} | Inactive: ${inactiveCount}`);
  console.log(`Topic Mapped: ${topicMappedCount} | Unmapped: ${topicUnmappedCount}`);
  console.log(`Year Mapped: ${yearMappedCount} | Unmapped: ${yearUnmappedCount}`);
  console.log(`With Explanation: ${withExplanation} | Without: ${withoutExplanation}`);
  console.log(`With Image: ${withImage} | Without: ${withoutImage}`);

  console.log("\n=== SUBJECT BREAKDOWN ===");
  console.table(subjectCounts);

  console.log("\n=== TOPIC BREAKDOWN (284 mapped questions) ===");
  console.log(`Unique Topics Mapped in Questions: ${Object.keys(topicCounts).length}`);
  console.log(`Orphaned Topic IDs: ${invalidTopicQs.length}`);
  console.log(`Cross-Subject Topic Mismatches: ${crossSubjectTopicMismatches.length}`);

  if (crossSubjectTopicMismatches.length > 0) {
    console.log("Sample Cross-Subject Topic Mismatch:", crossSubjectTopicMismatches[0]);
  }

  console.log("\n=== YEAR DISTRIBUTION ===");
  console.log(yearCounts);

  console.log("\n=== OPTION & ANSWER VALIDATION ===");
  console.log(`Invalid Options Count: ${invalidOptions.length}`);
  if (invalidOptions.length > 0) console.log("Sample Invalid Options:", invalidOptions.slice(0, 3));
  console.log(`Invalid Correct Answers Count: ${invalidAnswers.length}`);
  if (invalidAnswers.length > 0) console.log("Sample Invalid Answers:", invalidAnswers.slice(0, 3));
  console.log("Answer Format Counts:", answerFormatCounts);

  console.log("\n=== DUPLICATE ANALYSIS ===");
  let exactDupCount = 0;
  let exactDupGroups = 0;
  exactDupMap.forEach((ids) => {
    if (ids.length > 1) {
      exactDupGroups++;
      exactDupCount += ids.length - 1;
    }
  });
  console.log(`Exact Duplicate Groups: ${exactDupGroups}, Duplicate Records: ${exactDupCount}`);

  let normDupCount = 0;
  let normDupGroups = 0;
  normalizedDupMap.forEach((ids) => {
    if (ids.length > 1) {
      normDupGroups++;
      normDupCount += ids.length - 1;
    }
  });
  console.log(`Normalized Duplicate Groups: ${normDupGroups}, Potential Near-Duplicates: ${normDupCount}`);

  // 5. Inspect Question Samples for Quality & Provenance
  console.log("\n=== PROVENANCE & METADATA INSPECTION ===");
  const metadataFields = new Set();
  let nonNullMetadataCount = 0;
  let nonNullSourceCount = 0;
  allQuestions.forEach(q => {
    if (q.metadata) {
      nonNullMetadataCount++;
      Object.keys(q.metadata).forEach(k => metadataFields.add(k));
    }
    if (q.source || q.source_url || q.source_name || q.reference) {
      nonNullSourceCount++;
    }
  });
  console.log(`Questions with non-null metadata: ${nonNullMetadataCount}`);
  console.log(`Metadata Keys Found:`, Array.from(metadataFields));
  console.log(`Questions with source/reference fields: ${nonNullSourceCount}`);
}

runAudit();
