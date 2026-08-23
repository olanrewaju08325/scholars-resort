import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Shield, Lock, Mail, Eye, EyeOff, User, Phone, Users, Sparkles, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { sendWelcomeEmail } from '@/services/emailService';

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const inviteCode = searchParams.get('invite');

  const [accountRole, setAccountRole] = useState<'student' | 'guardian'>(
    roleParam === 'guardian' || inviteCode ? 'guardian' : 'student'
  );

  useEffect(() => {
    if (inviteCode) {
      localStorage.setItem('pending_guardian_code', inviteCode.trim().toUpperCase());
      setAccountRole('guardian');
    }
  }, [inviteCode]);

  useEffect(() => {
    if (roleParam === 'guardian') {
      setAccountRole('guardian');
    }
  }, [roleParam]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone_number: phone.trim(),
            role: accountRole,
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('Failed to fetch')) {
          setError("Connection failed. If you hosted on Netlify, please ensure 'VITE_SUPABASE_URL' and 'VITE_SUPABASE_ANON_KEY' environment variables are set in your Netlify Site Settings.");
        } else {
          setError(signUpError.message);
        }
      } else {
        // Automatically dispatch welcome email via SMTP in background
        sendWelcomeEmail(email.trim(), fullName.trim(), accountRole).catch(e => console.warn('Welcome email error:', e));

        // If session was returned right away
        if (data.session) {
          const pendingCode = localStorage.getItem('pending_guardian_code');
          if (accountRole === 'guardian' && pendingCode) {
            navigate(`/guardian-connect?code=${pendingCode}`);
          } else if (accountRole === 'guardian') {
            navigate('/guardian');
          } else {
            navigate('/onboarding');
          }
        } else {
          const pendingCode = localStorage.getItem('pending_guardian_code');
          const redirectParam = pendingCode ? `&redirect=${encodeURIComponent(`/guardian-connect?code=${pendingCode}`)}` : '';
          navigate(`/login?verify=true${redirectParam}`);
        }
      }
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch')) {
        setError("Network error: Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify Site Settings.");
      } else {
        setError(err.message || "Failed to create account. Please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Left Panel (Hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-center flex-1 p-12 border-r border-border bg-card/30">
        <Link to="/" className="flex items-center gap-2 text-2xl font-bold font-display mb-12">
          <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-8 w-8 rounded-md object-cover" />
          <span>Scholars Resort</span>
        </Link>
        
        <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary mb-4 w-max">
          ⭐ {accountRole === 'guardian' ? 'Parent & Guardian Portal' : 'Join Thousands of Future Scholars'}
        </div>
        
        <h1 className="text-5xl font-display font-bold leading-tight mb-6">
          {accountRole === 'guardian' ? (
            <>
              Monitor & Guide<br/>
              <span className="text-primary">Academic Excellence</span><br/>
              Every Day.
            </>
          ) : (
            <>
              Your Journey to<br/>
              <span className="text-primary">JAMB Success</span><br/>
              Starts Here!
            </>
          )}
        </h1>
        <p className="text-lg text-muted-foreground mb-12 max-w-md">
          {accountRole === 'guardian'
            ? 'Track real-time CBT test results, view weekly subject mastery reports, and keep your child motivated with transparent progress insights.'
            : 'Create your account and get access to thousands of practice questions, CBT exams, AI tutor, and personalized performance tracking.'}
        </p>

        <div className="mt-auto pt-12 border-t border-border flex gap-4 text-sm font-medium text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="text-green-500 h-4 w-4" /> 100% Secure
          </div>
          <div className="flex items-center gap-2">
            <Lock className="text-slate-500 h-4 w-4" /> Your data is protected
          </div>
        </div>
      </div>

      {/* Right Panel (Signup Form) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-md my-auto py-8">
          <Card className="border-border shadow-lg">
            <CardHeader className="text-center space-y-2 mb-1">
              <CardTitle className="text-2xl font-display">Create Your Account</CardTitle>
              <CardDescription>
                {accountRole === 'guardian'
                  ? 'Sign up to monitor your child’s academic progress and CBT scores.'
                  : 'Join Scholars Resort and start preparing for JAMB the smart way.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Role Selection Switcher */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Select Account Type</Label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setAccountRole('student')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      accountRole === 'student'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountRole('guardian')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      accountRole === 'guardian'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Parent / Guardian</span>
                  </button>
                </div>
              </div>

              {inviteCode && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-2 text-xs text-primary font-medium">
                  <Sparkles className="w-4 h-4 shrink-0 text-primary" />
                  <span>Student invitation code applied: <strong>{inviteCode.toUpperCase()}</strong></span>
                </div>
              )}

              {error && (
                <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{accountRole === 'guardian' ? 'Parent / Guardian Full Name' : 'Student Full Name'}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="fullName"
                      placeholder={accountRole === 'guardian' ? 'e.g. Mr. Adebayo Ogunlesi' : 'e.g. John Doe'}
                      className="pl-10"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="email"
                      type="email" 
                      placeholder="Enter your email" 
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="phone"
                      type="tel" 
                      placeholder="080 1234 5678" 
                      className="pl-10"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="password"
                        type={showPassword ? "text" : "password"} 
                        placeholder="Password" 
                        className="pl-10 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"} 
                        placeholder="Confirm" 
                        className="pl-10"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md h-11 mt-2" 
                  disabled={loading}
                >
                  {loading ? "Creating Account..." : accountRole === 'guardian' ? "Create Guardian Account" : "Create Student Account"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 text-center border-t border-border pt-4">
              <div className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-semibold hover:underline">
                  Log in here
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Signup;
