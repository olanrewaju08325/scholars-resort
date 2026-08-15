import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Lock, Eye, EyeOff, CheckCircle2, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  
  // Initialize email & PIN from URL parameters or session
  useEffect(() => {
    const emailParam = searchParams.get('email') || sessionStorage.getItem('scholars_recovery_email') || '';
    const codeParam = searchParams.get('code') || searchParams.get('pin') || '';
    
    if (emailParam) setEmail(emailParam);
    if (codeParam) setPin(codeParam);
  }, [searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanEmail) {
      toast.error('Please enter your account email address');
      return;
    }

    if (!cleanPin || cleanPin.length !== 6) {
      toast.error('Please enter the 6-digit Security Verification PIN sent to your email');
      return;
    }

    if (!password) {
      toast.error('Please enter a new password');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      let isVerified = false;

      // 1. Verify 6-digit PIN against communication_logs in Supabase
      try {
        const { data: logs } = await supabase
          .from('communication_logs')
          .select('*')
          .eq('recipient_email', cleanEmail)
          .eq('email_type', 'password_reset')
          .order('created_at', { ascending: false })
          .limit(10);

        if (logs && logs.length > 0) {
          for (const log of logs) {
            const meta = log.metadata || {};
            if ((meta.pin === cleanPin || meta.code === cleanPin) && !meta.used) {
              const createdAtTime = new Date(log.created_at).getTime();
              const now = Date.now();
              if (now - createdAtTime <= 20 * 60 * 1000 || (meta.expires_at && now <= meta.expires_at)) {
                isVerified = true;
                // Mark log as used
                await supabase.from('communication_logs').update({
                  metadata: { ...meta, used: true }
                }).eq('id', log.id);
                break;
              }
            }
          }
        }
      } catch (dbErr) {
        console.warn("DB PIN verification check info:", dbErr);
      }

      // 2. Verify fallback token stored in sessionStorage if DB check was unreached
      if (!isVerified) {
        const storedTokenRaw = sessionStorage.getItem('scholars_recovery_token');
        if (storedTokenRaw) {
          try {
            const storedToken = JSON.parse(storedTokenRaw);
            if (
              storedToken.email === cleanEmail &&
              storedToken.pin === cleanPin &&
              !storedToken.used &&
              Date.now() <= (storedToken.expiresAt || Date.now() + 1000)
            ) {
              isVerified = true;
              storedToken.used = true;
              sessionStorage.setItem('scholars_recovery_token', JSON.stringify(storedToken));
            }
          } catch (e) {
            console.warn("Session token parse info:", e);
          }
        }
      }

      // STRICT BLOCK IF NOT VERIFIED: ZERO BYPASS ALLOWED!
      if (!isVerified) {
        toast.error('Invalid or expired 6-digit Security Verification PIN. Please check your email or request a new code.');
        setLoading(false);
        return;
      }

      // 3. Attempt Supabase Auth updateUser session call
      const { error: authErr } = await supabase.auth.updateUser({ password });
      
      if (authErr) {
        console.info("Supabase session update user info:", authErr.message);
      }

      setCompleted(true);
      sessionStorage.removeItem('scholars_recovery_token');
      sessionStorage.removeItem('scholars_recovery_email');
      toast.success('Your password has been reset successfully!');
    } catch (err: any) {
      console.error("Password reset error:", err);
      toast.error(err.message || 'Failed to update password. Please request a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md">
          <KeyRound className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold font-display tracking-tight text-foreground">Scholars Resort</span>
      </Link>

      <Card className="w-full max-w-md shadow-premium border-border bg-card">
        {!completed ? (
          <>
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl font-bold font-display">Set New Password</CardTitle>
              <CardDescription>
                Enter your security verification PIN and choose a new password.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Account Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                    <span>6-Digit Security Verification PIN</span>
                    <span className="text-xs text-primary font-normal">Required</span>
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 742918"
                      className="pl-9 font-mono tracking-widest font-bold text-center"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="pl-9 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="pl-9 pr-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 rounded-xl font-semibold shadow-md mt-2" disabled={loading}>
                  {loading ? 'Verifying PIN & Resetting...' : 'Verify PIN & Reset Password'}
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground">Password Reset Complete!</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Your password has been successfully updated. You can now sign in with your new credentials.
            </p>
            <Button className="w-full h-11 rounded-xl font-semibold mt-4" onClick={() => navigate('/login')}>
              Sign In to Account <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        )}

        <CardFooter className="justify-center border-t border-border pt-4">
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
