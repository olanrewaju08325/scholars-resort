import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';

export interface LearningPathStep {
  id: string;
  stepNumber: number;
  subjectName: string;
  topicName: string;
  priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'REINFORCE';
  currentAccuracy: number;
  targetAccuracy: number;
  jambWeightPercent: number;
  estimatedMinutes: number;
  recommendedAction: string;
  learningReason: string;
  isCompleted: boolean;
  practiceSubjectParam: string;
}

export interface AdaptiveLearningPathData {
  generatedAt: string;
  totalSteps: number;
  completedStepsCount: number;
  estimatedTotalMinutes: number;
  potentialScoreGain: number; // e.g. +45 UTME Score Points
  topFocusSubject: string;
  steps: LearningPathStep[];
}

export async function generateAdaptiveLearningPath(
  userId?: string,
  filterSubject?: string
): Promise<AdaptiveLearningPathData> {
  // 1. Collect user performance across topics
  const topicAccuracyMap: Record<string, { total: number; correct: number; subject: string }> = {};

  try {
    if (userId) {
      const { data: answers } = await supabase
        .from('session_answers')
        .select('is_correct, questions(topic_id, topics(name), subjects(name))')
        .eq('user_id', userId)
        .limit(1000);

      if (answers && answers.length > 0) {
        answers.forEach((a: any) => {
          const tName = a.questions?.topics?.name || 'Core UTME Topic';
          const sName = a.questions?.subjects?.name || 'General';
          if (!topicAccuracyMap[tName]) {
            topicAccuracyMap[tName] = { total: 0, correct: 0, subject: sName };
          }
          topicAccuracyMap[tName].total += 1;
          if (a.is_correct) topicAccuracyMap[tName].correct += 1;
        });
      }
    }

    // Blend local IndexedDB exam data
    const localExams = await db.pending_sessions.toArray();
    localExams.forEach((e: any) => {
      const sub = e.subject || 'General';
      if (!topicAccuracyMap[sub]) {
        topicAccuracyMap[sub] = { total: 0, correct: 0, subject: sub };
      }
      topicAccuracyMap[sub].total += 10;
      topicAccuracyMap[sub].correct += e.score || 0;
    });
  } catch (err) {
    console.warn('[AdaptiveLearningPath] Warning reading user history:', err);
  }

  // Master repository of high-yield UTME topics to build the path from
  const candidateTopics = [
    { subject: 'Use of English', topic: 'Grammar: Concord & Subject-Verb Agreement', weight: 20, defaultMinutes: 20 },
    { subject: 'Use of English', topic: 'Lexis: Synonyms, Antonyms & Idioms', weight: 25, defaultMinutes: 25 },
    { subject: 'Use of English', topic: 'Oral Forms: Vowels & Stress Placement', weight: 15, defaultMinutes: 15 },
    { subject: 'Use of English', topic: 'Mandatory Novel: The Life Changer', weight: 20, defaultMinutes: 20 },

    { subject: 'Mathematics', topic: 'Polynomials & Quadratic Equations', weight: 18, defaultMinutes: 30 },
    { subject: 'Mathematics', topic: 'Calculus: Differentiation & Integration', weight: 20, defaultMinutes: 35 },
    { subject: 'Mathematics', topic: 'Trigonometry & Bearings', weight: 15, defaultMinutes: 25 },
    { subject: 'Mathematics', topic: 'Number Bases & Logarithms', weight: 12, defaultMinutes: 20 },

    { subject: 'Physics', topic: 'Units, Vectors & Motion Kinematics', weight: 15, defaultMinutes: 25 },
    { subject: 'Physics', topic: 'Waves, Optics & Sound', weight: 20, defaultMinutes: 30 },
    { subject: 'Physics', topic: 'Current Electricity & Magnetism', weight: 20, defaultMinutes: 30 },
    { subject: 'Physics', topic: 'Thermal Physics & Gas Laws', weight: 15, defaultMinutes: 20 },

    { subject: 'Chemistry', topic: 'Electrochemistry & Faraday\'s Laws', weight: 18, defaultMinutes: 30 },
    { subject: 'Chemistry', topic: 'Organic Chemistry & Hydrocarbons', weight: 22, defaultMinutes: 35 },
    { subject: 'Chemistry', topic: 'Stoichiometry & Mole Calculations', weight: 18, defaultMinutes: 25 },
    { subject: 'Chemistry', topic: 'Acids, Bases, Salts & Volumetric Titration', weight: 18, defaultMinutes: 25 },

    { subject: 'Biology', topic: 'Genetics, Heredity & Punnett Squares', weight: 22, defaultMinutes: 30 },
    { subject: 'Biology', topic: 'Plant & Animal Nutrition', weight: 18, defaultMinutes: 25 },
    { subject: 'Biology', topic: 'Transport Systems & Respiration', weight: 18, defaultMinutes: 25 },
    { subject: 'Biology', topic: 'Cell Structure & Organization of Life', weight: 15, defaultMinutes: 20 },
  ];

  // Filter if user selected a specific subject
  const filteredList = filterSubject && filterSubject !== 'all'
    ? candidateTopics.filter(t => t.subject.toLowerCase() === filterSubject.toLowerCase())
    : candidateTopics;

  // Evaluate weakness score for each candidate topic
  const evaluatedList = filteredList.map((cand) => {
    // Find matching accuracy in topicAccuracyMap
    let accuracy = 40; // baseline if no data
    let attempts = 0;

    Object.entries(topicAccuracyMap).forEach(([key, val]) => {
      if (key.toLowerCase().includes(cand.topic.toLowerCase()) || cand.topic.toLowerCase().includes(key.toLowerCase())) {
        if (val.total > 0) {
          accuracy = Math.round((val.correct / val.total) * 100);
          attempts = val.total;
        }
      }
    });

    // Calculate Priority Score: Higher score = Needs more urgent study
    // Topics with accuracy < 50% get a huge boost, weighted by UTME exam frequency
    const weaknessFactor = 100 - accuracy;
    const priorityScore = weaknessFactor * (cand.weight / 10) + (attempts === 0 ? 15 : 0);

    let priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'REINFORCE' = 'MEDIUM';
    if (accuracy < 45) priorityLevel = 'CRITICAL';
    else if (accuracy < 60) priorityLevel = 'HIGH';
    else if (accuracy < 75) priorityLevel = 'MEDIUM';
    else priorityLevel = 'REINFORCE';

    return {
      ...cand,
      accuracy,
      attempts,
      priorityScore,
      priorityLevel
    };
  });

  // Sort by priorityScore descending to show weakest / highest-impact topics first
  evaluatedList.sort((a, b) => b.priorityScore - a.priorityScore);

  // Take top 6 steps for the sequence
  const selectedSteps = evaluatedList.slice(0, 6);

  const steps: LearningPathStep[] = selectedSteps.map((item, index) => {
    let recAction = 'Solve 15 Targeted Drill Questions';
    let reason = `High-yield UTME concept (${item.weight}% weight). Your current accuracy is ${item.accuracy}%.`;

    if (item.priorityLevel === 'CRITICAL') {
      recAction = 'Review Concept Cheat Sheet & Solve 20 Remedial Questions';
      reason = `Critical Weakness Alert: Accuracy is at ${item.accuracy}%. Mastering this adds +12 UTME points.`;
    } else if (item.priorityLevel === 'HIGH') {
      recAction = 'Complete 15 Speed Calculations Drill';
      reason = `High Impact Area: UTME weight is ${item.weight}%. Boost accuracy from ${item.accuracy}% to 80%+.`;
    } else if (item.priorityLevel === 'REINFORCE') {
      recAction = 'Take 10-Question Speed Mastery Check';
      reason = `Good foundation (${item.accuracy}% accuracy). Take quick refresher to maintain peak readiness.`;
    }

    return {
      id: `lpath_step_${index + 1}_${item.subject.toLowerCase().replace(/\s+/g, '_')}`,
      stepNumber: index + 1,
      subjectName: item.subject,
      topicName: item.topic,
      priorityLevel: item.priorityLevel,
      currentAccuracy: item.accuracy,
      targetAccuracy: Math.min(95, item.accuracy + 25),
      jambWeightPercent: item.weight,
      estimatedMinutes: item.defaultMinutes,
      recommendedAction: recAction,
      learningReason: reason,
      isCompleted: item.accuracy >= 85,
      practiceSubjectParam: item.subject
    };
  });

  const totalEstMin = steps.reduce((acc, s) => acc + s.estimatedMinutes, 0);
  const completedCount = steps.filter((s) => s.isCompleted).length;
  const focusSub = steps[0]?.subjectName || 'Mathematics';

  return {
    generatedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    totalSteps: steps.length,
    completedStepsCount: completedCount,
    estimatedTotalMinutes: totalEstMin,
    potentialScoreGain: Math.max(25, (steps.length - completedCount) * 8),
    topFocusSubject: focusSub,
    steps
  };
}
