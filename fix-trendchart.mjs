import fs from 'fs';

let content = fs.readFileSync('src/components/dashboard/PerformanceTrendChart.tsx', 'utf8');

const oldLogic = `  const trendData = history && history.length > 0 ? history.map((item, idx) => ({
    session: \`Exam \${idx + 1}\`,
    score: item.score || 0,
    english: Math.min(100, Math.round((item.score || 50) * 1.05)),
    math: Math.min(100, Math.round((item.score || 50) * 0.95)),
    physics: Math.min(100, Math.round((item.score || 50) * 0.9)),
    chemistry: Math.min(100, Math.round((item.score || 50) * 1.02)),
  })) : [
    { session: 'Mock 1', score: 62, english: 65, math: 58, physics: 55, chemistry: 60 },
    { session: 'Mock 2', score: 68, english: 70, math: 64, physics: 62, chemistry: 65 },
    { session: 'Mock 3', score: 74, english: 78, math: 70, physics: 68, chemistry: 72 },
    { session: 'Mock 4', score: 81, english: 85, math: 76, physics: 75, chemistry: 80 },
    { session: 'Mock 5', score: 86, english: 90, math: 82, physics: 80, chemistry: 84 },
  ];`;

const newLogic = `  const trendData = history && history.length > 0 ? history.map((item, idx) => ({
    session: \`Exam \${idx + 1}\`,
    score: item.score || 0,
    english: Math.min(100, Math.round((item.score || 50) * 1.05)),
    math: Math.min(100, Math.round((item.score || 50) * 0.95)),
    physics: Math.min(100, Math.round((item.score || 50) * 0.9)),
    chemistry: Math.min(100, Math.round((item.score || 50) * 1.02)),
  })) : [];
  
  if (trendData.length === 0) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Subject Performance Trend Over Time
          </CardTitle>
          <CardDescription className="text-xs">
            Complete exam sessions to see your subject progression trend.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
          No exam history data available yet.
        </CardContent>
      </Card>
    );
  }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/dashboard/PerformanceTrendChart.tsx', content);
console.log('Fixed PerformanceTrendChart');
