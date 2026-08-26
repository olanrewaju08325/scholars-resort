import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { TrendingUp, Award, Clock, ArrowUpRight, ArrowDownRight, Sparkles, Download, Target } from 'lucide-react';
import { downloadPerformanceSummaryPdf } from '@/lib/performanceSummaryPdf';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface DashboardWidgetProps {
  history?: any[];
  studentName?: string;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ history = [], studentName }) => {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<'all' | 'recent'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const rawHistory = history && history.length > 0 ? history : [];
  const displayHistory = filter === 'recent' ? rawHistory.slice(-5) : rawHistory;

  // Format data for Recharts
  const chartData = displayHistory.map((item, idx) => {
    const rawScore = Number(item.score ?? item.percentage ?? 0);
    // Normalized to 100% or 400 JAMB scale
    const percentage = rawScore > 100 ? Math.round((rawScore / 400) * 100) : rawScore;
    const jambEstimate = rawScore <= 100 ? Math.round(rawScore * 4) : rawScore;

    return {
      examNumber: `Exam #${idx + 1}`,
      rawScore,
      score: percentage,
      jambScore: jambEstimate,
      date: item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Day ${idx + 1}`,
      target: 75, // 300/400 = 75%
      english: Math.min(100, Math.max(20, Math.round(percentage * 1.02))),
      scienceOrArt: Math.min(100, Math.max(15, Math.round(percentage * 0.96)))
    };
  });

  // Calculate improvement trend
  const firstScore = chartData.length > 0 ? chartData[0].score : 0;
  const latestScore = chartData.length > 0 ? chartData[chartData.length - 1].score : 0;
  const scoreDiff = latestScore - firstScore;
  const isImproving = scoreDiff >= 0;

  const highestScore = chartData.length > 0 ? Math.max(...chartData.map(d => d.score)) : 0;
  const avgScore = chartData.length > 0 ? Math.round(chartData.reduce((acc, curr) => acc + curr.score, 0) / chartData.length) : 0;

  const handleDownloadReport = async () => {
    setIsExporting(true);
    try {
      await downloadPerformanceSummaryPdf({
        studentName: studentName || profile?.full_name || 'Scholar Candidate',
        email: profile?.email || '',
        targetScore: profile?.target_score || 300,
        history: rawHistory,
        stats: {
          examsTaken: rawHistory.length,
          averageScore: avgScore,
          highestScore,
          recentScore: latestScore,
          improvementRate: scoreDiff
        }
      });
      toast.success('Performance & Weak Topics Summary PDF generated!');
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF summary.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card id="dashboard-performance-widget" className="bg-card text-card-foreground border-border shadow-md overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/80 bg-muted/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </span>
              <CardTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                Exam Performance & Score Improvement Trends
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Visualizing historical mock drills, percentage progression, and trajectory towards 300+ JAMB target.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex bg-muted p-1 rounded-lg border border-border text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  filter === 'all' 
                    ? 'bg-primary text-primary-foreground shadow-xs font-bold' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Mocks
              </button>
              <button
                onClick={() => setFilter('recent')}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  filter === 'recent' 
                    ? 'bg-primary text-primary-foreground shadow-xs font-bold' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Last 5
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadReport}
              disabled={isExporting}
              className="h-8 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-primary" />
              {isExporting ? 'Exporting...' : 'Summary PDF'}
            </Button>
          </div>
        </div>

        {/* Quick Highlights Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 mt-2 border-t border-border/80">
          <div className="bg-muted/40 p-2.5 rounded-lg border border-border/80">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
              <Award className="w-3.5 h-3.5 text-amber-500" /> Highest Score
            </div>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {highestScore}% <span className="text-[11px] text-muted-foreground font-normal">({Math.round(highestScore * 4)}/400)</span>
            </div>
          </div>

          <div className="bg-muted/40 p-2.5 rounded-lg border border-border/80">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-blue-500" /> Latest Score
            </div>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {latestScore}% <span className="text-[11px] text-muted-foreground font-normal">({Math.round(latestScore * 4)}/400)</span>
            </div>
          </div>

          <div className="bg-muted/40 p-2.5 rounded-lg border border-border/80">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
              <Target className="w-3.5 h-3.5 text-emerald-500" /> Average
            </div>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {avgScore}% <span className="text-[11px] text-muted-foreground font-normal">({Math.round(avgScore * 4)}/400)</span>
            </div>
          </div>

          <div className="bg-muted/40 p-2.5 rounded-lg border border-border/80">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Trajectory
            </div>
            <div className={`text-lg font-bold flex items-center mt-0.5 ${isImproving ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {isImproving ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
              {scoreDiff >= 0 ? `+${scoreDiff}%` : `${scoreDiff}%`}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {chartData.length === 0 ? (
          <div className="h-[240px] flex flex-col items-center justify-center text-center p-6 bg-muted/20 rounded-xl border border-dashed border-border">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">No Mock Exam Sessions Recorded Yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              Complete your first full-length JAMB CBT mock exam or subject practice session to generate performance curves.
            </p>
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="englishGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                <XAxis 
                  dataKey="examNumber" 
                  fontSize={11} 
                  stroke="#64748b" 
                  tickLine={false} 
                />
                <YAxis 
                  domain={[0, 100]} 
                  fontSize={11} 
                  stroke="#64748b" 
                  tickLine={false}
                  unit="%" 
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950/95 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 backdrop-blur-md">
                          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex justify-between gap-4">
                            <span>{label}</span>
                            <span className="text-slate-400 font-normal">{data.date}</span>
                          </p>
                          <div className="flex justify-between gap-4">
                            <span className="text-emerald-400 font-medium">Exam Score:</span>
                            <span className="font-bold text-white">{data.score}% ({data.jambScore}/400)</span>
                          </div>
                          <div className="flex justify-between gap-4 text-slate-400">
                            <span>Target Benchmark:</span>
                            <span className="text-amber-400 font-semibold">75% (300/400)</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} 
                />
                <ReferenceLine 
                  y={75} 
                  stroke="#f59e0b" 
                  strokeDasharray="4 4" 
                  label={{ value: 'JAMB 300+ Target (75%)', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  name="Overall Performance (%)" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#scoreGradient)" 
                  dot={{ r: 4, fill: '#10b981', stroke: '#064e3b', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#34d399' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
