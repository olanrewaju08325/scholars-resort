import { Card, CardContent } from '@/components/ui/card';
import { Target, TrendingUp, Flame, Brain } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export const StatsOverview = ({ stats }: { stats: any }) => {
  // Mock data for Radar chart - in a real scenario, this would come from the database (e.g., subject-level score aggregations)
  const masteryData = [
    { subject: 'English', score: 85, fullMark: 100 },
    { subject: 'Maths', score: 65, fullMark: 100 },
    { subject: 'Physics', score: 70, fullMark: 100 },
    { subject: 'Chemistry', score: 90, fullMark: 100 },
    { subject: 'Biology', score: 50, fullMark: 100 },
  ];

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
            <div className="text-2xl font-bold font-display text-green-500">+12%</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Improvement</div>
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Line Chart */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Performance Trend (Out of 400)</h3>
            <div className="h-[250px] w-full">
              {stats.history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.history}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 400]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl p-4 text-center">
                  Take your first exam to see your progress chart
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Radar Chart */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Subject Mastery</h3>
            <div className="h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="80%" data={masteryData}>
                   <PolarGrid stroke="hsl(var(--border))" />
                   <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                   <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                   <Radar name="Student" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                   <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                 </RadarChart>
               </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
