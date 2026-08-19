import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Search, UserCircle, Activity, Award, AlertTriangle, BookOpen, Gift, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export const StudentInsightsTab = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [examSessions, setExamSessions] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  
  const searchStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    try {
      // Find student
      const { data: students, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
        .eq('role', 'student')
        .limit(1);

      if (error) throw error;

      if (!students || students.length === 0) {
        toast.error("Student not found");
        setStudent(null);
        setSearching(false);
        return;
      }

      const foundStudent = students[0];
      setStudent(foundStudent);

      // Fetch their exam sessions
      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('*, mock_exams(title)')
        .eq('user_id', foundStudent.id)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: true });

      if (sessions) {
        setExamSessions(sessions.reverse()); // latest first for the list
        
        // Prepare chart data (chronological)
        const chartData = sessions.map((s: any, index: number) => ({
          name: `Exam ${index + 1}`,
          Score: s.score || 0
        }));
        setPerformanceData(chartData);
      } else {
        setExamSessions([]);
        setPerformanceData([]);
      }

    } catch (err: any) {
      toast.error(`Search failed: ${err.message}`);
    }
    setSearching(false);
  };

  const giftAccess = async () => {
    if (!student) return;
    try {
      const { error } = await supabase.from('subscriptions').insert({
        user_id: student.id,
        plan_id: 'lifetime', // Adjust based on actual plan structure
        status: 'active',
        start_date: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Lifetime access gifted successfully!");
    } catch (err: any) {
      toast.error(`Failed to gift access: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> Student Insights
          </h2>
          <p className="text-slate-400">Deep dive into individual student performance and activity.</p>
        </div>
        
        <form onSubmit={searchStudent} className="flex gap-2">
          <Input 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            placeholder="Search by name or email..." 
            className="w-full md:w-64 bg-slate-900 border-slate-800"
          />
          <Button type="submit" disabled={searching} className="bg-primary hover:bg-primary/90 shrink-0">
            <Search className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {!student ? (
        <Card className="bg-slate-900 border-slate-800 text-slate-100 min-h-[400px] flex items-center justify-center">
          <div className="text-center text-slate-500">
            <UserCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>Search for a student to view their insights.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Overview */}
          <Card className="md:col-span-1 bg-slate-900 border-slate-800 text-slate-100 h-fit">
            <CardHeader className="text-center pb-2">
              <div className="w-20 h-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                {student.full_name?.charAt(0) || 'S'}
              </div>
              <CardTitle className="text-xl">{student.full_name}</CardTitle>
              <CardDescription className="text-slate-400">{student.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                  <div className="text-xs text-slate-500 mb-1">Streak</div>
                  <div className="text-lg font-bold text-orange-500 flex items-center justify-center gap-1">
                    {student.streak_days || 0} <span className="text-sm">days</span>
                  </div>
                </div>
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                  <div className="text-xs text-slate-500 mb-1">Exams Taken</div>
                  <div className="text-lg font-bold text-primary">{examSessions.length}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Button onClick={giftAccess} className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
                  <Gift className="w-4 h-4 mr-2 text-purple-400" /> Gift Access
                </Button>
                <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
                  <MessageSquare className="w-4 h-4 mr-2 text-blue-400" /> Send Message
                </Button>
              </div>

              <div className="pt-4 border-t border-slate-800 text-sm text-slate-400 space-y-2">
                <div className="flex justify-between">
                  <span>Joined:</span>
                  <span className="text-slate-200">{new Date(student.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Active:</span>
                  <span className="text-slate-200">{new Date(student.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Role:</span>
                  <span className="text-slate-200 capitalize">{student.role}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Data */}
          <div className="md:col-span-2 space-y-6">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">Score Trend</CardTitle>
                <CardDescription className="text-slate-400">Progression across all submitted CBT sessions.</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceData.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
                    No exam data available yet.
                  </div>
                ) : (
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 12}} />
                        <YAxis stroke="#64748b" tick={{fontSize: 12}} domain={[0, 400]} />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px'}}
                          itemStyle={{color: '#3b82f6'}}
                        />
                        <Line type="monotone" dataKey="Score" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-md flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> Needs Attention
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    {/* Simulated weak areas based on score - in a real app, query weak_topics table */}
                    {examSessions.length > 0 && examSessions[0].score < 200 ? (
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5"></div>
                        <span className="text-slate-300">Overall score consistently below 200 threshold. Recommend foundational review.</span>
                      </li>
                    ) : examSessions.length === 0 ? (
                      <li className="text-slate-500 italic">No data</li>
                    ) : (
                      <li className="flex items-start gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5"></div>
                         <span className="text-slate-300">On track. No major weak areas detected recently.</span>
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-md flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-400" /> Recent Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {examSessions.length === 0 ? (
                      <div className="text-slate-500 text-sm italic">No recent sessions</div>
                    ) : (
                      examSessions.slice(0, 3).map(session => (
                        <div key={session.id} className="flex justify-between items-center text-sm p-2 bg-slate-950 rounded border border-slate-800">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-300 truncate max-w-[120px]">{session.mock_exams?.title || 'Custom Practice'}</span>
                          </div>
                          <span className="font-bold text-primary">{session.score || 0}/400</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
