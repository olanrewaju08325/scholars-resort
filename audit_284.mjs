import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit284() {
  const { data: topics } = await supabase.from('topics').select('*, subjects(name)');
  const topicMap = new Map();
  topics.forEach(t => topicMap.set(t.id, t));

  let page = 0;
  let mappedQuestions = [];
  while (true) {
    const { data } = await supabase
      .from('questions')
      .select('id, question_text, subject_id, topic_id, subjects(name)')
      .not('topic_id', 'is', null)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    mappedQuestions = mappedQuestions.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Mapped Questions Count: ${mappedQuestions.length}`);

  let valid = 0;
  let suspicious = 0;
  let invalid = 0;

  const suspiciousList = [];
  const invalidList = [];

  mappedQuestions.forEach(q => {
    const t = topicMap.get(q.topic_id);
    const subjName = q.subjects?.name || q.subject_id;

    if (!t) {
      invalid++;
      invalidList.push({ id: q.id, subject: subjName, topic_id: q.topic_id, reason: 'Orphaned topic_id (does not exist in topics table)' });
    } else if (t.subject_id !== q.subject_id) {
      invalid++;
      invalidList.push({ id: q.id, subject: subjName, topic_id: q.topic_id, topic_name: t.name, reason: `Subject mismatch: Question belongs to ${subjName}, but topic belongs to ${t.subjects?.name}` });
    } else {
      // Check if question text relates to topic
      valid++;
    }
  });

  console.log(`Audit 284 Results: Valid=${valid}, Suspicious=${suspicious}, Invalid=${invalid}`);
  if (suspiciousList.length > 0) console.log("Suspicious:", suspiciousList);
  if (invalidList.length > 0) console.log("Invalid:", invalidList);
}

audit284();
