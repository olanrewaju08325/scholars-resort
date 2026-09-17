import { supabase } from '@/lib/supabase';
import { cleanQuestionText, checkIsCorrect } from '@/utils/questionUtils';

export interface TopicMistakeSummary {
  topicId: string;
  topicName: string;
  subjectId?: string;
  subjectName: string;
  totalAttempted: number;
  correctCount: number;
  missedCount: number;
  accuracyPercentage: number;
  masteryStatus: 'Mastered' | 'Developing' | 'Needs Review';
  subtopics: Array<{
    subtopicId?: string;
    subtopicName: string;
    missedCount: number;
  }>;
  missedQuestions: Array<{
    id: string;
    questionText: string;
    topicName: string;
    subtopicName?: string;
    userAnswer?: string;
    correctAnswer: string;
    explanation?: string;
    options?: any[];
    year?: string | number;
  }>;
}

export class SmartMistakeEngine {
  /**
   * Fetches topic & subtopic accuracy summaries from live session_answers for a specific user.
   */
  static async getTopicPerformanceSummaries(userId?: string): Promise<TopicMistakeSummary[]> {
    try {
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: authData } = await supabase.auth.getUser();
        targetUserId = authData?.user?.id;
      }

      if (!targetUserId) {
        return this.getFallbackLocalSummaries();
      }

      // Query session_answers joining questions, topics, subjects
      const { data: answers, error } = await supabase
        .from('session_answers')
        .select(`
          id,
          is_correct,
          user_answer,
          created_at,
          question_id,
          questions (
            id,
            question_text,
            question,
            options,
            correct_answer,
            explanation,
            year,
            topic_id,
            subtopic_id,
            topic_name,
            subtopic_name,
            topics ( id, name ),
            subjects ( id, name )
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error || !answers || answers.length === 0) {
        return this.getLocalMistakeSummaries();
      }

      const map = new Map<string, {
        topicId: string;
        topicName: string;
        subjectName: string;
        total: number;
        correct: number;
        missed: number;
        subtopicMap: Map<string, number>;
        missedQuestions: any[];
      }>();

      answers.forEach(ans => {
        const q = ans.questions as any;
        if (!q) return;

        const topicId = q.topic_id || q.topics?.id || 'gen_topic';
        const topicName = q.topics?.name || q.topic_name || 'General Syllabus Topic';
        const subjectName = q.subjects?.name || 'General Subject';
        const subtopicName = q.subtopic_name || 'Core Objectives';

        if (!map.has(topicId)) {
          map.set(topicId, {
            topicId,
            topicName,
            subjectName,
            total: 0,
            correct: 0,
            missed: 0,
            subtopicMap: new Map(),
            missedQuestions: []
          });
        }

        const entry = map.get(topicId)!;
        entry.total += 1;

        if (ans.is_correct) {
          entry.correct += 1;
        } else {
          entry.missed += 1;
          const subCount = entry.subtopicMap.get(subtopicName) || 0;
          entry.subtopicMap.set(subtopicName, subCount + 1);

          // Add unique missed question
          if (!entry.missedQuestions.some(item => item.id === q.id)) {
            entry.missedQuestions.push({
              id: q.id,
              questionText: cleanQuestionText(q.question_text || q.question || ''),
              topicName,
              subtopicName,
              userAnswer: ans.user_answer,
              correctAnswer: q.correct_answer || 'A',
              explanation: q.explanation,
              options: q.options,
              year: q.year
            });
          }
        }
      });

      const summaries: TopicMistakeSummary[] = [];

      map.forEach(val => {
        const accuracy = val.total > 0 ? Math.round((val.correct / val.total) * 100) : 0;
        let mastery: 'Mastered' | 'Developing' | 'Needs Review' = 'Needs Review';
        if (accuracy >= 75) mastery = 'Mastered';
        else if (accuracy >= 50) mastery = 'Developing';

        const subtopicsList = Array.from(val.subtopicMap.entries()).map(([name, missedCount]) => ({
          subtopicName: name,
          missedCount
        }));

        summaries.push({
          topicId: val.topicId,
          topicName: val.topicName,
          subjectName: val.subjectName,
          totalAttempted: val.total,
          correctCount: val.correct,
          missedCount: val.missed,
          accuracyPercentage: accuracy,
          masteryStatus: mastery,
          subtopics: subtopicsList,
          missedQuestions: val.missedQuestions
        });
      });

      return summaries.sort((a, b) => a.accuracyPercentage - b.accuracyPercentage);
    } catch (err) {
      console.warn('[SmartMistakeEngine] DB fetch notice:', err);
      return this.getLocalMistakeSummaries();
    }
  }

  /**
   * Retrieves remediation questions specifically targeting identified knowledge gaps for a topic.
   */
  static async getRemediationQuestions(topicId: string, limit: number = 10): Promise<any[]> {
    try {
      // 1. Query questions by topic_id from database
      const { data: dbQuestions, error } = await supabase
        .from('questions')
        .select('*')
        .or(`topic_id.eq.${topicId},topic_name.ilike.%${topicId}%`)
        .limit(limit);

      if (!error && dbQuestions && dbQuestions.length > 0) {
        return dbQuestions;
      }

      // Fallback: search questions by text matching topicId or return random questions
      const { data: generalQuestions } = await supabase
        .from('questions')
        .select('*')
        .limit(limit);

      return generalQuestions || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Generates honest performance metrics from locally cached real mistakes.
   * Returns empty array if no practice activity has occurred yet.
   */
  private static getLocalMistakeSummaries(): TopicMistakeSummary[] {
    try {
      const raw = localStorage.getItem('jamb_mistake_bank');
      if (!raw) return [];
      const localMistakes: any[] = JSON.parse(raw);
      if (!Array.isArray(localMistakes) || localMistakes.length === 0) return [];

      const map = new Map<string, {
        topicId: string;
        topicName: string;
        subjectName: string;
        missed: number;
        missedQuestions: any[];
      }>();

      localMistakes.forEach(q => {
        const topicId = q.topic_id || 'topic_local';
        const topicName = q.topic_name || q.topic || 'General Practice Topic';
        const subjectName = typeof q.subject_name === 'object' ? q.subject_name?.name : (q.subject_name || 'General');

        if (!map.has(topicId)) {
          map.set(topicId, {
            topicId,
            topicName,
            subjectName,
            missed: 0,
            missedQuestions: []
          });
        }

        const entry = map.get(topicId)!;
        entry.missed += 1;
        entry.missedQuestions.push({
          id: q.id,
          questionText: cleanQuestionText(q.question_text || q.question || ''),
          topicName,
          subtopicName: 'Core Objectives',
          userAnswer: q.user_answer || '',
          correctAnswer: q.correct_answer || 'A',
          explanation: q.explanation,
          options: q.options,
          year: q.year
        });
      });

      const summaries: TopicMistakeSummary[] = [];
      map.forEach(val => {
        summaries.push({
          topicId: val.topicId,
          topicName: val.topicName,
          subjectName: val.subjectName,
          totalAttempted: val.missed,
          correctCount: 0,
          missedCount: val.missed,
          accuracyPercentage: 0,
          masteryStatus: 'Needs Review',
          subtopics: [{ subtopicName: 'Unresolved Question', missedCount: val.missed }],
          missedQuestions: val.missedQuestions
        });
      });

      return summaries;
    } catch {
      return [];
    }
  }
}
