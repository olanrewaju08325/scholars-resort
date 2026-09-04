import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkRecoverySession = async () => {
      try {
        // 1. Check if Supabase already has an active session from recovery link
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('[ResetPassword] Session check warning:', error.message);
        }

        if (session && isMounted) {
          setHasValidSession(true);
          setUserEmail(session.user?.email || null);
          setSessionChecking(false);
          return;
        }

        // 2. Check if recovery token is present in hash (#access_token=... or ?code=...)
        const hash = window.location.hash;
        if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
          // Supabase JS will parse this hash in auth state listener
          setHasValidSession(true);
          setSessionChecking(false);
          return;
        }

        const codeParam = searchParams.get('code') || searchParams.get('token_hash');
        if (codeParam && isMounted) {
          setHasValidSession(true);
          setSessionChecking(false);
          return;
        }

        // If no recovery session found after 1.5s delay
        setTimeout(() => {
          if (isMounted) {
            setSessionChecking(false);
          }
        }, 1500);
      } catch (err) {
        console.warn('[ResetPassword] Initialization error:', err);
        if (isMounted) setSessionChecking(false);
      }
    };

    // Listen for PASSWORD_RECOVERY auth event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasValidSession(true);
        if (session?.user?.email) setUserEmail(session.user.email);
        setSessionChecking(false);
      }
    });

    checkRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password) {
      toast.error('Please enter your new password');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      setErrorMessage('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        // Log password change in activity logs
        try {
          await supabase.from('activity_logs').insert({
            user_id: data.user.id,
            activity_type: 'password_reset',
            action: `Password reset updated for ${data.user.email || 'user'}`,
            metadata: { details: 'Account password updated via authenticated recovery session' },
            created_at: new Date().toISOString()
          });
        } catch (_) {}
      }

      setIsCompleted(true);
      toast.success('Your password has been successfully updated!');
    } catch (err: any) {
      console.error('[ResetPassword] Update error:', err);
      const msg = err.message || 'Failed to update password. Please request a new reset link.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-card border border-border p-6 rounded-2xl shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <RotateCw className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Verifying Recovery Link...</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Please wait while we validate your security token.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
          <KeyRound className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold font-display tracking-tight text-foreground">Scholars Resort</span>
      </Link>

      <div className="w-full max-w-md bg-card border border-border p-8 rounded-2xl shadow-xl space-y-6">
        
        {/* COMPLETED SUCCESS STATE */}
        {isCompleted ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-in zoom-in-90">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground">Password Reset Successful!</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your password has been changed securely. You can now use your new password to sign in.
            </p>

            <Button
              className="w-full font-semibold h-11 rounded-xl shadow-md mt-4"
              onClick={() => navigate('/login')}
            >
              Sign In Now <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        ) : hasValidSession ? (
          /* ACTIVE RECOVERY FORM */
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold font-display text-foreground">Set New Password</h2>
              <p className="text-muted-foreground text-xs mt-1">
                {userEmail ? (
                  <>Setting new password for <strong className="text-foreground">{userEmail}</strong></>
                ) : (
                  'Enter a strong, secure password for your account below.'
                )}
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-start gap-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-sm"
                    placeholder="Enter new password (min. 6 chars)"
                    required
                    minLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-sm"
                    placeholder="Re-type new password"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl shadow-md h-11 font-semibold text-sm mt-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4 animate-spin" /> Updating Password...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Update Password
                  </span>
                )}
              </Button>
            </form>
          </div>
        ) : (
          /* NO ACTIVE RECOVERY LINK STATE */
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold font-display text-foreground">Password Reset Session Expired</h2>
            <p className="text-muted-foreground text-xs leading-relaxed">
              No active password recovery session was detected, or the reset link has already been used. Please request a new link or 6-digit OTP code.
            </p>

            <Button
              className="w-full font-semibold h-11 rounded-xl shadow-md mt-2"
              onClick={() => navigate('/forgot-password')}
            >
              Request New Reset Link / OTP <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="pt-4 border-t border-border text-center">
          <Link
            to="/login"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}


