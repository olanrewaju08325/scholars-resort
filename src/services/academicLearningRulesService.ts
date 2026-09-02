import { supabase } from '@/lib/supabase';

export interface AcademicLearningRules {
  masteryThresholdPercent: number; // e.g. 75%
  minAttemptsForMastery: number; // e.g. 3 questions
  weaknessTriggerPercent: number; // e.g. 50%
  prerequisiteMode: 'strict' | 'advisory'; // strict = locked until prereq mastered; advisory = accessible with guidance
  activePrescribedNovelId?: string; // id of active literature novel or empty
  activePrescribedNovelTitle?: string;
  dailyStudyTargetMinutes: number; // e.g. 30 mins
  updatedAt?: string;
}

export const DEFAULT_ACADEMIC_LEARNING_RULES: AcademicLearningRules = {
  masteryThresholdPercent: 75,
  minAttemptsForMastery: 3,
  weaknessTriggerPercent: 50,
  prerequisiteMode: 'strict',
  activePrescribedNovelId: '',
  activePrescribedNovelTitle: '',
  dailyStudyTargetMinutes: 30
};

const SETTING_KEY = 'academic_learning_rules';
const STORAGE_KEY = 'scholars_resort_learning_rules';

export async function fetchAcademicLearningRules(): Promise<AcademicLearningRules> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', SETTING_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      const parsed = data.setting_value as AcademicLearningRules;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      return { ...DEFAULT_ACADEMIC_LEARNING_RULES, ...parsed };
    }
  } catch (err) {
    console.warn('[AcademicLearningRules] Could not load from Supabase:', err);
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      return { ...DEFAULT_ACADEMIC_LEARNING_RULES, ...JSON.parse(local) };
    }
  } catch {}

  return DEFAULT_ACADEMIC_LEARNING_RULES;
}

export async function saveAcademicLearningRules(rules: Partial<AcademicLearningRules>): Promise<{ success: boolean; error?: string }> {
  const merged: AcademicLearningRules = {
    ...DEFAULT_ACADEMIC_LEARNING_RULES,
    ...rules,
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        setting_key: SETTING_KEY,
        setting_value: merged,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('academic_learning_rules_updated', { detail: merged }));
    }

    if (error) {
      console.warn('[AcademicLearningRules] Supabase upsert notice:', error.message);
      return { success: true, error: `Saved locally: ${error.message}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[AcademicLearningRules] Save error:', err);
    return { success: false, error: err.message };
  }
}
