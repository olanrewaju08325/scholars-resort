import { supabase } from './supabase';
import { toast } from 'sonner';
import { triggerConfetti, playSuccessChime, playLevelUpFanfare } from './celebration';
import { enqueueOfflineWrite } from './syncQueue';

export interface LevelTier {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  icon: string;
  color: string;
  perks: string;
}

export const LEVEL_TIERS: LevelTier[] = [
  { level: 1, title: 'Novice Aspirant', minXp: 0, maxXp: 250, icon: 'GraduationCap', color: 'from-slate-500 to-slate-700', perks: 'Basic CBT practice & flashcard access' },
  { level: 2, title: 'Keen Scholar', minXp: 250, maxXp: 600, icon: 'BookOpen', color: 'from-blue-500 to-cyan-600', perks: 'Detailed speed & topic breakdown metrics' },
  { level: 3, title: 'JAMB Contender', minXp: 600, maxXp: 1200, icon: 'Swords', color: 'from-emerald-500 to-teal-600', perks: 'Custom mock exam builder & weak area drills' },
  { level: 4, title: 'Master Tactician', minXp: 1200, maxXp: 2200, icon: 'Brain', color: 'from-violet-500 to-purple-700', perks: 'AI Explanation Deep-Dive & streak shield bonuses' },
  { level: 5, title: 'UTME Champion', minXp: 2200, maxXp: 4000, icon: 'Trophy', color: 'from-amber-500 to-orange-600', perks: 'Exclusive high-yield prediction mocks & VIP badge' },
  { level: 6, title: 'Academic Elite', minXp: 4000, maxXp: 7000, icon: 'Crown', color: 'from-rose-500 to-pink-600', perks: 'Full national tournament priority leaderboard placement' },
  { level: 7, title: 'High Scholar Vanguard', minXp: 7000, maxXp: 11000, icon: 'Zap', color: 'from-cyan-500 to-blue-700', perks: 'Personalized AI study regimen & instant mentor access' },
  { level: 8, title: 'Grandmaster of JAMB', minXp: 11000, maxXp: Infinity, icon: 'Sparkles', color: 'from-amber-400 via-yellow-500 to-orange-500', perks: 'Lifetime Hall of Fame induction & Master distinction' },
];

export interface LevelInfo {
  level: number;
  title: string;
  icon: string;
  color: string;
  perks: string;
  minXp: number;
  maxXp: number;
  currentLevelXp: number;
  xpRequiredForNext: number;
  progressPercentage: number;
  nextTier: LevelTier | null;
}

/**
 * Compute the exact level metadata and progress based on user XP
 */
export function calculateLevel(xp: number): LevelInfo {
  const safeXp = Math.max(0, xp || 0);
  const tier = LEVEL_TIERS.find(t => safeXp >= t.minXp && (t.maxXp === Infinity || safeXp < t.maxXp)) || LEVEL_TIERS[0];
  const nextTierIndex = LEVEL_TIERS.findIndex(t => t.level === tier.level + 1);
  const nextTier = nextTierIndex !== -1 ? LEVEL_TIERS[nextTierIndex] : null;

  if (!nextTier) {
    return {
      ...tier,
      currentLevelXp: safeXp - tier.minXp,
      xpRequiredForNext: 0,
      progressPercentage: 100,
      nextTier: null
    };
  }

  const range = nextTier.minXp - tier.minXp;
  const currentInTier = safeXp - tier.minXp;
  const progressPercentage = Math.min(100, Math.max(0, Math.round((currentInTier / range) * 100)));

  return {
    ...tier,
    currentLevelXp: currentInTier,
    xpRequiredForNext: nextTier.minXp - safeXp,
    progressPercentage,
    nextTier
  };
}

export interface AwardXpResult {
  previousXp: number;
  newXp: number;
  previousLevel: LevelInfo;
  newLevel: LevelInfo;
  leveledUp: boolean;
  amountAwarded: number;
}

/**
 * Award XP to a student, persist to database, log transaction, check level-ups, and dispatch events.
 */
export async function awardXp(userId: string, amount: number, reason: string): Promise<AwardXpResult | null> {
  if (!userId || amount <= 0) return null;

  try {
    // 1. Fetch current profile XP
    let currentXp = 0;
    try {
      const { data: profile } = await supabase.from('profiles').select('xp').eq('id', userId).maybeSingle();
      if (profile?.xp !== undefined) {
        currentXp = Number(profile.xp) || 0;
      } else {
        const localXp = localStorage.getItem(`user_xp_${userId}`);
        if (localXp) currentXp = parseInt(localXp, 10) || 0;
      }
    } catch {
      const localXp = localStorage.getItem(`user_xp_${userId}`);
      if (localXp) currentXp = parseInt(localXp, 10) || 0;
    }

    const previousLevel = calculateLevel(currentXp);
    const newXp = currentXp + amount;
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel.level > previousLevel.level;

    // 2. Cache immediately in localStorage for real-time reactivity
    localStorage.setItem(`user_xp_${userId}`, newXp.toString());

    // 3. Update Supabase profile
    try {
      // Try RPC first for atomicity
      const { error: rpcErr } = await supabase.rpc('increment_xp', { p_user_id: userId, p_amount: amount });
      if (rpcErr) {
        // Fallback to direct update
        const { error: updateErr } = await supabase.from('profiles').update({
          xp: newXp,
          updated_at: new Date().toISOString()
        }).eq('id', userId);
        if (updateErr) throw updateErr;
      }
    } catch (dbErr) {
      console.warn('[Gamification] Enqueuing offline XP sync:', dbErr);
      await enqueueOfflineWrite({
        type: 'profile_update',
        table: 'profiles',
        action: 'update',
        payload: { id: userId, xp: newXp },
        userId,
        silent: true
      });
    }

    // 4. Safely log XP transaction (local storage fallback to prevent 404 network errors)
    try {
      const storedLogs = JSON.parse(localStorage.getItem(`jamb_xp_logs_${userId}`) || '[]');
      storedLogs.unshift({
        id: crypto.randomUUID(),
        amount,
        reason,
        created_at: new Date().toISOString()
      });
      localStorage.setItem(`jamb_xp_logs_${userId}`, JSON.stringify(storedLogs.slice(0, 50)));
    } catch {
      // Non-blocking transaction log
    }

    // 5. Broadcast global custom event for instant UI re-render
    window.dispatchEvent(new CustomEvent('user_xp_updated', {
      detail: {
        userId,
        xp: newXp,
        amount,
        reason,
        previousLevel,
        newLevel,
        leveledUp
      }
    }));

    // 6. If leveled up, trigger celebrations!
    if (leveledUp) {
      triggerConfetti();
      playLevelUpFanfare();
      
      toast.success(`LEVEL UP! Level ${newLevel.level}: ${newLevel.title}`, {
        description: `Congratulations! You unlocked: ${newLevel.perks}`,
        duration: 7000,
        style: {
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          border: '1px solid #6366f1',
          color: '#ffffff',
        }
      });

      // Check level achievement badges
      await checkLevelBadges(userId, newLevel.level);
    }

    return {
      previousXp: currentXp,
      newXp,
      previousLevel,
      newLevel,
      leveledUp,
      amountAwarded: amount
    };
  } catch (err) {
    console.error('[Gamification] Error awarding XP:', err);
    return null;
  }
}

/**
 * Award XP and Badges for completing a CBT Mock Exam session
 */
export async function awardMockExamCompletionXp(
  userId: string,
  stats: {
    score: number;
    totalQuestions: number;
    timeSpentSeconds: number;
    totalTimeSeconds?: number;
  }
): Promise<number> {
  const { score, totalQuestions, timeSpentSeconds, totalTimeSeconds = 7200 } = stats;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  // Base completion XP
  let totalAward = 150;
  const breakdown: string[] = ['+150 XP Base Mock Exam Completion'];

  // Score bonus: Up to +150 XP proportional to percentage
  const scoreBonus = Math.round((percentage / 100) * 150);
  if (scoreBonus > 0) {
    totalAward += scoreBonus;
    breakdown.push(`+${scoreBonus} XP Accuracy (${percentage}%)`);
  }

  // Perfect 100% bonus
  if (percentage === 100) {
    totalAward += 100;
    breakdown.push('+100 XP Flawless 100% Score Bonus');
  } else if (percentage >= 90) {
    totalAward += 60;
    breakdown.push('+60 XP High Scorer (90%+) Bonus');
  }

  // Speed demon bonus (>= 70% in less than 50% allotted time)
  const isSpeedDemon = percentage >= 70 && timeSpentSeconds > 0 && timeSpentSeconds <= totalTimeSeconds / 2;
  if (isSpeedDemon) {
    totalAward += 50;
    breakdown.push('+50 XP Speed Demon Bonus');
  }

  // Award the calculated XP
  await awardXp(userId, totalAward, `Completed CBT Mock Exam (${percentage}% score)`);

  // Toast celebratory feedback
  toast.success(`Exam Completed: +${totalAward} XP Earned!`, {
    description: breakdown.join(' • '),
    duration: 6000
  });

  // Evaluate and award mock exam badges
  await checkAndAwardBadges(userId, {
    score: percentage,
    timeSpentSecs: timeSpentSeconds,
    totalTimeSecs: totalTimeSeconds,
    isFirstExam: false
  });

  return totalAward;
}

/**
 * Award XP and Badges for daily study streak check-ins
 */
export async function awardDailyStreakXp(userId: string, streakDays: number): Promise<number> {
  if (!userId || streakDays <= 0) return 0;

  const baseStreakXp = 50;
  const streakMultiplierBonus = streakDays * 10;
  let totalAward = baseStreakXp + streakMultiplierBonus;
  let bonusDesc = `+50 XP Daily Study + ${streakMultiplierBonus} XP (${streakDays}-Day Streak Multiplier)`;

  // Streak milestone bonuses
  if (streakDays === 3) {
    totalAward += 100;
    bonusDesc += ' + 100 XP 3-Day Milestone!';
  } else if (streakDays === 7) {
    totalAward += 250;
    bonusDesc += ' + 250 XP 7-Day Scholar Milestone!';
  } else if (streakDays === 14) {
    totalAward += 500;
    bonusDesc += ' + 500 XP 14-Day Habit Master Milestone!';
  } else if (streakDays === 30) {
    totalAward += 1000;
    bonusDesc += ' + 1000 XP 30-Day Legend Milestone!';
  }

  await awardXp(userId, totalAward, `Daily Study Streak: Day ${streakDays}`);

  toast.success(`Streak Maintained: Day ${streakDays}!`, {
    description: `${bonusDesc} (Total: +${totalAward} XP)`,
    duration: 6000
  });

  // Check streak badges
  await checkStreakBadges(userId, streakDays);

  return totalAward;
}

/**
 * Check and award all qualifying achievement badges
 */
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
  const isUUID = (id: any) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!userId || !isUUID(userId)) return;

  try {
    // 1. Fetch user's already-earned badges (using correct student_id column)
    const userBadgesRes = await supabase.from('user_badges').select('*').eq('student_id', userId);
    const earnedBadgeIds = new Set<string>();
    
    // Also check local badges cache for resilient offline and hybrid support
    const localBadges = JSON.parse(localStorage.getItem(`scholars_earned_badges_${userId}`) || '[]');
    localBadges.forEach((k: string) => earnedBadgeIds.add(k));

    if (userBadgesRes.data) {
      userBadgesRes.data.forEach((ub: any) => {
        if (ub.badge_id) earnedBadgeIds.add(ub.badge_id);
        if (ub.badge_key) earnedBadgeIds.add(ub.badge_key);
      });
    }

    // Also fetch DB badges to map requirement_type to badge_id UUID
    let dbBadges: any[] = [];
    try {
      const { data } = await supabase.from('badges').select('id, requirement_type, name');
      if (data) {
        dbBadges = data;
        // Also map existing user_badges by matching requirement_type
        if (userBadgesRes.data) {
          userBadgesRes.data.forEach((ub: any) => {
            const found = dbBadges.find(b => b.id === ub.badge_id);
            if (found?.requirement_type) earnedBadgeIds.add(found.requirement_type);
          });
        }
      }
    } catch (e) {
      console.warn('DB badges fetch fallback:', e);
    }

    // 2. Fetch extra context if not passed in
    let totalExams = stats.totalExams;
    let streakDays = stats.streakDays;

    if (totalExams === undefined) {
      const { count } = await supabase
        .from('exam_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      totalExams = count || 1;
    }

    if (streakDays === undefined) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('streak_days')
        .eq('id', userId)
        .maybeSingle();
      streakDays = profile?.streak_days || 0;
    }

    // Standard badge definitions
    const BADGES_CATALOG: Array<{ key: string; name: string; description: string; icon: string; xp_threshold?: number; score_threshold?: number; streak_threshold?: number; exams_threshold?: number }> = [
      { key: 'first_exam', name: 'First Steps', description: 'Completed your first CBT Mock Exam', icon: 'Trophy' },
      { key: 'score_80', name: 'High Achiever', description: 'Scored 80% or higher on a CBT simulation', icon: 'Star', score_threshold: 80 },
      { key: 'high_scorer', name: 'Score Elite (90%+)', description: 'Scored 90% or above on a CBT exam', icon: 'Star', score_threshold: 90 },
      { key: 'flawless', name: 'Flawless 100%', description: 'Achieved a perfect 100% score on an exam', icon: 'Star', score_threshold: 100 },
      { key: 'speed_demon', name: 'Speed Demon', description: 'Finished with >= 70% in under half the allotted time', icon: 'Zap' },
      { key: 'exam_10', name: 'Tenacious Ten', description: 'Completed 10 full CBT Mock Exams', icon: 'Trophy', exams_threshold: 10 },
      { key: 'exam_50', name: 'Centurion Prep', description: 'Completed 50 CBT Mock Exams', icon: 'Trophy', exams_threshold: 50 },
      { key: 'streak_3', name: 'Ignited Spark', description: 'Maintained a 3-day active study streak', icon: 'Flame', streak_threshold: 3 },
      { key: 'streak_7', name: '7-Day Scholar', description: 'Maintained a 7-day active study streak', icon: 'Flame', streak_threshold: 7 },
      { key: 'streak_14', name: 'Unstoppable Habit', description: 'Maintained a 14-day study marathon', icon: 'Flame', streak_threshold: 14 },
      { key: 'streak_30', name: 'Monthly Legend', description: 'Maintained an unbroken 30-day streak', icon: 'Flame', streak_threshold: 30 },
    ];

    // Load custom admin-configured badges dynamically from admin_settings
    try {
      const { data: adminBadgesData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'gamification_badges_config')
        .maybeSingle();

      const customBadges = (adminBadgesData?.setting_value && Array.isArray(adminBadgesData.setting_value))
        ? adminBadgesData.setting_value
        : JSON.parse(localStorage.getItem('scholar_custom_badges') || '[]');

      if (Array.isArray(customBadges)) {
        customBadges.forEach((cb: any) => {
          const key = cb.badge_key || cb.key || cb.id;
          if (key && !BADGES_CATALOG.some(b => b.key === key)) {
            BADGES_CATALOG.push({
              key,
              name: cb.name || 'Custom Achievement',
              description: cb.description || 'Special milestone badge earned',
              icon: cb.icon || 'Award',
              xp_threshold: Number(cb.xp_threshold) || 0,
              score_threshold: Number(cb.score_threshold || cb.required_score) || 0,
              streak_threshold: Number(cb.streak_threshold) || 0,
              exams_threshold: Number(cb.exams_threshold) || 0
            });
          }
        });
      }
    } catch (e) {
      console.warn('Custom admin badges fetch notice:', e);
    }

    const badgesToAward: typeof BADGES_CATALOG = [];

    for (const badge of BADGES_CATALOG) {
      if (earnedBadgeIds.has(badge.key)) continue;

      let qualify = false;
      switch (badge.key) {
        case 'first_exam':
          if (stats.isFirstExam || (totalExams || 0) >= 1) qualify = true;
          break;
        case 'score_80':
          if (stats.score >= 80) qualify = true;
          break;
        case 'high_scorer':
          if (stats.score >= 90) qualify = true;
          break;
        case 'flawless':
          if (stats.score === 100) qualify = true;
          break;
        case 'speed_demon':
          if (stats.score >= 70 && stats.timeSpentSecs > 0 && stats.timeSpentSecs <= stats.totalTimeSecs / 2) qualify = true;
          break;
        case 'exam_10':
          if ((totalExams || 0) >= 10) qualify = true;
          break;
        case 'exam_50':
          if ((totalExams || 0) >= 50) qualify = true;
          break;
        case 'streak_3':
          if ((streakDays || 0) >= 3) qualify = true;
          break;
        case 'streak_7':
          if ((streakDays || 0) >= 7) qualify = true;
          break;
        case 'streak_14':
          if ((streakDays || 0) >= 14) qualify = true;
          break;
        case 'streak_30':
          if ((streakDays || 0) >= 30) qualify = true;
          break;
        default:
          // Dynamic evaluation for Admin-created custom badges
          if (badge.score_threshold && badge.score_threshold > 0 && stats.score >= badge.score_threshold) {
            qualify = true;
          } else if (badge.streak_threshold && badge.streak_threshold > 0 && (streakDays || 0) >= badge.streak_threshold) {
            qualify = true;
          } else if (badge.exams_threshold && badge.exams_threshold > 0 && (totalExams || 0) >= badge.exams_threshold) {
            qualify = true;
          } else if (badge.xp_threshold && badge.xp_threshold > 0 && stats.score >= 70) {
            qualify = true;
          }
          break;
      }

      if (qualify) {
        badgesToAward.push(badge);
      }
    }

    // Award badges, grant +100 XP each, and play celebration
    const successfullyAwarded: typeof BADGES_CATALOG = [];
    for (const badge of badgesToAward) {
      if (earnedBadgeIds.has(badge.key)) continue;
      earnedBadgeIds.add(badge.key);

      // Map to DB badge UUID if exists
      const dbMatch = dbBadges.find(b => b.requirement_type === badge.key);
      const badgeIdToInsert = dbMatch?.id || (isUUID(badge.key) ? badge.key : null);

      // Insert to user_badges with correct schema columns
      if (badgeIdToInsert) {
        try {
          await supabase.from('user_badges').insert({ 
            student_id: userId, 
            badge_id: badgeIdToInsert,
            earned_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('[Gamification] Badge insertion notice:', err);
        }
      }

      // Always save locally so student never loses earned badges
      try {
        const currentSaved = JSON.parse(localStorage.getItem(`scholars_earned_badges_${userId}`) || '[]');
        if (!currentSaved.includes(badge.key)) {
          currentSaved.push(badge.key);
          localStorage.setItem(`scholars_earned_badges_${userId}`, JSON.stringify(currentSaved));
        }
      } catch {
        // Safe local write
      }

      successfullyAwarded.push(badge);

      // Bonus XP for unlocking badge (+100 XP)
      await awardXp(userId, 100, `Achievement Unlocked: ${badge.name}`);
      triggerConfetti();
      playSuccessChime();

      toast.success(`Achievement Unlocked: ${badge.name}!`, {
        description: `${badge.description} (+100 Bonus XP)`,
        duration: 6000,
        style: {
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid #3b82f6',
          color: '#fff',
        },
      });
    }

    return successfullyAwarded;
  } catch (err) {
    console.error('Failed to award badges:', err);
    return [];
  }
};

/**
 * Streak-specific badge check — called daily from streakService
 */
export const checkStreakBadges = async (userId: string, streakDays: number) => {
  await checkAndAwardBadges(userId, {
    score: 0,
    timeSpentSecs: 0,
    totalTimeSecs: 1,
    isFirstExam: false,
    streakDays,
  });
};

/**
 * Level milestones badge check
 */
export const checkLevelBadges = async (userId: string, level: number) => {
  if (level >= 2) {
    await checkAndAwardBadges(userId, {
      score: 0,
      timeSpentSecs: 0,
      totalTimeSecs: 1,
      isFirstExam: false
    });
  }
};
