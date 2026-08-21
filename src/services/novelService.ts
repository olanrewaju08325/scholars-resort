import { supabase } from '@/lib/supabase';
import { DEFAULT_JAMB_BOOKS, type LiteratureBook } from '@/data/jambNovelsData';

const STORAGE_KEY = 'scholars_resort_jamb_novels';
const SETTING_KEY = 'jamb_novels_db';

// Retrieve all books (first checks Supabase, then localStorage, then default real data)
export const fetchJambBooks = async (): Promise<LiteratureBook[]> => {
  try {
    // 1. Try Supabase admin_settings
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
    console.warn('Could not fetch novels from Supabase admin_settings:', err);
  }

  // 2. Try localStorage
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not parse local novel storage:', err);
  }

  // 3. Fallback to default real data
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_JAMB_BOOKS));
  return DEFAULT_JAMB_BOOKS;
};

// Save books (updates Supabase and localStorage)
export const saveJambBooks = async (books: LiteratureBook[]): Promise<{ success: boolean; error?: string }> => {
  try {
    // Update localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));

    // Persist to Supabase admin_settings
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        setting_key: SETTING_KEY,
        setting_value: books,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('literature_updated'));
    }

    if (error) {
      console.warn('Failed to upsert novels to Supabase:', error.message);
      return { success: true, error: `Saved locally: ${error.message}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error saving novel data:', err);
    return { success: false, error: err.message };
  }
};
