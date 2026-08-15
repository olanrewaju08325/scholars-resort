import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface PerformanceTrendChartProps {
  history?: any[];
}

export const PerformanceTrendChart: React.FC<PerformanceTrendChartProps> = ({ history = [] }) => {
  // Generate historical subject trend data
  const trendData = history && history.length > 0 ? history.map((item, idx) => ({
    session: `Exam ${idx + 1}`,
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
  ];

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" /> Subject Performance Trend Over Time
        </CardTitle>
        <CardDescription className="text-xs">
          Track individual subject scores across exam sessions (Recharts visualization)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="session" fontSize={11} stroke="#94a3b8" />
              <YAxis domain={[0, 100]} fontSize={11} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="score" name="Overall Avg (%)" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="english" name="Use of English" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="math" name="Mathematics" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="physics" name="Physics" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="chemistry" name="Chemistry" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
