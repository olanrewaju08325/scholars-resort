import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Shield, Lock, Mail, Eye, EyeOff, Target, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const isMasterAdmin = cleanEmail === 'olanrewajuhamilot@gmail.com' || cleanEmail === 'admitwise2@gmail.com';

    // Strict Maintenance Mode Check from Supabase DB settings
    try {
      const { data: adminData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'maintenance_mode')
        .maybeSingle();

      const isMaint = adminData?.setting_value?.enabled;
      if (isMaint && !isMasterAdmin) {
        // Also check if profile is admin
        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('role')
          .eq('email', cleanEmail)
          .maybeSingle();
        
        if (profileCheck?.role !== 'admin' && profileCheck?.role !== 'superadmin') {
          setError('Platform is currently under scheduled maintenance. Non-master administrative accounts are restricted from logging in.');
          setLoading(false);
          return;
        }
      }
    } catch (mErr) {
      console.warn('Maintenance pre-check notice:', mErr);
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      const pendingCode = localStorage.getItem('pending_guardian_code');
      if (pendingCode) {
        navigate(`/guardian-connect?code=${pendingCode}`);
      } else {
        // Support ?from= redirect — used by Pricing page when user is not logged in
        const fromPath = searchParams.get('from');
        navigate(fromPath || '/dashboard');
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
        
        <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary mb-4 w-max shadow-sm border border-primary/20">
          Welcome Back
        </div>
        
        <h1 className="text-5xl font-display font-bold leading-tight mb-6">
          Welcome Back,<br/>
          <span className="text-primary">Future Achiever!</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-12 max-w-md">
          Login to continue your journey to JAMB success. Learn smart, practice more and secure quick admissions.
        </p>

        <div className="flex flex-col gap-8">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Target className="text-primary h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-lg">Continue Your Progress</h4>
              <p className="text-muted-foreground text-sm">Pick up where you stopped and keep improving.</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <Activity className="text-green-500 h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-lg">Track Your Performance</h4>
              <p className="text-muted-foreground text-sm">Monitor your scores and strengthen your weak topics.</p>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-12 border-t border-border flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="text-green-500 h-5 w-5" />
            <span>100% Secure. Your data is safe.</span>
          </div>
        </div>
      </div>

      {/* Right Panel (Login Form) */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-md">
          <Card className="border-border shadow-lg">
            <CardHeader className="text-center space-y-2 mb-4">
              <CardTitle className="text-2xl font-display">Login to Your Account</CardTitle>
              <CardDescription>Enter your details to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="bg-destructive/15 text-destructive p-3 rounded-md mb-6 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
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
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="password"
                      type={showPassword ? "text" : "password"} 
                      placeholder="Enter your password" 
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
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

                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember" />
                    <Label htmlFor="remember" className="font-normal cursor-pointer">Remember me</Label>
                  </div>
                  <Link to="/forgot-password" className="font-medium text-primary hover:underline">Forgot Password?</Link>
                </div>

                <Button type="submit" className="w-full text-lg h-12 font-bold" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login \u2192'}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <p className="text-center w-full text-sm text-muted-foreground">
                Don't have an account? <Link to="/signup" className="font-semibold text-primary hover:underline">Create Account</Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
