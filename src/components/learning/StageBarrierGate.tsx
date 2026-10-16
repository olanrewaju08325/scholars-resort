import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lock, Unlock, ShieldCheck, CheckCircle2, AlertCircle, PlayCircle, 
  Award, Sparkles, ChevronRight, Zap, Target, BookOpen, Clock 
} from 'lucide-react';
import { 
  CANONICAL_STAGE_GATES, 
  stageGateService, 
  type StageGate, 
  type UserStageStatus 
} from '@/services/stageGateService';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface StageBarrierGateProps {
  subject: string;
  onSelectCheckpointTest?: (stage: StageGate) => void;
}

export const StageBarrierGate: React.FC<StageBarrierGateProps> = ({ 
  subject, 
  onSelectCheckpointTest 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<Record<number, UserStageStatus>>({});
  const [loading, setLoading] = useState(true);

  const loadProgress = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await stageGateService.getStudentStageProgress(user.id, subject);
      setProgress(data);
    } catch (e) {
      console.warn('Error loading stage progress:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [user?.id, subject]);

  const handleLaunchTest = (gate: StageGate, isUnlocked: boolean) => {
    if (!isUnlocked) {
      toast.error(`Stage ${gate.stageNumber} is locked! You must first pass the Stage ${gate.stageNumber - 1} Checkpoint Test with >= ${CANONICAL_STAGE_GATES[gate.stageNumber - 2].requiredScorePercent}%.`);
      return;
    }

    if (onSelectCheckpointTest) {
      onSelectCheckpointTest(gate);
    } else {
      // Navigate to practice with checkpoint parameters
      navigate(`/practice?subject=${encodeURIComponent(subject)}&mode=checkpoint&stage=${gate.stageNumber}&count=${gate.questionCount}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-lg font-bold font-display flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Milestone Security Barrier Gates ({subject})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Strict progression locks: Students must pass each stage's milestone test (≥ 70–85%) before unlocking subsequent curriculum stages and achievements.
          </p>
        </div>
        <Badge variant="outline" className="self-start sm:self-auto border-primary/30 text-primary bg-primary/5 text-xs py-1">
          <Target className="w-3.5 h-3.5 mr-1" /> Progression Locked
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CANONICAL_STAGE_GATES.map((gate) => {
          const status = progress[gate.stageNumber] || {
            stageNumber: gate.stageNumber,
            isUnlocked: gate.stageNumber === 1,
            isPassed: false,
            highestScore: 0
          };

          const isUnlocked = status.isUnlocked;
          const isPassed = status.isPassed;

          return (
            <Card 
              key={gate.stageNumber}
              className={`transition-all border ${
                isPassed 
                  ? 'bg-emerald-500/5 border-emerald-500/30' 
                  : isUnlocked 
                    ? 'bg-card border-primary/30 hover:border-primary/60 shadow-sm' 
                    : 'bg-muted/40 border-border opacity-75'
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      isPassed 
                        ? 'bg-emerald-500 text-white' 
                        : isUnlocked 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                      {gate.stageNumber}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                        {gate.title.split(':')[1]?.trim() || gate.title}
                        {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />}
                      </CardTitle>
                      <CardDescription className="text-[11px] line-clamp-1">
                        {gate.curriculumScope}
                      </CardDescription>
                    </div>
                  </div>

                  {isPassed ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                      PASSED ({status.highestScore}%)
                    </Badge>
                  ) : isUnlocked ? (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5 text-[10px]">
                      READY TO TEST
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground text-[10px] gap-1">
                      <Lock className="w-2.5 h-2.5" /> LOCKED
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-1 text-xs">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {gate.description}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground bg-muted/50 p-2 rounded-lg">
                  <span className="flex items-center gap-1 font-medium">
                    <Target className="w-3 h-3 text-primary" /> Pass Mark: {gate.requiredScorePercent}%
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {gate.questionCount} Questions
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {gate.timeLimitMinutes} Mins
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <div className="text-[11px]">
                    {isPassed ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" /> Stage Cleared (Score: {status.highestScore}%)
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Must score ≥ {gate.requiredScorePercent}% to unlock Stage {gate.stageNumber + 1}
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Pass Stage {gate.prerequisiteStage} Checkpoint first
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isPassed ? 'outline' : isUnlocked ? 'default' : 'secondary'}
                    disabled={!isUnlocked}
                    onClick={() => handleLaunchTest(gate, isUnlocked)}
                    className="h-8 text-xs font-bold gap-1.5"
                  >
                    {isPassed ? (
                      <>
                        <PlayCircle className="w-3.5 h-3.5" /> Retake Drill
                      </>
                    ) : isUnlocked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Take Barrier Test
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Locked
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
