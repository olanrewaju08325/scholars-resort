import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { triggerConfetti, playSuccessChime, playLevelUpFanfare } from '@/lib/celebration';
import { awardXp, calculateLevel } from '@/lib/gamification';

export interface GamificationBadge {
  id: string;
  badge_key: string;
  name: string;
  description: string;
  icon: string;
  category: 'Milestone' | 'Mastery' | 'Speed' | 'Consistency' | 'Security';
  xp_reward: number;
  coin_reward?: number;
  trigger_type: 
    | 'test_score' 
    | 'stage_gate_passed' 
    | 'streak_days' 
    | 'diagrams_solved' 
    | 'speed_drill' 
    | 'subjects_completed'
    | 'offline_sessions';
  target_threshold: number; // e.g. 80 for 80% score, 7 for 7-day streak, 1 for stage 1 passed
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  created_at?: string;
}

export interface UserUnlockedBadge {
  badge_id: string;
  badge_key: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  unlocked_at: string;
}

export interface GamificationEvent {
  userId: string;
  eventType: 
    | 'test_score' 
    | 'stage_gate_passed' 
    | 'streak_days' 
    | 'diagrams_solved' 
    | 'speed_drill' 
    | 'subjects_completed'
    | 'offline_sessions';
  value: number; // e.g., score achieved (85), streak count (7), stage passed (1)
  subject?: string;
  topicName?: string;
  stageNumber?: number;
  metadata?: Record<string, any>;
}

// Default canonical brain badges
export const CANONICAL_SYSTEM_BADGES: GamificationBadge[] = [
  {
    id: 'badge_first_pass',
    badge_key: 'first_utme_pass',
    name: 'UTME Benchmark Achiever',
    description: 'Scored 75% or higher on an authentic JAMB practice test.',
    icon: 'Award',
    category: 'Milestone',
    xp_reward: 250,
    coin_reward: 50,
    trigger_type: 'test_score',
    target_threshold: 75,
    rarity: 'Common'
  },
  {
    id: 'badge_stage_1_conqueror',
    badge_key: 'stage_1_barrier_passed',
    name: 'Stage 1 Fortress Buster',
    description: 'Passed the Stage 1 locked milestone checkpoint test with >= 75%.',
    icon: 'Shield',
    category: 'Security',
    xp_reward: 350,
    coin_reward: 80,
    trigger_type: 'stage_gate_passed',
    target_threshold: 1,
    rarity: 'Rare'
  },
  {
    id: 'badge_stage_2_master',
    badge_key: 'stage_2_barrier_passed',
    name: 'Stage 2 Deep Thinker',
    description: 'Conquered Stage 2 locked barrier gate with deep curriculum mastery.',
    icon: 'Lock',
    category: 'Security',
    xp_reward: 500,
    coin_reward: 120,
    trigger_type: 'stage_gate_passed',
    target_threshold: 2,
    rarity: 'Epic'
  },
  {
    id: 'badge_diagram_detective',
    badge_key: 'visual_diagram_pro',
    name: 'Diagram & Apparatus Detective',
    description: 'Accurately solved 10+ questions containing visual diagrams, apparatus, or circuits.',
    icon: 'Eye',
    category: 'Mastery',
    xp_reward: 300,
    coin_reward: 60,
    trigger_type: 'diagrams_solved',
    target_threshold: 10,
    rarity: 'Rare'
  },
  {
    id: 'badge_lightning_accuracy',
    badge_key: 'lightning_drill_30s',
    name: 'Speed Tactician',
    description: 'Completed a 20-question speed drill under 35 seconds per question.',
    icon: 'Zap',
    category: 'Speed',
    xp_reward: 400,
    coin_reward: 90,
    trigger_type: 'speed_drill',
    target_threshold: 35, // average seconds <= 35
    rarity: 'Epic'
  },
  {
    id: 'badge_streak_7',
    badge_key: 'consistent_scholar_7',
    name: 'Iron Will (7-Day Streak)',
    description: 'Maintained 7 consecutive daily study sessions without breaking.',
    icon: 'Flame',
    category: 'Consistency',
    xp_reward: 450,
    coin_reward: 100,
    trigger_type: 'streak_days',
    target_threshold: 7,
    rarity: 'Rare'
  },
  {
    id: 'badge_offline_warrior',
    badge_key: 'offline_champion',
    name: 'Offline Vault Warrior',
    description: 'Completed full mock tests completely offline in low-data mode.',
    icon: 'HardDrive',
    category: 'Milestone',
    xp_reward: 350,
    coin_reward: 70,
    trigger_type: 'offline_sessions',
    target_threshold: 3,
    rarity: 'Common'
  }
];

class GamificationEngine {
  private activeBadges: GamificationBadge[] = [...CANONICAL_SYSTEM_BADGES];
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      // 1. Load custom/AI created badges from Supabase or localStorage
      const { data } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'gamification_badges_config')
        .maybeSingle();

      if (data?.setting_value && Array.isArray(data.setting_value) && data.setting_value.length > 0) {
        this.activeBadges = data.setting_value;
      } else {
        const local = localStorage.getItem('scholar_custom_badges');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.activeBadges = parsed;
          }
        }
      }
    } catch (e) {
      console.warn('[GamificationEngine] Initialization warning:', e);
    } finally {
      this.isInitialized = true;
    }
  }

  public getBadges(): GamificationBadge[] {
    return this.activeBadges;
  }

  public setBadges(badges: GamificationBadge[]): void {
    this.activeBadges = badges;
    try {
      localStorage.setItem('scholar_custom_badges', JSON.stringify(badges));
    } catch {}
  }

  /**
   * Main Engine Brain: Evaluates incoming student activity and unlocks badges if criteria are satisfied
   */
  public async evaluateEvent(event: GamificationEvent): Promise<UserUnlockedBadge[]> {
    await this.initialize();
    if (!event.userId) return [];

    const unlockedNow: UserUnlockedBadge[] = [];
    const storageKey = `user_unlocked_badges_${event.userId}`;
    let userBadgeKeys = new Set<string>();

    try {
      const localBadges = localStorage.getItem(storageKey);
      if (localBadges) {
        const parsed = JSON.parse(localBadges);
        if (Array.isArray(parsed)) {
          parsed.forEach((b: any) => userBadgeKeys.add(b.badge_key));
        }
      }
    } catch {}

    // Evaluate matching badges
    for (const badge of this.activeBadges) {
      if (userBadgeKeys.has(badge.badge_key)) {
        continue; // Already earned
      }

      let criterionMet = false;

      if (badge.trigger_type === event.eventType) {
        switch (badge.trigger_type) {
          case 'test_score':
            criterionMet = event.value >= badge.target_threshold;
            break;
          case 'stage_gate_passed':
            criterionMet = event.value >= badge.target_threshold;
            break;
          case 'streak_days':
            criterionMet = event.value >= badge.target_threshold;
            break;
          case 'diagrams_solved':
            criterionMet = event.value >= badge.target_threshold;
            break;
          case 'speed_drill':
            // For speed drills, lower seconds is better!
            criterionMet = event.value > 0 && event.value <= badge.target_threshold;
            break;
          case 'subjects_completed':
            criterionMet = event.value >= badge.target_threshold;
            break;
          case 'offline_sessions':
            criterionMet = event.value >= badge.target_threshold;
            break;
        }
      }

      if (criterionMet) {
        const unlocked: UserUnlockedBadge = {
          badge_id: badge.id,
          badge_key: badge.badge_key,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          xp_reward: badge.xp_reward,
          unlocked_at: new Date().toISOString()
        };

        unlockedNow.push(unlocked);
        userBadgeKeys.add(badge.badge_key);

        // Award XP and coins via gamification library
        await awardXp(event.userId, badge.xp_reward, `Unlocked Badge: ${badge.name}`);

        // Persist to Supabase if available
        try {
          await supabase.from('user_badges').insert({
            user_id: event.userId,
            badge_id: badge.id,
            badge_key: badge.badge_key,
            unlocked_at: new Date().toISOString()
          });
        } catch {}

        // Persist to local cache
        try {
          const currentList = JSON.parse(localStorage.getItem(storageKey) || '[]');
          currentList.push(unlocked);
          localStorage.setItem(storageKey, JSON.stringify(currentList));
        } catch {}

        // Trigger celebratory fanfare
        triggerConfetti();
        playLevelUpFanfare();
        toast.success(`🏆 Milestone Unlocked: "${badge.name}"! +${badge.xp_reward} XP awarded!`, {
          duration: 5000,
          description: badge.description
        });

        // Dispatch window event for UI listeners
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('scholar:badge-unlocked', {
            detail: { badge: unlocked, event }
          }));
        }
      }
    }

    return unlockedNow;
  }

  /**
   * Helper to fetch all unlocked badges for a user
   */
  public async getUserUnlockedBadges(userId: string): Promise<UserUnlockedBadge[]> {
    if (!userId) return [];
    const storageKey = `user_unlocked_badges_${userId}`;

    try {
      const { data } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', userId);

      if (data && data.length > 0) {
        return data.map(d => ({
          badge_id: d.badge_id || d.id,
          badge_key: d.badge_key || '',
          name: d.name || 'Scholar Achievement',
          description: d.description || 'Milestone earned through platform practice',
          icon: d.icon || 'Award',
          xp_reward: d.xp_reward || 200,
          unlocked_at: d.unlocked_at || d.created_at || new Date().toISOString()
        }));
      }
    } catch {}

    try {
      const local = localStorage.getItem(storageKey);
      if (local) return JSON.parse(local);
    } catch {}

    return [];
  }
}

export const gamificationEngine = new GamificationEngine();
