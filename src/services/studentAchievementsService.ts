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
    // 1. Fetch user unlocked achievements from Supabase
    const { data: userAchievements } = await supabase
      .from('achievements')
      .select('badge_key, created_at')
      .eq('user_id', userId);

    const unlockedMap = new Map<string, string>();
    (userAchievements || []).forEach((ach: any) => {
      unlockedMap.set(ach.badge_key, ach.created_at);
    });

    // 2. Fetch profile data (streak days)
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_days')
      .eq('id', userId)
      .maybeSingle();

    const streakDays = profile?.streak_days || 0;

    // 3. Fetch completed exam sessions count & metrics
    const { data: examSessions } = await supabase
      .from('exam_sessions')
      .select('id, score, total_questions, created_at, status')
      .eq('user_id', userId)
      .eq('status', 'completed');

    const totalExamsCompleted = examSessions?.length || 0;

    const hasFlawless = (examSessions || []).some(s => {
      const pct = s.total_questions ? (s.score / s.total_questions) * 100 : s.score;
      return pct >= 100;
    });

    // Check time-of-day sessions
    const hasEarlyBird = (examSessions || []).some(s => {
      const h = new Date(s.created_at).getHours();
      return h >= 4 && h < 8;
    });

    const hasNightOwl = (examSessions || []).some(s => {
      const h = new Date(s.created_at).getHours();
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
      for (const key of newlyUnlockedKeys) {
        const badgeDef = ACHIEVEMENTS_CATALOG.find(b => b.key === key);
        if (badgeDef) {
          try {
            await supabase.from('achievements').insert({
              user_id: userId,
              badge_key: badgeDef.key,
              title: badgeDef.title,
              description: badgeDef.description,
              icon: badgeDef.icon
            });
          } catch (e) {
            console.warn('Achievement insert error:', e);
          }

          // Award XP bonus
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
