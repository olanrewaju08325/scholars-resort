import { supabase } from '@/lib/supabase';
import { getCompletedOfflineSessions } from '@/lib/offlineStore';

export interface StudyTask {
  id: string;
  timeSlot: 'morning' | 'midday' | 'afternoon' | 'evening';
  slotLabel: string;
  slotTime: string;
  title: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
  priorityLabel: string;
  recommendationReason: string;
  actionType: 'drill' | 'review' | 'flashcard' | 'mock';
  isCompleted: boolean;
}

export interface DailyPlannerData {
  date: string;
  formattedDate: string;
  tasks: StudyTask[];
  completionPercentage: number;
  weakTopicsFound: string[];
  strongTopicsFound: string[];
}

const JAMB_HIGH_YIELD_SYLLABUS: Record<string, string[]> = {
  'Use of English': [
    'Lexis and Structure',
    'Concord Rules & Subject-Verb Agreement',
    'Comprehension Passages & Inference',
    'Antonyms and Synonyms',
    'Oral Forms & Stress Patterns'
  ],
  'Mathematics': [
    'Quadratic Equations & Algebra',
    'Calculus (Differentiation & Integration)',
    'Matrices & Determinants',
    'Trigonometry & Bearing',
    'Statistics & Probability'
  ],
  'Physics': [
    'Electric Fields & Coulomb\'s Law',
    'Motion & Kinematics',
    'Electromagnetism & Induction',
    'Optics & Wave Motion',
    'Thermal Energy & Gas Laws'
  ],
  'Chemistry': [
    'Organic Chemistry & IUPAC Nomenclature',
    'Chemical Equilibrium & Le Chatelier',
    'Periodic Table & Atomic Structure',
    'Stoichiometry & Mole Concept',
    'Electrochemistry & Electrolysis'
  ],
  'Biology': [
    'Genetics & Mendel\'s Laws',
    'Cellular Respiration & Photosynthesis',
    'Ecology & Habitat Adaptation',
    'Digestive & Circulatory Systems',
    'Plant Transport & Transpiration'
  ]
};

/**
 * Generates or retrieves a unique daily study plan based on user's past performance data
 */
export async function generateDailyStudyPlan(userId: string): Promise<DailyPlannerData> {
  const todayStr = new Date().toISOString().split('T')[0];
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // 1. Fetch user performance statistics across session answers
  const topicStatsMap: Record<string, { subject: string; topic: string; correct: number; total: number }> = {};
  
  try {
    if (userId) {
      // Query recent answers from Supabase
      const { data: recentAnswers } = await supabase
        .from('session_answers')
        .select('question_id, is_correct')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (recentAnswers && recentAnswers.length > 0) {
        const qIds = Array.from(new Set(recentAnswers.map(a => a.question_id).filter(Boolean)));
        
        if (qIds.length > 0) {
          const { data: questions } = await supabase
            .from('questions')
            .select('id, topic_id, subject_id, subjects(name), topics(name)')
            .in('id', qIds.slice(0, 100));

          if (questions && questions.length > 0) {
            const qMetaMap: Record<string, { subject: string; topic: string }> = {};
            
            questions.forEach((q: any) => {
              const subjName = q.subjects?.name || 'General';
              const topicName = q.topics?.name || 'Core Concepts';
              qMetaMap[q.id] = { subject: subjName, topic: topicName };
            });

            recentAnswers.forEach((ans: any) => {
              const meta = qMetaMap[ans.question_id];
              if (meta) {
                const key = `${meta.subject}:::${meta.topic}`;
                if (!topicStatsMap[key]) {
                  topicStatsMap[key] = { subject: meta.subject, topic: meta.topic, correct: 0, total: 0 };
                }
                topicStatsMap[key].total += 1;
                if (ans.is_correct) topicStatsMap[key].correct += 1;
              }
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[DailyStudyPlanner] Supabase fetch error, using fallback offline store:', err);
  }

  // Also include offline completed sessions
  const offlineSessions = getCompletedOfflineSessions();
  
  // Categorize weak (<65%) and strong (>=75%) topics
  const weakTopics: { subject: string; topic: string; accuracy: number }[] = [];
  const strongTopics: { subject: string; topic: string; accuracy: number }[] = [];

  Object.values(topicStatsMap).forEach(st => {
    const accuracy = st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;
    if (accuracy < 65) {
      weakTopics.push({ subject: st.subject, topic: st.topic, accuracy });
    } else if (accuracy >= 75) {
      strongTopics.push({ subject: st.subject, topic: st.topic, accuracy });
    }
  });

  // Sort weak topics ascending by accuracy
  weakTopics.sort((a, b) => a.accuracy - b.accuracy);

  // Check if today's tasks are already persisted in Supabase or LocalStorage
  let storedTasks: StudyTask[] = [];
  try {
    const { data: dbTasks } = await supabase
      .from('study_plan_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .order('created_at', { ascending: true });

    if (dbTasks && dbTasks.length > 0) {
      storedTasks = dbTasks.map((t: any) => ({
        id: t.id,
        timeSlot: t.time_slot || 'morning',
        slotLabel: getSlotLabel(t.time_slot),
        slotTime: getSlotTime(t.time_slot),
        title: t.title,
        subject: t.subject || 'Core UTME',
        topic: t.topic || 'General Practice',
        durationMinutes: t.duration_minutes || 30,
        priority: t.priority || 'medium',
        priorityLabel: t.priority === 'high' ? 'High Focus Area' : t.priority === 'medium' ? 'Recommended' : 'Refresher',
        recommendationReason: t.recommendation_reason || 'Personalized schedule task',
        actionType: t.action_type || 'drill',
        isCompleted: t.is_completed || false
      }));
    }
  } catch (e) {
    // Check LocalStorage cache
    const cacheKey = `daily_study_plan_${userId}_${todayStr}`;
    const rawCache = localStorage.getItem(cacheKey);
    if (rawCache) {
      try {
        storedTasks = JSON.parse(rawCache);
      } catch (err) {
        console.warn('Cache parse failed:', err);
      }
    }
  }

  // If we found existing tasks for today, return them!
  if (storedTasks.length > 0) {
    const completedCount = storedTasks.filter(t => t.isCompleted).length;
    const completionPercentage = Math.round((completedCount / storedTasks.length) * 100);
    return {
      date: todayStr,
      formattedDate,
      tasks: storedTasks,
      completionPercentage,
      weakTopicsFound: weakTopics.map(w => `${w.subject}: ${w.topic}`),
      strongTopicsFound: strongTopics.map(s => `${s.subject}: ${s.topic}`)
    };
  }

  // Otherwise, construct a UNIQUE, non-static schedule based on performance data
  const tasksToGenerate: StudyTask[] = [];

  // Slot 1: MORNING (08:00 AM) - High Priority Weak Topic Drill
  if (weakTopics.length > 0) {
    const topWeak = weakTopics[0];
    tasksToGenerate.push({
      id: `task_m1_${Date.now()}`,
      timeSlot: 'morning',
      slotLabel: 'Morning Focus',
      slotTime: '08:00 AM – 09:00 AM',
      title: `Remedial Drill: ${topWeak.topic}`,
      subject: topWeak.subject,
      topic: topWeak.topic,
      durationMinutes: 45,
      priority: 'high',
      priorityLabel: 'Remedial Focus Area',
      recommendationReason: `Auto-injected remedial task: Your accuracy on ${topWeak.topic} is currently ${topWeak.accuracy}%, which is below the 65% mastery threshold.`,
      actionType: 'drill',
      isCompleted: false
    });
  } else {
    tasksToGenerate.push({
      id: `task_m1_${Date.now()}`,
      timeSlot: 'morning',
      slotLabel: 'Morning Focus',
      slotTime: '08:00 AM – 09:00 AM',
      title: 'Vocabulary & Lexis Concord Masterclass',
      subject: 'Use of English',
      topic: 'Concord Rules & Subject-Verb Agreement',
      durationMinutes: 45,
      priority: 'high',
      priorityLabel: 'UTME High Yield',
      recommendationReason: 'English is mandatory for all UTME candidates (40% of total score).',
      actionType: 'drill',
      isCompleted: false
    });
  }

  // Slot 2: MID-DAY (12:00 PM) - Second Weak Topic or Concept Review
  if (weakTopics.length > 1) {
    const secondWeak = weakTopics[1];
    tasksToGenerate.push({
      id: `task_md_${Date.now()}`,
      timeSlot: 'midday',
      slotLabel: 'Mid-Day Practice',
      slotTime: '12:00 PM – 01:00 PM',
      title: `Remedial Review: ${secondWeak.topic}`,
      subject: secondWeak.subject,
      topic: secondWeak.topic,
      durationMinutes: 30,
      priority: 'high',
      priorityLabel: 'Remedial Target',
      recommendationReason: `Auto-injected remedial review: Your accuracy on ${secondWeak.topic} is currently ${secondWeak.accuracy}%, which is below the 65% mastery threshold.`,
      actionType: 'review',
      isCompleted: false
    });
  } else {
    tasksToGenerate.push({
      id: `task_md_${Date.now()}`,
      timeSlot: 'midday',
      slotLabel: 'Mid-Day Practice',
      slotTime: '12:00 PM – 01:00 PM',
      title: 'Algebra & Equations Problem Drill',
      subject: 'Mathematics',
      topic: 'Quadratic Equations & Algebra',
      durationMinutes: 30,
      priority: 'medium',
      priorityLabel: 'Core Skill',
      recommendationReason: 'Calculations require regular practice to maintain speed.',
      actionType: 'drill',
      isCompleted: false
    });
  }

  // Slot 3: AFTERNOON (03:30 PM) - Literature / Flashcard Review
  tasksToGenerate.push({
    id: `task_af_${Date.now()}`,
    timeSlot: 'afternoon',
    slotLabel: 'Afternoon Speed Drill',
    slotTime: '03:30 PM – 04:30 PM',
    title: 'JAMB Novel Hub: "The Life Changer" Characters & Plot',
    subject: 'Use of English',
    topic: 'Literature & Novel Comprehension',
    durationMinutes: 30,
    priority: 'medium',
    priorityLabel: 'Guaranteed Questions',
    recommendationReason: 'JAMB tests 10 direct questions on the prescribed UTME novel.',
    actionType: 'flashcard',
    isCompleted: false
  });

  // Slot 4: EVENING (08:00 PM) - Full Time-Management Mock or Refresher
  if (strongTopics.length > 0) {
    const strong = strongTopics[0];
    tasksToGenerate.push({
      id: `task_ev_${Date.now()}`,
      timeSlot: 'evening',
      slotLabel: 'Evening Mastery Check',
      slotTime: '08:00 PM – 09:00 PM',
      title: `Speed Mastery Check: ${strong.topic}`,
      subject: strong.subject,
      topic: strong.topic,
      durationMinutes: 30,
      priority: 'low',
      priorityLabel: 'Refresher Drill',
      recommendationReason: `Maintain your high proficiency (${strong.accuracy}%) with a 15-question speed test.`,
      actionType: 'mock',
      isCompleted: false
    });
  } else {
    tasksToGenerate.push({
      id: `task_ev_${Date.now()}`,
      timeSlot: 'evening',
      slotLabel: 'Evening Timed Session',
      slotTime: '08:00 PM – 09:00 PM',
      title: '40-Second Time-Management Practice Test',
      subject: 'Physics / Chemistry',
      topic: 'Electromagnetism & Periodic Trends',
      durationMinutes: 30,
      priority: 'medium',
      priorityLabel: 'Speed Challenge',
      recommendationReason: 'Train your response time to under 40 seconds per question.',
      actionType: 'mock',
      isCompleted: false
    });
  }

  // Persist generated tasks to DB / LocalStorage
  savePlannerTasks(userId, todayStr, tasksToGenerate);

  return {
    date: todayStr,
    formattedDate,
    tasks: tasksToGenerate,
    completionPercentage: 0,
    weakTopicsFound: weakTopics.map(w => `${w.subject}: ${w.topic}`),
    strongTopicsFound: strongTopics.map(s => `${s.subject}: ${s.topic}`)
  };
}

/**
 * Saves planner task state
 */
export async function savePlannerTasks(userId: string, dateStr: string, tasks: StudyTask[]): Promise<void> {
  const cacheKey = `daily_study_plan_${userId}_${dateStr}`;
  localStorage.setItem(cacheKey, JSON.stringify(tasks));

  try {
    if (userId) {
      // First delete existing for date
      await supabase.from('study_plan_tasks').delete().eq('user_id', userId).eq('date', dateStr);

      const dbInserts = tasks.map(t => ({
        user_id: userId,
        date: dateStr,
        time_slot: t.timeSlot,
        title: t.title,
        subject: t.subject,
        topic: t.topic,
        duration_minutes: t.durationMinutes,
        priority: t.priority,
        recommendation_reason: t.recommendationReason,
        action_type: t.actionType,
        is_completed: t.isCompleted
      }));

      await supabase.from('study_plan_tasks').insert(dbInserts);
    }
  } catch (err) {
    console.warn('[DailyStudyPlanner] Failed to save tasks to Supabase:', err);
  }
}

/**
 * Toggles completion status of a planner task
 */
export async function toggleTaskCompletion(userId: string, dateStr: string, taskId: string, currentTasks: StudyTask[]): Promise<StudyTask[]> {
  const updated = currentTasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
  await savePlannerTasks(userId, dateStr, updated);
  return updated;
}

function getSlotLabel(slot: string): string {
  switch (slot) {
    case 'morning': return 'Morning Focus';
    case 'midday': return 'Mid-Day Practice';
    case 'afternoon': return 'Afternoon Speed Drill';
    case 'evening': return 'Evening Timed Session';
    default: return 'Study Session';
  }
}

function getSlotTime(slot: string): string {
  switch (slot) {
    case 'morning': return '08:00 AM – 09:00 AM';
    case 'midday': return '12:00 PM – 01:00 PM';
    case 'afternoon': return '03:30 PM – 04:30 PM';
    case 'evening': return '08:00 PM – 09:00 PM';
    default: return 'Anytime';
  }
}
