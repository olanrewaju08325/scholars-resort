import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { count: totalQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true });
  const { count: activeQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('is_active', true);
  const { count: inactiveQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('is_active', false);
  const { count: subjectsCount } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
  const { count: topicsCount } = await supabase.from('topics').select('*', { count: 'exact', head: true });
  const { count: topicMappedQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true }).not('topic_id', 'is', null);
  const { count: unmappedQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true }).is('topic_id', null);
  const { count: yearAssignedQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true }).not('year', 'is', null);

  console.log("=== BASELINE METRICS ===");
  console.log({
    totalQuestions,
    activeQuestions,
    inactiveQuestions,
    subjectsCount,
    topicsCount,
    topicMappedQuestions,
    unmappedQuestions,
    yearAssignedQuestions
  });
}

check();
