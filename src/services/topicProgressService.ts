import { supabase } from '@/lib/supabase';

export interface TopicProgress {
  subjectId: string;
  topicId: string;
  topicName: string;
  score: number; // percentage (0-100)
  questionsAttempted: number;
  isMastered: boolean; // >= 70%
  completedAt: string;
}

const STORAGE_KEY = 'scholar_topic_progress';
const SETTING_KEY = 'scholar_sequence_lock_enabled';

/**
 * Gets whether strict sequence lock is enabled by admin. Defaults to true.
 */
export const isSequenceLockEnabled = (): boolean => {
  try {
    const val = localStorage.getItem(SETTING_KEY);
    if (val === 'false') return false;
  } catch {}
  return true;
};

/**
 * Sets strict sequence lock mode (Admin Setting).
 */
export const setSequenceLockEnabled = async (enabled: boolean): Promise<void> => {
  try {
    localStorage.setItem(SETTING_KEY, String(enabled));
    await supabase.from('system_settings').upsert({
      key: 'enforce_sequence_lock',
      value: enabled ? 'true' : 'false',
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Could not save sequence lock setting:', e);
  }
};

/**
 * Retrieves all topic progress records.
 */
export const getAllTopicProgress = (): Record<string, TopicProgress> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

/**
 * Evaluates whether a topic is mastered (score >= 70%).
 */
export const isTopicMastered = (topicId: string | number): boolean => {
  const all = getAllTopicProgress();
  const key = String(topicId);
  if (all[key]) {
    return all[key].isMastered;
  }
  return false;
};

/**
 * Records a CBT drill score for a topic and evaluates mastery (>= 70%).
 */
export const recordTopicScore = async (
  subjectId: string,
  topicId: string,
  topicName: string,
  scorePercentage: number,
  questionsCount: number
): Promise<TopicProgress> => {
  const isMastered = scorePercentage >= 70;
  const progress: TopicProgress = {
    subjectId,
    topicId,
    topicName,
    score: scorePercentage,
    questionsAttempted: questionsCount,
    isMastered,
    completedAt: new Date().toISOString()
  };

  const all = getAllTopicProgress();
  const key = String(topicId);
  
  if (all[key] && all[key].isMastered) {
    progress.isMastered = true;
    progress.score = Math.max(all[key].score, scorePercentage);
  }

  all[key] = progress;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.id) {
      await supabase.from('topic_progress').upsert({
        user_id: userData.user.id,
        subject_id: subjectId,
        topic_id: topicId,
        score: progress.score,
        questions_attempted: questionsCount,
        is_mastered: progress.isMastered,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,topic_id' });
    }
  } catch (err) {
    console.warn('Supabase topic_progress sync notice:', err);
  }

  return progress;
};

/**
 * Evaluates whether a specific topic in an ordered sequence is unlocked.
 * Topic 1 (index 0) is ALWAYS unlocked.
 * Topic N (index N-1) requires Topic N-1 (index N-2) to be mastered (>= 70%).
 */
export const isTopicUnlockedInSequence = (
  topicList: Array<{ id: string | number; name: string }>,
  targetTopicIndex: number
): { isUnlocked: boolean; prerequisiteName?: string; prerequisiteIndex?: number } => {
  if (!isSequenceLockEnabled()) {
    return { isUnlocked: true };
  }

  if (targetTopicIndex <= 0) {
    return { isUnlocked: true };
  }

  const prevTopic = topicList[targetTopicIndex - 1];
  if (!prevTopic) {
    return { isUnlocked: true };
  }

  const prevMastered = isTopicMastered(prevTopic.id);
  if (prevMastered) {
    return { isUnlocked: true };
  }

  return {
    isUnlocked: false,
    prerequisiteName: prevTopic.name,
    prerequisiteIndex: targetTopicIndex
  };
};
