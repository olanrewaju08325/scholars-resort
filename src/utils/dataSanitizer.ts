/**
 * DataSanitizer Utility
 * Validates and sanitizes API responses from database or external calls before setting state.
 * Prevents UI crashes and guarantees clean empty states or fallback structures (never mock fake data).
 */

export interface SanitizedExamSession {
  id: string;
  user_id?: string;
  subject?: string;
  total_questions?: number;
  correct_count?: number;
  score?: number;
  percentage?: number;
  created_at?: string;
  submitted_at?: string;
  time_spent_seconds?: number;
}

export interface SanitizedWeeklyChallenge {
  id: string;
  title: string;
  subject: string;
  xp_reward: number;
  week_start: string;
  week_end: string;
  question_data?: {
    question: string;
    options: string[];
    answer: string;
    explanation?: string;
  };
  is_active?: boolean;
}

export interface SanitizedLeaderboardEntry {
  user_id: string;
  full_name: string;
  score: number;
  rank?: number;
  avatar_url?: string;
}

export interface SanitizedXPTransaction {
  id: string;
  user_id?: string;
  amount: number;
  reason?: string;
  created_at: string;
}

export interface SanitizedStudyGoal {
  id: string;
  user_id?: string;
  daily_target: number;
  completed_count?: number;
  created_at?: string;
}

export interface SanitizedTournament {
  id: string;
  title: string;
  start_time: string;
  duration_minutes: number;
  status?: string;
  prize_pool?: string;
}

export class DataSanitizer {
  /**
   * Safely parses any response array, returning an empty array if invalid.
   */
  static sanitizeArray<T>(data: any, sanitizerFn?: (item: any) => T | null): T[] {
    if (!data || !Array.isArray(data)) return [];
    if (!sanitizerFn) return data as T[];

    return data
      .map((item) => {
        try {
          return sanitizerFn(item);
        } catch {
          return null;
        }
      })
      .filter((item): item is T => item !== null && item !== undefined);
  }

  /**
   * Safely validates a single object or returns null/fallback.
   */
  static sanitizeObject<T>(data: any, sanitizerFn: (item: any) => T | null, fallback: T | null = null): T | null {
    if (!data || typeof data !== 'object') return fallback;
    try {
      const sanitized = sanitizerFn(data);
      return sanitized !== null ? sanitized : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Sanitizes Exam Session objects
   */
  static sanitizeExamSession(item: any): SanitizedExamSession | null {
    if (!item || typeof item !== 'object' || (!item.id && !item.created_at)) return null;

    return {
      id: String(item.id || Math.random().toString(36).substring(2, 9)),
      user_id: item.user_id ? String(item.user_id) : undefined,
      subject: item.subject ? String(item.subject) : 'General',
      total_questions: typeof item.total_questions === 'number' ? item.total_questions : 0,
      correct_count: typeof item.correct_count === 'number' ? item.correct_count : 0,
      score: typeof item.score === 'number' ? item.score : (typeof item.percentage === 'number' ? item.percentage : 0),
      percentage: typeof item.percentage === 'number' ? item.percentage : (typeof item.score === 'number' ? item.score : 0),
      created_at: item.created_at ? String(item.created_at) : new Date().toISOString(),
      submitted_at: item.submitted_at ? String(item.submitted_at) : undefined,
      time_spent_seconds: typeof item.time_spent_seconds === 'number' ? item.time_spent_seconds : 0
    };
  }

  /**
   * Sanitizes Weekly Challenge objects
   */
  static sanitizeWeeklyChallenge(item: any): SanitizedWeeklyChallenge | null {
    if (!item || typeof item !== 'object') return null;
    if (!item.title && !item.question_data) return null;

    return {
      id: String(item.id || `challenge_${Date.now()}`),
      title: String(item.title || 'Weekly Challenge'),
      subject: String(item.subject || 'General'),
      xp_reward: typeof item.xp_reward === 'number' ? item.xp_reward : 100,
      week_start: String(item.week_start || new Date().toISOString().split('T')[0]),
      week_end: String(item.week_end || new Date().toISOString().split('T')[0]),
      question_data: item.question_data && typeof item.question_data === 'object' ? {
        question: String(item.question_data.question || ''),
        options: Array.isArray(item.question_data.options) ? item.question_data.options.map(String) : [],
        answer: String(item.question_data.answer || 'A'),
        explanation: item.question_data.explanation ? String(item.question_data.explanation) : undefined
      } : undefined,
      is_active: Boolean(item.is_active ?? true)
    };
  }

  /**
   * Sanitizes Leaderboard entries
   */
  static sanitizeLeaderboardEntry(item: any): SanitizedLeaderboardEntry | null {
    if (!item || typeof item !== 'object') return null;

    return {
      user_id: String(item.user_id || item.id || Math.random().toString(36).substring(2, 9)),
      full_name: String(item.full_name || item.name || 'Scholar Candidate'),
      score: typeof item.score === 'number' ? item.score : (typeof item.xp === 'number' ? item.xp : 0),
      rank: typeof item.rank === 'number' ? item.rank : undefined,
      avatar_url: item.avatar_url ? String(item.avatar_url) : undefined
    };
  }

  /**
   * Sanitizes XP Transactions
   */
  static sanitizeXPTransaction(item: any): SanitizedXPTransaction | null {
    if (!item || typeof item !== 'object') return null;

    return {
      id: String(item.id || Math.random().toString(36).substring(2, 9)),
      user_id: item.user_id ? String(item.user_id) : undefined,
      amount: typeof item.amount === 'number' ? item.amount : (typeof item.xp === 'number' ? item.xp : 0),
      reason: item.reason ? String(item.reason) : 'Practice Activity',
      created_at: String(item.created_at || new Date().toISOString())
    };
  }

  /**
   * Sanitizes Tournament objects
   */
  static sanitizeTournament(item: any): SanitizedTournament | null {
    if (!item || typeof item !== 'object') return null;
    if (!item.title || !item.start_time) return null;

    return {
      id: String(item.id || Math.random().toString(36).substring(2, 9)),
      title: String(item.title),
      start_time: String(item.start_time),
      duration_minutes: typeof item.duration_minutes === 'number' ? item.duration_minutes : 60,
      status: String(item.status || 'upcoming'),
      prize_pool: item.prize_pool ? String(item.prize_pool) : undefined
    };
  }
}
