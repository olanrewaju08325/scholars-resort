import { supabase } from '@/lib/supabase';

export interface CareerCourse {
  name: string;
  subjects: string[];
  requirements: string;
}

export interface CareerCategory {
  category: string;
  courses: CareerCourse[];
}

export const INITIAL_CAREER_DATA: CareerCategory[] = [
  {
    category: 'Medical & Health Sciences',
    courses: [
      { name: 'Medicine and Surgery', subjects: ['English', 'Biology', 'Chemistry', 'Physics'], requirements: '5 O\'Level credits including Math & English' },
      { name: 'Nursing Science', subjects: ['English', 'Biology', 'Chemistry', 'Physics'], requirements: '5 O\'Level credits including Math & English' },
      { name: 'Pharmacy', subjects: ['English', 'Biology', 'Chemistry', 'Physics'], requirements: '5 O\'Level credits including Math & English' },
    ]
  },
  {
    category: 'Engineering & Technology',
    courses: [
      { name: 'Computer Science', subjects: ['English', 'Mathematics', 'Physics', 'Chemistry'], requirements: '5 O\'Level credits including Math & English' },
      { name: 'Mechanical Engineering', subjects: ['English', 'Mathematics', 'Physics', 'Chemistry'], requirements: '5 O\'Level credits including Math & English' },
      { name: 'Electrical Engineering', subjects: ['English', 'Mathematics', 'Physics', 'Chemistry'], requirements: '5 O\'Level credits including Math & English' },
    ]
  },
  {
    category: 'Arts & Humanities',
    courses: [
      { name: 'Law', subjects: ['English', 'Literature in English', 'Government', 'CRS/IRS'], requirements: '5 O\'Level credits including Lit & English' },
      { name: 'Mass Communication', subjects: ['English', 'Literature in English', 'Government', 'Any other Arts/Social Science'], requirements: '5 O\'Level credits including Math & English' },
    ]
  },
  {
    category: 'Social & Management Sciences',
    courses: [
      { name: 'Accounting', subjects: ['English', 'Mathematics', 'Economics', 'Government/Commerce'], requirements: '5 O\'Level credits including Math, English & Economics' },
      { name: 'Economics', subjects: ['English', 'Mathematics', 'Economics', 'Government'], requirements: '5 O\'Level credits including Math, English & Economics' },
    ]
  }
];

const SETTING_KEY = 'career_guide_db';
const STORAGE_KEY = 'scholar_career_guide_db';

export const fetchCareerGuideData = async (): Promise<CareerCategory[]> => {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', SETTING_KEY)
      .maybeSingle();

    if (!error && data?.setting_value && Array.isArray(data.setting_value) && data.setting_value.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.setting_value));
      return data.setting_value;
    }
  } catch (err) {
    console.warn('Could not fetch career guide data from admin_settings:', err);
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return INITIAL_CAREER_DATA;
};

export const saveCareerGuideData = async (data: CareerCategory[]): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        setting_key: SETTING_KEY,
        setting_value: data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
