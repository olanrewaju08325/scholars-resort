import { supabase } from '@/lib/supabase';
import { normalizeSubjectName, isUUID } from '@/utils/subjectUtils';
import { callGroqAPI, stripThinkTags } from '@/services/aiService';

export interface DataHealthIssue {
  id: string;
  type: 'missing_topic' | 'invalid_topic_fk' | 'missing_subject_fk' | 'missing_explanation' | 'malformed_options' | 'invalid_answer';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  count: number;
  description: string;
  affectedQuestionIds: string[];
  canAutoFix: boolean;
  fixActionName?: string;
}

export interface SubjectHealthBreakdown {
  subjectId: string;
  subjectName: string;
  totalQuestions: number;
  healthyQuestions: number;
  orphanedNoTopicCount: number;
  missingExplanationCount: number;
  topicsCount: number;
}

export interface DataHealthAuditReport {
  timestamp: string;
  overallScore: number; // 0 to 100
  status: 'healthy' | 'warning' | 'critical';
  totalQuestions: number;
  healthyQuestionsCount: number;
  totalSubjects: number;
  totalTopics: number;
  orphanedQuestionsCount: number;
  missingExplanationCount: number;
  invalidOptionsCount: number;
  issues: DataHealthIssue[];
  subjectBreakdowns: SubjectHealthBreakdown[];
}

export class DataHealthAuditService {
  /**
   * Run a comprehensive audit of all questions in the database to detect orphans,
   * broken relations, missing explanations, and schema inconsistencies.
   */
  public static async runAudit(): Promise<DataHealthAuditReport> {
    const timestamp = new Date().toISOString();

    // 1. Query all subjects
    const { data: subjectsData } = await supabase.from('subjects').select('id, name, is_active');
    const subjects = subjectsData || [];
    const subjectMap = new Map<string, { id: string; name: string }>();
    const subjectIdSet = new Set<string>();
    subjects.forEach(s => {
      subjectMap.set(s.id, s);
      subjectIdSet.add(s.id);
    });

    // 2. Query all topics
    const { data: topicsData } = await supabase.from('topics').select('id, name, subject_id');
    const topics = topicsData || [];
    const topicMap = new Map<string, { id: string; name: string; subject_id: string }>();
    const topicIdSet = new Set<string>();
    const topicsBySubject = new Map<string, Array<{ id: string; name: string }>>();
    
    topics.forEach(t => {
      topicMap.set(t.id, t);
      topicIdSet.add(t.id);
      const existing = topicsBySubject.get(t.subject_id) || [];
      existing.push({ id: t.id, name: t.name });
      topicsBySubject.set(t.subject_id, existing);
    });

    // 3. Query all questions across full database using paginated ranges (bypassing PostgREST 1000 limit)
    let questions: any[] = [];
    try {
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: chunk, error: qErr } = await supabase
          .from('questions')
          .select('id, question_text, subject_id, topic_id, correct_answer, explanation, options, is_active, year')
          .range(from, from + pageSize - 1);

        if (qErr) {
          console.warn('[DataHealthAuditService] Query batch error:', qErr.message);
          break;
        }

        if (!chunk || chunk.length === 0) break;
        questions = questions.concat(chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }
    } catch (err) {
      console.warn('[DataHealthAuditService] Error fetching questions:', err);
    }

    const totalQuestions = questions.length;

    // Issue Trackers
    const missingTopicIds: string[] = [];
    const invalidTopicFkIds: string[] = [];
    const missingSubjectFkIds: string[] = [];
    const missingExplanationIds: string[] = [];
    const malformedOptionIds: string[] = [];
    const invalidAnswerIds: string[] = [];

    // Per-subject counters
    const subjectStats = new Map<string, {
      total: number;
      healthy: number;
      orphanedNoTopic: number;
      missingExp: number;
    }>();

    subjects.forEach(s => {
      subjectStats.set(s.id, { total: 0, healthy: 0, orphanedNoTopic: 0, missingExp: 0 });
    });

    // Unassigned subject bucket
    const UNMAPPED_KEY = 'unmapped';
    subjectStats.set(UNMAPPED_KEY, { total: 0, healthy: 0, orphanedNoTopic: 0, missingExp: 0 });

    for (const q of questions) {
      let isQuestionHealthy = true;
      const subId = q.subject_id;
      const subStatKey = (subId && subjectIdSet.has(subId)) ? subId : UNMAPPED_KEY;
      const stat = subjectStats.get(subStatKey)!;
      stat.total++;

      // Check Subject FK
      if (!subId || !subjectIdSet.has(subId)) {
        missingSubjectFkIds.push(q.id);
        isQuestionHealthy = false;
      }

      // Check Topic FK / Orphan status
      if (!q.topic_id || String(q.topic_id).trim() === '') {
        missingTopicIds.push(q.id);
        stat.orphanedNoTopic++;
        isQuestionHealthy = false;
      } else if (!topicIdSet.has(q.topic_id)) {
        invalidTopicFkIds.push(q.id);
        stat.orphanedNoTopic++;
        isQuestionHealthy = false;
      }

      // Check Explanation
      if (!q.explanation || String(q.explanation).trim().length < 5) {
        missingExplanationIds.push(q.id);
        stat.missingExp++;
      }

      // Check Options
      let optCount = 0;
      if (Array.isArray(q.options)) {
        optCount = q.options.length;
      } else if (typeof q.options === 'string') {
        try {
          const parsed = JSON.parse(q.options);
          optCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          optCount = 0;
        }
      }
      if (optCount < 2) {
        malformedOptionIds.push(q.id);
        isQuestionHealthy = false;
      }

      // Check Answer Key
      if (!q.correct_answer || String(q.correct_answer).trim() === '') {
        invalidAnswerIds.push(q.id);
        isQuestionHealthy = false;
      }

      if (isQuestionHealthy) {
        stat.healthy++;
      }
    }

    // Build Issues List
    const issues: DataHealthIssue[] = [];

    if (missingTopicIds.length > 0) {
      issues.push({
        id: 'missing-topics',
        type: 'missing_topic',
        severity: 'warning',
        title: 'Questions Missing Parent Topic Link',
        count: missingTopicIds.length,
        description: `${missingTopicIds.length} question(s) have no topic assigned (topic_id is NULL). Students will not see these in topic drills.`,
        affectedQuestionIds: missingTopicIds,
        canAutoFix: true,
        fixActionName: 'Auto-Link to Subject Core Topic'
      });
    }

    if (invalidTopicFkIds.length > 0) {
      issues.push({
        id: 'invalid-topic-fk',
        type: 'invalid_topic_fk',
        severity: 'critical',
        title: 'Broken Topic References (Foreign Key Inconsistency)',
        count: invalidTopicFkIds.length,
        description: `${invalidTopicFkIds.length} question(s) reference topic IDs that do not exist in the topics table.`,
        affectedQuestionIds: invalidTopicFkIds,
        canAutoFix: true,
        fixActionName: 'Repair Topic Foreign Keys'
      });
    }

    if (missingSubjectFkIds.length > 0) {
      issues.push({
        id: 'missing-subject-fk',
        type: 'missing_subject_fk',
        severity: 'critical',
        title: 'Unmapped / Orphaned Subject References',
        count: missingSubjectFkIds.length,
        description: `${missingSubjectFkIds.length} question(s) have NULL or non-existent subject_id references.`,
        affectedQuestionIds: missingSubjectFkIds,
        canAutoFix: false,
        fixActionName: 'Reassign to Verified Subject'
      });
    }

    if (missingExplanationIds.length > 0) {
      issues.push({
        id: 'missing-explanations',
        type: 'missing_explanation',
        severity: 'info',
        title: 'Questions Missing Detailed Explanations',
        count: missingExplanationIds.length,
        description: `${missingExplanationIds.length} question(s) lack rich step-by-step explanations. Students will receive generic fallback messages.`,
        affectedQuestionIds: missingExplanationIds,
        canAutoFix: true,
        fixActionName: 'Generate AI Explanations'
      });
    }

    if (malformedOptionIds.length > 0) {
      issues.push({
        id: 'malformed-options',
        type: 'malformed_options',
        severity: 'critical',
        title: 'Malformed Question Option Choices',
        count: malformedOptionIds.length,
        description: `${malformedOptionIds.length} question(s) have less than 2 options or corrupted JSON choices.`,
        affectedQuestionIds: malformedOptionIds,
        canAutoFix: false
      });
    }

    if (invalidAnswerIds.length > 0) {
      issues.push({
        id: 'invalid-answers',
        type: 'invalid_answer',
        severity: 'critical',
        title: 'Missing Answer Key',
        count: invalidAnswerIds.length,
        description: `${invalidAnswerIds.length} question(s) have no correct answer specified.`,
        affectedQuestionIds: invalidAnswerIds,
        canAutoFix: false
      });
    }

    // Build Subject Breakdowns
    const subjectBreakdowns: SubjectHealthBreakdown[] = [];
    subjects.forEach(s => {
      const stat = subjectStats.get(s.id)!;
      const subTopics = topicsBySubject.get(s.id) || [];
      subjectBreakdowns.push({
        subjectId: s.id,
        subjectName: s.name,
        totalQuestions: stat.total,
        healthyQuestions: stat.healthy,
        orphanedNoTopicCount: stat.orphanedNoTopic,
        missingExplanationCount: stat.missingExp,
        topicsCount: subTopics.length
      });
    });

    const unmappedStat = subjectStats.get(UNMAPPED_KEY)!;
    if (unmappedStat.total > 0) {
      subjectBreakdowns.push({
        subjectId: 'unmapped',
        subjectName: '⚠️ Unmapped / Orphaned Subject',
        totalQuestions: unmappedStat.total,
        healthyQuestions: 0,
        orphanedNoTopicCount: unmappedStat.orphanedNoTopic,
        missingExplanationCount: unmappedStat.missingExp,
        topicsCount: 0
      });
    }

    const totalOrphans = missingTopicIds.length + invalidTopicFkIds.length;
    const criticalIssueCount = missingSubjectFkIds.length + malformedOptionIds.length + invalidAnswerIds.length;
    
    // Compute score out of 100
    let overallScore = 100;
    if (totalQuestions > 0) {
      const penalty = ((totalOrphans * 1.5) + (criticalIssueCount * 3) + (missingExplanationIds.length * 0.5)) / totalQuestions * 100;
      overallScore = Math.max(10, Math.min(100, Math.round(100 - penalty)));
    }

    const status = overallScore >= 85 ? 'healthy' : overallScore >= 60 ? 'warning' : 'critical';

    return {
      timestamp,
      overallScore,
      status,
      totalQuestions,
      healthyQuestionsCount: totalQuestions - (totalOrphans + criticalIssueCount),
      totalSubjects: subjects.length,
      totalTopics: topics.length,
      orphanedQuestionsCount: totalOrphans,
      missingExplanationCount: missingExplanationIds.length,
      invalidOptionsCount: malformedOptionIds.length,
      issues,
      subjectBreakdowns: subjectBreakdowns.sort((a, b) => b.totalQuestions - a.totalQuestions)
    };
  }

  /**
   * Automatically repairs orphaned questions (questions with missing or invalid topic_id)
   * by ensuring a verified default topic exists for each subject and batch updating the question records.
   */
  public static async autoFixOrphanedTopics(): Promise<{
    success: boolean;
    repairedCount: number;
    createdTopicsCount: number;
    message: string;
  }> {
    // 1. Fetch all subjects
    const { data: subjects } = await supabase.from('subjects').select('id, name');
    if (!subjects || subjects.length === 0) {
      return { success: false, repairedCount: 0, createdTopicsCount: 0, message: 'No subjects found in database.' };
    }

    // 2. Fetch all existing topics
    const { data: topics } = await supabase.from('topics').select('id, name, subject_id');
    const validTopicIds = new Set((topics || []).map(t => t.id));
    const defaultTopicMap = new Map<string, string>(); // subject_id -> topic_id

    let createdTopicsCount = 0;

    for (const sub of subjects) {
      // Find an existing "General" or first available topic
      const subTopics = (topics || []).filter(t => t.subject_id === sub.id);
      const generalTopic = subTopics.find(t => 
        t.name.toLowerCase().includes('general') || 
        t.name.toLowerCase().includes('foundations') ||
        t.name.toLowerCase().includes('core') ||
        t.name.toLowerCase().includes('fundamentals')
      ) || subTopics[0];

      if (generalTopic) {
        defaultTopicMap.set(sub.id, generalTopic.id);
      } else {
        // Create a default topic for this subject
        const { data: newTopic, error: createErr } = await supabase
          .from('topics')
          .insert({
            subject_id: sub.id,
            name: `${sub.name} - Core Syllabus & Concepts`
          })
          .select('id')
          .single();

        if (newTopic && !createErr) {
          defaultTopicMap.set(sub.id, newTopic.id);
          validTopicIds.add(newTopic.id);
          createdTopicsCount++;
        }
      }
    }

    // 3. Fetch all questions that are missing topic_id or have invalid topic_id
    const { data: questions } = await supabase
      .from('questions')
      .select('id, subject_id, topic_id')
      .limit(10000);

    if (!questions) {
      return { success: true, repairedCount: 0, createdTopicsCount, message: 'No questions to inspect.' };
    }

    const orphansToFix = questions.filter(q => {
      if (!q.subject_id) return false; // cannot auto-assign without subject
      if (!q.topic_id || String(q.topic_id).trim() === '') return true;
      if (!validTopicIds.has(q.topic_id)) return true;
      return false;
    });

    if (orphansToFix.length === 0) {
      return { 
        success: true, 
        repairedCount: 0, 
        createdTopicsCount, 
        message: 'No orphaned questions detected. All questions are linked to verified topics!' 
      };
    }

    let repairedCount = 0;

    // Batch update by subject
    const questionsBySubject = new Map<string, string[]>();
    orphansToFix.forEach(q => {
      const list = questionsBySubject.get(q.subject_id) || [];
      list.push(q.id);
      questionsBySubject.set(q.subject_id, list);
    });

    for (const [subId, qIds] of questionsBySubject.entries()) {
      const targetTopicId = defaultTopicMap.get(subId);
      if (!targetTopicId) continue;

      // Update in chunks of 100
      for (let i = 0; i < qIds.length; i += 100) {
        const chunk = qIds.slice(i, i + 100);
        const { error: updateErr } = await supabase
          .from('questions')
          .update({ topic_id: targetTopicId })
          .in('id', chunk);

        if (!updateErr) {
          repairedCount += chunk.length;
        } else {
          console.warn('[AutoFixOrphans] Chunk update error:', updateErr.message);
        }
      }
    }

    return {
      success: true,
      repairedCount,
      createdTopicsCount,
      message: `Successfully mapped ${repairedCount} orphaned questions to verified curriculum topics across ${questionsBySubject.size} subjects.`
    };
  }

  /**
   * Batch generates AI explanations for questions missing detailed feedback.
   */
  public static async autoGenerateMissingExplanations(
    limit: number = 10,
    onProgress?: (current: number, total: number) => void
  ): Promise<{
    success: boolean;
    updatedCount: number;
    errors: string[];
  }> {
    // 1. Fetch questions with missing explanations
    const { data: questions } = await supabase
      .from('questions')
      .select('id, question_text, options, correct_answer, explanation')
      .or('explanation.is.null,explanation.eq.')
      .limit(limit);

    if (!questions || questions.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      onProgress?.(i + 1, questions.length);

      try {
        const prompt = `You are a high-accuracy JAMB UTME & WAEC academic examiner.
Generate a concise, crystal-clear, step-by-step pedagogical explanation for this exam question.

Question: ${q.question_text}
Options: ${JSON.stringify(q.options)}
Correct Answer: ${q.correct_answer}

Provide only the explanation text (2 to 4 concise sentences or calculation steps). Do not include introductory conversational filler.`;

        const response = await callGroqAPI([{ role: 'user', content: prompt }]);
        const cleanExp = response ? stripThinkTags(response).trim() : '';

        if (cleanExp && cleanExp.length > 10) {
          const { error: upErr } = await supabase
            .from('questions')
            .update({ explanation: cleanExp })
            .eq('id', q.id);

          if (!upErr) {
            updatedCount++;
          } else {
            errors.push(`Question ${q.id}: ${upErr.message}`);
          }
        }
      } catch (err: any) {
        errors.push(`Question ${q.id}: ${err.message}`);
      }
    }

    return {
      success: updatedCount > 0,
      updatedCount,
      errors
    };
  }
}
