import { supabase } from './supabase';
import { awardDailyStreakXp, checkStreakBadges } from './gamification';

export const recordStudyAction = async (userId: string, actionType: 'exam' | 'practice' | 'library') => {
  try {
    // 1. Log the action
    await supabase.from('study_logs').insert({
      user_id: userId,
      action_type: actionType
    });

    // 2. Fetch current profile stats
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_days, streak_freezes, last_study_date, longest_streak')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return;

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

    // 3. Update profile
    await supabase.from('profiles').update({
      streak_days: newStreak,
      streak_freezes: newFreezes,
      last_study_date: today,
      longest_streak: newLongest
    }).eq('id', userId);

    // 4. Award Daily Streak XP and badges
    await awardDailyStreakXp(userId, newStreak);

  } catch (err) {
    console.error("Error updating streak:", err);
  }
};
