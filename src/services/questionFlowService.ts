import { supabase } from '@/lib/supabase';
import { ContentNormalizer, type NormalizedQuestion } from '@/utils/ContentNormalizer';
import { 
  normalizeSubjectName, 
  resolveSubjectIdsByNameOrAlias, 
  OFFICIAL_JAMB_SUBJECTS, 
  isUUID 
} from '@/utils/subjectUtils';

export type ExamMode = 
  | 'subject_practice' 
  | 'topic_drill' 
  | 'speed_test' 
  | 'full_mock' 
  | 'daily_quiz' 
  | 'past_questions' 
  | 'ai_generated_mock';

export interface ModeQuestionQueryConfig {
  mode: ExamMode;
  subjectId?: string; // UUID or subject name
  subjectIds?: string[]; // Array of subject UUIDs or names (e.g. for Full Mock)
  topicId?: string;
  count?: number;
  examYear?: number | string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed' | 'adaptive';
  timeLimitSeconds?: number;
  learningStyle?: string;
}

export interface QuestionFlowValidation {
  allFromDatabase: boolean;
  noMockFallbackUsed: boolean;
  schemaValid: boolean;
  subjectsCovered: Record<string, number>;
  optionsCountValid: boolean;
  correctAnswerAssigned: boolean;
  explanationsPresentRatio: number;
}

export interface QuestionFlowResult {
  success: boolean;
  mode: ExamMode;
  questions: NormalizedQuestion[];
  totalRetrieved: number;
  expectedCount: number;
  subjectsQueried: string[];
  queryLatencyMs: number;
  source: 'supabase_database' | 'empty_database';
  validation: QuestionFlowValidation;
  errorMessage?: string;
  warnings: string[];
}

export interface ModeAuditReport {
  timestamp: string;
  overallStatus: 'passed' | 'warning' | 'critical';
  allModesPassed: boolean;
  totalModesTested: number;
  modesPassedCount: number;
  totalDatabaseQuestionsSampled: number;
  zeroMockDataEnforced: boolean;
  results: Record<ExamMode, QuestionFlowResult>;
}

export class QuestionFlowService {
  /**
   * Universal, database-authoritative question query engine for each CBT mode.
   * STRICTLY executes real Supabase queries with ZERO hardcoded mock data fallbacks.
   */
  public static async fetchQuestionsForMode(config: ModeQuestionQueryConfig): Promise<QuestionFlowResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const subjectsQueried: string[] = [];

    const defaultCounts: Record<ExamMode, number> = {
      subject_practice: config.count || 20,
      topic_drill: config.count || 20,
      speed_test: 20,
      full_mock: 180,
      daily_quiz: config.count || 15,
      past_questions: config.count || 40,
      ai_generated_mock: config.count || 180,
    };

    const targetCount = config.count || defaultCounts[config.mode] || 20;

    try {
      let rawQuestions: any[] = [];

      switch (config.mode) {
        case 'subject_practice': {
          const subId = config.subjectId || 'use-of-english';
          const canonical = normalizeSubjectName(subId);
          subjectsQueried.push(canonical);

          const matchedIds = await resolveSubjectIdsByNameOrAlias(subId);
          const validUuids = matchedIds.filter(isUUID);

          let query = supabase
            .from('questions')
            .select('*, subjects(id, name), topics(id, name)')
            .eq('is_active', true);

          if (validUuids.length > 0) {
            query = query.in('subject_id', validUuids);
          }

          if (config.difficulty && config.difficulty !== 'mixed' && config.difficulty !== 'adaptive') {
            query = query.eq('difficulty', config.difficulty);
          }

          const { data, error } = await query.limit(Math.max(targetCount * 3, 100));

          if (error) {
            warnings.push(`Supabase error fetching Subject Practice questions: ${error.message}`);
          } else if (data && data.length > 0) {
            rawQuestions = data;
          }
          break;
        }

        case 'topic_drill': {
          const subId = config.subjectId || 'use-of-english';
          const canonical = normalizeSubjectName(subId);
          subjectsQueried.push(canonical);

          let query = supabase
            .from('questions')
            .select('*, subjects(id, name), topics(id, name)')
            .eq('is_active', true);

          if (config.topicId && config.topicId !== 'all') {
            query = query.eq('topic_id', config.topicId);
          } else {
            const matchedIds = await resolveSubjectIdsByNameOrAlias(subId);
            const validUuids = matchedIds.filter(isUUID);
            if (validUuids.length > 0) {
              query = query.in('subject_id', validUuids);
            }
          }

          const { data, error } = await query.limit(Math.max(targetCount * 2, 60));

          if (error) {
            warnings.push(`Supabase error fetching Topic Drill questions: ${error.message}`);
          } else if (data && data.length > 0) {
            rawQuestions = data;
          } else if (config.topicId) {
            warnings.push(`No active questions found in database for topic ID: ${config.topicId}`);
          }
          break;
        }

        case 'speed_test': {
          const subId = config.subjectId || 'all';
          let query = supabase
            .from('questions')
            .select('*, subjects(id, name), topics(id, name)')
            .eq('is_active', true);

          if (subId !== 'all') {
            const canonical = normalizeSubjectName(subId);
            subjectsQueried.push(canonical);
            const matchedIds = await resolveSubjectIdsByNameOrAlias(subId);
            const validUuids = matchedIds.filter(isUUID);
            if (validUuids.length > 0) {
              query = query.in('subject_id', validUuids);
            }
          } else {
            subjectsQueried.push('General UTME');
          }

          const { data, error } = await query.limit(60);

          if (error) {
            warnings.push(`Supabase error fetching Speed Test questions: ${error.message}`);
          } else if (data && data.length > 0) {
            rawQuestions = data;
          }
          break;
        }

        case 'full_mock':
        case 'ai_generated_mock': {
          // Standard UTME: 4 Subjects (Use of English [60 Qs] + 3 Core Subjects [40 Qs each] = 180 total)
          let targetSubs = config.subjectIds || ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
          if (targetSubs.length < 4) {
            targetSubs = ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
          }

          const normalizedSubs = Array.from(new Set(targetSubs.map(s => normalizeSubjectName(s))));
          const hasEnglish = normalizedSubs.includes('Use of English');
          const finalSubjects = hasEnglish
            ? ['Use of English', ...normalizedSubs.filter(s => s !== 'Use of English').slice(0, 3)]
            : ['Use of English', ...normalizedSubs.slice(0, 3)];

          subjectsQueried.push(...finalSubjects);

          const subjectPromises = finalSubjects.map(async (subjName) => {
            const limit = subjName === 'Use of English' ? 60 : 40;
            const matchedIds = await resolveSubjectIdsByNameOrAlias(subjName);
            const validUuids = matchedIds.filter(isUUID);

            let subQuery = supabase
              .from('questions')
              .select('*, subjects(id, name), topics(id, name)')
              .eq('is_active', true);

            if (validUuids.length > 0) {
              subQuery = subQuery.in('subject_id', validUuids);
            }

            const { data, error } = await subQuery.limit(limit * 2);
            if (error) {
              warnings.push(`Failed querying ${subjName} for mock: ${error.message}`);
              return [];
            }
            
            const shuffled = (data || []).sort(() => Math.random() - 0.5).slice(0, limit);
            return shuffled.map(q => ({
              ...q,
              subject_name: subjName
            }));
          });

          const results = await Promise.all(subjectPromises);
          rawQuestions = results.flat();
          break;
        }

        case 'daily_quiz': {
          subjectsQueried.push('Daily Challenge');
          const { data, error } = await supabase
            .from('questions')
            .select('*, subjects(id, name), topics(id, name)')
            .eq('is_active', true)
            .limit(45);

          if (error) {
            warnings.push(`Supabase error fetching Daily Quiz questions: ${error.message}`);
          } else if (data) {
            rawQuestions = data;
          }
          break;
        }

        case 'past_questions': {
          const subId = config.subjectId || 'use-of-english';
          const canonical = normalizeSubjectName(subId);
          subjectsQueried.push(canonical);

          const matchedIds = await resolveSubjectIdsByNameOrAlias(subId);
          const validUuids = matchedIds.filter(isUUID);

          let query = supabase
            .from('questions')
            .select('*, subjects(id, name), topics(id, name)')
            .eq('is_active', true);

          if (validUuids.length > 0) {
            query = query.in('subject_id', validUuids);
          }

          if (config.examYear) {
            query = query.eq('exam_year', config.examYear);
          }

          const { data, error } = await query.limit(targetCount * 2);
          if (error) {
            warnings.push(`Supabase error fetching Past Questions: ${error.message}`);
          } else if (data) {
            rawQuestions = data;
          }
          break;
        }
      }

      // Process and Normalize Questions through ContentNormalizer (strips extraneous tags, numbers, headers)
      const normalizedList = ContentNormalizer.normalizeStream(rawQuestions);
      
      // Shuffle and slice to target count (unless empty)
      const finalQuestions = (config.mode === 'full_mock' || config.mode === 'ai_generated_mock')
        ? normalizedList // Keep subject-ordered grouping for mocks
        : normalizedList.sort(() => Math.random() - 0.5).slice(0, targetCount);

      const queryLatencyMs = Date.now() - startTime;

      // Validate Query Output & Quality
      const subjectsCovered: Record<string, number> = {};
      let optionsValidCount = 0;
      let validAnswerCount = 0;
      let explanationCount = 0;

      finalQuestions.forEach(q => {
        const sub = q.subject_name || (q.raw?.subjects?.name) || 'Unknown';
        const normSub = normalizeSubjectName(sub);
        subjectsCovered[normSub] = (subjectsCovered[normSub] || 0) + 1;

        if (Array.isArray(q.options) && q.options.length >= 2) {
          optionsValidCount++;
        }
        if (q.correct_option && ['A', 'B', 'C', 'D', 'E'].includes(q.correct_option)) {
          validAnswerCount++;
        }
        if (q.explanation && q.explanation.trim().length > 5) {
          explanationCount++;
        }
      });

      const totalRetrieved = finalQuestions.length;
      const schemaValid = totalRetrieved > 0 && optionsValidCount === totalRetrieved && validAnswerCount === totalRetrieved;

      const validation: QuestionFlowValidation = {
        allFromDatabase: true, // Sourced 100% from Supabase
        noMockFallbackUsed: true, // No fake mock array injections
        schemaValid,
        subjectsCovered,
        optionsCountValid: totalRetrieved > 0 ? optionsValidCount === totalRetrieved : false,
        correctAnswerAssigned: totalRetrieved > 0 ? validAnswerCount === totalRetrieved : false,
        explanationsPresentRatio: totalRetrieved > 0 ? Math.round((explanationCount / totalRetrieved) * 100) : 0,
      };

      return {
        success: totalRetrieved > 0,
        mode: config.mode,
        questions: finalQuestions,
        totalRetrieved,
        expectedCount: targetCount,
        subjectsQueried,
        queryLatencyMs,
        source: totalRetrieved > 0 ? 'supabase_database' : 'empty_database',
        validation,
        warnings,
        errorMessage: totalRetrieved === 0 ? `Database returned 0 questions for ${config.mode}.` : undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        mode: config.mode,
        questions: [],
        totalRetrieved: 0,
        expectedCount: targetCount,
        subjectsQueried,
        queryLatencyMs: Date.now() - startTime,
        source: 'empty_database',
        validation: {
          allFromDatabase: true,
          noMockFallbackUsed: true,
          schemaValid: false,
          subjectsCovered: {},
          optionsCountValid: false,
          correctAnswerAssigned: false,
          explanationsPresentRatio: 0,
        },
        errorMessage: err.message || 'Unexpected error during question flow verification.',
        warnings: [...warnings, err.message],
      };
    }
  }

  /**
   * Diagnostic verification check for a single exam mode.
   */
  public static async verifyModeQuestionFlow(mode: ExamMode, sampleConfig?: Partial<ModeQuestionQueryConfig>): Promise<QuestionFlowResult> {
    const config: ModeQuestionQueryConfig = {
      mode,
      subjectId: sampleConfig?.subjectId || 'use-of-english',
      subjectIds: sampleConfig?.subjectIds || ['Use of English', 'Mathematics', 'Physics', 'Chemistry'],
      count: sampleConfig?.count,
      difficulty: sampleConfig?.difficulty || 'mixed',
      ...sampleConfig
    };

    return this.fetchQuestionsForMode(config);
  }

  /**
   * Runs an end-to-end question flow audit across all 4 core modes + secondary modes.
   * Verifies database response times, integrity, normalization, and zero-mock enforcement.
   */
  public static async runAllModesQuestionFlowAudit(sampleSubjects?: string[]): Promise<ModeAuditReport> {
    const modes: ExamMode[] = [
      'subject_practice',
      'topic_drill',
      'speed_test',
      'full_mock',
      'daily_quiz',
      'past_questions',
      'ai_generated_mock'
    ];

    const results: Record<string, QuestionFlowResult> = {};
    let passedCount = 0;
    let totalSampled = 0;

    for (const mode of modes) {
      const res = await this.verifyModeQuestionFlow(mode, {
        subjectIds: sampleSubjects || ['Use of English', 'Mathematics', 'Physics', 'Chemistry']
      });
      results[mode] = res;
      if (res.success && res.validation.schemaValid) {
        passedCount++;
      }
      totalSampled += res.totalRetrieved;
    }

    const allPassed = passedCount === modes.length;
    let overallStatus: 'passed' | 'warning' | 'critical' = 'passed';
    if (passedCount === 0) {
      overallStatus = 'critical';
    } else if (passedCount < modes.length) {
      overallStatus = 'warning';
    }

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      allModesPassed: allPassed,
      totalModesTested: modes.length,
      modesPassedCount: passedCount,
      totalDatabaseQuestionsSampled: totalSampled,
      zeroMockDataEnforced: true,
      results: results as Record<ExamMode, QuestionFlowResult>,
    };
  }
}
