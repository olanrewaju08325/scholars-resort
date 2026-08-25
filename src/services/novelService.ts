import { supabase } from '@/lib/supabase';
import { DEFAULT_JAMB_BOOKS, type LiteratureBook } from '@/data/jambNovelsData';

const STORAGE_KEY = 'scholars_resort_jamb_novels';
const SETTING_KEY = 'jamb_novels_db';
const LOCK_SETTING_KEY = 'literature_hub_locked';

export interface LiteratureLockStatus {
  isLocked: boolean;
  lockReason?: string;
  updatedAt?: string;
}

// Retrieve lock status for literature hub
export const fetchLiteratureLockStatus = async (): Promise<LiteratureLockStatus> => {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', LOCK_SETTING_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      localStorage.setItem('literature_lock_status', JSON.stringify(data.setting_value));
      return data.setting_value as LiteratureLockStatus;
    }
  } catch (err) {
    console.warn('Could not fetch literature lock status from Supabase:', err);
  }

  try {
    const local = localStorage.getItem('literature_lock_status');
    if (local) {
      return JSON.parse(local);
    }
  } catch {}

  return { isLocked: false, lockReason: 'Official JAMB literature texts are currently being updated by the academic team.' };
};

// Save lock status
export const saveLiteratureLockStatus = async (isLocked: boolean, lockReason?: string): Promise<{ success: boolean }> => {
  const payload: LiteratureLockStatus = {
    isLocked,
    lockReason: lockReason || 'Official JAMB literature texts are currently being updated by the academic team.',
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem('literature_lock_status', JSON.stringify(payload));

  try {
    await supabase.from('admin_settings').upsert({
      setting_key: LOCK_SETTING_KEY,
      setting_value: payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' });
  } catch (err) {
    console.warn('Failed to persist lock status to Supabase:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('literature_updated'));
  }

  return { success: true };
};

// Upload textbook file to Supabase Storage with local fallback
export const uploadTextbookFileToSupabaseStorage = async (file: File): Promise<{ url: string; source: 'supabase' | 'local'; fileName: string }> => {
  const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  try {
    // Attempt Supabase Storage bucket upload
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('textbooks')
      .upload(cleanFileName, file, { cacheControl: '3600', upsert: true });

    if (!uploadError && uploadData) {
      const { data: publicUrlData } = supabase
        .storage
        .from('textbooks')
        .getPublicUrl(cleanFileName);

      if (publicUrlData?.publicUrl) {
        return {
          url: publicUrlData.publicUrl,
          source: 'supabase',
          fileName: file.name
        };
      }
    }
  } catch (err) {
    console.warn('Supabase Storage upload fallback triggered:', err);
  }

  // Fallback to Data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        url: e.target?.result as string,
        source: 'local',
        fileName: file.name
      });
    };
    reader.onerror = () => reject(new Error('Failed to read textbook file'));
    reader.readAsDataURL(file);
  });
};

// Retrieve all books (first checks Supabase, then localStorage, or auto-seeds defaults)
export const fetchJambBooks = async (): Promise<LiteratureBook[]> => {
  try {
    // 1. Try Supabase admin_settings
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', SETTING_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      if (Array.isArray(data.setting_value)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.setting_value));
        return data.setting_value;
      }
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

  // 3. First-time initialization: Auto-seed DEFAULT_JAMB_BOOKS to Supabase so Admin can manage real records
  try {
    await saveJambBooks(DEFAULT_JAMB_BOOKS);
  } catch (e) {
    console.warn('Failed to seed default novels to Supabase:', e);
  }

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

