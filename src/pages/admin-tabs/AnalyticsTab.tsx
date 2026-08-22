import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export const AnalyticsTab = () => {
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [examData, setExamData] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        // Revenue Analytics (Mocked up from past 7 days based on manual_payments)
        // In a real app we'd aggregate this in SQL, doing client-side for now
        const { data: payments } = await supabase
          .from('manual_payments')
          .select('amount, created_at, status')
          .eq('status', 'approved');

        const last7Days = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0];
        });

        const revMap = last7Days.reduce((acc, date) => ({ ...acc, [date]: 0 }), {} as Record<string, number>);
        
        payments?.forEach(p => {
          const date = p.created_at.split('T')[0];
          if (revMap[date] !== undefined) {
            revMap[date] += p.amount || 0;
          }
        });

        setRevenueData(Object.entries(revMap).map(([date, amount]) => ({
          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: amount
        })));

        // Exam Analytics
        const { data: exams } = await supabase
          .from('exam_sessions')
          .select('*')
          .limit(200);

        const examMap = last7Days.reduce((acc, date) => ({ ...acc, [date]: { exams: 0, avgScore: 0, sumScore: 0 } }), {} as Record<string, any>);
        
        exams?.forEach((e: any) => {
          const rawDate = e.created_at || e.started_at;
          if (!rawDate) return;
          const date = rawDate.split('T')[0];
          if (examMap[date] && e.score !== null && e.score !== undefined) {
            examMap[date].exams += 1;
            const total = Number(e.total_questions) || 40;
            const percentage = (Number(e.score) / total) * 100;
            examMap[date].sumScore += percentage;
            examMap[date].avgScore = Math.round(examMap[date].sumScore / examMap[date].exams);
          }
        });

        setExamData(Object.entries(examMap).map(([date, data]) => ({
          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          exams: data.exams,
          avgScore: data.avgScore
        })));

      } catch (e) {
        console.error("Failed to load analytics", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const exportCSV = () => {
    try {
      const headers = ['Date', 'Revenue', 'Exams Taken', 'Average Score (%)'];
      const rows = revenueData.map((rd, i) => [
        rd.name,
        rd.revenue,
        examData[i]?.exams || 0,
        examData[i]?.avgScore || 0
      ]);
      
      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `scholars_resort_analytics_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Analytics exported successfully');
    } catch (e) {
      toast.error('Failed to export CSV');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-slate-100">Enterprise Analytics</h2>
          <p className="text-slate-400 text-sm">Detailed insights on platform usage and revenue</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle>Revenue (Last 7 Days)</CardTitle>
            <CardDescription className="text-slate-400">Manual payments approved</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-slate-500">Loading chart...</div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₦${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exam Volume & Score Chart */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle>Exam Engagement</CardTitle>
            <CardDescription className="text-slate-400">Exams taken vs Average Score</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-slate-500">Loading chart...</div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={examData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="exams" stroke="#3b82f6" strokeWidth={2} name="Exams Taken" />
                    <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke="#a855f7" strokeWidth={2} name="Avg Score (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
