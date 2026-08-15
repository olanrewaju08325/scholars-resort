import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Compass } from 'lucide-react';

interface SubjectMasteryRadarChartProps {
  data: Array<{
    subject: string;
    score: number;
    target: number;
  }>;
}

export const SubjectMasteryRadarChart: React.FC<SubjectMasteryRadarChartProps> = ({ data }) => {
  const chartData = data && data.length > 0 ? data : [
    { subject: 'Use of English', score: 75, target: 85 },
    { subject: 'Mathematics', score: 68, target: 80 },
    { subject: 'Physics', score: 72, target: 80 },
    { subject: 'Chemistry', score: 80, target: 85 },
    { subject: 'Biology', score: 82, target: 90 },
  ];

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-600" /> Subject & Topic Mastery Radar
        </CardTitle>
        <CardDescription className="text-xs">
          Multi-axis comparison of proficiency vs target threshold
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'currentColor', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" fontSize={10} />
              <Radar name="Accuracy Score" dataKey="score" stroke="#16a34a" fill="#16a34a" fillOpacity={0.4} />
              <Radar name="Target Score" dataKey="target" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
