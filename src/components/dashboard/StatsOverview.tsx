import { Card, CardContent } from '@/components/ui/card';
import { Target, TrendingUp, Flame, Brain } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export const StatsOverview = ({ stats }: { stats: any }) => {
  // Calculate real improvement comparing latest exam to average score
  const latestExam = stats.history && stats.history.length > 0 ? stats.history[stats.history.length - 1].score : 0;
  const improvement = stats.history && stats.history.length > 1
    ? Math.round(latestExam - stats.history[0].score)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex flex-col items-center text-center justify-center">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-2">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold font-display">{stats.streak}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Day Streak</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex flex-col items-center text-center justify-center">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
              <Brain className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold font-display">{stats.examsTaken}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Exams Taken</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex flex-col items-center text-center justify-center">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
              <Target className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold font-display">{stats.averageScore}<span className="text-sm text-muted-foreground font-normal">/400</span></div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Avg Score</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex flex-col items-center text-center justify-center">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <div className={`text-2xl font-bold font-display ${improvement >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {improvement > 0 ? `+${improvement}` : improvement} pts
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Score Progress</div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
