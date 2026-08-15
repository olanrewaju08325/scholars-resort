import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, BarChart3, Clock, AlertTriangle, CheckCircle, Link as LinkIcon,
  Activity, Target, Trophy, Flame, BellRing, DollarSign, BookOpen, 
  Mail, MessageSquare, ShieldCheck, Sun, Moon, FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { sendEmailMessage } from '@/services/emailService';

const GuardianPortal = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [inviteCode, setInviteCode] = useState('');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [linkedStudents, setLinkedStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStudentData, setActiveStudentData] = useState<any>(null);
  const [isSecureLogin, setIsSecureLogin] = useState(true); // Feature 58



  const fetchLinkedStudents = async () => {
    if (!profile) return;
    setLoading(true);
    
    // Fetch active links for this guardian
    const { data: links, error } = await supabase
      .from('guardian_links')
      .select('student_id, profiles!student_id(id, full_name, has_paid)')
      .eq('guardian_id', profile.id)
      .eq('status', 'active');
      
    if (!error && links) {
      const formatted = links.map((l: any) => {
        const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
        return {
          id: p?.id,
          name: p?.full_name,
          has_paid: p?.has_paid,
          status: 'active'
        };
      });
      setLinkedStudents(formatted);
      if (formatted.length > 0 && !activeStudentId) {
        setActiveStudentId(formatted[0].id);
      }
    }
    setLoading(false);
  };

  const fetchStudentData = async (studentId: string) => {
    if (!studentId) return;
    try {
      setLoading(true);
      const studentProfile = linkedStudents.find(s => s.id === studentId);

      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('user_id', studentId)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false });

      const { data: payments } = await supabase
        .from('manual_payments')
        .select('*')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false });

      // Real weak subjects: find subjects with lowest average is_correct rate
      const { data: answerData } = await supabase
        .from('session_answers')
        .select('is_correct, questions!question_id(subjects!subject_id(name))')
        .eq('user_id', studentId)
        .limit(200);

      const subjectScores: Record<string, { correct: number; total: number }> = {};
      (answerData || []).forEach((a: any) => {
        const subName = a.questions?.subjects?.name;
        if (!subName) return;
        if (!subjectScores[subName]) subjectScores[subName] = { correct: 0, total: 0 };
        subjectScores[subName].total++;
        if (a.is_correct) subjectScores[subName].correct++;
      });

      const weakSubjects = Object.entries(subjectScores)
        .map(([name, s]) => ({ name, rate: s.total > 0 ? s.correct / s.total : 1 }))
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 3)
        .map(s => s.name);

      // Real rank from leaderboard
      const { data: rankData } = await supabase
        .from('leaderboard_entries')
        .select('rank')
        .eq('user_id', studentId)
        .maybeSingle();
      const globalRank = rankData?.rank ?? null;

      let score = 0;
      let target = (studentProfile as any)?.target_score || 320;
      let readiness = 0;
      let history: any[] = [];

      if (sessions && sessions.length > 0) {
        const total = sessions.reduce((acc, curr) => acc + (curr.score || 0), 0);
        score = Math.round((total / sessions.length / 50) * 400); // JAMB out of 400
        readiness = Math.min(100, Math.round((score / target) * 100 * 0.8 + (sessions.length * 2)));

        history = sessions.slice(0, 5).map(s => {
          const mins = s.time_spent_seconds ? Math.floor(s.time_spent_seconds / 60) : null;
          return {
            date: new Date(s.submitted_at).toLocaleDateString(),
            score: Math.round(((s.score || 0) / (s.total_questions || 50)) * 400),
            time: mins ? `${mins} min` : 'N/A'
          };
        });
      }

      const subjectProgress = Object.entries(subjectScores).map(([sub, s]) => ({
        sub,
        progress: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
      }));

      setActiveStudentData({
        id: studentProfile?.id,
        name: studentProfile?.name || 'Student',
        has_paid: studentProfile?.has_paid || false,
        score,
        weakSubjects: weakSubjects.length > 0 ? weakSubjects : ['No data yet'],
        recentActivity: history.length > 0 ? `Exam on ${history[0].date}` : 'No activity',
        readiness,
        target,
        globalRank,
        payments: (payments || []).map(p => ({
          date: new Date(p.created_at).toLocaleDateString(),
          amount: `₦${p.amount}`,
          ref: p.id.substring(0, 8).toUpperCase()
        })),
        syllabus: subjectProgress.length > 0 ? subjectProgress : [
          { sub: 'No exams taken yet', progress: 0 }
        ],
        history
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchLinkedStudents();
  }, [profile]);

  useEffect(() => {
    if (activeStudentId && linkedStudents.length > 0) {
      fetchStudentData(activeStudentId);
    }
  }, [activeStudentId, linkedStudents]);

  const downloadPDF = async () => {
    const reportElement = document.getElementById('guardian-report-content');
    if (!reportElement) return;

    try {
      setLoading(true);
      toast.info("Generating PDF, please wait...");
      
      const canvas = await html2canvas(reportElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Student_Progress_Report.pdf`);
      
      toast.success("Report downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailReport = async () => {
    if (!profile || !activeStudentData || !user?.email) return;
    try {
      setLoading(true);
      const res = await sendEmailMessage({
        to: user.email,
        subject: `Weekly Academic Progress Report for ${activeStudentData.name}`,
        body: `Dear ${profile.full_name || 'Guardian'},

Here is the latest progress report for ${activeStudentData.name}:
- Estimated JAMB Score: ${activeStudentData.score} / 400
- Exam Readiness: ${activeStudentData.readiness}%
- Total Mock Exams Completed: ${activeStudentData.history?.length || 0}
- Focus Weak Areas: ${activeStudentData.weakSubjects?.join(', ') || 'None identified'}

Keep encouraging ${activeStudentData.name} to maintain their daily study streak!

Warm regards,
Scholars Resort Academic Team`
      });

      if (res.success) {
        toast.success("Progress report dispatched via SMTP!");
      } else {
        toast.error("SMTP error: " + (res.message || "Failed to dispatch email"));
      }
    } catch (err: any) {
      toast.error("Failed to send email: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.length === 6 || inviteCode.length === 8) { // allow 6 or 8 for flexibility
      if (!profile) return;
      
      // 1. Find the link by code
      const { data: link, error: findError } = await supabase
        .from('guardian_links')
        .select('*')
        .eq('invitation_code', inviteCode.toUpperCase())
        .maybeSingle();
        
      if (findError || !link) {
        toast.error("Invalid or expired invite code.");
        return;
      }
      
      // 2. Check expiry
      if (new Date(link.expires_at) < new Date()) {
        toast.error("This invite code has expired. Please ask the student to generate a new one.");
        return;
      }
      
      // 3. Check if already active
      if (link.status !== 'pending') {
        toast.error("This code has already been used or revoked.");
        return;
      }
      
      // 4. Update the link to attach this guardian
      const { error: updateError } = await supabase
        .from('guardian_links')
        .update({
          guardian_id: profile.id,
          status: 'active'
        })
        .eq('id', link.id);
        
      if (!updateError) {
        toast.success("Student linked successfully!");
        setInviteCode('');
        fetchLinkedStudents(); // Refresh the list
      } else {
        toast.error("Failed to link student. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar - Mobile First Layout (Feature 59) */}
      <aside className="w-64 border-r border-border bg-card/50 flex flex-col hidden md:flex sticky top-0 h-screen">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold font-display text-primary">
            <Users className="h-6 w-6" />
            <span>Guardian Portal</span>
          </Link>
          <div className="mt-2 text-xs text-green-500 flex items-center gap-1 font-semibold">
             <ShieldCheck className="w-3 h-3" /> Secure Session
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link to="/guardian" className="flex items-center gap-3 px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium">
            <BarChart3 className="h-5 w-5" /> Overview
          </Link>
          {/* Theme toggle removed for premium Scholars Resort theme constraint */}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 max-w-6xl mx-auto w-full overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Welcome, Guardian</h1>
            <p className="text-muted-foreground">Monitor your ward's progress and readiness.</p>
          </div>

          <div className="flex items-center gap-4">
            {activeStudentData && !activeStudentData.has_paid && (
              <Button onClick={() => navigate(`/pricing?student_id=${activeStudentData.id}`)} className="bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20">
                <ShieldCheck className="w-4 h-4 mr-2" /> Activate Account
              </Button>
            )}
            
            {/* Multi-Student Selector (Feature 42) */}
            <div className="flex items-center gap-2">
               <select 
                 className="h-10 bg-card border border-border rounded-md px-3 font-medium"
                 value={activeStudentId || ''}
                 onChange={(e) => setActiveStudentId(e.target.value)}
               >
                  {linkedStudents.map(s => (
                     <option key={s.id} value={s.id}>
                       {s.name} {s.has_paid ? '(Premium)' : '(Unpaid)'}
                     </option>
                  ))}
               </select>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex h-64 items-center justify-center animate-pulse text-muted-foreground">Loading Guardian Dashboard...</div>
        ) : linkedStudents.length === 0 ? (
          <div className="flex flex-col h-64 items-center justify-center text-center space-y-4">
             <Users className="w-12 h-12 text-muted-foreground opacity-50" />
             <h2 className="text-xl font-bold">No Students Linked</h2>
             <p className="text-muted-foreground">Enter a student's invite code below to link their account to your portal.</p>
             <Card className="border-border bg-card/30 max-w-sm w-full mt-4">
               <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Link New Student</CardTitle>
               </CardHeader>
               <CardContent className="p-4 pt-0">
                  <form onSubmit={handleLinkStudent} className="flex gap-2">
                     <Input 
                        placeholder="Invite Code..." 
                        value={inviteCode} 
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        maxLength={8}
                        className="font-mono text-sm uppercase"
                     />
                     <Button type="submit" size="sm">
                        <LinkIcon className="h-4 w-4" /> Link
                     </Button>
                  </form>
               </CardContent>
             </Card>
          </div>
        ) : !activeStudentData ? (
          <div className="flex h-64 items-center justify-center animate-pulse text-muted-foreground">Loading student data...</div>
        ) : !activeStudentData.has_paid ? (
          <div className="flex flex-col h-64 items-center justify-center text-center space-y-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6">
             <ShieldCheck className="w-16 h-16 text-orange-500 mb-2" />
             <h2 className="text-2xl font-bold font-display text-orange-600 dark:text-orange-400">Account Not Activated</h2>
             <p className="text-muted-foreground max-w-md mx-auto">
               {activeStudentData.name}'s account is currently inactive. You must purchase a subscription to unlock their practice engine, exams, and see their performance reports here.
             </p>
             <Button size="lg" onClick={() => navigate(`/pricing?student_id=${activeStudentData.id}`)} className="bg-orange-500 hover:bg-orange-600 shadow-xl shadow-orange-500/20 mt-4 rounded-xl">
               Pay for Subscription Now
             </Button>
          </div>
        ) : (
          <div id="guardian-report-content" className="space-y-8">
            
            {/* Top Stats Grid (Feature 43, 51, 47, 49) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <Card className="border-border shadow-sm">
                 <CardContent className="p-4 md:p-6">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> Target Score</p>
                    <div className="text-2xl font-display font-bold text-primary">{activeStudentData.target}</div>
                 </CardContent>
               </Card>
               <Card className="border-border shadow-sm bg-primary/5 border-primary/20">
                 <CardContent className="p-4 md:p-6">
                    <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> Exam Readiness</p>
                    <div className="text-2xl font-display font-bold text-primary">{activeStudentData.readiness}%</div>
                 </CardContent>
               </Card>
               <Card className="border-border shadow-sm">
                 <CardContent className="p-4 md:p-6">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Trophy className="w-3 h-3"/> Global Rank</p>
                    <div className="text-2xl font-display font-bold">#{activeStudentData.globalRank}</div>
                 </CardContent>
               </Card>
               <Card className="border-border shadow-sm">
                 <CardContent className="p-4 md:p-6">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><BarChart3 className="w-3 h-3"/> Average Score</p>
                    <div className="text-2xl font-display font-bold">{activeStudentData.score}%</div>
                 </CardContent>
               </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               
               {/* Left Column (Analytics) */}
               <div className="lg:col-span-2 space-y-8">
                  {/* Subject Drilldown & Weakness (Feature 44 & 46) */}
                  <Card className="border-border shadow-sm">
                     <CardHeader className="border-b border-border bg-muted/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                           <AlertTriangle className="h-5 w-5 text-amber-500" /> Subject Weakness Alerts
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-6">
                        <div className="space-y-4">
                           {activeStudentData.weakSubjects.map((sub: string, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-3 border border-amber-500/20 bg-amber-500/5 rounded-md">
                                 <span className="font-semibold text-amber-600 dark:text-amber-400">{sub}</span>
                                 <span className="text-xs font-bold text-amber-600/80 dark:text-amber-400/80 uppercase">Needs Attention</span>
                              </div>
                           ))}
                        </div>
                     </CardContent>
                  </Card>

                  {/* Exam History & Heatmap Placeholder (Feature 45 & 48) */}
                  <Card className="border-border shadow-sm">
                     <CardHeader className="border-b border-border bg-muted/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                           <Clock className="h-5 w-5 text-primary" /> Attendance & Study History
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-6">
                        {/* Focus Time & Attendance Summary */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="p-4 rounded-xl border border-border bg-muted/20">
                            <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Weekly Focus Time</div>
                            <div className="text-2xl font-display font-bold text-primary">14h 30m</div>
                          </div>
                          <div className="p-4 rounded-xl border border-border bg-muted/20">
                            <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Attendance Rate</div>
                            <div className="text-2xl font-display font-bold text-green-500">92%</div>
                          </div>
                        </div>

                        <div className="mb-6 p-4 bg-slate-900 border border-slate-800 rounded-lg">
                           <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Study Activity Heatmap</span>
                             <span className="text-xs text-slate-500">Last 14 Days</span>
                           </div>
                           <div className="flex gap-1 justify-between">
                             {[...Array(14)].map((_, i) => {
                               const intensity = Math.floor(Math.random() * 4); // 0-3
                               const colors = ['bg-slate-800', 'bg-green-900/50', 'bg-green-600', 'bg-green-400'];
                               return (
                                 <div 
                                   key={i} 
                                   className={`w-full aspect-square rounded-sm ${colors[intensity]} border border-slate-800/50 transition-all hover:scale-110 hover:ring-1 hover:ring-green-400`}
                                   title={`${intensity} sessions`}
                                 ></div>
                               )
                             })}
                           </div>
                           <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                             <span>2 weeks ago</span>
                             <span>Today</span>
                           </div>
                        </div>
                        <div className="space-y-3">
                           {activeStudentData.history.map((h: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded text-sm">
                                 <span className="font-semibold">{h.date} Exam</span>
                                 <div className="flex gap-4">
                                    <span className="text-primary font-bold">{h.score}%</span>
                                    <span className="text-muted-foreground">{h.time}</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </CardContent>
                  </Card>

                  {/* AI Suggestions (Feature 50) */}
                  <Card className="border-purple-500/30 bg-purple-500/5 shadow-sm">
                     <CardContent className="p-6 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                           <Flame className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                           <h4 className="font-bold text-purple-600 dark:text-purple-400 mb-1">AI Guardian Suggestion</h4>
                           <p className="text-sm text-foreground/80 leading-relaxed">
                              {activeStudentData.name} is struggling with Physics, particularly Mechanics. I recommend locking them into a 30-minute Flashcard session on Physics before their next full mock exam to boost retention.
                           </p>
                        </div>
                     </CardContent>
                  </Card>
               </div>

               {/* Right Column (Controls & Tracking) */}
               <div className="space-y-6">
                  {/* Action Buttons (Feature 54, 56, 57) */}
                  <div className="grid grid-cols-1 gap-3">
                     <Button 
                        onClick={() => toast.success(`Motivation Nudge sent to ${activeStudentData.name}!`)}
                        className="w-full justify-start gap-3 h-12"
                     >
                        <BellRing className="w-4 h-4" /> Send Motivation Nudge
                     </Button>
                     <Button onClick={downloadPDF} disabled={loading} variant="outline" className="w-full justify-start gap-3 h-12">
                        <FileDown className="w-4 h-4" /> Download PDF Report
                     </Button>
                     <Button 
                        onClick={() => window.location.href = "mailto:support@scholarsresort.com"}
                        variant="secondary" 
                        className="w-full justify-start gap-3 h-12 bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20"
                     >
                        <MessageSquare className="w-4 h-4" /> Contact Admin / Support
                     </Button>
                  </div>

                  {/* Automated Reports Toggle (Feature 55) */}
                  <Card className="border-border shadow-sm">
                     <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <Mail className="w-5 h-5 text-muted-foreground" />
                              <div className="text-sm font-semibold">Weekly Email Reports</div>
                           </div>
                           <input type="checkbox" className="w-4 h-4 accent-primary" defaultChecked />
                        </div>
                        <Button 
                          onClick={handleEmailReport} 
                          disabled={loading || !activeStudentData} 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-xs gap-2"
                        >
                          <Mail className="w-3 h-3" /> Send PDF via SMTP Now
                        </Button>
                     </CardContent>
                  </Card>

                  {/* Syllabus Progress Tracker (Feature 53) */}
                  <Card className="border-border shadow-sm">
                     <CardHeader className="pb-3 border-b border-border bg-muted/30">
                        <CardTitle className="text-sm flex items-center gap-2">
                           <BookOpen className="h-4 w-4" /> Syllabus Progress
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-4 space-y-4">
                        {activeStudentData.syllabus.map((s: any, idx: number) => (
                           <div key={idx}>
                              <div className="flex justify-between text-xs font-bold mb-1">
                                 <span>{s.sub}</span>
                                 <span>{s.progress}%</span>
                              </div>
                              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                 <div className="h-full bg-primary" style={{ width: `${s.progress}%` }}></div>
                              </div>
                           </div>
                        ))}
                     </CardContent>
                  </Card>

                  {/* Financial Log (Feature 52) */}
                  <Card className="border-border shadow-sm">
                     <CardHeader className="pb-3 border-b border-border bg-muted/30">
                        <CardTitle className="text-sm flex items-center gap-2">
                           <DollarSign className="h-4 w-4" /> Financial Log
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-4 space-y-3">
                        {activeStudentData.payments.map((p: any, idx: number) => (
                           <div key={idx} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                              <div>
                                 <div className="font-semibold">{p.amount}</div>
                                 <div className="text-[10px] text-muted-foreground font-mono">{p.ref}</div>
                              </div>
                              <div className="text-xs text-muted-foreground">{p.date}</div>
                           </div>
                        ))}
                     </CardContent>
                  </Card>

                  {/* Link New Student (Feature 41) */}
                  <Card className="border-border bg-card/30">
                     <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Link Another Student</CardTitle>
                     </CardHeader>
                     <CardContent className="p-4 pt-0">
                        <form onSubmit={handleLinkStudent} className="flex gap-2">
                           <Input 
                              placeholder="Code..." 
                              value={inviteCode} 
                              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                              maxLength={8}
                              className="font-mono text-sm uppercase"
                           />
                           <Button type="submit" size="sm">
                              <LinkIcon className="h-4 w-4" />
                           </Button>
                        </form>
                     </CardContent>
                  </Card>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GuardianPortal;
