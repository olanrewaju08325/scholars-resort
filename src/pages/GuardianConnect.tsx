import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const GuardianConnect = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading');
  const [studentName, setStudentName] = useState<string>('');

  useEffect(() => {
    if (code) {
      localStorage.setItem('pending_guardian_code', code);
    }
  }, [code]);

  useEffect(() => {
    if (authLoading) return;

    const savedCode = code || localStorage.getItem('pending_guardian_code');
    if (!savedCode) {
      setStatus('invalid');
      return;
    }

    const processLink = async () => {
      try {
        const { data: linkData, error: linkError } = await supabase
          .from('guardian_links')
          .select('*, profiles!student_id(full_name)')
          .eq('invitation_code', savedCode.toUpperCase())
          .maybeSingle();

        if (linkError || !linkData) {
          setStatus('invalid');
          localStorage.removeItem('pending_guardian_code');
          return;
        }

        if (new Date(linkData.expires_at) < new Date() || linkData.status !== 'pending') {
          setStatus('invalid');
          localStorage.removeItem('pending_guardian_code');
          return;
        }

        const studentProfile = Array.isArray(linkData.profiles) ? linkData.profiles[0] : linkData.profiles;
        setStudentName(studentProfile?.full_name || 'a student');

        if (!profile) {
          setStatus('valid'); // Waiting for login
          return;
        }

        // Auto-link if logged in
        const { error: updateError } = await supabase
          .from('guardian_links')
          .update({
            guardian_id: profile.id,
            status: 'active'
          })
          .eq('id', linkData.id);

        if (updateError) throw updateError;

        // Auto-send guardian activation email
        if (profile?.email) {
          supabase.functions.invoke('communication-center', {
            body: {
              to: profile.email,
              templateName: 'guardian_linked',
              payload: { studentName, guardianName: profile.full_name }
            }
          }).catch(() => {}); // fire-and-forget, never block the UI
        }

        setStatus('success');
        localStorage.removeItem('pending_guardian_code');
        toast.success("Guardian linked successfully!");
        setTimeout(() => navigate('/dashboard'), 2000);
      } catch (e) {
        setStatus('invalid');
      }
    };

    processLink();
  }, [profile, authLoading, code, navigate]);

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-slate-400">Verifying invitation link...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-2">Invalid or Expired Link</h1>
        <p className="text-slate-400 max-w-md mb-8">This guardian invitation link is no longer valid. Please ask the student to generate a new one from their dashboard.</p>
        <Button onClick={() => navigate('/')}>Return Home</Button>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Users className="w-16 h-16 text-green-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-2">Connection Successful!</h1>
        <p className="text-slate-400 max-w-md mb-8">You are now linked with {studentName}. Redirecting to your dashboard...</p>
      </div>
    );
  }

  if (status === 'valid' && !profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Users className="w-16 h-16 text-blue-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-2">Connect with {studentName}</h1>
        <p className="text-slate-400 max-w-md mb-8">You need to log in or create a Guardian account to accept this invitation.</p>
        <div className="flex gap-4">
          <Button onClick={() => navigate('/login')}>Log In</Button>
          <Button variant="outline" onClick={() => navigate('/signup')}>Create Account</Button>
        </div>
      </div>
    );
  }

  return null;
};

export default GuardianConnect;
