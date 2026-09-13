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
        return this.getFallbackLocalSummaries();
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
      console.warn('[SmartMistakeEngine] DB fetch error:', err);
      return this.getFallbackLocalSummaries();
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
   * Generates non-technical fallback performance metrics if DB is offline.
   */
  private static getFallbackLocalSummaries(): TopicMistakeSummary[] {
    return [
      {
        topicId: 'p_mech',
        topicName: 'Mechanics & Motion',
        subjectName: 'Physics',
        totalAttempted: 20,
        correctCount: 11,
        missedCount: 9,
        accuracyPercentage: 55,
        masteryStatus: 'Developing',
        subtopics: [
          { subtopicName: 'Projectiles & Velocity', missedCount: 5 },
          { subtopicName: 'Newtonian Gravity', missedCount: 4 }
        ],
        missedQuestions: []
      },
      {
        topicId: 'c_stoich',
        topicName: 'Stoichiometry & Gas Laws',
        subjectName: 'Chemistry',
        totalAttempted: 15,
        correctCount: 6,
        missedCount: 9,
        accuracyPercentage: 40,
        masteryStatus: 'Needs Review',
        subtopics: [
          { subtopicName: 'Ideal Gas Equation PV=nRT', missedCount: 6 },
          { subtopicName: 'Molar Mass Conversions', missedCount: 3 }
        ],
        missedQuestions: []
      },
      {
        topicId: 'm_trig',
        topicName: 'Trigonometry & Calculus',
        subjectName: 'Mathematics',
        totalAttempted: 25,
        correctCount: 20,
        missedCount: 5,
        accuracyPercentage: 80,
        masteryStatus: 'Mastered',
        subtopics: [
          { subtopicName: 'Derivatives & Integrals', missedCount: 3 }
        ],
        missedQuestions: []
      }
    ];
  }
}
