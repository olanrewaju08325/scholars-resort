import { supabase } from '@/lib/supabase';
import { ensureAllJambSubjectsInDatabase, unifyDatabaseSubjects, OFFICIAL_JAMB_SUBJECTS } from '@/utils/subjectUtils';
import { DEFAULT_JAMB_BOOKS, type LiteratureBook } from '@/data/jambNovelsData';

export interface TableDiagnosticItem {
  tableName: string;
  totalRecords: number;
  status: 'passed' | 'warning' | 'critical';
  issuesCount: number;
  details: string;
}

export interface DetailedIssue {
  id: string;
  table: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  recommendation: string;
}

export interface QuestionBankMetrics {
  totalCount: number;
  missingSubjectIdCount: number;
  missingTopicIdCount: number;
  invalidOptionsCount: number;
  missingAnswerCount: number;
  placeholderMockCount: number;
  validProductionCount: number;
  subjectBreakdown: { [subjectName: string]: number };
}

export interface SubjectMetrics {
  totalCount: number;
  officialSubjectsCount: number;
  missingOfficialSubjects: string[];
  inactiveCount: number;
}

export interface TopicMetrics {
  totalCount: number;
  orphanedTopicsCount: number;
  topicsWithoutQuestionsCount: number;
}

export interface UserProgressMetrics {
  totalExamSessions: number;
  submittedExamSessions: number;
  orphanedSessionsCount: number;
  totalPracticeLogs: number;
}

export interface LiteratureMetrics {
  totalNovelsCount: number;
  lifeChangerPresent: boolean;
  lifeChangerChaptersCount: number;
  lifeChangerQuestionsCount: number;
}

export interface DatabaseDiagnosticReport {
  timestamp: string;
  overallHealthScore: number; // 0 - 100%
  totalIssuesCount: number;
  criticalIssuesCount: number;
  warningIssuesCount: number;
  questions: QuestionBankMetrics;
  subjects: SubjectMetrics;
  topics: TopicMetrics;
  userProgress: UserProgressMetrics;
  literature: LiteratureMetrics;
  issues: DetailedIssue[];
  tableSummaries: TableDiagnosticItem[];
}

/**
 * Executes live data integrity and diagnostic checks across Supabase database tables.
 */
export const runDatabaseDiagnostics = async (): Promise<DatabaseDiagnosticReport> => {
  const issues: DetailedIssue[] = [];
  const tableSummaries: TableDiagnosticItem[] = [];

  let criticalCount = 0;
  let warningCount = 0;

  // 1. Diagnostics on `subjects`
  let subjectMetrics: SubjectMetrics = {
    totalCount: 0,
    officialSubjectsCount: 0,
    missingOfficialSubjects: [],
    inactiveCount: 0,
  };

  try {
    const { data: dbSubjects, error: subErr } = await supabase.from('subjects').select('*');
    if (subErr) {
      issues.push({
        id: 'sub-fetch-err',
        table: 'subjects',
        severity: 'critical',
        category: 'Database Connection',
        message: `Failed to query subjects table: ${subErr.message}`,
        recommendation: 'Check Supabase database credentials and connection permissions.',
      });
      criticalCount++;
    } else if (dbSubjects) {
      subjectMetrics.totalCount = dbSubjects.length;
      subjectMetrics.inactiveCount = dbSubjects.filter((s) => s.is_active === false).length;

      const existingNames = new Set(dbSubjects.map((s) => s.name.trim().toLowerCase()));
      const missing = OFFICIAL_JAMB_SUBJECTS.filter((s) => !existingNames.has(s.name.toLowerCase()));
      subjectMetrics.missingOfficialSubjects = missing.map((s) => s.name);
      subjectMetrics.officialSubjectsCount = OFFICIAL_JAMB_SUBJECTS.length - missing.length;

      if (missing.length > 0) {
        issues.push({
          id: 'sub-missing-official',
          table: 'subjects',
          severity: 'warning',
          category: 'Schema Completeness',
          message: `Missing ${missing.length} official UTME subjects: ${missing.map((m) => m.name).join(', ')}`,
          recommendation: 'Run Auto-Repair to seed missing official UTME subject definitions.',
        });
        warningCount++;
      }

      tableSummaries.push({
        tableName: 'subjects',
        totalRecords: dbSubjects.length,
        status: missing.length === 0 ? 'passed' : 'warning',
        issuesCount: missing.length,
        details: `${subjectMetrics.officialSubjectsCount}/${OFFICIAL_JAMB_SUBJECTS.length} official subjects configured in database.`,
      });
    }
  } catch (err: any) {
    issues.push({
      id: 'sub-exception',
      table: 'subjects',
      severity: 'critical',
      category: 'Exception',
      message: `Error checking subjects: ${err.message || err}`,
      recommendation: 'Verify database accessibility.',
    });
    criticalCount++;
  }

  // 2. Diagnostics on `topics`
  let topicMetrics: TopicMetrics = {
    totalCount: 0,
    orphanedTopicsCount: 0,
    topicsWithoutQuestionsCount: 0,
  };

  try {
    const { data: dbTopics, error: topErr } = await supabase.from('topics').select('*, subjects(id, name)');
    if (topErr) {
      issues.push({
        id: 'top-fetch-err',
        table: 'topics',
        severity: 'warning',
        category: 'Query Error',
        message: `Failed to query topics table: ${topErr.message}`,
        recommendation: 'Check RLS policy or schema permissions on topics table.',
      });
      warningCount++;
    } else if (dbTopics) {
      topicMetrics.totalCount = dbTopics.length;

      // Find orphaned topics
      const orphaned = dbTopics.filter((t) => !t.subject_id || !t.subjects);
      topicMetrics.orphanedTopicsCount = orphaned.length;

      if (orphaned.length > 0) {
        issues.push({
          id: 'top-orphaned',
          table: 'topics',
          severity: 'warning',
          category: 'Foreign Key Integrity',
          message: `Found ${orphaned.length} orphaned topics pointing to invalid or deleted subject IDs.`,
          recommendation: 'Run Auto-Repair to remap or prune orphaned topics.',
        });
        warningCount++;
      }

      tableSummaries.push({
        tableName: 'topics',
        totalRecords: dbTopics.length,
        status: orphaned.length === 0 ? 'passed' : 'warning',
        issuesCount: orphaned.length,
        details: `${dbTopics.length} syllabus topics registered. ${orphaned.length} orphaned.`,
      });
    }
  } catch (err: any) {
    console.warn('Topic diagnostic error:', err);
  }

  // 3. Diagnostics on `questions`
  let questionMetrics: QuestionBankMetrics = {
    totalCount: 0,
    missingSubjectIdCount: 0,
    missingTopicIdCount: 0,
    invalidOptionsCount: 0,
    missingAnswerCount: 0,
    placeholderMockCount: 0,
    validProductionCount: 0,
    subjectBreakdown: {},
  };

  try {
    const { data: dbQuestions, error: qErr } = await supabase
      .from('questions')
      .select('id, question_text, subject_id, topic_id, options, correct_answer, subjects(name)');

    if (qErr) {
      issues.push({
        id: 'q-fetch-err',
        table: 'questions',
        severity: 'critical',
        category: 'Query Error',
        message: `Failed to query questions bank: ${qErr.message}`,
        recommendation: 'Check database connection or RLS permissions on questions table.',
      });
      criticalCount++;
    } else if (dbQuestions) {
      questionMetrics.totalCount = dbQuestions.length;

      dbQuestions.forEach((q) => {
        // Missing Subject ID
        if (!q.subject_id) questionMetrics.missingSubjectIdCount++;

        // Missing Topic ID
        if (!q.topic_id) questionMetrics.missingTopicIdCount++;

        // Invalid options formatting
        let parsedOpts: any[] = [];
        if (typeof q.options === 'string') {
          try {
            parsedOpts = JSON.parse(q.options);
          } catch {
            parsedOpts = [];
          }
        } else if (Array.isArray(q.options)) {
          parsedOpts = q.options;
        }

        if (!parsedOpts || parsedOpts.length < 2) {
          questionMetrics.invalidOptionsCount++;
        }

        // Missing Correct Answer
        if (!q.correct_answer && (q as any).correct_option === undefined && (q as any).answer_index === undefined) {
          questionMetrics.missingAnswerCount++;
        }

        // Detect placeholder/mock text patterns
        const textLower = (q.question_text || '').toLowerCase();
        if (
          textLower.includes('mock question') ||
          textLower.includes('sample question') ||
          textLower.includes('lorem ipsum') ||
          textLower.includes('test question') ||
          textLower.includes('dummy question')
        ) {
          questionMetrics.placeholderMockCount++;
        }

        // Subject breakdown
        const subName = (q.subjects as any)?.name || 'Unassigned / Unknown';
        questionMetrics.subjectBreakdown[subName] = (questionMetrics.subjectBreakdown[subName] || 0) + 1;
      });

      questionMetrics.validProductionCount =
        questionMetrics.totalCount -
        questionMetrics.missingSubjectIdCount -
        questionMetrics.invalidOptionsCount -
        questionMetrics.placeholderMockCount;

      if (questionMetrics.missingSubjectIdCount > 0) {
        issues.push({
          id: 'q-missing-sub',
          table: 'questions',
          severity: 'critical',
          category: 'Data Orphan',
          message: `Found ${questionMetrics.missingSubjectIdCount} questions with null/missing subject_id.`,
          recommendation: 'Assign valid UTME subjects to orphaned questions.',
        });
        criticalCount++;
      }

      if (questionMetrics.invalidOptionsCount > 0) {
        issues.push({
          id: 'q-invalid-opts',
          table: 'questions',
          severity: 'warning',
          category: 'Format Defect',
          message: `Found ${questionMetrics.invalidOptionsCount} questions with invalid or missing option arrays.`,
          recommendation: 'Inspect and re-format options array into valid JSON [A, B, C, D].',
        });
        warningCount++;
      }

      if (questionMetrics.placeholderMockCount > 0) {
        issues.push({
          id: 'q-mock-placeholders',
          table: 'questions',
          severity: 'warning',
          category: 'Mock Data Detected',
          message: `Found ${questionMetrics.placeholderMockCount} placeholder/mock test questions in the bank.`,
          recommendation: 'Run Auto-Repair to purge placeholder test questions and keep production question bank clean.',
        });
        warningCount++;
      }

      const qStatus =
        questionMetrics.missingSubjectIdCount === 0 && questionMetrics.placeholderMockCount === 0
          ? 'passed'
          : questionMetrics.missingSubjectIdCount > 0
          ? 'critical'
          : 'warning';

      tableSummaries.push({
        tableName: 'questions',
        totalRecords: dbQuestions.length,
        status: qStatus,
        issuesCount:
          questionMetrics.missingSubjectIdCount +
          questionMetrics.invalidOptionsCount +
          questionMetrics.placeholderMockCount,
        details: `${questionMetrics.validProductionCount} production questions verified across ${
          Object.keys(questionMetrics.subjectBreakdown).length
        } subjects.`,
      });
    }
  } catch (err: any) {
    issues.push({
      id: 'q-exception',
      table: 'questions',
      severity: 'critical',
      category: 'Exception',
      message: `Error evaluating questions bank: ${err.message || err}`,
      recommendation: 'Verify database connection.',
    });
    criticalCount++;
  }

  // 4. Diagnostics on `exam_sessions` & `user_progress`
  let userMetrics: UserProgressMetrics = {
    totalExamSessions: 0,
    submittedExamSessions: 0,
    orphanedSessionsCount: 0,
    totalPracticeLogs: 0,
  };

  try {
    const { data: dbSessions, error: sessErr } = await supabase
      .from('exam_sessions')
      .select('id, user_id, status, created_at');

    if (!sessErr && dbSessions) {
      userMetrics.totalExamSessions = dbSessions.length;
      userMetrics.submittedExamSessions = dbSessions.filter((s) => s.status === 'submitted').length;
      userMetrics.orphanedSessionsCount = dbSessions.filter((s) => !s.user_id).length;

      if (userMetrics.orphanedSessionsCount > 0) {
        issues.push({
          id: 'sess-orphaned',
          table: 'exam_sessions',
          severity: 'info',
          category: 'Guest Logs',
          message: `Found ${userMetrics.orphanedSessionsCount} anonymous/guest exam sessions.`,
          recommendation: 'Consider archiving inactive guest sessions during database maintenance.',
        });
      }

      tableSummaries.push({
        tableName: 'exam_sessions',
        totalRecords: dbSessions.length,
        status: 'passed',
        issuesCount: userMetrics.orphanedSessionsCount,
        details: `${userMetrics.submittedExamSessions} completed exam submissions recorded in database.`,
      });
    }
  } catch (err) {
    console.warn('Exam sessions diagnostic error:', err);
  }

  // 5. Diagnostics on Literature & Novels (`admin_settings`)
  let literatureMetrics: LiteratureMetrics = {
    totalNovelsCount: 0,
    lifeChangerPresent: false,
    lifeChangerChaptersCount: 0,
    lifeChangerQuestionsCount: 0,
  };

  try {
    const { data: novelSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'jamb_novels_db')
      .maybeSingle();

    if (novelSetting && Array.isArray(novelSetting.setting_value)) {
      const books: LiteratureBook[] = novelSetting.setting_value;
      literatureMetrics.totalNovelsCount = books.length;

      const lc = books.find((b) => b.id === 'the-life-changer' || b.title.toLowerCase().includes('life changer'));
      if (lc) {
        literatureMetrics.lifeChangerPresent = true;
        literatureMetrics.lifeChangerChaptersCount = lc.chapters?.length || 0;
        literatureMetrics.lifeChangerQuestionsCount = lc.practiceQuestions?.length || 0;
      }
    }

    if (!literatureMetrics.lifeChangerPresent) {
      issues.push({
        id: 'lit-missing-life-changer',
        table: 'admin_settings',
        severity: 'warning',
        category: 'Missing Prescribed Text',
        message: '"The Life Changer" by Khadija Abubakar Jalli is not seeded in the database.',
        recommendation: 'Run Auto-Repair to seed "The Life Changer" with all 9 chapters & practice questions.',
      });
      warningCount++;
    }

    tableSummaries.push({
        tableName: 'admin_settings (Literature)',
        totalRecords: literatureMetrics.totalNovelsCount,
        status: literatureMetrics.lifeChangerPresent ? 'passed' : 'warning',
        issuesCount: literatureMetrics.lifeChangerPresent ? 0 : 1,
        details: literatureMetrics.lifeChangerPresent
          ? `"The Life Changer" configured with ${literatureMetrics.lifeChangerChaptersCount} chapters & ${literatureMetrics.lifeChangerQuestionsCount} questions.`
          : 'Prescribed JAMB novel missing in database.',
      });
  } catch (err) {
    console.warn('Literature diagnostic error:', err);
  }

  // Calculate Overall Health Score
  const totalChecks = 10;
  const healthDeduction = criticalCount * 15 + warningCount * 5;
  const overallHealthScore = Math.max(0, Math.min(100, 100 - healthDeduction));

  return {
    timestamp: new Date().toISOString(),
    overallHealthScore,
    totalIssuesCount: issues.length,
    criticalIssuesCount: criticalCount,
    warningIssuesCount: warningCount,
    questions: questionMetrics,
    subjects: subjectMetrics,
    topics: topicMetrics,
    userProgress: userMetrics,
    literature: literatureMetrics,
    issues,
    tableSummaries,
  };
};

/**
 * Auto-repairs database integrity issues:
 * - Seeds missing official JAMB subjects into Supabase `subjects` table.
 * - Unifies duplicate subject aliases and remaps questions.
 * - Purges placeholder/mock test questions from the bank.
 * - Seeds default literature prescribed text ("The Life Changer") into `admin_settings`.
 */
export const repairDatabaseIntegrity = async (): Promise<{
  success: boolean;
  message: string;
  repairedItems: string[];
}> => {
  const repairedItems: string[] = [];

  try {
    // 1. Ensure all official UTME subjects exist in database
    const subjectsRes = await ensureAllJambSubjectsInDatabase();
    repairedItems.push(`Verified & synced ${subjectsRes.length} official UTME subjects in database.`);

    // 2. Unify database subjects and remap duplicate/alias references in questions
    const unifyRes = await unifyDatabaseSubjects();
    if (unifyRes.success) {
      repairedItems.push(`Unified subject aliases and remapped ${unifyRes.updatedCount} questions to canonical subject IDs.`);
    }

    // 3. Purge mock/placeholder test questions
    const { data: mockQuestions } = await supabase
      .from('questions')
      .select('id, question_text');

    if (mockQuestions && mockQuestions.length > 0) {
      const mockIdsToPurge = mockQuestions
        .filter((q) => {
          const textLower = (q.question_text || '').toLowerCase();
          return (
            textLower.includes('mock question') ||
            textLower.includes('sample question') ||
            textLower.includes('lorem ipsum') ||
            textLower.includes('test question') ||
            textLower.includes('dummy question')
          );
        })
        .map((q) => q.id);

      if (mockIdsToPurge.length > 0) {
        const { error: deleteErr } = await supabase
          .from('questions')
          .delete()
          .in('id', mockIdsToPurge);

        if (!deleteErr) {
          repairedItems.push(`Purged ${mockIdsToPurge.length} placeholder/mock test questions from database.`);
        }
      }
    }

    // 4. Seed "The Life Changer" and default JAMB novels into Supabase `admin_settings` if missing
    const { data: existingNovels } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'jamb_novels_db')
      .maybeSingle();

    if (!existingNovels || !existingNovels.setting_value || !Array.isArray(existingNovels.setting_value)) {
      await supabase.from('admin_settings').upsert({
        setting_key: 'jamb_novels_db',
        setting_value: DEFAULT_JAMB_BOOKS,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'setting_key' });

      repairedItems.push('Seeded official UTME Literature novel "The Life Changer" with 9 chapters and practice questions into database.');
    }

    return {
      success: true,
      message: 'Database integrity auto-repair completed successfully!',
      repairedItems,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Repair failed: ${err.message || err}`,
      repairedItems,
    };
  }
};
