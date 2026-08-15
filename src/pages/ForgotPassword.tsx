import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      setSuccess(true);
      toast.success('Password reset email sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold font-display tracking-tight text-primary">Scholars Resort</span>
      </Link>
      
      <div className="w-full max-w-md bg-card border border-border p-8 rounded-2xl shadow-premium">
        {!success ? (
          <>
            <h2 className="text-2xl font-bold mb-2 font-display">Reset Password</h2>
            <p className="text-muted-foreground mb-6 text-sm">Enter your email address and we'll send you a link to securely reset your password.</p>
            
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none" 
                    placeholder="student@example.com"
                    required
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full rounded-xl shadow-premium h-11" disabled={loading}>
                {loading ? 'Sending Link...' : 'Send Reset Link'}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2 font-display">Check Your Email</h2>
            <p className="text-muted-foreground mb-6 text-sm">We've sent a secure password reset link to <strong>{email}</strong>.</p>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setSuccess(false)}>
              Try another email
            </Button>
          </div>
        )}
        
        <div className="mt-8 pt-6 border-t border-border text-center">
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

// Temporary import for the logo
import { BookOpen } from 'lucide-react';
