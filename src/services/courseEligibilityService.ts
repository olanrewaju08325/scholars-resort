import { supabase } from '@/lib/supabase';

export interface UniversityCutoff {
  name: string;
  cutoff: number;
}

export interface CourseEligibilityItem {
  course: string;
  category: string;
  jambSubjects: string[];
  olevelCredits: string[];
  universities: UniversityCutoff[];
  advice: string;
}

export const INITIAL_COURSE_DATABASE: CourseEligibilityItem[] = [
  {
    course: "Medicine & Surgery",
    category: "Medical & Health Sciences",
    jambSubjects: ["Use of English", "Biology", "Chemistry", "Physics"],
    olevelCredits: ["English Language", "Mathematics", "Biology", "Chemistry", "Physics"],
    universities: [
      { name: "University of Lagos (UNILAG)", cutoff: 285 },
      { name: "University of Ibadan (UI)", cutoff: 290 },
      { name: "Obafemi Awolowo University (OAU)", cutoff: 280 },
      { name: "Ahmadu Bello University (ABU)", cutoff: 275 },
      { name: "University of Nigeria Nsukka (UNN)", cutoff: 282 },
    ],
    advice: "Must score 280+ in UTME. All 5 O'Level credits must be in one sitting for top federal universities."
  },
  {
    course: "Computer Science",
    category: "Sciences & Technology",
    jambSubjects: ["Use of English", "Mathematics", "Physics", "Chemistry or Economics or Biology"],
    olevelCredits: ["English Language", "Mathematics", "Physics", "Chemistry", "One other science subject"],
    universities: [
      { name: "University of Lagos (UNILAG)", cutoff: 260 },
      { name: "Federal University of Technology Akure (FUTA)", cutoff: 250 },
      { name: "University of Ibadan (UI)", cutoff: 265 },
      { name: "University of Ilorin (UNILORIN)", cutoff: 245 },
    ],
    advice: "Mathematics and Physics are non-negotiable JAMB requirements for Computer Science across all Nigerian universities."
  },
  {
    course: "Law (Common Law / Islamic Law)",
    category: "Law & Humanities",
    jambSubjects: ["Use of English", "Literature in English", "Government or History", "CRK/IRS or Economics"],
    olevelCredits: ["English Language", "Mathematics", "Literature in English", "Government/History", "One Arts/Social Science subject"],
    universities: [
      { name: "University of Lagos (UNILAG)", cutoff: 275 },
      { name: "University of Ibadan (UI)", cutoff: 280 },
      { name: "Lagos State University (LASU)", cutoff: 260 },
      { name: "Ahmadu Bello University (ABU)", cutoff: 255 },
    ],
    advice: "Literature in English is strictly compulsory for Law in JAMB and WAEC. Mathematics credit is required by JAMB."
  },
  {
    course: "Nursing Science",
    category: "Medical & Health Sciences",
    jambSubjects: ["Use of English", "Biology", "Chemistry", "Physics"],
    olevelCredits: ["English Language", "Mathematics", "Biology", "Chemistry", "Physics"],
    universities: [
      { name: "University of Ibadan (UI)", cutoff: 270 },
      { name: "Obafemi Awolowo University (OAU)", cutoff: 265 },
      { name: "University of Benin (UNIBEN)", cutoff: 258 },
    ],
    advice: "Highly competitive course. Target at least 260+ in UTME to guarantee admission."
  },
  {
    course: "Accounting & Finance",
    category: "Commercial & Management",
    jambSubjects: ["Use of English", "Mathematics", "Economics", "Commerce or Government or Accounting"],
    olevelCredits: ["English Language", "Mathematics", "Economics", "Financial Accounting or Commerce", "One Social Science subject"],
    universities: [
      { name: "University of Lagos (UNILAG)", cutoff: 250 },
      { name: "University of Benin (UNIBEN)", cutoff: 240 },
      { name: "University of Ilorin (UNILORIN)", cutoff: 235 },
    ],
    advice: "Mathematics and Economics are strictly mandatory in JAMB for Accounting."
  },
  {
    course: "Mechanical Engineering",
    category: "Engineering & Environmental",
    jambSubjects: ["Use of English", "Mathematics", "Physics", "Chemistry"],
    olevelCredits: ["English Language", "Mathematics", "Physics", "Chemistry", "Further Mathematics or Technical Drawing"],
    universities: [
      { name: "Federal University of Technology Akure (FUTA)", cutoff: 255 },
      { name: "University of Lagos (UNILAG)", cutoff: 270 },
      { name: "Ahmadu Bello University (ABU)", cutoff: 240 },
      { name: "University of Nigeria Nsukka (UNN)", cutoff: 250 }
    ],
    advice: "Physics, Chemistry, and Mathematics are compulsory for all Engineering disciplines."
  },
  {
    course: "Pharmacy (Pharm.D)",
    category: "Medical & Health Sciences",
    jambSubjects: ["Use of English", "Biology", "Chemistry", "Physics"],
    olevelCredits: ["English Language", "Mathematics", "Biology", "Chemistry", "Physics"],
    universities: [
      { name: "University of Ibadan (UI)", cutoff: 275 },
      { name: "University of Lagos (UNILAG)", cutoff: 272 },
      { name: "Obafemi Awolowo University (OAU)", cutoff: 270 },
      { name: "University of Nigeria Nsukka (UNN)", cutoff: 268 },
    ],
    advice: "6-year Pharm.D programme requires high UTME score and distinction in Chemistry and Biology."
  }
];

const SETTING_KEY = 'course_eligibility_db';
const STORAGE_KEY = 'scholar_course_eligibility_db';

export const fetchCourseEligibilityData = async (): Promise<CourseEligibilityItem[]> => {
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
    console.warn('Could not fetch course eligibility data from admin_settings:', err);
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return INITIAL_COURSE_DATABASE;
};

export const saveCourseEligibilityData = async (data: CourseEligibilityItem[]): Promise<{ success: boolean; error?: string }> => {
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
