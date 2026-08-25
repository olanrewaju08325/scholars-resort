import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';

export interface CleanupFilterOptions {
  purgePlaceholderQuestions: boolean;
  purgeGuestSessions: boolean;
  purgeUnsubmittedSessions: boolean;
  purgeTestTournaments: boolean;
  purgeLocalIndexedDB: boolean;
  dateFilterEnabled: boolean;
  createdBeforeDate?: string; // ISO date string (YYYY-MM-DD)
  customKeywords?: string[];
}

export interface TableCleanupPreview {
  table: string;
  matchedCount: number;
  description: string;
}

export interface CleanupPreviewResult {
  timestamp: string;
  totalTargetedRecords: number;
  tablePreviews: TableCleanupPreview[];
  summaryMessage: string;
}

export interface CleanupExecutionResult {
  success: boolean;
  timestamp: string;
  totalDeletedRecords: number;
  details: { table: string; deletedCount: number; status: 'success' | 'failed'; error?: string }[];
  message: string;
}

const DEFAULT_KEYWORDS = ['mock question', 'sample question', 'lorem ipsum', 'test question', 'dummy question', 'temp question'];

/**
 * Previews the number of mock/development records targeted for deletion across Supabase tables.
 */
export const previewEnvironmentCleanup = async (
  options: CleanupFilterOptions
): Promise<CleanupPreviewResult> => {
  const previews: TableCleanupPreview[] = [];
  let totalCount = 0;

  const keywords = [
    ...DEFAULT_KEYWORDS,
    ...(options.customKeywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean),
  ];

  // 1. Target Questions Bank
  if (options.purgePlaceholderQuestions) {
    try {
      let query = supabase.from('questions').select('id, question_text, created_at');

      if (options.dateFilterEnabled && options.createdBeforeDate) {
        query = query.lt('created_at', new Date(options.createdBeforeDate).toISOString());
      }

      const { data, error } = await query;
      if (!error && data) {
        const matched = data.filter((q) => {
          const textLower = (q.question_text || '').toLowerCase();
          return keywords.some((kw) => textLower.includes(kw));
        });

        previews.push({
          table: 'questions',
          matchedCount: matched.length,
          description: `Placeholder/mock test questions matching keywords (${keywords.slice(0, 3).join(', ')}...)`,
        });
        totalCount += matched.length;
      }
    } catch (err) {
      console.warn('Error previewing question cleanup:', err);
    }
  }

  // 2. Target Guest & Anonymous Exam Sessions
  if (options.purgeGuestSessions) {
    try {
      let query = supabase.from('exam_sessions').select('id, user_id, created_at').is('user_id', null);

      if (options.dateFilterEnabled && options.createdBeforeDate) {
        query = query.lt('created_at', new Date(options.createdBeforeDate).toISOString());
      }

      const { data, error } = await query;
      if (!error && data) {
        previews.push({
          table: 'exam_sessions (Guest)',
          matchedCount: data.length,
          description: 'Anonymous guest test exam sessions without an attached user account.',
        });
        totalCount += data.length;
      }
    } catch (err) {
      console.warn('Error previewing guest sessions cleanup:', err);
    }
  }

  // 3. Target Unsubmitted/Abandoned Sessions
  if (options.purgeUnsubmittedSessions) {
    try {
      let query = supabase.from('exam_sessions').select('id, status, created_at').eq('status', 'in_progress');

      if (options.dateFilterEnabled && options.createdBeforeDate) {
        query = query.lt('created_at', new Date(options.createdBeforeDate).toISOString());
      }

      const { data, error } = await query;
      if (!error && data) {
        previews.push({
          table: 'exam_sessions (In-Progress)',
          matchedCount: data.length,
          description: 'Abandoned/unsubmitted test exam sessions left in in_progress state.',
        });
        totalCount += data.length;
      }
    } catch (err) {
      console.warn('Error previewing in-progress sessions cleanup:', err);
    }
  }

  // 4. Target Test Tournaments
  if (options.purgeTestTournaments) {
    try {
      let query = supabase.from('tournaments').select('id, title, created_at');

      if (options.dateFilterEnabled && options.createdBeforeDate) {
        query = query.lt('created_at', new Date(options.createdBeforeDate).toISOString());
      }

      const { data, error } = await query;
      if (!error && data) {
        const matched = data.filter((t) => {
          const titleLower = (t.title || '').toLowerCase();
          return titleLower.includes('test') || titleLower.includes('mock') || titleLower.includes('demo');
        });

        previews.push({
          table: 'tournaments',
          matchedCount: matched.length,
          description: 'Test/demo tournaments titled with test or mock indicators.',
        });
        totalCount += matched.length;
      }
    } catch (err) {
      console.warn('Error previewing tournament cleanup:', err);
    }
  }

  // 5. Local IndexedDB cache count
  if (options.purgeLocalIndexedDB) {
    try {
      const pendingCount = await db.pending_sessions.count();
      previews.push({
        table: 'Local IndexedDB (pending_sessions)',
        matchedCount: pendingCount,
        description: 'Cached client-side offline exam logs stored in local IndexedDB browser storage.',
      });
      totalCount += pendingCount;
    } catch (err) {
      console.warn('Error previewing IndexedDB cleanup:', err);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalTargetedRecords: totalCount,
    tablePreviews: previews,
    summaryMessage: `Found ${totalCount} development mock records ready for cleanup.`,
  };
};

/**
 * Executes environment cleanup and deletes targeted development mock records from Supabase tables.
 */
export const executeEnvironmentCleanup = async (
  options: CleanupFilterOptions,
  confirmationToken: string
): Promise<CleanupExecutionResult> => {
  if (confirmationToken !== 'PURGE-MOCK-DATA') {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      totalDeletedRecords: 0,
      details: [],
      message: 'Invalid confirmation token. Cleanup aborted for safety.',
    };
  }

  const executionDetails: { table: string; deletedCount: number; status: 'success' | 'failed'; error?: string }[] = [];
  let totalDeleted = 0;

  const keywords = [
    ...DEFAULT_KEYWORDS,
    ...(options.customKeywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean),
  ];

  // 1. Purge Questions Bank
  if (options.purgePlaceholderQuestions) {
    try {
      let query = supabase.from('questions').select('id, question_text, created_at');
      if (options.dateFilterEnabled && options.createdBeforeDate) {
        query = query.lt('created_at', new Date(options.createdBeforeDate).toISOString());
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const idsToDelete = data
          .filter((q) => keywords.some((kw) => (q.question_text || '').toLowerCase().includes(kw)))
          .map((q) => q.id);

        if (idsToDelete.length > 0) {
          const { error: delErr } = await supabase.from('questions').delete().in('id', idsToDelete);
          if (delErr) {
            executionDetails.push({ table: 'questions', deletedCount: 0, status: 'failed', error: delErr.message });
          } else {
            executionDetails.push({ table: 'questions', deletedCount: idsToDelete.length, status: 'success' });
            totalDeleted += idsToDelete.length;
          }
        }
      }
    } catch (err: any) {
      executionDetails.push({ table: 'questions', deletedCount: 0, status: 'failed', error: err.message || String(err) });
    }
  }

  // 2. Purge Guest Exam Sessions
  if (options.purgeGuestSessions) {
    try {
      let query = supabase.from('exam_sessions').delete().is('user_id', null);
      if (options.dateFilterEnabled && options.createdBeforeDate) {
        query = query.lt('created_at', new Date(options.createdBeforeDate).toISOString());
      }

      const { count, error } = await query;
      if (error) {
        executionDetails.push({ table: 'exam_sessions (Guest)', deletedCount: 0, status: 'failed', error: error.message });
      } else {
        executionDetails.push({ table: 'exam_sessions (Guest)', deletedCount: count || 0, status: 'success' });
        totalDeleted += count || 0;
      }
    } catch (err: any) {
      executionDetails.push({ table: 'exam_sessions (Guest)', deletedCount: 0, status: 'failed', error: err.message || String(err) });
    }
  }

  // 3. Purge Abandoned In-Progress Sessions
  if (options.purgeUnsubmittedSessions) {
    try {
      let query = supabase.from('exam_sessions').delete().eq('status', 'in_progress');
      if (options.dateFilterEnabled && options.createdBeforeDate) {
        query = query.lt('created_at', new Date(options.createdBeforeDate).toISOString());
      }

      const { count, error } = await query;
      if (error) {
        executionDetails.push({ table: 'exam_sessions (In-Progress)', deletedCount: 0, status: 'failed', error: error.message });
      } else {
        executionDetails.push({ table: 'exam_sessions (In-Progress)', deletedCount: count || 0, status: 'success' });
        totalDeleted += count || 0;
      }
    } catch (err: any) {
      executionDetails.push({ table: 'exam_sessions (In-Progress)', deletedCount: 0, status: 'failed', error: err.message || String(err) });
    }
  }

  // 4. Purge Test Tournaments
  if (options.purgeTestTournaments) {
    try {
      let query = supabase.from('tournaments').select('id, title, created_at');
      if (options.dateFilterEnabled && options.createdBeforeDate) {
        query = query.lt('created_at', new Date(options.createdBeforeDate).toISOString());
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const idsToDelete = data
          .filter((t) => {
            const titleLower = (t.title || '').toLowerCase();
            return titleLower.includes('test') || titleLower.includes('mock') || titleLower.includes('demo');
          })
          .map((t) => t.id);

        if (idsToDelete.length > 0) {
          const { error: delErr } = await supabase.from('tournaments').delete().in('id', idsToDelete);
          if (delErr) {
            executionDetails.push({ table: 'tournaments', deletedCount: 0, status: 'failed', error: delErr.message });
          } else {
            executionDetails.push({ table: 'tournaments', deletedCount: idsToDelete.length, status: 'success' });
            totalDeleted += idsToDelete.length;
          }
        }
      }
    } catch (err: any) {
      executionDetails.push({ table: 'tournaments', deletedCount: 0, status: 'failed', error: err.message || String(err) });
    }
  }

  // 5. Clear Local IndexedDB Cache
  if (options.purgeLocalIndexedDB) {
    try {
      const countBefore = await db.pending_sessions.count();
      await db.pending_sessions.clear();
      executionDetails.push({ table: 'Local IndexedDB', deletedCount: countBefore, status: 'success' });
      totalDeleted += countBefore;
    } catch (err: any) {
      executionDetails.push({ table: 'Local IndexedDB', deletedCount: 0, status: 'failed', error: err.message || String(err) });
    }
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    totalDeletedRecords: totalDeleted,
    details: executionDetails,
    message: `Environment cleanup completed! Successfully deleted ${totalDeleted} development mock records.`,
  };
};
