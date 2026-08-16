import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Check, ShieldCheck, CloudUpload, Loader2, Banknote,
  LogIn, UserPlus, CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const Pricing = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<'lifetime' | 'yearly'>('lifetime');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('student_id');
  const [studentName, setStudentName] = useState<string | null>(null);

  // Fetch guardian's target student name (if paying for someone else)
  useEffect(() => {
    if (studentId) {
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', studentId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setStudentName(data.full_name);
        });
    }
  }, [studentId]);

  // Auto-redirect paid users away from pricing page
  useEffect(() => {
    if (profile?.has_paid && profile.role !== 'admin') {
      toast.success('Payment verified! Welcome to Scholars Resort.');
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  const plans = {
    lifetime: { name: 'One-Time Full Access', price: 3000, desc: 'Lifetime Full Exam Access', badge: 'Single ₦3,000 Payment' },
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ── 1. Guard: auth must be fully resolved ──────────────────────────────
    if (authLoading) {
      toast.info('Please wait while we verify your session...');
      return;
    }

    // ── 2. Guard: must be logged in ────────────────────────────────────────
    if (!user) {
      toast.error('Please log in first to upload your receipt.');
      // Navigate to login with a redirect back to pricing (preserving student_id)
      const returnPath = studentId ? `/pricing?student_id=${studentId}` : '/pricing';
      navigate(`/login?from=${encodeURIComponent(returnPath)}`);
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // ── 3. Validate file ────────────────────────────────────────────────────
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Max size is 5MB.');
      return;
    }

    setIsUploading(true);

    try {
      // ── 4. Upload to Supabase Storage ─────────────────────────────────────
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('materials').getPublicUrl(filePath);

      // ── 5. Ensure profile row exists to prevent foreign key constraint errors ──
      const targetUserId = studentId || user.id;
      const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', targetUserId).maybeSingle();
      if (!existingProfile) {
        await supabase.from('profiles').upsert({
          id: targetUserId,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Scholar Student',
          email: user.email || '',
          role: 'student',
          has_paid: false
        });
      }

      // ── 6. Insert payment record ──────────────────────────────────────────
      const { error: dbError } = await supabase.from('manual_payments').insert({
        user_id: targetUserId,
        amount: plans[selectedPlan].price,
        proof_image_url: urlData.publicUrl,
        status: 'pending',
        plan_id: selectedPlan,
      });

      if (dbError) throw new Error(`Failed to save payment record: ${dbError.message}`);

      // ── 6. Notify admin & student via email API route ─────────────────────
      fetch('/api/payment-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Scholar Student',
          amount: plans[selectedPlan].price,
          proofUrl: urlData.publicUrl,
          planId: selectedPlan,
        }),
      }).catch(err => console.warn('Payment email dispatch warning:', err));

      setUploadSuccess(true);
      toast.success('Receipt uploaded! Your account will be activated within 24 hours.', {
        duration: 8000,
      });
    } catch (err: any) {
      toast.error(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Determine auth state for UI decisions
  const isLoggedIn = !!user;
  const isAuthReady = !authLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 items-start">

        {/* Left: Features list */}
        <div className="space-y-6 lg:sticky lg:top-8">
          <Link to="/" className="text-primary font-bold text-xl inline-flex items-center gap-2 mb-4 hover:underline">
            ← Back
          </Link>
          <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight">
            {studentName ? `Activate ${studentName}'s Account.` : 'Unlock Your Full Potential.'}
          </h1>
          <p className="text-lg text-muted-foreground">
            {studentName
              ? `Get ${studentName} full access to the most advanced JAMB CBT prep platform in Nigeria.`
              : 'Get access to the most advanced JAMB CBT prep platform in Nigeria. No free tiers, just serious preparation.'}
          </p>
          <ul className="space-y-4 mt-8">
            {[
              'Unlimited standard CBT exams',
              'Unlimited practice questions',
              'Advanced weakness targeting',
              'Performance analytics',
              'Access to weekly mock tournaments',
              'Offline app capability',
              'AI Tutor & Study Planner',
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-lg font-medium">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <Check className="text-green-500 w-5 h-5" />
                </div>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {/* Auth status banner */}
          {isAuthReady && !isLoggedIn && (
            <div className="mt-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
              <LogIn className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-400 text-sm">Login required to pay</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You need an account to upload your receipt.{' '}
                  <Link to="/login?from=/pricing" className="text-primary font-semibold hover:underline">Log in</Link>
                  {' '}or{' '}
                  <Link to="/signup" className="text-primary font-semibold hover:underline">create one for free</Link>.
                </p>
              </div>
            </div>
          )}
          {isAuthReady && isLoggedIn && (
            <div className="mt-4 p-3 rounded-xl border border-green-500/30 bg-green-500/10 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <p className="text-sm text-green-400 font-medium">
                Logged in as <strong>{profile?.full_name || user?.email}</strong>. You can now upload your receipt.
              </p>
            </div>
          )}
        </div>

        {/* Right: Payment card */}
        <div className="space-y-6">

          {/* Plan Selector */}
          <Card className="border-border shadow-2xl bg-card relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-600" />
            <CardHeader className="text-center pt-8">
              <CardTitle className="text-3xl font-display">One-Time Activation</CardTitle>
              <CardDescription className="text-base mt-2">Pay once for lifetime access to all UTME/JAMB subjects & CBT mocks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-6 border-2 border-primary bg-primary/5 rounded-2xl text-center space-y-2">
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground mb-2">
                  ₦3,000 One-Time Lifetime Fee
                </div>
                <div className="text-4xl font-extrabold font-display text-primary">₦3,000</div>
                <p className="text-sm font-semibold text-foreground">Full Unlimited UTME/JAMB Access</p>
                <p className="text-xs text-muted-foreground">No recurring fees, no hidden charges. Pay ₦3,000 once and practice indefinitely.</p>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border pt-4">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium w-full">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                <span>Payments are encrypted and 100% secure</span>
              </div>
            </CardFooter>
          </Card>

          {/* Bank Transfer + Upload Card */}
          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden w-full">
            <CardHeader className="bg-slate-950 pb-8 text-center border-b border-slate-800">
              <CardTitle className="text-2xl text-white">Complete Your Payment</CardTitle>
              <CardDescription className="text-slate-400">
                You selected the <strong className="text-white">{plans[selectedPlan].name}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Bank details */}
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex items-start gap-4">
                <div className="bg-blue-500/20 p-2 rounded-full">
                  <Banknote className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-200">Bank Transfer Details</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Transfer <strong className="text-white">₦{plans[selectedPlan].price.toLocaleString()}</strong> to the account below.
                  </p>
                  <div className="mt-4 space-y-2 bg-slate-950 p-3 rounded-md border border-slate-800">
                    {[
                      { label: 'Bank Name', value: 'Moniepoint MCB' },
                      { label: 'Account Number', value: '9032517376' },
                      { label: 'Account Name', value: 'Olamide Olanrewaju Abdulmuiz' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-slate-500">{label}:</span>
                        <span className="font-mono text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upload Section */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-300 block">Upload Payment Receipt</label>

                {uploadSuccess ? (
                  <div className="border-2 border-green-500/40 bg-green-500/10 rounded-xl p-6 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                    <p className="text-green-400 font-bold text-lg">Receipt Submitted!</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Your payment is pending admin verification. Your account will be activated within 24 hours.
                    </p>
                  </div>
                ) : (
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors relative ${
                    isLoggedIn && !isUploading
                      ? 'border-slate-600 hover:bg-slate-800/50 cursor-pointer'
                      : 'border-slate-800 opacity-60 cursor-not-allowed'
                  }`}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleManualUpload}
                      disabled={isUploading || authLoading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    {isUploading ? (
                      <>
                        <Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
                        <p className="text-sm text-slate-300 font-medium">Uploading receipt...</p>
                        <p className="text-xs text-slate-500 mt-1">Please do not close this page.</p>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        {!isLoggedIn ? (
                          <>
                            <p className="text-sm text-amber-400 font-semibold">Login required</p>
                            <button
                              type="button"
                              onClick={() => navigate(`/login?from=${encodeURIComponent(studentId ? `/pricing?student_id=${studentId}` : '/pricing')}`)}
                              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                            >
                              <LogIn className="w-4 h-4" /> Login to Upload
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-slate-300 font-medium">Click to upload receipt</p>
                            <p className="text-xs text-slate-500 mt-1">JPEG, PNG, or PDF · Max 5MB</p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Login / Signup quick links for unauthenticated */}
                {!isLoggedIn && isAuthReady && (
                  <div className="flex gap-3 mt-2">
                    <Link
                      to={`/login?from=${encodeURIComponent(studentId ? `/pricing?student_id=${studentId}` : '/pricing')}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 border border-border rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
                    >
                      <LogIn className="w-4 h-4" /> Log In
                    </Link>
                    <Link
                      to="/signup"
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" /> Create Account
                    </Link>
                  </div>
                )}
              </div>

              {/* Help note */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200">
                <p className="font-semibold mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Need Help?
                </p>
                <p>
                  If you've paid and your account isn't activated within 24 hours, email{' '}
                  <strong>support@scholarsresort.com</strong> or message the admin via WhatsApp.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
