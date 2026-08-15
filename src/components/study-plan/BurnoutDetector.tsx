import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, AlertTriangle, CheckCircle, Brain, BatteryMedium } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export const BurnoutDetector = () => {
  // In a real app, this would be calculated from recent study hours vs average
  const metrics = {
    focusScore: 82, // 0-100
    hoursStudied: 4.5,
    recommendedLimit: 6,
    burnoutRisk: 'Low' // Low, Medium, High
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'Medium': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'High': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-primary bg-primary/10 border-primary/20';
    }
  };

  const RiskIcon = metrics.burnoutRisk === 'Low' ? CheckCircle : 
                   metrics.burnoutRisk === 'Medium' ? BatteryMedium : AlertTriangle;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Productivity & Burnout
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-border bg-muted/20">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Brain className="w-4 h-4" /> <span className="text-xs font-bold uppercase">Focus Score</span>
            </div>
            <div className="text-3xl font-display font-bold text-primary">{metrics.focusScore}<span className="text-lg text-muted-foreground">/100</span></div>
          </div>
          
          <div className={`p-4 rounded-xl border ${getRiskColor(metrics.burnoutRisk)}`}>
            <div className="flex items-center gap-2 mb-2 opacity-80">
              <RiskIcon className="w-4 h-4" /> <span className="text-xs font-bold uppercase">Burnout Risk</span>
            </div>
            <div className="text-2xl font-display font-bold">{metrics.burnoutRisk}</div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-semibold">Today's Study Load</span>
            <span className="text-xs font-bold text-muted-foreground">{metrics.hoursStudied}h / {metrics.recommendedLimit}h Limit</span>
          </div>
          <Progress value={(metrics.hoursStudied / metrics.recommendedLimit) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            {metrics.burnoutRisk === 'Low' 
              ? "You're pacing yourself perfectly. Keep up the good work without overexerting." 
              : "You are approaching your cognitive limit for today. Consider taking a long break soon."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
