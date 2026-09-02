import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
  let page = 0;
  let all = [];
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, year, source_type, source_name, source_year, subtopic_id, exam_type')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Checked ${all.length} questions.`);

  let nonNullYear = 0;
  let nonNullSourceType = 0;
  let nonDefaultSourceType = 0;
  let nonNullSourceName = 0;
  let nonNullSourceYear = 0;
  let nonNullSubtopicId = 0;

  all.forEach(q => {
    if (q.year !== null && q.year !== undefined) nonNullYear++;
    if (q.source_type !== null && q.source_type !== undefined) nonNullSourceType++;
    if (q.source_type && q.source_type !== 'jamb_past') nonDefaultSourceType++;
    if (q.source_name !== null && q.source_name !== undefined) nonNullSourceName++;
    if (q.source_year !== null && q.source_year !== undefined) nonNullSourceYear++;
    if (q.subtopic_id !== null && q.subtopic_id !== undefined) nonNullSubtopicId++;
  });

  console.log({
    nonNullYear,
    nonNullSourceType,
    nonDefaultSourceType,
    nonNullSourceName,
    nonNullSourceYear,
    nonNullSubtopicId
  });
}

checkCols();
