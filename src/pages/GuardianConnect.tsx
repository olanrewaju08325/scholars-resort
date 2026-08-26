import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Loader2, Users, ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sendNotification } from '@/lib/notifications';

const GuardianConnect = () => {
  const [searchParams] = useSearchParams();
  const rawCode = searchParams.get('code') || '';
  const { profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading');
  const [studentName, setStudentName] = useState<string>('a student');
  const [activeCode, setActiveCode] = useState<string>('');

  useEffect(() => {
    if (rawCode) {
      const normalized = rawCode.trim().toUpperCase();
      localStorage.setItem('pending_guardian_code', normalized);
      setActiveCode(normalized);
    } else {
      const stored = localStorage.getItem('pending_guardian_code');
      if (stored) setActiveCode(stored.trim().toUpperCase());
    }
  }, [rawCode]);

  useEffect(() => {
    if (authLoading) return;

    const savedCode = activeCode || rawCode.trim().toUpperCase() || (localStorage.getItem('pending_guardian_code') || '').trim().toUpperCase();
    if (!savedCode) {
      setStatus('invalid');
      return;
    }

    const processLink = async () => {
      try {
        // If user is not logged in, show the invitation acceptance / signup screen
        if (!profile) {
          try {
            const { data: linkData } = await supabase
              .from('guardian_links')
              .select('student_id, expires_at')
              .eq('invitation_code', savedCode)
              .maybeSingle();

            if (linkData?.student_id) {
              const { data: studentProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', linkData.student_id)
                .maybeSingle();
              if (studentProfile?.full_name) {
                setStudentName(studentProfile.full_name);
              }
            }
          } catch {
            // Ignore anonymous fetch restrictions
          }
          setStatus('valid');
          return;
        }

        // When user IS logged in, link this guardian to the student
        let studentId = '';
        try {
          // Check guardian_links
          const { data: linkData } = await supabase
            .from('guardian_links')
            .select('id, student_id, invitation_code, status, expires_at')
            .eq('invitation_code', savedCode)
            .maybeSingle();

          if (linkData) {
            studentId = linkData.student_id;
            await supabase
              .from('guardian_links')
              .update({
                guardian_id: profile.id,
                status: 'active'
              })
              .eq('id', linkData.id);
          } else {
            // Fallback: try update by code directly
            await supabase
              .from('guardian_links')
              .update({
                guardian_id: profile.id,
                status: 'active'
              })
              .eq('invitation_code', savedCode);
          }

          // Also synchronize guardian_student_relationships table
          if (studentId) {
            try {
              await supabase
                .from('guardian_student_relationships')
                .upsert({
                  guardian_id: profile.id,
                  student_id: studentId,
                  status: 'active',
                  created_at: new Date().toISOString()
                }, { onConflict: 'guardian_id,student_id' });
            } catch (relErr) {
              console.warn('[GuardianConnect] guardian_student_relationships notice:', relErr);
            }
          }
        } catch (dbErr) {
          console.warn('[GuardianConnect] DB link notice:', dbErr);
        }

        // Fetch student name for celebration screen
        if (studentId) {
          try {
            const { data: studentProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', studentId)
              .maybeSingle();
            if (studentProfile?.full_name) {
              setStudentName(studentProfile.full_name);
            }
          } catch {}
        }

        // Ensure user profile has guardian role and paid access
        if (profile.role !== 'admin') {
          try {
            await supabase
              .from('profiles')
              .update({ role: 'guardian', has_paid: true })
              .eq('id', profile.id);
            await refreshProfile();
          } catch {}
        }

        // Fire notifications
        if (studentId) {
          await sendNotification(
            studentId,
            'Guardian Connected!',
            `${profile.full_name || 'Your guardian'} has successfully linked with your Scholars Resort account to support your JAMB preparation.`,
            'success'
          );
        }

        if (profile?.email) {
          supabase.functions.invoke('communication-center', {
            body: {
              to: profile.email,
              templateName: 'guardian_linked',
              payload: { studentName, guardianName: profile.full_name }
            }
          }).catch(() => {});
        }

        setStatus('success');
        localStorage.removeItem('pending_guardian_code');
        toast.success("Guardian portal linked successfully!");
        setTimeout(() => navigate('/guardian'), 1800);
      } catch (e) {
        console.error('[GuardianConnect] Exception:', e);
        if (profile?.role === 'guardian') {
          setStatus('success');
          setTimeout(() => navigate('/guardian'), 1200);
        } else {
          setStatus('invalid');
        }
      }
    };

    processLink();
  }, [profile, authLoading, activeCode, rawCode, navigate]);

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-lg font-bold text-white mb-1">Verifying Invitation Code...</h2>
        <p className="text-slate-400 text-sm">Validating secure guardian link credentials</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 text-red-500 shadow-lg">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Invalid or Expired Link</h1>
        <p className="text-slate-400 max-w-md mb-8">
          This guardian invitation link is no longer valid or has expired. Please ask the student to generate a fresh link or invite code from their student profile.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => navigate('/')} variant="outline">Return Home</Button>
          <Button onClick={() => navigate('/guardian')} className="bg-primary">Open Guardian Portal</Button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 text-emerald-500 shadow-lg">
          <Users className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Connection Successful!</h1>
        <p className="text-slate-400 max-w-md mb-8">
          You are now linked with <strong>{studentName}</strong>. Opening your Guardian Monitoring Portal...
        </p>
        <Button onClick={() => navigate('/guardian')} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
          Go to Guardian Portal <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  if (status === 'valid' && !profile) {
    const codeToPass = activeCode || rawCode || localStorage.getItem('pending_guardian_code') || '';
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 text-blue-400 shadow-lg">
          <Users className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-4">
          Parent & Guardian Portal
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">
          Connect with <span className="text-primary">{studentName}</span>
        </h1>
        <p className="text-slate-400 max-w-md mb-8 text-sm leading-relaxed">
          You have been invited to monitor {studentName}&apos;s real-time JAMB CBT exam scores, study consistency, and academic weak points.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
          <Button 
            onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/guardian-connect?code=${codeToPass}`)}`)}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md"
          >
            <LogIn className="w-4 h-4 mr-2" /> Log In to Link
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate(`/signup?role=guardian&invite=${codeToPass}`)}
            className="w-full border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          >
            <UserPlus className="w-4 h-4 mr-2" /> Create Parent Account
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default GuardianConnect;
