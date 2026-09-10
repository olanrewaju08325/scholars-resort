import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { fetchAcademicLearningRules, type AcademicLearningRules } from './academicLearningRulesService';
import { CANONICAL_UTME_SUBJECTS, CANONICAL_SYLLABUS_DETAILS } from '@/utils/subjectTaxonomy';

export interface JourneyNode {
  id: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  unitName: string;
  level: number;
  sequence: number;
  prerequisites: string[]; // Node IDs required
  jambWeightPercent: number; // Weight in UTME Exam
  description: string;
  keyConcepts: string[];
  status: 'mastered' | 'in_progress' | 'locked';
  accuracyPercentage: number;
  questionsAttempted: number;
  correctAnswers: number;
  recommendedAction: string;
  recommendedReading?: string;
}

export interface SubjectJourney {
  subjectId: string;
  subjectName: string;
  totalNodes: number;
  masteredNodes: number;
  completionPercentage: number;
  nodes: JourneyNode[];
}

export interface OverallJourneyProgress {
  totalMastered: number;
  totalTopics: number;
  overallPercentage: number;
  currentActiveTopic: JourneyNode | null;
  subjectJourneys: Record<string, SubjectJourney>;
  learningRules: AcademicLearningRules;
}

export async function fetchEducationalJourneyProgress(userId?: string): Promise<OverallJourneyProgress> {
  // 1. Fetch Authoritative Academic Learning Rules from DB (admin_settings)
  const learningRules = await fetchAcademicLearningRules();

  // 2. Fetch Subjects and Topics from Supabase
  let subjectsList: any[] = [];
  let topicsList: any[] = [];

  try {
    const [subRes, topRes] = await Promise.all([
      supabase.from('subjects').select('*').eq('is_active', true).order('name'),
      supabase.from('topics').select('*, subjects(id, name)').order('name')
    ]);

    if (subRes.data && subRes.data.length > 0) {
      subjectsList = subRes.data;
    }
    if (topRes.data && topRes.data.length > 0) {
      topicsList = topRes.data;
    }
  } catch (err) {
    console.warn('[EducationalJourney] Error fetching subjects/topics from Supabase:', err);
  }

  // If DB topics are empty, load canonical UTME subjects & syllabus
  if (topicsList.length === 0) {
    CANONICAL_UTME_SUBJECTS.forEach((sub) => {
      const details = CANONICAL_SYLLABUS_DETAILS[sub.id] || [];
      details.forEach((top, idx) => {
        topicsList.push({
          id: `top_${sub.code.toLowerCase()}_${idx + 1}`,
          name: top.name,
          description: top.description,
          sequence: idx + 1,
          jamb_weight: 15,
          level: Math.min(Math.floor(idx / 3) + 1, 4),
          learning_objectives: top.subtopics?.flatMap(st => st.learningObjectives) || [top.name],
          subjects: { id: sub.id, name: sub.name }
        });
      });
    });
  }

  // 3. Collect REAL User performance statistics and Supabase topic_progress records
  const topicStats: Record<string, { total: number; correct: number; isMastered?: boolean; score?: number }> = {};
  let totalUserAnswers = 0;

  try {
    if (userId) {
      // Query Supabase topic_progress table directly
      const { data: dbProgress } = await supabase
        .from('topic_progress')
        .select('*')
        .eq('user_id', userId);

      if (dbProgress && dbProgress.length > 0) {
        dbProgress.forEach((tp: any) => {
          const tId = tp.topic_id;
          if (tId) {
            const attempted = tp.questions_attempted || 10;
            const scoreVal = Number(tp.score) || 0;
            topicStats[tId] = {
              total: attempted,
              correct: Math.round((scoreVal / 100) * attempted),
              isMastered: tp.is_mastered || scoreVal >= 70,
              score: scoreVal
            };
          }
        });
      }

      const { data: answers } = await supabase
        .from('session_answers')
        .select('is_correct, question_id, questions(topic_id, topics(name, id), subjects(name, id))')
        .eq('user_id', userId)
        .limit(2000);

      if (answers && answers.length > 0) {
        totalUserAnswers += answers.length;
        answers.forEach((ans: any) => {
          const tId = ans.questions?.topics?.id || ans.questions?.topic_id;
          const tName = ans.questions?.topics?.name;
          const sName = ans.questions?.subjects?.name;

          if (tId) {
            if (!topicStats[tId]) topicStats[tId] = { total: 0, correct: 0 };
            topicStats[tId].total += 1;
            if (ans.is_correct) topicStats[tId].correct += 1;
          }
          if (tName) {
            if (!topicStats[tName]) topicStats[tName] = { total: 0, correct: 0 };
            topicStats[tName].total += 1;
            if (ans.is_correct) topicStats[tName].correct += 1;
          }
          if (sName) {
            if (!topicStats[sName]) topicStats[sName] = { total: 0, correct: 0 };
            topicStats[sName].total += 1;
            if (ans.is_correct) topicStats[sName].correct += 1;
          }
        });
      }
    }

    // Blend IndexedDB local offline exams
    const localExams = await db.pending_sessions.toArray();
    localExams.forEach((e: any) => {
      if (e.subject) {
        if (!topicStats[e.subject]) topicStats[e.subject] = { total: 0, correct: 0 };
        topicStats[e.subject].total += 10;
        topicStats[e.subject].correct += e.score || 0;
        totalUserAnswers += 10;
      }
    });
  } catch (err) {
    console.warn('[EducationalJourney] Error fetching user answer stats:', err);
  }

  // 4. Map DB Topics into Journey Nodes
  const evaluatedNodes: JourneyNode[] = topicsList.map((t, idx) => {
    const subName = t.subjects?.name || 'General Subject';
    const subId = t.subjects?.id || t.subject_id || 'general';
    const tName = t.name || t.title || `Topic ${idx + 1}`;
    const tId = t.id || `top_${idx + 1}`;

    // Find real stats for this topic
    const statById = topicStats[tId];
    const statByName = topicStats[tName];
    const totalAttempted = (statById?.total || 0) + (statByName?.total || 0);
    const correctCount = (statById?.correct || 0) + (statByName?.correct || 0);

    const accuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;

    const prereqs = Array.isArray(t.prerequisites) ? t.prerequisites : [];
    const concepts = Array.isArray(t.learning_objectives) && t.learning_objectives.length > 0
      ? t.learning_objectives
      : [tName, 'Core UTME Principles', 'Exam Application'];

    return {
      id: tId,
      subjectId: subId,
      subjectName: subName,
      topicName: tName,
      unitName: t.description || `Unit ${t.sequence || idx + 1}`,
      level: Number(t.level) || 1,
      sequence: Number(t.sequence) || (idx + 1),
      prerequisites: prereqs,
      jambWeightPercent: Number(t.jamb_weight) || 15,
      description: t.description || `Syllabus mastery module for ${tName}`,
      keyConcepts: concepts,
      status: 'locked' as const,
      accuracyPercentage: accuracy,
      questionsAttempted: totalAttempted,
      correctAnswers: correctCount,
      recommendedAction: t.recommended_action || (Array.isArray(t.recommended_tasks) && t.recommended_tasks[0]) || `Solve 15 Drill Questions on ${tName}`,
      recommendedReading: t.recommended_reading || t.prescribed_book || t.reading_material || ''
    };
  });

  // 5. Evaluate Mastery and Prerequisite Unlocking per Subject
  const subjectGroups: Record<string, SubjectJourney> = {};
  const { masteryThresholdPercent, minAttemptsForMastery, prerequisiteMode } = learningRules;

  // Group nodes by subject
  const subNodeMap: Record<string, JourneyNode[]> = {};
  evaluatedNodes.forEach((node) => {
    if (!subNodeMap[node.subjectId]) subNodeMap[node.subjectId] = [];
    subNodeMap[node.subjectId].push(node);
  });

  Object.entries(subNodeMap).forEach(([subId, nodes]) => {
    // Sort nodes by sequence ascending
    nodes.sort((a, b) => a.sequence - b.sequence);

    // Track mastered node IDs in this subject
    const masteredIds = new Set<string>();

    // Pass 1: Mark nodes that meet the >= 70% mastery criteria
    nodes.forEach((node) => {
      if (node.accuracyPercentage >= 70 || (node.questionsAttempted >= minAttemptsForMastery && node.accuracyPercentage >= masteryThresholdPercent)) {
        node.status = 'mastered';
        masteredIds.add(node.id);
      }
    });

    // Pass 2: Evaluate Unlocking / In-Progress status based on sequence and prerequisites
    nodes.forEach((node, index) => {
      if (node.status === 'mastered') return;

      if (prerequisiteMode === 'advisory') {
        // In advisory mode (Admin Toggle Override), all nodes are accessible
        node.status = 'in_progress';
      } else {
        // Strict Prerequisite Mode:
        // Starter node (index === 0) is always available in_progress
        if (index === 0) {
          node.status = 'in_progress';
          return;
        }

        // If explicit prerequisites are specified, check if all are mastered
        if (node.prerequisites.length > 0) {
          const allPrereqsMastered = node.prerequisites.every((prereqId) => masteredIds.has(prereqId));
          if (allPrereqsMastered) {
            node.status = 'in_progress';
          } else {
            node.status = 'locked';
          }
        } else {
          // If no explicit prerequisites, unlock when previous node in sequence is mastered (score >= 70%)
          const prevNode = nodes[index - 1];
          if (prevNode && (prevNode.status === 'mastered' || prevNode.accuracyPercentage >= 70)) {
            node.status = 'in_progress';
          } else {
            node.status = 'locked';
          }
        }
      }
    });

    const totalNodes = nodes.length;
    const masteredCount = nodes.filter((n) => n.status === 'mastered').length;
    const completionPercentage = totalNodes > 0 ? Math.round((masteredCount / totalNodes) * 100) : 0;
    const firstNode = nodes[0];

    subjectGroups[subId] = {
      subjectId: subId,
      subjectName: firstNode ? firstNode.subjectName : subId,
      totalNodes,
      masteredNodes: masteredCount,
      completionPercentage,
      nodes
    };
  });

  const totalMastered = evaluatedNodes.filter((n) => n.status === 'mastered').length;
  const totalTopics = evaluatedNodes.length;
  const overallPercentage = totalTopics > 0 ? Math.round((totalMastered / totalTopics) * 100) : 0;

  const currentActiveTopic = evaluatedNodes.find((n) => n.status === 'in_progress') || evaluatedNodes[0] || null;

  return {
    totalMastered,
    totalTopics,
    overallPercentage,
    currentActiveTopic,
    subjectJourneys: subjectGroups,
    learningRules
  };
}
