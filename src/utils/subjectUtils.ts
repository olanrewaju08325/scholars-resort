import { supabase } from '@/lib/supabase';

export interface JambSubjectInfo {
  id: string;
  name: string;
  aliases: string[];
  category: 'compulsory' | 'sciences' | 'commercial' | 'arts';
  icon: string;
}

export const OFFICIAL_JAMB_SUBJECTS: JambSubjectInfo[] = [
  {
    id: 'use-of-english',
    name: 'Use of English',
    aliases: ['use of english', 'english', 'english language', 'eng', 'english-language', 'use-of-english'],
    category: 'compulsory',
    icon: 'book-open'
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    aliases: ['mathematics', 'math', 'maths', 'general mathematics', 'general maths'],
    category: 'sciences',
    icon: 'calculator'
  },
  {
    id: 'physics',
    name: 'Physics',
    aliases: ['physics', 'phy'],
    category: 'sciences',
    icon: 'atom'
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    aliases: ['chemistry', 'chem'],
    category: 'sciences',
    icon: 'flask-conical'
  },
  {
    id: 'biology',
    name: 'Biology',
    aliases: ['biology', 'bio'],
    category: 'sciences',
    icon: 'dna'
  },
  {
    id: 'agricultural-science',
    name: 'Agricultural Science',
    aliases: ['agricultural science', 'agric', 'agricultural-science', 'agric science'],
    category: 'sciences',
    icon: 'sprout'
  },
  {
    id: 'economics',
    name: 'Economics',
    aliases: ['economics', 'econ'],
    category: 'commercial',
    icon: 'trending-up'
  },
  {
    id: 'commerce',
    name: 'Commerce',
    aliases: ['commerce', 'comm'],
    category: 'commercial',
    icon: 'shopping-bag'
  },
  {
    id: 'government',
    name: 'Government',
    aliases: ['government', 'govt'],
    category: 'arts',
    icon: 'landmark'
  },
  {
    id: 'literature-in-english',
    name: 'Literature in English',
    aliases: ['literature in english', 'literature', 'lit in eng', 'lit-in-eng', 'lit'],
    category: 'arts',
    icon: 'book-type'
  },
  {
    id: 'christian-religious-studies',
    name: 'Christian Religious Studies',
    aliases: ['christian religious studies', 'crs', 'crk', 'christian religious knowledge'],
    category: 'arts',
    icon: 'cross'
  },
  {
    id: 'islamic-religious-studies',
    name: 'Islamic Religious Studies',
    aliases: ['islamic religious studies', 'irs', 'irk', 'islamic religious knowledge'],
    category: 'arts',
    icon: 'moon'
  },
  {
    id: 'geography',
    name: 'Geography',
    aliases: ['geography', 'geo'],
    category: 'arts',
    icon: 'globe'
  },
  {
    id: 'history',
    name: 'History',
    aliases: ['history', 'hist'],
    category: 'arts',
    icon: 'scroll'
  },
  {
    id: 'principles-of-accounts',
    name: 'Principles of Accounts',
    aliases: ['principles of accounts', 'accounts', 'accounting', 'acc'],
    category: 'commercial',
    icon: 'file-spreadsheet'
  },
  {
    id: 'hausa',
    name: 'Hausa',
    aliases: ['hausa'],
    category: 'arts',
    icon: 'languages'
  },
  {
    id: 'igbo',
    name: 'Igbo',
    aliases: ['igbo'],
    category: 'arts',
    icon: 'languages'
  },
  {
    id: 'yoruba',
    name: 'Yoruba',
    aliases: ['yoruba'],
    category: 'arts',
    icon: 'languages'
  },
  {
    id: 'french',
    name: 'French',
    aliases: ['french'],
    category: 'arts',
    icon: 'languages'
  }
];

/**
 * Normalizes any variation of a subject name to its canonical JAMB name.
 * e.g., "English", "English Language", "use-of-english" -> "Use of English"
 */
export const normalizeSubjectName = (inputName: string): string => {
  if (!inputName || typeof inputName !== 'string') return 'Use of English';
  
  const clean = inputName.trim().toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
  
  for (const sub of OFFICIAL_JAMB_SUBJECTS) {
    if (sub.name.toLowerCase() === clean) return sub.name;
    if (sub.id.toLowerCase() === clean) return sub.name;
    if (sub.aliases.some(alias => alias.toLowerCase() === clean)) {
      return sub.name;
    }
  }

  // Substring fallback
  if (clean.includes('english') || clean.includes('use of eng')) return 'Use of English';
  if (clean.includes('math')) return 'Mathematics';
  if (clean.includes('physic')) return 'Physics';
  if (clean.includes('chem')) return 'Chemistry';
  if (clean.includes('bio')) return 'Biology';
  if (clean.includes('agric')) return 'Agricultural Science';
  if (clean.includes('econ')) return 'Economics';
  if (clean.includes('gov')) return 'Government';
  if (clean.includes('lit')) return 'Literature in English';
  if (clean.includes('crs') || clean.includes('christian')) return 'Christian Religious Studies';
  if (clean.includes('irs') || clean.includes('islamic')) return 'Islamic Religious Studies';
  if (clean.includes('account')) return 'Principles of Accounts';

  // Capitalize nicely if not found
  return inputName.trim();
};

/**
 * Gets all equivalent names & aliases for a subject.
 * Useful for matching questions in Supabase queries with OR or IN filters.
 */
export const getSubjectAliases = (inputName: string): string[] => {
  const canonical = normalizeSubjectName(inputName);
  const matched = OFFICIAL_JAMB_SUBJECTS.find(s => s.name === canonical);
  if (!matched) return [inputName, canonical];
  
  // Return unique list of canonical name, aliases, and id
  return Array.from(new Set([
    matched.name,
    matched.id,
    ...matched.aliases,
    matched.name.toLowerCase(),
    matched.name.toUpperCase()
  ]));
};

/**
 * Ensures all official JAMB subjects exist in the Supabase `subjects` table and are active.
 */
export const ensureAllJambSubjectsInDatabase = async (): Promise<any[]> => {
  try {
    const { data: existing, error } = await supabase.from('subjects').select('*');
    if (error) {
      console.warn('Could not query subjects table:', error);
      return [];
    }

    const existingNames = new Set((existing || []).map(s => normalizeSubjectName(s.name)));
    const missing = OFFICIAL_JAMB_SUBJECTS.filter(s => !existingNames.has(s.name));

    if (missing.length > 0) {
      const inserts = missing.map(m => ({
        name: m.name,
        icon: m.icon,
        is_active: true
      }));

      await supabase.from('subjects').upsert(inserts, { onConflict: 'name' });
      const { data: updated } = await supabase.from('subjects').select('*').order('name');
      return updated || [];
    }

    return existing || [];
  } catch (err) {
    console.warn('Error seeding missing JAMB subjects:', err);
    return [];
  }
};

/**
 * Unifies and standardizes all database subject records and questions in Supabase.
 * Maps variations like 'English', 'English Language', 'use-of-english' to canonical IDs & names.
 */
export const unifyDatabaseSubjects = async (): Promise<{ updatedCount: number; success: boolean }> => {
  try {
    // 1. Ensure all official JAMB subjects exist in `subjects` table
    await ensureAllJambSubjectsInDatabase();

    // 2. Fetch all subjects
    const { data: dbSubjects } = await supabase.from('subjects').select('*');
    if (!dbSubjects || dbSubjects.length === 0) return { updatedCount: 0, success: false };

    // Build map of canonical name -> master subject record ID
    const canonicalMap = new Map<string, string>();
    const duplicateIdsToMasterId = new Map<string, string>();

    dbSubjects.forEach(s => {
      const canonicalName = normalizeSubjectName(s.name);
      if (!canonicalMap.has(canonicalName)) {
        canonicalMap.set(canonicalName, s.id);
      } else {
        duplicateIdsToMasterId.set(s.id, canonicalMap.get(canonicalName)!);
      }
    });

    let updatedQuestions = 0;

    // 3. Update questions referencing duplicate subject IDs to master subject ID
    for (const [dupId, masterId] of duplicateIdsToMasterId.entries()) {
      const { data: remapped } = await supabase
        .from('questions')
        .update({ subject_id: masterId })
        .eq('subject_id', dupId)
        .select('id');
      
      if (remapped) updatedQuestions += remapped.length;
    }

    // 4. Update questions where `subject_id` is a string alias (e.g., 'English', 'use-of-english', 'Maths')
    for (const officialSubject of OFFICIAL_JAMB_SUBJECTS) {
      const masterId = canonicalMap.get(officialSubject.name);
      if (!masterId) continue;

      const aliasesToFix = getSubjectAliases(officialSubject.name).filter(alias => alias !== masterId);

      for (const alias of aliasesToFix) {
        const { data: fixed } = await supabase
          .from('questions')
          .update({ subject_id: masterId })
          .eq('subject_id', alias)
          .select('id');

        if (fixed) updatedQuestions += fixed.length;
      }
    }

    // 5. Update non-canonical subject names in `subjects` table to canonical names
    for (const s of dbSubjects) {
      const canonicalName = normalizeSubjectName(s.name);
      if (s.name !== canonicalName && !duplicateIdsToMasterId.has(s.id)) {
        await supabase.from('subjects').update({ name: canonicalName }).eq('id', s.id);
      }
    }

    return { updatedCount: updatedQuestions, success: true };
  } catch (err) {
    console.warn('Error during subject unification:', err);
    return { updatedCount: 0, success: false };
  }
};

/**
 * Universal question fetcher for a subject that accounts for canonical names, UUIDs, and aliases.
 */
export const fetchQuestionsForSubject = async (subjectNameOrId: string, limitCount: number = 40): Promise<any[]> => {
  const canonical = normalizeSubjectName(subjectNameOrId);
  const aliases = getSubjectAliases(canonical);

  try {
    const { data: dbSubjects } = await supabase.from('subjects').select('id, name');
    const matchedSubjectIds = (dbSubjects || [])
      .filter(s => aliases.includes(s.name.toLowerCase()) || aliases.includes(s.id.toLowerCase()) || normalizeSubjectName(s.name) === canonical)
      .map(s => s.id);

    const allFilters = Array.from(new Set([...matchedSubjectIds, canonical, ...aliases, subjectNameOrId]));

    const { data: qData } = await supabase
      .from('questions')
      .select('*, subjects(name)')
      .eq('is_active', true)
      .in('subject_id', allFilters)
      .limit(limitCount);

    if (qData && qData.length > 0) return qData;
  } catch (err) {
    console.warn('Error querying by in(subject_id):', err);
  }

  // Fallback 1: Query all active questions and filter client side
  try {
    const { data: allQ } = await supabase
      .from('questions')
      .select('*, subjects(name)')
      .eq('is_active', true)
      .limit(300);

    if (allQ && allQ.length > 0) {
      const filtered = allQ.filter(q => {
        const qSubName = q.subjects?.name || q.subject || q.subject_id;
        if (!qSubName) return false;
        return normalizeSubjectName(qSubName) === canonical || aliases.includes(qSubName.toLowerCase());
      });
      if (filtered.length > 0) return filtered.slice(0, limitCount);
    }
  } catch {}

  return [];
};

/**
 * Data Integrity Checker for CBT practice engine initialization.
 * Performs a server-side count check on the `questions` table before initializing any practice session.
 * Compares setup/local count with exact Supabase database count, forcing a real-time fetch if a discrepancy is detected.
 * Logs discrepancies for auditing.
 */
export const checkSubjectDataIntegrity = async (subjectIdOrName: string, expectedCount?: number): Promise<{
  requestedSubject: string;
  canonicalName: string;
  serverCount: number;
  availableCount: number;
  hasSufficientQuestions: boolean;
  discrepancyDetected: boolean;
  questions: any[];
}> => {
  const canonicalName = normalizeSubjectName(subjectIdOrName);
  
  // 1. Server-side count check on the `questions` table directly from Supabase
  let serverCount = 0;
  try {
    // Attempt count via matched subject IDs
    const matchedSubjectIds = await resolveSubjectIdsByNameOrAlias(subjectIdOrName);
    if (matchedSubjectIds.length > 0) {
      const { count, error } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .in('subject_id', matchedSubjectIds);
        
      if (!error && count !== null) {
        serverCount = count;
      }
    }
    
    // If serverCount is 0, query total active questions count in DB for fallback auditing
    if (serverCount === 0) {
      const { count: totalActiveCount } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      console.log(`[CBT Data Integrity Audit] Direct subject count: ${serverCount}, Total active DB questions: ${totalActiveCount || 0}`);
    }
  } catch (err) {
    console.error('[CBT Data Integrity Validator Error]', err);
  }

  // 2. Real-time fetch of active questions from Supabase
  const questions = await fetchQuestionsForSubject(subjectIdOrName, 500);
  const availableCount = questions.length;
  
  // Discrepancy check between setup count/expectation and real-time database count
  const discrepancyDetected = expectedCount !== undefined && expectedCount !== availableCount;

  console.log(`[CBT Data Integrity Check] Subject: "${subjectIdOrName}" (Canonical: "${canonicalName}") | Server Exact Count: ${serverCount} | Realtime Fetched: ${availableCount}`);

  if (discrepancyDetected) {
    console.warn(
      `[CBT DATA INTEGRITY AUDIT DISCREPANCY DETECTED] Setup Count (${expectedCount}) differs from Server DB Questions (${availableCount}) for subject "${subjectIdOrName}". Forcing real-time cache refresh from Supabase.`
    );
  }

  if (availableCount === 0) {
    console.warn(`[CBT DATA INTEGRITY AUDIT WARNING] Subject "${subjectIdOrName}" returned 0 active questions in the database!`);
  }

  return {
    requestedSubject: subjectIdOrName,
    canonicalName,
    serverCount,
    availableCount,
    hasSufficientQuestions: availableCount > 0,
    discrepancyDetected,
    questions,
  };
};
