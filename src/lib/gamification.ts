import { supabase } from './supabase';
import { toast } from 'sonner';

export const checkAndAwardBadges = async (
  userId: string,
  stats: {
    score: number;
    timeSpentSecs: number;
    totalTimeSecs: number;
    isFirstExam: boolean;
    streakDays?: number;
    totalExams?: number;
    totalFlashcards?: number;
  }
) => {
  try {
    // 1. Fetch all badge definitions
    const { data: badges } = await supabase.from('badges').select('*');
    if (!badges || badges.length === 0) return;

    // 2. Fetch user's already-earned badges
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('student_id', userId);
    const earnedBadgeIds = new Set(userBadges?.map((ub) => ub.badge_id) || []);

    // 3. Fetch extra context if not passed in
    let totalExams = stats.totalExams;
    let streakDays = stats.streakDays;

    if (totalExams === undefined) {
      const { count } = await supabase
        .from('exam_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'submitted');
      totalExams = count || 0;
    }

    if (streakDays === undefined) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('streak_days')
        .eq('id', userId)
        .single();
      streakDays = profile?.streak_days || 0;
    }

    const badgesToAward: any[] = [];

    for (const badge of badges) {
      if (earnedBadgeIds.has(badge.id)) continue;

      let qualify = false;
      switch (badge.requirement_type) {
        case 'first_exam':
          if (stats.isFirstExam || totalExams === 1) qualify = true;
          break;
        case 'flawless':
          if (stats.score === 100) qualify = true;
          break;
        case 'speed_demon':
          if (stats.score >= 70 && stats.timeSpentSecs < stats.totalTimeSecs / 2) qualify = true;
          break;
        case 'streak_7':
          if ((streakDays || 0) >= 7) qualify = true;
          break;
        case 'streak_30':
          if ((streakDays || 0) >= 30) qualify = true;
          break;
        case 'exam_10':
          if ((totalExams || 0) >= 10) qualify = true;
          break;
        case 'exam_50':
          if ((totalExams || 0) >= 50) qualify = true;
          break;
        case 'high_scorer':
          if (stats.score >= 90) qualify = true;
          break;
      }

      if (qualify) {
        badgesToAward.push(badge);
      }
    }

    // 4. Award badges and award XP
    for (const badge of badgesToAward) {
      const { error } = await supabase.from('user_badges').insert({
        student_id: userId,
        badge_id: badge.id,
      });

      if (!error) {
        // Award bonus XP for badge unlock — try RPC first, then direct update as fallback
        const { error: rpcError } = await supabase.rpc('increment_xp', { p_user_id: userId, p_amount: 50 });
        if (rpcError) {
          // Fallback: direct update
          const { data: profileData } = await supabase.from('profiles').select('xp').eq('id', userId).single();
          if (profileData) {
            await supabase.from('profiles').update({ xp: (profileData.xp || 0) + 50 }).eq('id', userId);
          }
        }

        toast.success(`Achievement Unlocked: ${badge.name}!`, {
          description: badge.description,
          duration: 6000,
          style: {
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #3b82f6',
            color: '#fff',
          },
        });
      }
    }
  } catch (err) {
    console.error('Failed to award badges', err);
  }
};

// Streak-specific badge check — called daily from streakService
export const checkStreakBadges = async (userId: string, streakDays: number) => {
  await checkAndAwardBadges(userId, {
    score: 0,
    timeSpentSecs: 0,
    totalTimeSecs: 1,
    isFirstExam: false,
    streakDays,
  });
};
