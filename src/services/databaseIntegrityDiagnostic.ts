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
  emptySubjects?: string[];
}

export interface TopicMetrics {
  totalCount: number;
  orphanedTopicsCount: number;
  topicsWithoutQuestionsCount: number;
  emptyTopics?: string[];
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

export interface QuestionAuditMetrics {
  totalAudited: number;
  validCount: number;
  draftCount: number;
  needsReviewCount: number;
  duplicateCandidateCount: number;
  taxonomyPendingCount: number;
  invalidCount: number;

  // Specific defect counts
  missingText: number;
  malformedOptions: number;
  incorrectOptionCounts: number;
  missingAnswer: number;
  invalidAnswerRef: number;
  invalidSubjectId: number;
  invalidTopicId: number;
  invalidSubtopicId: number;
  duplicateStems: number;
  duplicateOptions: number;
  malformedLatex: number;
  brokenImageUrls: number;
  missingExplanations: number;
  invalidDifficulty: number;
  invalidYear: number;
}

export interface QuestionAuditReport {
  metrics: QuestionAuditMetrics;
  questionsByClassification: {
    VALID: string[];
    DRAFT: string[];
    NEEDS_REVIEW: string[];
    DUPLICATE_CANDIDATE: string[];
    TAXONOMY_PENDING: string[];
    INVALID: string[];
  };
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
  questionAudit?: QuestionAuditReport;
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

      // 2a. Find subjects with 0 topics
      if (dbSubjects) {
        const topicsBySubject = new Set(dbTopics.map((t) => t.subject_id).filter(Boolean));
        const emptySubjects = dbSubjects
          .filter((s) => !topicsBySubject.has(s.id))
          .map((s) => s.name);
        
        subjectMetrics.emptySubjects = emptySubjects;
        if (emptySubjects.length > 0) {
          issues.push({
            id: 'sub-empty-topics',
            table: 'subjects',
            severity: 'warning',
            category: 'Taxonomy Coverage',
            message: `Found ${emptySubjects.length} subjects with zero syllabus topics: ${emptySubjects.join(', ')}`,
            recommendation: 'Register at least one topic for each official subject in Syllabus Admin.',
          });
          warningCount++;
        }
      }

      // 2b. Find topics with 0 subtopics/objectives
      const emptyTopics = dbTopics
        .filter((t) => !t.learning_objectives || !Array.isArray(t.learning_objectives) || t.learning_objectives.length === 0)
        .map((t) => t.name);

      topicMetrics.emptyTopics = emptyTopics;
      if (emptyTopics.length > 0) {
        issues.push({
          id: 'top-empty-objectives',
          table: 'topics',
          severity: 'warning',
          category: 'Taxonomy Coverage',
          message: `Found ${emptyTopics.length} topics with zero registered subtopics/objectives.`,
          recommendation: 'Configure learning objectives for empty topics in the Academic Taxonomy Hub.',
        });
        warningCount++;
      }

      tableSummaries.push({
        tableName: 'topics',
        totalRecords: dbTopics.length,
        status: orphaned.length === 0 && emptyTopics.length === 0 ? 'passed' : 'warning',
        issuesCount: orphaned.length + emptyTopics.length,
        details: `${dbTopics.length} syllabus topics registered. ${orphaned.length} orphaned. ${emptyTopics.length} empty.`,
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

  let auditMetrics: QuestionAuditMetrics = {
    totalAudited: 0,
    validCount: 0,
    draftCount: 0,
    needsReviewCount: 0,
    duplicateCandidateCount: 0,
    taxonomyPendingCount: 0,
    invalidCount: 0,
    
    missingText: 0,
    malformedOptions: 0,
    incorrectOptionCounts: 0,
    missingAnswer: 0,
    invalidAnswerRef: 0,
    invalidSubjectId: 0,
    invalidTopicId: 0,
    invalidSubtopicId: 0,
    duplicateStems: 0,
    duplicateOptions: 0,
    malformedLatex: 0,
    brokenImageUrls: 0,
    missingExplanations: 0,
    invalidDifficulty: 0,
    invalidYear: 0,
  };

  const questionsByClassification = {
    VALID: [] as string[],
    DRAFT: [] as string[],
    NEEDS_REVIEW: [] as string[],
    DUPLICATE_CANDIDATE: [] as string[],
    TAXONOMY_PENDING: [] as string[],
    INVALID: [] as string[],
  };

  try {
    const { data: dbQuestions, error: qErr } = await supabase
      .from('questions')
      .select('*, subjects(name)');

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
      auditMetrics.totalAudited = dbQuestions.length;

      // Pre-pass: exact normalized stem duplicate detection
      const seenStems = new Map<string, string>(); // normalized stem -> original question ID
      const duplicateIds = new Set<string>();
      
      dbQuestions.forEach((q) => {
        const text = q.question_text || '';
        const normStem = text.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        if (normStem.length > 10) {
          if (seenStems.has(normStem)) {
            duplicateIds.add(q.id);
            duplicateIds.add(seenStems.get(normStem)!);
          } else {
            seenStems.set(normStem, q.id);
          }
        }
      });

      dbQuestions.forEach((q) => {
        let isInvalid = false;
        let isTaxonomyPending = false;
        let isDuplicateCandidate = false;
        let isNeedsReview = false;

        // 1. Missing or empty question text
        if (!q.question_text || q.question_text.trim() === '') {
          auditMetrics.missingText++;
          isInvalid = true;
        }

        // 2. Options array check
        let parsedOpts: string[] = [];
        if (typeof q.options === 'string') {
          try {
            parsedOpts = JSON.parse(q.options);
          } catch {
            parsedOpts = [];
          }
        } else if (Array.isArray(q.options)) {
          parsedOpts = q.options;
        }

        if (!Array.isArray(parsedOpts)) {
          auditMetrics.malformedOptions++;
          isInvalid = true;
        } else if (parsedOpts.length < 2 || parsedOpts.length > 5) {
          auditMetrics.incorrectOptionCounts++;
          isInvalid = true;
        }

        // 3. Missing or invalid answer check
        if (!q.correct_answer && q.correct_option === undefined && q.answer_index === undefined) {
          auditMetrics.missingAnswer++;
          isInvalid = true;
        } else if (parsedOpts.length >= 2) {
          // If correct_answer is provided, check if it matches an option or is valid option letter
          const ansStr = String(q.correct_answer || '').trim();
          const hasMatch = parsedOpts.some(opt => String(opt).trim() === ansStr);
          const isLetter = ['A', 'B', 'C', 'D', 'E'].includes(ansStr);
          if (!hasMatch && !isLetter) {
            auditMetrics.invalidAnswerRef++;
            isInvalid = true;
          }
        }

        // 4. Subject ID check
        if (!q.subject_id) {
          auditMetrics.invalidSubjectId++;
          isInvalid = true;
        }

        // 5. Taxonomy checking (Topic / Subtopic)
        if (!q.topic_id || q.topic_id === 'null' || q.topic_id === '') {
          auditMetrics.invalidTopicId++;
          isTaxonomyPending = true;
        }
        if (!q.subtopic_id) {
          auditMetrics.invalidSubtopicId++;
        }

        // 6. Duplicate stems check
        if (duplicateIds.has(q.id)) {
          auditMetrics.duplicateStems++;
          isDuplicateCandidate = true;
        }

        // 7. Duplicate options check
        if (parsedOpts.length >= 2) {
          const seenOpts = new Set<string>();
          let hasDup = false;
          parsedOpts.forEach(o => {
            if (o) {
              const clean = String(o).trim().toLowerCase();
              if (seenOpts.has(clean)) hasDup = true;
              seenOpts.add(clean);
            }
          });
          if (hasDup) {
            auditMetrics.duplicateOptions++;
            isNeedsReview = true;
          }
        }

        // 8. Malformed LaTeX
        if (q.question_text) {
          let latexCount = 0;
          for (let i = 0; i < q.question_text.length; i++) {
            if (q.question_text[i] === '$' && (i === 0 || q.question_text[i - 1] !== '\\')) {
              latexCount++;
            }
          }
          if (latexCount % 2 !== 0) {
            auditMetrics.malformedLatex++;
            isNeedsReview = true;
          }
        }

        // 9. Broken image or diagram URL
        const imageUrl = q.image_url || q.diagram_url || (q as any).image_path;
        if (imageUrl) {
          const lower = String(imageUrl).toLowerCase();
          if (lower.includes('placeholder') || lower.includes('dummy') || lower.includes('localhost') || (!lower.startsWith('http://') && !lower.startsWith('https://') && !lower.startsWith('/'))) {
            auditMetrics.brokenImageUrls++;
            isNeedsReview = true;
          }
        }

        // 10. Missing explanation where required
        if (!q.explanation || q.explanation.trim().length < 10) {
          auditMetrics.missingExplanations++;
          if (q.difficulty === 'hard') {
            isNeedsReview = true;
          }
        }

        // 11. Invalid difficulty value
        if (q.difficulty && !['easy', 'medium', 'hard'].includes(String(q.difficulty).toLowerCase())) {
          auditMetrics.invalidDifficulty++;
          isNeedsReview = true;
        }

        // 12. Invalid year value
        const qYear = q.year !== undefined && q.year !== null ? q.year : q.exam_year;
        if (qYear !== null && qYear !== undefined && qYear !== '') {
          const yrNum = Number(qYear);
          if (isNaN(yrNum) || yrNum < 1970 || yrNum > 2026) {
            auditMetrics.invalidYear++;
            isNeedsReview = true;
          }
        }

        // Now categorize!
        if (isInvalid) {
          auditMetrics.invalidCount++;
          questionsByClassification.INVALID.push(q.id);
        } else if (isDuplicateCandidate) {
          auditMetrics.duplicateCandidateCount++;
          questionsByClassification.DUPLICATE_CANDIDATE.push(q.id);
        } else if (isTaxonomyPending) {
          auditMetrics.taxonomyPendingCount++;
          questionsByClassification.TAXONOMY_PENDING.push(q.id);
        } else if (isNeedsReview) {
          auditMetrics.needsReviewCount++;
          questionsByClassification.NEEDS_REVIEW.push(q.id);
        } else if (q.is_active === false) {
          auditMetrics.draftCount++;
          questionsByClassification.DRAFT.push(q.id);
        } else {
          auditMetrics.validCount++;
          questionsByClassification.VALID.push(q.id);
        }

        // Standard metrics compatibility
        if (!q.subject_id) questionMetrics.missingSubjectIdCount++;
        if (!q.topic_id) questionMetrics.missingTopicIdCount++;
        if (!Array.isArray(parsedOpts) || parsedOpts.length < 2) questionMetrics.invalidOptionsCount++;
        if (!q.correct_answer && q.correct_option === undefined && q.answer_index === undefined) {
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
      .select('id, user_id, status, started_at');

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

    const { data: dbProgress, error: progErr } = await supabase
      .from('user_progress')
      .select('id, user_id, subject_id');
      
    if (!progErr && dbProgress) {
      userMetrics.totalPracticeLogs = dbProgress.length;
      const orphanedProg = dbProgress.filter(p => !p.user_id || !p.subject_id).length;
      if (orphanedProg > 0) {
        issues.push({
          id: 'prog-orphaned',
          table: 'user_progress',
          severity: 'warning',
          category: 'Data Link Defect',
          message: `Found ${orphanedProg} practice progress logs with broken links to users or subjects.`,
          recommendation: 'Prune orphaned progress logs with broken foreign keys.',
        });
        warningCount++;
      }
      
      tableSummaries.push({
        tableName: 'user_progress',
        totalRecords: dbProgress.length,
        status: orphanedProg === 0 ? 'passed' : 'warning',
        issuesCount: orphanedProg,
        details: `${dbProgress.length} user practice state and mastery records loaded.`,
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
    questionAudit: {
      metrics: auditMetrics,
      questionsByClassification
    }
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
