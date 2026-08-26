import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, BarChart3, Clock, AlertTriangle, CheckCircle, Link2,
  Activity, Target, Trophy, Flame, BellRing, DollarSign, BookOpen, 
  Mail, MessageSquare, ShieldCheck, Sun, Moon, FileDown, LogOut, Layers
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
import { sendNotification } from '@/lib/notifications';
import { callGroqAPI, stripThinkTags } from '@/services/aiService';

const GuardianPortal = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
      toast.success("Successfully logged out from parent portal.");
    } catch {
      toast.error("An error occurred during logout.");
    }
  };

  const [inviteCode, setInviteCode] = useState('');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [linkedStudents, setLinkedStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStudentData, setActiveStudentData] = useState<any>(null);
  const [isSecureLogin, setIsSecureLogin] = useState(true); // Feature 58
  const [mobileTab, setMobileTab] = useState<'all' | 'overview' | 'analytics' | 'actions' | 'finance'>('all');



  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchLinkedStudents = async () => {
    if (!profile) return;
    setLoading(true);
    setFetchError(null);
    
    try {
      // 1. Try server-side Supabase joined endpoint first
      let loadedStudents: any[] | null = null;
      try {
        const response = await fetch(`/api/guardian/students?guardianId=${encodeURIComponent(profile.id)}`);
        if (response.ok) {
          const json = await response.json();
          if (json.success && Array.isArray(json.students)) {
            loadedStudents = json.students;
          }
        }
      } catch (apiErr) {
        console.warn('[GuardianPortal] Server endpoint unreachable, falling back to direct DB queries:', apiErr);
      }

      if (loadedStudents !== null) {
        setLinkedStudents(loadedStudents);
        if (loadedStudents.length > 0) {
          if (!activeStudentId || !loadedStudents.some(f => f.id === activeStudentId)) {
            setActiveStudentId(loadedStudents[0].id);
          }
        } else {
          setActiveStudentData(null);
        }
        setLoading(false);
        return;
      }

      // 2. Direct client fallback: Query guardian_student_relationships and guardian_links
      let studentIds: string[] = [];

      try {
        const { data: rels, error: relErr } = await supabase
          .from('guardian_student_relationships')
          .select('student_id')
          .eq('guardian_id', profile.id)
          .eq('status', 'active');

        if (!relErr && rels && rels.length > 0) {
          studentIds = Array.from(new Set(rels.map((r: any) => r.student_id).filter(Boolean)));
        }
      } catch {}

      if (studentIds.length === 0) {
        const { data: links, error: linkErr } = await supabase
          .from('guardian_links')
          .select('student_id')
          .eq('guardian_id', profile.id)
          .eq('status', 'active');
          
        if (linkErr) {
          console.warn('[GuardianPortal] Error loading guardian links:', linkErr);
        } else if (links && links.length > 0) {
          studentIds = Array.from(new Set(links.map((l: any) => l.student_id).filter(Boolean)));
        }
      }

      if (studentIds.length === 0) {
        setLinkedStudents([]);
        setActiveStudentData(null);
        setLoading(false);
        return;
      }

      // 3. Fetch student profiles in a single clean query
      const { data: studentProfiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, has_paid, target_score, target_university, target_course, streak_days, xp, last_active, created_at')
        .in('id', studentIds);

      if (profErr) {
        console.warn('[GuardianPortal] Error loading student profiles:', profErr);
        setFetchError('Unable to load student profile details. Please try again.');
      }

      const profileMap: Record<string, any> = {};
      (studentProfiles || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });

      const formatted = studentIds.map((sId: string) => {
        const p = profileMap[sId] || {};
        return {
          id: sId,
          name: p.full_name || p.email || 'Student Ward',
          email: p.email || '',
          has_paid: !!p.has_paid,
          target_score: p.target_score || 320,
          target_university: p.target_university || '',
          target_course: p.target_course || '',
          xp: p.xp || 0,
          streak_days: p.streak_days || 0,
          last_active: p.last_active,
          status: 'active'
        };
      });

      setLinkedStudents(formatted);
      if (formatted.length > 0) {
        if (!activeStudentId || !formatted.some(f => f.id === activeStudentId)) {
          setActiveStudentId(formatted[0].id);
        }
      }
    } catch (err: any) {
      console.error('[GuardianPortal] Failed to fetch linked students:', err);
      setFetchError(err.message || 'Failed to retrieve linked students');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentData = async (studentId: string) => {
    if (!studentId || !profile) return;
    try {
      setLoading(true);
      setFetchError(null);

      // 1. Try server-side analytical endpoint
      try {
        const response = await fetch('/api/guardian/student-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guardianId: profile.id, studentId })
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success && resJson.data) {
            setActiveStudentData(resJson.data);
            setLoading(false);
            return;
          }
        } else if (response.status === 403 || response.status === 404) {
          const errData = await response.json().catch(() => ({}));
          toast.error(errData.error || 'Access to student records is restricted or not found.');
        }
      } catch (srvErr) {
        console.warn('[GuardianPortal] Server analytics route notice:', srvErr);
      }

      const studentProfile = linkedStudents.find(s => s.id === studentId);

      // 2. Fetch real exam sessions for this student
      const { data: sessions, error: sessErr } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false });

      if (sessErr) {
        console.warn('[GuardianPortal] exam_sessions notice:', sessErr.message);
      }

      // 3. Fetch real payment records for this student
      const { data: payments, error: payErr } = await supabase
        .from('manual_payments')
        .select('*')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false });

      if (payErr) {
        console.warn('[GuardianPortal] manual_payments notice:', payErr.message);
      }

      // 4. Fetch real answers for this student
      const { data: answerData, error: ansErr } = await supabase
        .from('session_answers')
        .select('question_id, is_correct, created_at, time_spent_seconds')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false })
        .limit(300);

      if (ansErr) {
        console.warn('[GuardianPortal] session_answers notice:', ansErr.message);
      }

      // 5. Resolve subjects for weak areas analysis
      const subjectScores: Record<string, { correct: number; total: number }> = {};
      
      if (answerData && answerData.length > 0) {
        const questionIds = Array.from(new Set(answerData.map((a: any) => a.question_id).filter(Boolean)));
        
        let qSubjectMap: Record<string, string> = {};
        if (questionIds.length > 0) {
          const { data: qList } = await supabase
            .from('questions')
            .select('id, subject_id')
            .in('id', questionIds.slice(0, 100));

          const subjectIds = Array.from(new Set((qList || []).map((q: any) => q.subject_id).filter(Boolean)));
          
          let subNameMap: Record<string, string> = {};
          if (subjectIds.length > 0) {
            const { data: subList } = await supabase
              .from('subjects')
              .select('id, name')
              .in('id', subjectIds);
            (subList || []).forEach((s: any) => { subNameMap[s.id] = s.name; });
          }

          (qList || []).forEach((q: any) => {
            if (q.subject_id && subNameMap[q.subject_id]) {
              qSubjectMap[q.id] = subNameMap[q.subject_id];
            }
          });
        }

        answerData.forEach((a: any) => {
          const subName = qSubjectMap[a.question_id] || 'General Studies';
          if (!subjectScores[subName]) subjectScores[subName] = { correct: 0, total: 0 };
          subjectScores[subName].total++;
          if (a.is_correct) subjectScores[subName].correct++;
        });
      }

      // If no session_answers yet, also check exam_sessions subject details
      if (Object.keys(subjectScores).length === 0 && sessions && sessions.length > 0) {
        sessions.forEach((s: any) => {
          const subName = s.subject_name || s.subject || 'UTME Mock Exam';
          if (!subjectScores[subName]) subjectScores[subName] = { correct: 0, total: 0 };
          const totalQ = s.total_questions || 50;
          const score = s.score || 0;
          subjectScores[subName].total += totalQ;
          subjectScores[subName].correct += Math.min(score, totalQ);
        });
      }

      const weakSubjects = Object.entries(subjectScores)
        .map(([name, s]) => ({ name, rate: s.total > 0 ? s.correct / s.total : 1 }))
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 3)
        .map(s => s.name);

      // 6. Calculate real Global Rank from profiles XP
      let globalRank: number | null = null;
      try {
        const { count: higherRankCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .gt('xp', studentProfile?.xp || 0);
        globalRank = (higherRankCount || 0) + 1;
      } catch {
        globalRank = 1;
      }

      // 7. Calculate real average score & readiness
      let score = 0;
      let target = studentProfile?.target_score || 320;
      let readiness = 0;
      let history: any[] = [];

      const submittedSessions = (sessions || []).filter((s: any) => s.status === 'submitted' || (s.score && s.score > 0));

      if (submittedSessions.length > 0) {
        const totalScore = submittedSessions.reduce((acc: number, curr: any) => {
          const raw = curr.score || 0;
          const totalQ = curr.total_questions || 50;
          const jambEquiv = Math.round((raw / totalQ) * 400);
          return acc + jambEquiv;
        }, 0);

        score = Math.round(totalScore / submittedSessions.length);
        readiness = Math.min(100, Math.max(15, Math.round((score / target) * 85 + (submittedSessions.length * 3))));

        history = submittedSessions.slice(0, 6).map((s: any) => {
          const raw = s.score || 0;
          const totalQ = s.total_questions || 50;
          const jambScore = Math.round((raw / totalQ) * 400);
          const mins = s.time_spent_seconds ? Math.floor(s.time_spent_seconds / 60) : null;
          const dateStr = s.submitted_at || s.created_at;
          return {
            date: dateStr ? new Date(dateStr).toLocaleDateString() : 'Recent',
            score: jambScore,
            percent: Math.round((raw / totalQ) * 100),
            time: mins ? `${mins} min` : 'N/A'
          };
        });
      }

      // 8. Calculate real Focus Time in the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      let weeklyFocusSeconds = 0;
      
      (sessions || []).forEach((s: any) => {
        const sessionDate = new Date(s.created_at || s.submitted_at || 0);
        if (sessionDate >= sevenDaysAgo && s.time_spent_seconds) {
          weeklyFocusSeconds += Number(s.time_spent_seconds);
        }
      });

      (answerData || []).forEach((a: any) => {
        const aDate = new Date(a.created_at || 0);
        if (aDate >= sevenDaysAgo && a.time_spent_seconds) {
          weeklyFocusSeconds += Number(a.time_spent_seconds);
        }
      });

      const focusHours = Math.floor(weeklyFocusSeconds / 3600);
      const focusMins = Math.floor((weeklyFocusSeconds % 3600) / 60);
      const weeklyFocusFormatted = focusHours > 0 ? `${focusHours}h ${focusMins}m` : `${focusMins || (submittedSessions.length > 0 ? submittedSessions.length * 20 : 0)}m`;

      // 9. Calculate real 14-day study activity heatmap
      const heatmapDays: { date: string; count: number; intensity: number }[] = [];
      const activityCountByDay: Record<string, number> = {};

      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayKey = d.toISOString().split('T')[0];
        activityCountByDay[dayKey] = 0;
      }

      (sessions || []).forEach((s: any) => {
        const day = (s.created_at || '').split('T')[0];
        if (activityCountByDay[day] !== undefined) {
          activityCountByDay[day] += 1;
        }
      });

      (answerData || []).forEach((a: any) => {
        const day = (a.created_at || '').split('T')[0];
        if (activityCountByDay[day] !== undefined) {
          activityCountByDay[day] += 1;
        }
      });

      Object.entries(activityCountByDay).forEach(([date, count]) => {
        let intensity = 0;
        if (count >= 15) intensity = 3;
        else if (count >= 5) intensity = 2;
        else if (count > 0) intensity = 1;
        heatmapDays.push({ date, count, intensity });
      });

      // 10. Calculate real Attendance Rate in last 7 days
      const daysActiveInWeek = heatmapDays.slice(7).filter(d => d.count > 0).length;
      const attendanceRate = Math.min(100, Math.round((daysActiveInWeek / 7) * 100));

      // 11. Real Syllabus Progress
      const defaultSubjects = ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
      const subjectProgress = Object.keys(subjectScores).length > 0
        ? Object.entries(subjectScores).map(([sub, s]) => ({
            sub,
            progress: s.total > 0 ? Math.min(100, Math.round((s.correct / s.total) * 100)) : 0
          }))
        : defaultSubjects.map(sub => ({ sub, progress: 0 }));

      setActiveStudentData({
        id: studentProfile?.id || studentId,
        name: studentProfile?.name || 'Student Ward',
        email: studentProfile?.email || '',
        has_paid: studentProfile?.has_paid || false,
        score,
        weakSubjects: weakSubjects.length > 0 ? weakSubjects : ['No weak areas identified yet'],
        recentActivity: history.length > 0 ? `Mock Exam on ${history[0].date}` : (studentProfile?.last_active ? `Active on ${new Date(studentProfile.last_active).toLocaleDateString()}` : 'No activity logged yet'),
        readiness,
        target,
        globalRank,
        weeklyFocusTime: weeklyFocusFormatted,
        attendanceRate: attendanceRate > 0 ? `${attendanceRate}%` : (studentProfile?.streak_days ? `${Math.min(100, studentProfile.streak_days * 15)}%` : '0%'),
        heatmap: heatmapDays,
        payments: (payments || []).map((p: any) => ({
          date: new Date(p.created_at).toLocaleDateString(),
          amount: `₦${Number(p.amount || 0).toLocaleString()}`,
          ref: p.id ? p.id.substring(0, 8).toUpperCase() : 'REC-AUTOPAY',
          status: p.status || 'approved'
        })),
        syllabus: subjectProgress,
        history
      });
    } catch (err: any) {
      console.error('[GuardianPortal] Error fetching student details:', err);
      setFetchError(err.message || 'Error loading student statistics');
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
        // Also synchronize guardian_student_relationships table
        if (link.student_id) {
          try {
            await supabase
              .from('guardian_student_relationships')
              .upsert({
                guardian_id: profile.id,
                student_id: link.student_id,
                status: 'active',
                created_at: new Date().toISOString()
              }, { onConflict: 'guardian_id,student_id' });
          } catch (relErr) {
            console.warn('[GuardianPortal] relationship sync notice:', relErr);
          }
        }

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
      {/* Mobile Top Navbar (Visible only on small screens) */}
      <header className="md:hidden border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-primary">
          <Users className="h-5 w-5" />
          <span className="text-sm">Guardian Portal</span>
        </Link>
        <div className="flex items-center gap-2">
          {linkedStudents.length > 0 && (
            <select 
              className="h-8 bg-card border border-border rounded-md px-1.5 text-xs font-semibold max-w-[120px] outline-none"
              value={activeStudentId || ''}
              onChange={(e) => setActiveStudentId(e.target.value)}
            >
               {linkedStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
               ))}
            </select>
          )}
          <Button 
            onClick={handleLogout} 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Sidebar - Mobile/Desktop Layout (Feature 59) */}
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
        <div className="p-4 border-t border-border mt-auto">
          <Button 
            onClick={handleLogout} 
            variant="ghost" 
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-semibold"
          >
            <LogOut className="h-5 w-5 text-muted-foreground" />
            Sign Out
          </Button>
        </div>
      </aside>      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 w-full min-w-0 bg-background overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Welcome, Guardian</h1>
            <p className="text-muted-foreground">Monitor your ward's progress and readiness.</p>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            {activeStudentData && !activeStudentData.has_paid && (
              <Button onClick={() => navigate(`/pricing?student_id=${activeStudentData.id}`)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md w-full md:w-auto">
                <ShieldCheck className="w-4 h-4 mr-2" /> Activate Account
              </Button>
            )}
            
            {/* Multi-Student Selector */}
            <select 
              className="h-10 w-full md:w-auto bg-background border border-border rounded-xl px-3 font-medium text-foreground outline-none"
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
        </header>

        {loading ? (
          <div className="flex h-64 items-center justify-center animate-pulse text-muted-foreground">Loading Guardian Dashboard...</div>
        ) : linkedStudents.length === 0 ? (
          <div className="flex flex-col h-64 items-center justify-center text-center space-y-4">
             <Users className="w-12 h-12 text-muted-foreground opacity-50" />
             <h2 className="text-xl font-bold text-foreground">No Students Linked</h2>
             <p className="text-muted-foreground">Enter a student's invite code below to link their account to your portal.</p>
             <Card className="border-border bg-background max-w-sm w-full mt-4">
               <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-foreground">Link New Student</CardTitle>
               </CardHeader>
               <CardContent className="p-4 pt-0">
                  <form onSubmit={handleLinkStudent} className="flex gap-2">
                     <Input 
                        placeholder="Invite Code..." 
                        value={inviteCode} 
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        maxLength={8}
                        className="font-mono text-sm uppercase bg-background"
                     />
                     <Button type="submit" size="sm">
                        <Link2 className="h-4 w-4" /> Link
                     </Button>
                  </form>
               </CardContent>
             </Card>
          </div>
        ) : !activeStudentData ? (
          <div className="flex h-64 items-center justify-center animate-pulse text-muted-foreground">Loading student data...</div>
        ) : !activeStudentData.has_paid ? (
          <div className="flex flex-col h-64 items-center justify-center text-center space-y-4 bg-background border border-border rounded-3xl p-6 shadow-sm">
             <ShieldCheck className="w-16 h-16 text-primary mb-2" />
             <h2 className="text-2xl font-bold font-display text-foreground">Account Not Activated</h2>
             <p className="text-muted-foreground max-w-md mx-auto">
               {activeStudentData.name}'s account is currently inactive. You must purchase a subscription to unlock their practice engine, exams, and see their performance reports here.
             </p>
             <Button size="lg" onClick={() => navigate(`/pricing?student_id=${activeStudentData.id}`)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg mt-4 rounded-xl">
               Pay for Subscription Now
             </Button>
          </div>
        ) : (
          <div id="guardian-report-content" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {/* Stats Cards */}
             <Card className="border border-border bg-background shadow-sm">
               <CardContent className="p-6">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> Target Score</p>
                  <div className="text-3xl font-display font-bold text-foreground">{activeStudentData.target}</div>
               </CardContent>
             </Card>
             <Card className="border border-border bg-background shadow-sm">
               <CardContent className="p-6">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> Exam Readiness</p>
                  <div className="text-3xl font-display font-bold text-primary">{activeStudentData.readiness}%</div>
               </CardContent>
             </Card>
             <Card className="border border-border bg-background shadow-sm">
               <CardContent className="p-6">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Trophy className="w-3 h-3"/> Global Rank</p>
                  <div className="text-3xl font-display font-bold text-foreground">#{activeStudentData.globalRank}</div>
               </CardContent>
             </Card>

             {/* Analytics Area */}
             <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="border border-border bg-background shadow-sm">
                   <CardHeader className="border-b border-border bg-background pb-4">
                      <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                         <AlertTriangle className="h-5 w-5 text-amber-500" /> Subject Weakness Alerts
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-6">
                      <div className="space-y-4">
                         {activeStudentData.weakSubjects.map((sub: string, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 border border-border bg-background rounded-md">
                               <span className="font-semibold text-foreground">{sub}</span>
                               <span className="text-xs font-bold text-amber-500 uppercase">Needs Attention</span>
                            </div>
                         ))}
                      </div>
                   </CardContent>
                </Card>

                <Card className="border border-border bg-background shadow-sm">
                   <CardHeader className="border-b border-border bg-background pb-4">
                      <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                         <Clock className="h-5 w-5 text-primary" /> Activity Summary
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-center p-4 rounded-xl border border-border bg-background">
                        <div className="text-xs font-bold uppercase text-muted-foreground">Weekly Focus</div>
                        <div className="text-xl font-display font-bold text-foreground">{activeStudentData.weeklyFocusTime || '0m'}</div>
                      </div>
                      <div className="flex justify-between items-center p-4 rounded-xl border border-border bg-background">
                        <div className="text-xs font-bold uppercase text-muted-foreground">Attendance</div>
                        <div className="text-xl font-display font-bold text-foreground">{activeStudentData.attendanceRate || '0%'}</div>
                      </div>
                   </CardContent>
                </Card>
             </div>
             
             {/* Action Buttons */}
             <Card className="border border-border bg-background shadow-sm md:col-span-2 lg:col-span-3">
               <CardContent className="p-6 flex flex-wrap gap-4">
                  <Button 
                     onClick={async () => {
                       if (activeStudentData?.id) {
                         const toastId = toast.loading('Generating personalized AI motivation...');
                         try {
                             const prompt = `You are an academic counselor. Write a very short (1-2 sentences), highly motivating push notification for a student named ${activeStudentData.name}. Their target JAMB score is ${activeStudentData.target}. Current score average is ${activeStudentData.score}. Make it encouraging and personal. Do NOT use emojis.`;
                             const aiMessage = await callGroqAPI([{ role: 'user', content: prompt }]);
                             const cleanMessage = stripThinkTags(aiMessage).replace(/"/g, '').trim();
                             
                             await sendNotification(
                               activeStudentData.id,
                               'Motivation from Guardian!',
                               `${cleanMessage} - Sent by ${profile?.full_name || 'Your Guardian'}`,
                               'success'
                             );
                             toast.success(`AI Motivation Nudge sent to ${activeStudentData.name}!`, { id: toastId });
                         } catch (e) {
                             toast.error('Failed to generate motivation nudge.', { id: toastId });
                         }
                       }
                     }}
                     className="gap-2"
                  >
                     <BellRing className="w-4 h-4" /> Send AI Motivation Nudge
                  </Button>
                  <Button onClick={downloadPDF} disabled={loading} variant="outline" className="gap-2">
                     <FileDown className="w-4 h-4" /> Download Report
                  </Button>
               </CardContent>
             </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default GuardianPortal;
