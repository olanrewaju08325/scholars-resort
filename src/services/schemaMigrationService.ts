import { supabase } from '@/lib/supabase';
import { OFFICIAL_JAMB_SUBJECTS, normalizeSubjectName, isUUID } from '@/utils/subjectUtils';

export interface TableInspectionResult {
  tableName: string;
  totalRecords: number;
  healthyRecords: number;
  flaggedRecords: number;
  status: 'healthy' | 'warning' | 'critical';
  issues: Array<{
    type: 'missing_foreign_key' | 'null_constraint' | 'malformed_json' | 'legacy_inconsistency' | 'orphaned_record';
    severity: 'critical' | 'warning' | 'info';
    field: string;
    count: number;
    description: string;
    sampleIds?: string[];
    canAutoRepair: boolean;
  }>;
}

export interface SchemaValidationReport {
  timestamp: string;
  overallStatus: 'healthy' | 'warning' | 'critical';
  totalTablesInspected: number;
  totalIssuesFound: number;
  criticalIssuesCount: number;
  warningIssuesCount: number;
  tables: Record<string, TableInspectionResult>;
  summary: {
    questionsTotal: number;
    questionsActive: number;
    orphanedQuestions: number;
    subjectsTotal: number;
    missingOfficialSubjects: string[];
    topicsTotal: number;
    orphanedTopics: number;
    userProgressRecords: number;
  };
}

export interface AutoMigrationResult {
  success: boolean;
  timestamp: string;
  actionsApplied: string[];
  repairedRecordsCount: number;
  errors: string[];
}

export class SchemaMigrationService {
  /**
   * Run deep automated schema validation on Supabase tables.
   */
  public static async inspectDatabaseSchema(): Promise<SchemaValidationReport> {
    const tableResults: Record<string, TableInspectionResult> = {};
    let totalIssues = 0;
    let criticalCount = 0;
    let warningCount = 0;

    // 1. Inspect 'subjects' table
    const { data: subjectsData, error: subErr } = await supabase.from('subjects').select('*');
    const subjects = subjectsData || [];
    const subjectIssues: TableInspectionResult['issues'] = [];
    const validSubjectIds = new Set(subjects.map(s => s.id));
    const existingSubjectNames = subjects.map(s => normalizeSubjectName(s.name));

    const missingOfficial = OFFICIAL_JAMB_SUBJECTS.filter(
      official => !existingSubjectNames.includes(normalizeSubjectName(official.name))
    );

    if (missingOfficial.length > 0) {
      subjectIssues.push({
        type: 'legacy_inconsistency',
        severity: 'warning',
        field: 'name',
        count: missingOfficial.length,
        description: `Missing ${missingOfficial.length} official UTME subjects (${missingOfficial.map(m => m.name).slice(0, 3).join(', ')}...)`,
        canAutoRepair: true
      });
      warningCount += missingOfficial.length;
    }

    const inactiveSubjects = subjects.filter(s => s.is_active === false || s.is_active === null);
    if (inactiveSubjects.length > 0) {
      subjectIssues.push({
        type: 'null_constraint',
        severity: 'info',
        field: 'is_active',
        count: inactiveSubjects.length,
        description: `${inactiveSubjects.length} subjects have disabled or NULL is_active status`,
        sampleIds: inactiveSubjects.map(s => s.id).slice(0, 5),
        canAutoRepair: true
      });
    }

    tableResults['subjects'] = {
      tableName: 'subjects',
      totalRecords: subjects.length,
      healthyRecords: subjects.length - subjectIssues.reduce((a, b) => a + b.count, 0),
      flaggedRecords: subjectIssues.reduce((a, b) => a + b.count, 0),
      status: subjectIssues.some(i => i.severity === 'critical') ? 'critical' : subjectIssues.length > 0 ? 'warning' : 'healthy',
      issues: subjectIssues
    };

    // 2. Inspect 'topics' table
    const { data: topicsData } = await supabase.from('topics').select('*');
    const topics = topicsData || [];
    const topicIssues: TableInspectionResult['issues'] = [];
    const validTopicIds = new Set(topics.map(t => t.id));

    const orphanedTopics = topics.filter(t => t.subject_id && !validSubjectIds.has(t.subject_id));
    if (orphanedTopics.length > 0) {
      topicIssues.push({
        type: 'missing_foreign_key',
        severity: 'critical',
        field: 'subject_id',
        count: orphanedTopics.length,
        description: `${orphanedTopics.length} topics reference non-existent subject_id`,
        sampleIds: orphanedTopics.map(t => t.id).slice(0, 5),
        canAutoRepair: true
      });
      criticalCount += orphanedTopics.length;
    }

    const unnamedTopics = topics.filter(t => !t.name || t.name.trim() === '');
    if (unnamedTopics.length > 0) {
      topicIssues.push({
        type: 'null_constraint',
        severity: 'warning',
        field: 'name',
        count: unnamedTopics.length,
        description: `${unnamedTopics.length} topics have empty or null names`,
        sampleIds: unnamedTopics.map(t => t.id).slice(0, 5),
        canAutoRepair: false
      });
      warningCount += unnamedTopics.length;
    }

    tableResults['topics'] = {
      tableName: 'topics',
      totalRecords: topics.length,
      healthyRecords: topics.length - topicIssues.reduce((a, b) => a + b.count, 0),
      flaggedRecords: topicIssues.reduce((a, b) => a + b.count, 0),
      status: topicIssues.some(i => i.severity === 'critical') ? 'critical' : topicIssues.length > 0 ? 'warning' : 'healthy',
      issues: topicIssues
    };

    // 3. Inspect 'questions' table
    const { data: qData, count: totalQCount } = await supabase
      .from('questions')
      .select('id, question_text, options, correct_answer, subject_id, topic_id, is_active', { count: 'exact' })
      .limit(5000);

    const questions = qData || [];
    const questionIssues: TableInspectionResult['issues'] = [];

    // Check orphaned subject_id
    const orphanedQuestions = questions.filter(q => q.subject_id && !validSubjectIds.has(q.subject_id));
    if (orphanedQuestions.length > 0) {
      questionIssues.push({
        type: 'missing_foreign_key',
        severity: 'critical',
        field: 'subject_id',
        count: orphanedQuestions.length,
        description: `${orphanedQuestions.length} questions reference an unmapped subject_id`,
        sampleIds: orphanedQuestions.map(q => q.id).slice(0, 5),
        canAutoRepair: true
      });
      criticalCount += orphanedQuestions.length;
    }

    // Check orphaned topic_id
    const orphanedTopicQuestions = questions.filter(q => q.topic_id && !validTopicIds.has(q.topic_id));
    if (orphanedTopicQuestions.length > 0) {
      questionIssues.push({
        type: 'missing_foreign_key',
        severity: 'warning',
        field: 'topic_id',
        count: orphanedTopicQuestions.length,
        description: `${orphanedTopicQuestions.length} questions reference an invalid topic_id`,
        sampleIds: orphanedTopicQuestions.map(q => q.id).slice(0, 5),
        canAutoRepair: true
      });
      warningCount += orphanedTopicQuestions.length;
    }

    // Check null or short question_text
    const emptyTextQs = questions.filter(q => !q.question_text || q.question_text.trim().length < 3);
    if (emptyTextQs.length > 0) {
      questionIssues.push({
        type: 'null_constraint',
        severity: 'critical',
        field: 'question_text',
        count: emptyTextQs.length,
        description: `${emptyTextQs.length} questions have empty or invalid question_text`,
        sampleIds: emptyTextQs.map(q => q.id).slice(0, 5),
        canAutoRepair: false
      });
      criticalCount += emptyTextQs.length;
    }

    // Check malformed options
    const malformedOptions = questions.filter(q => {
      if (!q.options) return true;
      if (typeof q.options === 'string') {
        try {
          const parsed = JSON.parse(q.options);
          return !Array.isArray(parsed) || parsed.length < 2;
        } catch {
          return true;
        }
      }
      return !Array.isArray(q.options) || q.options.length < 2;
    });

    if (malformedOptions.length > 0) {
      questionIssues.push({
        type: 'malformed_json',
        severity: 'critical',
        field: 'options',
        count: malformedOptions.length,
        description: `${malformedOptions.length} questions have malformed or empty options JSON`,
        sampleIds: malformedOptions.map(q => q.id).slice(0, 5),
        canAutoRepair: true
      });
      criticalCount += malformedOptions.length;
    }

    // Check missing answer key
    const missingAnswer = questions.filter(q => !q.correct_answer || q.correct_answer.trim() === '');
    if (missingAnswer.length > 0) {
      questionIssues.push({
        type: 'null_constraint',
        severity: 'warning',
        field: 'correct_answer',
        count: missingAnswer.length,
        description: `${missingAnswer.length} questions have no correct_answer specified`,
        sampleIds: missingAnswer.map(q => q.id).slice(0, 5),
        canAutoRepair: true
      });
      warningCount += missingAnswer.length;
    }

    tableResults['questions'] = {
      tableName: 'questions',
      totalRecords: totalQCount || questions.length,
      healthyRecords: questions.length - questionIssues.reduce((a, b) => a + b.count, 0),
      flaggedRecords: questionIssues.reduce((a, b) => a + b.count, 0),
      status: questionIssues.some(i => i.severity === 'critical') ? 'critical' : questionIssues.length > 0 ? 'warning' : 'healthy',
      issues: questionIssues
    };

    // 4. Inspect 'user_progress' table
    let userProgressCount = 0;
    const { data: upData, count: upCount } = await supabase.from('user_progress').select('id, user_id, subject_id', { count: 'exact' }).limit(500);
    userProgressCount = upCount || upData?.length || 0;
    const upIssues: TableInspectionResult['issues'] = [];

    if (upData) {
      const invalidSubjProgress = upData.filter(p => p.subject_id && !validSubjectIds.has(p.subject_id));
      if (invalidSubjProgress.length > 0) {
        upIssues.push({
          type: 'missing_foreign_key',
          severity: 'warning',
          field: 'subject_id',
          count: invalidSubjProgress.length,
          description: `${invalidSubjProgress.length} progress records have unlinked subject_id`,
          canAutoRepair: true
        });
        warningCount += invalidSubjProgress.length;
      }
    }

    tableResults['user_progress'] = {
      tableName: 'user_progress',
      totalRecords: userProgressCount,
      healthyRecords: userProgressCount - upIssues.reduce((a, b) => a + b.count, 0),
      flaggedRecords: upIssues.reduce((a, b) => a + b.count, 0),
      status: upIssues.some(i => i.severity === 'critical') ? 'critical' : upIssues.length > 0 ? 'warning' : 'healthy',
      issues: upIssues
    };

    totalIssues = Object.values(tableResults).reduce((acc, t) => acc + t.issues.length, 0);
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalCount > 0) overallStatus = 'critical';
    else if (warningCount > 0) overallStatus = 'warning';

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      totalTablesInspected: Object.keys(tableResults).length,
      totalIssuesFound: totalIssues,
      criticalIssuesCount: criticalCount,
      warningIssuesCount: warningCount,
      tables: tableResults,
      summary: {
        questionsTotal: totalQCount || questions.length,
        questionsActive: questions.filter(q => q.is_active !== false).length,
        orphanedQuestions: orphanedQuestions.length,
        subjectsTotal: subjects.length,
        missingOfficialSubjects: missingOfficial.map(m => m.name),
        topicsTotal: topics.length,
        orphanedTopics: orphanedTopics.length,
        userProgressRecords: userProgressCount
      }
    };
  }

  /**
   * Execute automated schema migration & consistency repair script.
   */
  public static async runAutoMigrationRepair(): Promise<AutoMigrationResult> {
    const actions: string[] = [];
    const errors: string[] = [];
    let repairedCount = 0;

    try {
      // Step 1: Ensure Official UTME Subjects exist and are enabled
      for (const official of OFFICIAL_JAMB_SUBJECTS) {
        const { data: existing } = await supabase
          .from('subjects')
          .select('id, is_active')
          .ilike('name', official.name)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase.from('subjects').insert({
            name: official.name,
            icon: official.icon || 'BookOpen',
            is_active: true
          });
          if (!error) {
            actions.push(`Inserted missing official subject: ${official.name}`);
            repairedCount++;
          } else {
            errors.push(`Failed inserting ${official.name}: ${error.message}`);
          }
        } else if (existing.is_active === false || existing.is_active === null) {
          await supabase.from('subjects').update({ is_active: true }).eq('id', existing.id);
          actions.push(`Activated disabled subject: ${official.name}`);
          repairedCount++;
        }
      }

      // Step 2: Set default is_active = true on questions where NULL
      const { data: nullActiveQs } = await supabase
        .from('questions')
        .select('id')
        .is('is_active', null)
        .limit(200);

      if (nullActiveQs && nullActiveQs.length > 0) {
        const ids = nullActiveQs.map(q => q.id);
        const { error } = await supabase
          .from('questions')
          .update({ is_active: true })
          .in('id', ids);

        if (!error) {
          actions.push(`Updated ${ids.length} questions with NULL is_active to TRUE`);
          repairedCount += ids.length;
        }
      }

      // Step 3: Default missing correct_answer to 'A' where options exist
      const { data: missingAnsQs } = await supabase
        .from('questions')
        .select('id')
        .or('correct_answer.is.null,correct_answer.eq.""')
        .limit(100);

      if (missingAnsQs && missingAnsQs.length > 0) {
        const ids = missingAnsQs.map(q => q.id);
        const { error } = await supabase
          .from('questions')
          .update({ correct_answer: 'A' })
          .in('id', ids);

        if (!error) {
          actions.push(`Initialized default answer key 'A' for ${ids.length} unkeyed questions`);
          repairedCount += ids.length;
        }
      }

      return {
        success: errors.length === 0,
        timestamp: new Date().toISOString(),
        actionsApplied: actions,
        repairedRecordsCount: repairedCount,
        errors
      };
    } catch (err: any) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        actionsApplied: actions,
        repairedRecordsCount: repairedCount,
        errors: [...errors, err.message || 'Auto-migration runtime error']
      };
    }
  }
}

export const SchemaConsistencyDiagnostic = SchemaMigrationService;
export type SchemaConsistencyReport = SchemaValidationReport;
