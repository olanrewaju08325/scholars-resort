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

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!acceptedTerms) {
      toast.error('Please accept the payment terms & conditions before uploading your receipt.');
      return;
    }
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
            <div className="mt-6 p-5 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <LogIn className="w-6 h-6 text-amber-500 shrink-0" />
                <p className="font-extrabold text-amber-400 text-base">⚠️ Login Required Before Making Payment</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Please log in or register a free account first so our payment activation system can link your receipt directly to your profile.
              </p>
              <div className="flex gap-3 pt-1">
                <Link 
                  to={`/login?from=${encodeURIComponent(studentId ? `/pricing?student_id=${studentId}` : '/pricing')}`} 
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" /> Log In Now
                </Link>
                <Link 
                  to="/signup" 
                  className="px-4 py-2 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Register Free
                </Link>
              </div>
            </div>
          )}
          {isAuthReady && isLoggedIn && (
            <div className="mt-4 p-4 rounded-xl border border-green-500/40 bg-green-500/10 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <p className="text-sm text-green-400 font-medium">
                Logged in as <strong className="text-white">{profile?.full_name || user?.email}</strong>. You are ready to make payment and upload your receipt!
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
          <Card className="bg-card text-card-foreground border-border shadow-xl overflow-hidden w-full">
            <CardHeader className="bg-muted/40 pb-6 text-center border-b border-border">
              <CardTitle className="text-2xl font-bold font-display text-foreground">Complete Your Payment</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                You selected the <strong className="text-foreground font-bold">{plans[selectedPlan].name}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Bank details */}
              <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-xl shrink-0">
                  <Banknote className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="font-bold text-foreground text-base">Bank Transfer Details</h4>
                  <p className="text-sm text-muted-foreground">
                    Transfer <strong className="text-primary font-bold">₦{plans[selectedPlan].price.toLocaleString()}</strong> to the official Moniepoint account below.
                  </p>
                  <div className="mt-3 space-y-2 bg-background p-4 rounded-xl border border-border shadow-inner">
                    {[
                      { label: 'Bank Name', value: 'Moniepoint MCB' },
                      { label: 'Account Number', value: '9032517376' },
                      { label: 'Account Name', value: 'Olamide Olanrewaju Abdulmuiz' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">{label}:</span>
                        <span className="font-mono font-bold text-foreground text-base">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mandatory Payment Terms Agreement */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Mandatory Payment Guidelines & Terms
                </p>
                <ul className="text-xs text-foreground/90 space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li>Transfer exact amount (<strong>₦3,000</strong>) to Moniepoint MCB <strong>9032517376</strong>.</li>
                  <li>Use your registered account <strong>Name or Email</strong> in the transfer narration/memo.</li>
                  <li>Upload a clear receipt screenshot after payment. Activation takes 5-15 minutes after review.</li>
                  <li>Payments are non-refundable once account access is granted. Ensure your email is correct.</li>
                </ul>
                <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-bold text-foreground">
                    I have read and agree to the payment instructions & non-refundable activation terms.
                  </span>
                </label>
              </div>

              {/* Upload Section */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground block">Upload Payment Receipt</label>

                {uploadSuccess ? (
                  <div className="border-2 border-green-500/40 bg-green-500/10 rounded-2xl p-6 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                    <p className="text-green-600 dark:text-green-400 font-extrabold text-lg">Receipt Submitted!</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Your payment proof has been sent to admin review. You will receive activation confirmation at <strong>admitwise2@gmail.com</strong>.
                    </p>
                  </div>
                ) : (
                  <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative ${
                    isLoggedIn && acceptedTerms && !isUploading
                      ? 'border-primary/50 hover:bg-primary/5 cursor-pointer bg-background'
                      : 'border-border bg-muted/20 opacity-70 cursor-not-allowed'
                  }`}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleManualUpload}
                      disabled={isUploading || authLoading || !acceptedTerms}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    {isUploading ? (
                      <>
                        <Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
                        <p className="text-sm text-foreground font-bold">Uploading payment receipt...</p>
                        <p className="text-xs text-muted-foreground mt-1">Please do not close this window.</p>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-8 h-8 text-primary mx-auto mb-2" />
                        {!isLoggedIn ? (
                          <>
                            <p className="text-sm text-amber-500 font-bold">Login required before uploading</p>
                            <button
                              type="button"
                              onClick={() => navigate(`/login?from=${encodeURIComponent(studentId ? `/pricing?student_id=${studentId}` : '/pricing')}`)}
                              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors"
                            >
                              <LogIn className="w-4 h-4" /> Login to Upload
                            </button>
                          </>
                        ) : !acceptedTerms ? (
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                            ⚠️ Check the agreement box above to enable receipt upload
                          </p>
                        ) : (
                          <>
                            <p className="text-sm text-foreground font-bold">Click or drop payment receipt here</p>
                            <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or PDF · Max 5MB</p>
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

              {/* Support Contact */}
              <div className="p-4 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Direct Customer Support
                </p>
                <p>
                  Need assistance with your payment? Contact support directly at{' '}
                  <a href="mailto:admitwise2@gmail.com" className="text-primary font-bold hover:underline">
                    admitwise2@gmail.com
                  </a>{' '}
                  or WhatsApp <strong>09032517376</strong>.
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
