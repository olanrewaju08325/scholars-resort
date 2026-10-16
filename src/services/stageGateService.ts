import { supabase } from '@/lib/supabase';
import { gamificationEngine } from './gamificationEngineService';

export interface StageGate {
  stageNumber: number;
  title: string;
  description: string;
  requiredScorePercent: number;
  questionCount: number;
  timeLimitMinutes: number;
  curriculumScope: string;
  isLockedByDefault: boolean;
  prerequisiteStage: number | null; // e.g. Stage 2 requires Stage 1 to be passed
}

export interface UserStageStatus {
  stageNumber: number;
  isUnlocked: boolean;
  isPassed: boolean;
  highestScore: number;
  lastAttemptAt?: string;
}

export const CANONICAL_STAGE_GATES: StageGate[] = [
  {
    stageNumber: 1,
    title: 'Stage 1: Foundational Taxonomy & Core Axioms',
    description: 'Master the fundamental definitions, laws, units, and basic formulas across your selected UTME subject.',
    requiredScorePercent: 70,
    questionCount: 15,
    timeLimitMinutes: 15,
    curriculumScope: 'Topics 1 - 4: Core Fundamentals',
    isLockedByDefault: false,
    prerequisiteStage: null
  },
  {
    stageNumber: 2,
    title: 'Stage 2: Conceptual Logic & Diagram Analysis',
    description: 'Solve visual questions, schematic circuits, apparatus interpretations, and multi-step problems.',
    requiredScorePercent: 75,
    questionCount: 20,
    timeLimitMinutes: 20,
    curriculumScope: 'Topics 5 - 10: Intermediate Analysis & Visuals',
    isLockedByDefault: true,
    prerequisiteStage: 1
  },
  {
    stageNumber: 3,
    title: 'Stage 3: High-Yield Past Exam Synthesis',
    description: 'Tackle the most frequently repeated tricky UTME past paper patterns, exceptions, and calculations.',
    requiredScorePercent: 80,
    questionCount: 25,
    timeLimitMinutes: 25,
    curriculumScope: 'Topics 11 - 18: Advanced High-Yield Synthesis',
    isLockedByDefault: true,
    prerequisiteStage: 2
  },
  {
    stageNumber: 4,
    title: 'Stage 4: Grand UTME Speed & Precision Gate',
    description: 'The ultimate barrier: simulate high-pressure UTME exam conditions with rapid recall under 40s per question.',
    requiredScorePercent: 85,
    questionCount: 30,
    timeLimitMinutes: 30,
    curriculumScope: 'Complete Syllabus Comprehensive Integration',
    isLockedByDefault: true,
    prerequisiteStage: 3
  }
];

class StageGateService {
  private getStorageKey(userId: string, subject: string): string {
    const cleanSub = subject.trim().toLowerCase().replace(/\s+/g, '_');
    return `stage_gate_progress_${userId}_${cleanSub}`;
  }

  public async getStudentStageProgress(userId: string, subject: string): Promise<Record<number, UserStageStatus>> {
    const key = this.getStorageKey(userId, subject);
    let result: Record<number, UserStageStatus> = {
      1: { stageNumber: 1, isUnlocked: true, isPassed: false, highestScore: 0 },
      2: { stageNumber: 2, isUnlocked: false, isPassed: false, highestScore: 0 },
      3: { stageNumber: 3, isUnlocked: false, isPassed: false, highestScore: 0 },
      4: { stageNumber: 4, isUnlocked: false, isPassed: false, highestScore: 0 }
    };

    // 1. Try local cache
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        result = { ...result, ...parsed };
      }
    } catch {}

    // 2. Try Supabase
    try {
      const { data } = await supabase
        .from('user_stage_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('subject', subject);

      if (data && data.length > 0) {
        data.forEach((row: any) => {
          result[row.stage_number] = {
            stageNumber: row.stage_number,
            isUnlocked: Boolean(row.is_unlocked),
            isPassed: Boolean(row.is_passed),
            highestScore: Number(row.highest_score) || 0,
            lastAttemptAt: row.updated_at
          };
        });
      }
    } catch {}

    // Ensure Stage 1 is always unlocked for starters
    result[1].isUnlocked = true;

    // Validate unlocked states sequentially based on prerequisite passing
    for (let i = 2; i <= 4; i++) {
      const prevStage = result[i - 1];
      if (prevStage && prevStage.isPassed) {
        result[i].isUnlocked = true;
      }
    }

    return result;
  }

  /**
   * Records student attempt at a stage checkpoint test.
   * If score >= requiredScorePercent, unlocks the next stage and triggers the Gamification Engine!
   */
  public async recordStageAttempt(
    userId: string,
    subject: string,
    stageNumber: number,
    scorePercent: number
  ): Promise<{ passed: boolean; unlockedNextStage: boolean; newBadges: any[] }> {
    const gate = CANONICAL_STAGE_GATES.find(g => g.stageNumber === stageNumber);
    const requiredScore = gate?.requiredScorePercent || 70;
    const isPassed = scorePercent >= requiredScore;

    const currentProgress = await this.getStudentStageProgress(userId, subject);
    const prevBest = currentProgress[stageNumber]?.highestScore || 0;
    const highestScore = Math.max(prevBest, scorePercent);

    currentProgress[stageNumber] = {
      stageNumber,
      isUnlocked: true,
      isPassed: isPassed || currentProgress[stageNumber]?.isPassed,
      highestScore,
      lastAttemptAt: new Date().toISOString()
    };

    let unlockedNextStage = false;
    if (isPassed && stageNumber < 4) {
      currentProgress[stageNumber + 1].isUnlocked = true;
      unlockedNextStage = true;
    }

    // Persist to local cache
    const key = this.getStorageKey(userId, subject);
    try {
      localStorage.setItem(key, JSON.stringify(currentProgress));
    } catch {}

    // Persist to Supabase
    try {
      await supabase.from('user_stage_progress').upsert({
        user_id: userId,
        subject,
        stage_number: stageNumber,
        is_unlocked: true,
        is_passed: isPassed,
        highest_score: highestScore,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,subject,stage_number' });

      if (unlockedNextStage) {
        await supabase.from('user_stage_progress').upsert({
          user_id: userId,
          subject,
          stage_number: stageNumber + 1,
          is_unlocked: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,subject,stage_number' });
      }
    } catch {}

    // Evaluate Gamification Engine:
    let newBadges: any[] = [];
    if (isPassed) {
      newBadges = await gamificationEngine.evaluateEvent({
        userId,
        eventType: 'stage_gate_passed',
        value: stageNumber,
        subject,
        metadata: { scorePercent, stageNumber }
      });
    }

    return {
      passed: isPassed,
      unlockedNextStage,
      newBadges
    };
  }
}

export const stageGateService = new StageGateService();
