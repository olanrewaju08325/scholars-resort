import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, Target, Sparkles, CheckCircle, ArrowRight, BookOpen } from 'lucide-react';
import { calculateEstimatedJambScore } from '@/lib/jambPredictor';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface JambScorePredictorCardProps {
  history?: any[];
}

export const JambScorePredictorCard: React.FC<JambScorePredictorCardProps> = ({ history = [] }) => {
  const prediction = calculateEstimatedJambScore(history);

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground bg-muted border-border';
    if (score >= 280) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 220) return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    if (score >= 180) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    return 'text-red-500 bg-red-500/10 border-red-500/30';
  };

  return (
    <Card className="border-border shadow-sm bg-gradient-to-br from-card via-card to-emerald-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Projected JAMB/UTME Score Predictor
            </CardTitle>
            <CardDescription className="text-xs">
              Algorithmic readiness calculation based on verified exam history
            </CardDescription>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getScoreColor(prediction.estimatedScore)}`}>
            {prediction.confidenceLevel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {prediction.hasData && prediction.estimatedScore !== null ? (
          <>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
              <div>
                <div className="text-3xl font-display font-extrabold text-foreground flex items-baseline gap-1">
                  <span>{prediction.estimatedScore}</span>
                  <span className="text-sm font-normal text-muted-foreground">/ 400</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Estimated Aggregate UTME Score</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-emerald-500">{prediction.overallReadinessPercent}%</div>
                <p className="text-[11px] text-muted-foreground">Mastery Index</p>
              </div>
            </div>

            {prediction.subjectBreakdown.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject Readiness Breakdown</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {prediction.subjectBreakdown.map((subj, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-card border border-border text-center">
                      <span className="text-[11px] font-semibold text-foreground truncate block">{subj.subjectName}</span>
                      <span className="text-sm font-bold text-emerald-500 block mt-0.5">{subj.estimatedSubjectScore} / 100</span>
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded mt-1 bg-primary/10 text-primary border border-primary/20">
                        Grade {subj.readinessGrade}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-4 rounded-xl bg-muted/20 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                No exam performance recorded yet
              </div>
              <p className="text-xs text-muted-foreground max-w-lg">
                Complete your first CBT mock or subject drill to calculate an authoritative projected JAMB score based on real performance.
              </p>
            </div>
            <Button asChild size="sm" className="gap-1.5 shrink-0">
              <Link to="/cbt">
                <BookOpen className="w-3.5 h-3.5" /> Start First CBT <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        )}

        {prediction.recommendations.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Guidance:
            </div>
            {prediction.recommendations.map((rec, i) => (
              <p key={i} className="flex items-start gap-1.5">
                <CheckCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
