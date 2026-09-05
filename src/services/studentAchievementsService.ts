import { supabase } from '@/lib/supabase';
import { awardXp } from '@/lib/gamification';
import { triggerConfetti, playSuccessChime } from '@/lib/celebration';
import { toast } from 'sonner';

export interface AchievementBadge {
  key: string;
  title: string;
  description: string;
  category: 'streak' | 'mastery' | 'exam' | 'speed' | 'special';
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress: { current: number; total: number };
  xpReward: number;
}

export const ACHIEVEMENTS_CATALOG = [
  {
    key: 'streak_master_7',
    title: 'Streak Master (7 Days)',
    description: 'Maintained an unbroken 7-day study streak',
    category: 'streak' as const,
    icon: 'Flame',
    requirement: 7,
    xpReward: 200
  },
  {
    key: 'streak_master_30',
    title: 'Streak Legend (30 Days)',
    description: 'Achieved a monumental 30-day continuous study habit',
    category: 'streak' as const,
    icon: 'Flame',
    requirement: 30,
    xpReward: 500
  },
  {
    key: 'topic_expert_physics',
    title: 'Topic Expert (Physics)',
    description: 'Achieved 85%+ accuracy on 15+ Physics questions',
    category: 'mastery' as const,
    icon: 'BrainCircuit',
    requirement: 15,
    xpReward: 250
  },
  {
    key: 'topic_expert_math',
    title: 'Topic Expert (Math)',
    description: 'Achieved 85%+ accuracy on 15+ Mathematics questions',
    category: 'mastery' as const,
    icon: 'Target',
    requirement: 15,
    xpReward: 250
  },
  {
    key: 'topic_expert_english',
    title: 'Topic Expert (English)',
    description: 'Achieved 85%+ accuracy on 15+ Use of English questions',
    category: 'mastery' as const,
    icon: 'BookOpen',
    requirement: 15,
    xpReward: 250
  },
  {
    key: 'exam_champion_10',
    title: 'Exam Champion',
    description: 'Completed 10 full UTME Mock Exam simulations',
    category: 'exam' as const,
    icon: 'Trophy',
    requirement: 10,
    xpReward: 300
  },
  {
    key: 'flawless_100',
    title: 'Flawless 100%',
    description: 'Achieved a perfect 100% score in a practice or mock test',
    category: 'special' as const,
    icon: 'Star',
    requirement: 1,
    xpReward: 350
  },
  {
    key: 'speed_demon',
    title: 'Speed Demon',
    description: 'Completed 20 questions in under 10 minutes with >= 75% accuracy',
    category: 'speed' as const,
    icon: 'Zap',
    requirement: 1,
    xpReward: 200
  },
  {
    key: 'early_bird',
    title: 'Early Bird Scholar',
    description: 'Completed a practice session between 4:00 AM and 8:00 AM',
    category: 'special' as const,
    icon: 'Sunrise',
    requirement: 1,
    xpReward: 150
  },
  {
    key: 'night_owl',
    title: 'Night Owl Master',
    description: 'Completed a practice session after 9:00 PM',
    category: 'special' as const,
    icon: 'Moon',
    requirement: 1,
    xpReward: 150
  }
];

/**
 * Evaluates student progress against milestone requirements and awards missing badges
 */
export async function evaluateStudentAchievements(userId: string): Promise<AchievementBadge[]> {
  if (!userId) {
    return ACHIEVEMENTS_CATALOG.map(def => ({
      ...def,
      unlocked: false,
      progress: { current: 0, total: def.requirement }
    }));
  }

  try {
    // 1. Fetch user unlocked achievements from Supabase user_badges (using valid student_id column)
    const { safeSupabaseQuery } = await import('@/lib/safeSupabase');
    const userAchRes = await safeSupabaseQuery<any[]>(
      supabase.from('user_badges').select('badge_id, earned_at').eq('student_id', userId),
      { contextName: 'StudentAchievementsService.user_badges', fallbackValue: [] }
    );
    const userAchievements = userAchRes.data || [];
    const localEarned = JSON.parse(localStorage.getItem(`scholars_earned_badges_${userId}`) || '[]');
    const isFirstInitialization = userAchievements.length === 0 && localEarned.length === 0 && !localStorage.getItem(`scholars_achievements_init_${userId}`);

    // Map DB badge requirement_types to keys
    let dbBadges: any[] = [];
    try {
      const { data } = await supabase.from('badges').select('id, requirement_type');
      if (data) dbBadges = data;
    } catch {
      // safe fallback
    }

    const unlockedMap = new Map<string, string>();
    localEarned.forEach((k: string) => unlockedMap.set(k, new Date().toISOString()));

    (userAchievements || []).forEach((ach: any) => {
      if (ach.badge_id) unlockedMap.set(ach.badge_id, ach.earned_at || new Date().toISOString());
      const matched = dbBadges.find(b => b.id === ach.badge_id);
      if (matched?.requirement_type) unlockedMap.set(matched.requirement_type, ach.earned_at || new Date().toISOString());
    });

    // 2. Fetch profile data (streak days)
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_days')
      .eq('id', userId)
      .maybeSingle();

    const streakDays = profile?.streak_days || 0;

    // 3. Fetch completed exam sessions count & metrics safely
    const examSessRes = await safeSupabaseQuery<any[]>(
      supabase.from('exam_sessions').select('id, score, total_questions, started_at, status').eq('user_id', userId).eq('status', 'completed'),
      { contextName: 'StudentAchievementsService.exam_sessions', fallbackValue: [] }
    );
    const examSessions = examSessRes.data || [];

    const totalExamsCompleted = examSessions?.length || 0;

    const hasFlawless = (examSessions || []).some(s => {
      const pct = s.total_questions ? (s.score / s.total_questions) * 100 : s.score;
      return pct >= 100;
    });

    // Check time-of-day sessions
    const hasEarlyBird = (examSessions || []).some(s => {
      const h = new Date(s.started_at || s.submitted_at || Date.now()).getHours();
      return h >= 4 && h < 8;
    });

    const hasNightOwl = (examSessions || []).some(s => {
      const h = new Date(s.started_at || s.submitted_at || Date.now()).getHours();
      return h >= 21 || h < 4;
    });

    // 4. Fetch subject performance count from session_answers
    const { data: answers } = await supabase
      .from('session_answers')
      .select('question_id, is_correct')
      .eq('user_id', userId)
      .limit(300);

    let physicsCorrect = 0;
    let mathCorrect = 0;
    let englishCorrect = 0;

    if (answers && answers.length > 0) {
      const qIds = Array.from(new Set(answers.map(a => a.question_id).filter(Boolean)));
      if (qIds.length > 0) {
        const { data: questions } = await supabase
          .from('questions')
          .select('id, subjects(name)')
          .in('id', qIds.slice(0, 100));

        const qSubjMap: Record<string, string> = {};
        (questions || []).forEach((q: any) => {
          qSubjMap[q.id] = q.subjects?.name || '';
        });

        answers.forEach(a => {
          if (!a.is_correct) return;
          const subj = qSubjMap[a.question_id];
          if (subj?.includes('Physics')) physicsCorrect++;
          else if (subj?.includes('Math')) mathCorrect++;
          else if (subj?.includes('English') || subj?.includes('Use of English')) englishCorrect++;
        });
      }
    }

    // Evaluate each achievement
    const newlyUnlockedKeys: string[] = [];
    const resultList: AchievementBadge[] = [];

    for (const def of ACHIEVEMENTS_CATALOG) {
      const isAlreadyUnlocked = unlockedMap.has(def.key);
      let currentProgress = 0;

      switch (def.key) {
        case 'streak_master_7':
          currentProgress = streakDays;
          break;
        case 'streak_master_30':
          currentProgress = streakDays;
          break;
        case 'topic_expert_physics':
          currentProgress = physicsCorrect;
          break;
        case 'topic_expert_math':
          currentProgress = mathCorrect;
          break;
        case 'topic_expert_english':
          currentProgress = englishCorrect;
          break;
        case 'exam_champion_10':
          currentProgress = totalExamsCompleted;
          break;
        case 'flawless_100':
          currentProgress = hasFlawless ? 1 : 0;
          break;
        case 'speed_demon':
          currentProgress = totalExamsCompleted >= 2 ? 1 : 0;
          break;
        case 'early_bird':
          currentProgress = hasEarlyBird ? 1 : 0;
          break;
        case 'night_owl':
          currentProgress = hasNightOwl ? 1 : 0;
          break;
      }

      const shouldUnlock = !isAlreadyUnlocked && currentProgress >= def.requirement;

      if (shouldUnlock) {
        newlyUnlockedKeys.push(def.key);
        unlockedMap.set(def.key, new Date().toISOString());
      }

      const isUnlocked = unlockedMap.has(def.key);

      resultList.push({
        key: def.key,
        title: def.title,
        description: def.description,
        category: def.category,
        icon: def.icon,
        unlocked: isUnlocked,
        unlockedAt: unlockedMap.get(def.key),
        progress: {
          current: Math.min(currentProgress, def.requirement),
          total: def.requirement
        },
        xpReward: def.xpReward
      });
    }

    // Persist newly unlocked achievements to Supabase & award XP
    if (newlyUnlockedKeys.length > 0) {
      if (isFirstInitialization) {
        localStorage.setItem(`scholars_achievements_init_${userId}`, 'true');
      }

      for (const key of newlyUnlockedKeys) {
        const badgeDef = ACHIEVEMENTS_CATALOG.find(b => b.key === key);
        if (badgeDef) {
          // Save locally
          try {
            const currentSaved = JSON.parse(localStorage.getItem(`scholars_earned_badges_${userId}`) || '[]');
            if (!currentSaved.includes(badgeDef.key)) {
              currentSaved.push(badgeDef.key);
              localStorage.setItem(`scholars_earned_badges_${userId}`, JSON.stringify(currentSaved));
            }
          } catch {
            // safe local fallback
          }

          // Save to Supabase user_badges if matching DB badge exists
          try {
            const dbMatch = dbBadges.find(b => b.requirement_type === badgeDef.key);
            if (dbMatch?.id) {
              await supabase.from('user_badges').insert({
                student_id: userId,
                badge_id: dbMatch.id,
                earned_at: new Date().toISOString()
              });
            }
          } catch (e) {
            console.warn('Achievement insert notice:', e);
          }

          if (!isFirstInitialization) {
            // Award XP bonus only for newly earned achievements after initialization
            await awardXp(userId, badgeDef.xpReward, `Unlocked Badge: ${badgeDef.title}`);
            triggerConfetti();
            playSuccessChime();

            toast.success(`🏆 Achievement Unlocked: ${badgeDef.title}!`, {
              description: `${badgeDef.description} (+${badgeDef.xpReward} XP)`,
              duration: 6000
            });
          }
        }
      }
    } else if (isFirstInitialization) {
      localStorage.setItem(`scholars_achievements_init_${userId}`, 'true');
    }

    return resultList;
  } catch (err) {
    console.error('[StudentAchievements] Error evaluating achievements:', err);
    return ACHIEVEMENTS_CATALOG.map(def => ({
      ...def,
      unlocked: false,
      progress: { current: 0, total: def.requirement }
    }));
  }
}
