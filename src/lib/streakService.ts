import { supabase } from './supabase';
import { awardDailyStreakXp, checkStreakBadges } from './gamification';

export const recordStudyAction = async (
  userId: string, 
  actionType: 'exam' | 'practice' | 'library',
  subjectNameOrId?: string
) => {
  try {
    // 1. Fetch current profile stats & user selected UTME subjects
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_days, streak_freezes, last_study_date, longest_streak, utme_subjects')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return;

    // 2. Validate context-aware subject match if subject is provided & user has registered UTME subjects
    const userSubjects: string[] = Array.isArray(profile.utme_subjects) ? profile.utme_subjects : [];
    if (subjectNameOrId && userSubjects.length > 0) {
      const normalizedSubject = subjectNameOrId.trim().toLowerCase();
      const isRelevant = userSubjects.some(s => 
        s.toLowerCase().includes(normalizedSubject) || normalizedSubject.includes(s.toLowerCase())
      );
      // If student is practicing a subject NOT in their UTME curriculum, log study but do not update primary UTME streak
      if (!isRelevant) {
        try {
          await supabase.from('study_logs').insert({
            user_id: userId,
            action_type: actionType,
            subject_context: subjectNameOrId,
            is_utme_curriculum: false
          });
        } catch {}
        return;
      }
    }

    // 3. Log the context-aware action safely
    try {
      await supabase.from('study_logs').insert({
        user_id: userId,
        action_type: actionType,
        subject_context: subjectNameOrId || 'UTME Core',
        is_utme_curriculum: true
      });
    } catch {}

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // If already studied today, do nothing to streaks
    if (profile.last_study_date === today) return;

    let newStreak = profile.streak_days || 0;
    let newFreezes = profile.streak_freezes || 0;

    if (!profile.last_study_date) {
      // First time studying
      newStreak = 1;
    } else {
      const lastDate = new Date(profile.last_study_date);
      const currentDate = new Date(today);
      const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

      if (diffDays === 1) {
        // Consecutive day
        newStreak += 1;
      } else if (diffDays > 1) {
        // Missed day(s) - check for freezes
        const missedDays = diffDays - 1;
        if (newFreezes >= missedDays) {
          // Consume freezes
          newFreezes -= missedDays;
          newStreak += 1; // Count today
        } else {
          // Streak broken
          newFreezes = 0;
          newStreak = 1;
        }
      }
    }

    // Award a freeze for every 7 consecutive days (max 3)
    if (newStreak > 0 && newStreak % 7 === 0 && newFreezes < 3) {
      newFreezes += 1;
    }

    const newLongest = Math.max(newStreak, profile.longest_streak || 0);

    // 4. Update profile
    await supabase.from('profiles').update({
      streak_days: newStreak,
      streak_freezes: newFreezes,
      last_study_date: today,
      longest_streak: newLongest
    }).eq('id', userId);

    // 5. Award Daily Streak XP and badges
    await awardDailyStreakXp(userId, newStreak);

  } catch (err) {
    console.error("Error updating streak:", err);
  }
};

