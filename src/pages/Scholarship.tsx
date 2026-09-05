import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  GraduationCap, Award, CheckCircle2, ShieldCheck,
  BookOpen, Sparkles, AlertCircle, ArrowRight,
  Clock, Trophy, HeartHandshake, Check, FileText
} from 'lucide-react';

interface ScholarshipConfig {
  isActive: boolean;
  passThresholdPercent: number;
  monthlyQuota: number;
  programTitle: string;
  programDescription: string;
  eligibilityText: string;
}

const MERIT_QUESTIONS = [
  {
    id: 1,
    question: "From the words lettered A to D, choose the word that has the SAME vowel sound as the one represented by the underlined letters: 'f**oo**d'",
    options: ["A) book", "B) rude", "C) flood", "D) look"],
    correct: "B",
    explanation: "'Food' and 'rude' both share the long /u:/ vowel sound, whereas 'book' and 'look' have the short /ʊ/ sound."
  },
  {
    id: 2,
    question: "Choose the option OPPOSITE in meaning to the capitalized word: The doctor described the patient's condition as PRECARIOUS.",
    options: ["A) Dangerous", "B) Critical", "C) Stable", "D) Uncertain"],
    correct: "C",
    explanation: "'Precarious' means uncertain or dangerously unstable. The antonym is 'stable'."
  },
  {
    id: 3,
    question: "If 3x + 2 = 17, calculate the value of 2x² - 5.",
    options: ["A) 45", "B) 25", "C) 50", "D) 40"],
    correct: "A",
    explanation: "3x = 15 => x = 5. Then 2(5)² - 5 = 2(25) - 5 = 50 - 5 = 45."
  },
  {
    id: 4,
    question: "A car travels 180 km in 2.5 hours. What is its average speed in m/s?",
    options: ["A) 20 m/s", "B) 25 m/s", "C) 72 m/s", "D) 15 m/s"],
    correct: "A",
    explanation: "Speed in km/h = 180 / 2.5 = 72 km/h. Converting to m/s: 72 × (5/18) = 20 m/s."
  },
  {
    id: 5,
    question: "Which of the following cellular organelles is known as the 'powerhouse' of the eukaryotic cell?",
    options: ["A) Ribosome", "B) Nucleus", "C) Mitochondrion", "D) Endoplasmic reticulum"],
    correct: "C",
    explanation: "Mitochondria produce ATP through cellular respiration, supplying power to the cell."
  },
  {
    id: 6,
    question: "The phenomenon where a ray of light bends as it passes from air into water is known as:",
    options: ["A) Reflection", "B) Refraction", "C) Diffraction", "D) Polarization"],
    correct: "B",
    explanation: "Refraction is the change in direction of light due to a change in transmission medium speed."
  },
  {
    id: 7,
    question: "What is the oxidation number of Sulfur in H₂SO₄?",
    options: ["A) +4", "B) +6", "C) -2", "D) +2"],
    correct: "B",
    explanation: "2(+1) + S + 4(-2) = 0 => +2 + S - 8 = 0 => S = +6."
  },
  {
    id: 8,
    question: "In standard UTME grading, what is the maximum possible cumulative score achievable across 4 subjects?",
    options: ["A) 300", "B) 350", "C) 400", "D) 500"],
    correct: "C",
    explanation: "JAMB UTME consists of 4 subjects, each scored over 100 points, yielding a total of 400."
  },
  {
    id: 9,
    question: "If a sum of money doubles itself in 5 years at simple interest, what is the annual rate of interest?",
    options: ["A) 10%", "B) 15%", "C) 20%", "D) 25%"],
    correct: "C",
    explanation: "Interest I = Principal P. I = (P * R * T) / 100 => P = (P * R * 5) / 100 => 100 = 5R => R = 20%."
  },
  {
    id: 10,
    question: "Which literary device involves giving human attributes to non-human objects or abstract ideas?",
    options: ["A) Metaphor", "B) Hyperbole", "C) Personification", "D) Oxymoron"],
    correct: "C",
    explanation: "Personification endows inanimate objects or abstract concepts with human feelings or actions."
  }
];

export const Scholarship = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Program Config State
  const [config, setConfig] = useState<ScholarshipConfig>({
    isActive: true,
    passThresholdPercent: 70,
    monthlyQuota: 50,
    programTitle: '100% Free Lifetime UTME Scholarship Program',
    programDescription: 'Empowering determined and indigent Nigerian secondary school leavers with 100% free access to premier JAMB UTME preparation materials.',
    eligibilityText: 'Candidates with high academic aptitude from financially challenged backgrounds, orphans, and students from underserved communities.'
  });

  // Active View Tab: 'info' | 'assessment' | 'apply' | 'redeem'
  const [activeTab, setActiveTab] = useState<'info' | 'assessment' | 'apply' | 'redeem'>('info');

  // Assessment State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [testCompleted, setTestCompleted] = useState(false);
  const [testScorePercent, setTestScorePercent] = useState(0);
  const [passedAssessment, setPassedAssessment] = useState(false);
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [grantedSuccess, setGrantedSuccess] = useState(false);

  // Application Form State
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [stateOfOrigin, setStateOfOrigin] = useState('');
  const [targetCourse, setTargetCourse] = useState('');
  const [targetUni, setTargetUni] = useState('');
  const [reason, setReason] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);
  const [appSubmitted, setAppSubmitted] = useState(false);

  // Voucher Redeem State
  const [voucherInput, setVoucherInput] = useState('');
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);

  // Fetch Live Scholarship Config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'scholarship_program_config')
          .maybeSingle();

        if (data?.setting_value) {
          const parsed = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
          setConfig({
            isActive: parsed.isActive !== false,
            passThresholdPercent: Number(parsed.passThresholdPercent) || 70,
            monthlyQuota: Number(parsed.monthlyQuota) || 50,
            programTitle: parsed.programTitle || '100% Free Lifetime UTME Scholarship Program',
            programDescription: parsed.programDescription || 'Empowering determined Nigerian candidates with 100% free lifetime access.',
            eligibilityText: parsed.eligibilityText || 'Candidates from indigent backgrounds and high academic performers.'
          });
        }
      } catch (err) {
        console.warn('Could not fetch scholarship config:', err);
      }
    };

    fetchConfig();
  }, []);

  // Submit Aptitude Test
  const handleSubmitTest = async () => {
    let correctCount = 0;
    MERIT_QUESTIONS.forEach((q, idx) => {
      if (userAnswers[idx] === q.correct) {
        correctCount++;
      }
    });

    const scorePct = Math.round((correctCount / MERIT_QUESTIONS.length) * 100);
    const passed = scorePct >= config.passThresholdPercent;

    setTestScorePercent(scorePct);
    setPassedAssessment(passed);
    setTestCompleted(true);

    if (passed) {
      toast.success(`🎉 Congratulations! You scored ${scorePct}% on the Merit Assessment (Pass Mark: ${config.passThresholdPercent}%).`);
    } else {
      toast.info(`You scored ${scorePct}%. The pass mark is ${config.passThresholdPercent}%. You can still submit an Indigent Financial Aid application below for admin review.`);
    }

    // Save assessment record if user logged in
    if (user) {
      try {
        const { data: existingRow } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'scholarship_applications')
          .maybeSingle();

        const existingApps = existingRow?.setting_value && Array.isArray(existingRow.setting_value)
          ? existingRow.setting_value
          : [];

        const testRecord = {
          id: `SCHOLAR-APP-${Date.now()}`,
          userId: user.id,
          userName: profile?.full_name || 'Candidate',
          userEmail: user.email || '',
          userPhone: profile?.phone || '',
          score: scorePct,
          passed,
          type: 'merit_test',
          status: passed ? 'merit_passed' : 'pending_review',
          created_at: new Date().toISOString()
        };

        await supabase
          .from('admin_settings')
          .upsert({
            setting_key: 'scholarship_applications',
            setting_value: [testRecord, ...existingApps],
            updated_at: new Date().toISOString()
          });
      } catch {}
    }
  };

  // Instant 100% Scholarship Activation for Passed Candidates
  const handleClaimMeritScholarship = async () => {
    if (!user) {
      toast.error('Please create an account or sign in to claim your 100% scholarship.');
      navigate(`/login?from=${encodeURIComponent('/scholarship')}`);
      return;
    }

    setGrantingAccess(true);
    try {
      // 1. Activate lifetime subscription
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        plan_id: 'lifetime',
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 3650 * 86400000).toISOString()
      });

      // 2. Mark profile as paid/lifetime
      await supabase.from('profiles').update({
        has_paid: true
      }).eq('id', user.id);

      setGrantedSuccess(true);
      toast.success('🎉 100% Scholarship Access Activated! You now have full lifetime access to all JAMB UTME materials.');
    } catch (err: any) {
      toast.error(`Failed to activate scholarship: ${err.message}`);
    } finally {
      setGrantingAccess(false);
    }
  };

  // Submit Financial Aid Form
  const handleSubmitAidForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in or create an account first.');
      navigate(`/login?from=${encodeURIComponent('/scholarship')}`);
      return;
    }

    if (!reason.trim() || reason.trim().length < 20) {
      toast.error('Please provide a brief statement (at least 20 characters) explaining your financial situation or motivation.');
      return;
    }

    setSubmittingApp(true);
    try {
      const { data: existingRow } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'scholarship_applications')
        .maybeSingle();

      const existingApps = existingRow?.setting_value && Array.isArray(existingRow.setting_value)
        ? existingRow.setting_value
        : [];

      const newApp = {
        id: `AID-APP-${Date.now()}`,
        userId: user.id,
        userName: fullName.trim() || profile?.full_name || 'Applicant',
        userEmail: email.trim() || user.email || '',
        userPhone: phone.trim() || profile?.phone || '',
        stateOfOrigin: stateOfOrigin.trim(),
        targetCourse: targetCourse.trim(),
        targetUni: targetUni.trim(),
        reason: reason.trim(),
        type: 'financial_aid',
        status: 'pending_review',
        created_at: new Date().toISOString()
      };

      await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'scholarship_applications',
          setting_value: [newApp, ...existingApps],
          updated_at: new Date().toISOString()
        });

      setAppSubmitted(true);
      toast.success('🎉 Financial Aid Application Submitted! Our scholarship committee will review and activate your account within 24 hours.');
    } catch (err: any) {
      toast.error(`Submission failed: ${err.message}`);
    } finally {
      setSubmittingApp(false);
    }
  };

  // Redeem Voucher Code
  const handleRedeemVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a scholarship or voucher code.');
      return;
    }

    if (!user) {
      toast.error('Please log in first to apply this scholarship code.');
      navigate(`/login?from=${encodeURIComponent('/scholarship')}`);
      return;
    }

    setRedeemingVoucher(true);
    try {
      const { data: codeRow } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (!codeRow) {
        toast.error('Invalid scholarship voucher code. Please check with the administrator.');
        setRedeemingVoucher(false);
        return;
      }

      if (codeRow.max_uses && (codeRow.current_uses || 0) >= codeRow.max_uses) {
        toast.error('This scholarship voucher has expired or reached its maximum usage.');
        setRedeemingVoucher(false);
        return;
      }

      // Activate lifetime access
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        plan_id: 'lifetime',
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 3650 * 86400000).toISOString()
      });

      await supabase.from('profiles').update({
        has_paid: true
      }).eq('id', user.id);

      // Increment usage
      await supabase
        .from('discount_codes')
        .update({ current_uses: (codeRow.current_uses || 0) + 1 })
        .eq('id', codeRow.id);

      setGrantedSuccess(true);
      toast.success('🎉 Scholarship Voucher Accepted! Full Lifetime Access Activated.');
    } catch (err: any) {
      toast.error(`Redemption failed: ${err.message}`);
    } finally {
      setRedeemingVoucher(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 border border-purple-500/20 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider border border-purple-500/30">
            <GraduationCap className="w-3.5 h-3.5" /> Scholars Resort Scholarship Fund
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
            {config.programTitle}
          </h1>
          <p className="text-sm md:text-base text-slate-300">
            {config.programDescription}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'info' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Program Overview
        </button>
        <button
          onClick={() => setActiveTab('assessment')}
          className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'assessment' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Award className="w-3.5 h-3.5" /> 10-Question Merit Test ({config.passThresholdPercent}% Pass Mark)
        </button>
        <button
          onClick={() => setActiveTab('apply')}
          className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'apply' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          <HeartHandshake className="w-3.5 h-3.5" /> Indigent Financial Aid Form
        </button>
        <button
          onClick={() => setActiveTab('redeem')}
          className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'redeem' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Redeem Voucher Code
        </button>
      </div>

      {/* Tab 1: Overview & Eligibility */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border bg-card p-5 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">100% Free Lifetime Access</h3>
              <p className="text-xs text-muted-foreground">
                Recipients receive complete unlimited access to 35,000+ past questions, official UTME syllabus drills, literature hubs, and CBT mock exam simulations.
              </p>
            </Card>

            <Card className="border-border bg-card p-5 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Instant Merit Assessment</h3>
              <p className="text-xs text-muted-foreground">
                Score {config.passThresholdPercent}% or higher on our 10-question general aptitude test and receive instant automated scholarship activation.
              </p>
            </Card>

            <Card className="border-border bg-card p-5 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Need-Based Financial Aid</h3>
              <p className="text-xs text-muted-foreground">
                Indigent students, orphans, and candidates from low-income families can submit a quick 2-minute application reviewed daily by our administrators.
              </p>
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-bold">Eligibility Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <p className="text-sm font-medium text-foreground">
                {config.eligibilityText}
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Must be an active secondary school leaver, SS3 student, or UTME candidate.</li>
                <li>Targeting 300+ in the upcoming JAMB UTME examination.</li>
                <li>Committed to practicing regularly and maintaining academic integrity.</li>
              </ul>

              <div className="pt-4 flex items-center gap-3">
                <Button onClick={() => setActiveTab('assessment')} className="bg-primary hover:bg-primary/90 font-bold text-xs gap-1.5">
                  <Award className="w-4 h-4" /> Start 10-Question Merit Test
                </Button>
                <Button onClick={() => setActiveTab('apply')} variant="outline" className="text-xs font-bold">
                  Apply for Financial Aid
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: 10-Question Merit Test */}
      {activeTab === 'assessment' && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-500" /> JAMB UTME Merit Scholarship Assessment
                </CardTitle>
                <CardDescription className="text-xs">
                  Pass Mark: {config.passThresholdPercent}% ({Math.ceil(MERIT_QUESTIONS.length * (config.passThresholdPercent / 100))} of {MERIT_QUESTIONS.length} Questions Correct)
                </CardDescription>
              </div>
              {!testCompleted && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold">
                  Question {currentQIndex + 1} of {MERIT_QUESTIONS.length}
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {!testCompleted ? (
              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                  <p className="text-sm font-bold text-foreground">
                    {currentQIndex + 1}. {MERIT_QUESTIONS[currentQIndex].question}
                  </p>

                  <div className="space-y-2 pt-2">
                    {MERIT_QUESTIONS[currentQIndex].options.map((opt) => {
                      const letter = opt.substring(0, 1);
                      const isSelected = userAnswers[currentQIndex] === letter;
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => setUserAnswers(prev => ({ ...prev, [currentQIndex]: letter }))}
                          className={`w-full text-left p-3 rounded-lg border text-xs font-medium transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/50'
                              : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Progress & Nav */}
                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentQIndex === 0}
                    onClick={() => setCurrentQIndex(prev => prev - 1)}
                    className="text-xs"
                  >
                    Previous
                  </Button>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {MERIT_QUESTIONS.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentQIndex(idx)}
                        className={`w-6 h-6 rounded text-[11px] font-bold ${
                          currentQIndex === idx
                            ? 'bg-primary text-primary-foreground'
                            : userAnswers[idx]
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  {currentQIndex < MERIT_QUESTIONS.length - 1 ? (
                    <Button
                      size="sm"
                      onClick={() => setCurrentQIndex(prev => prev + 1)}
                      className="text-xs bg-primary hover:bg-primary/90 font-bold"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleSubmitTest}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      Submit Assessment
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
                  passedAssessment ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
                }`}>
                  {passedAssessment ? <Trophy className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-foreground">
                    {passedAssessment ? '🎉 Merit Scholarship Requirement Achieved!' : 'Assessment Complete'}
                  </h3>
                  <p className="text-sm font-bold text-muted-foreground">
                    Your Score: <span className={passedAssessment ? 'text-emerald-500' : 'text-amber-500'}>{testScorePercent}%</span> (Required: {config.passThresholdPercent}%)
                  </p>
                </div>

                {passedAssessment ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl max-w-md mx-auto space-y-3">
                    <p className="text-xs text-muted-foreground">
                      You have proven your academic excellence! Click below to immediately activate 100% Free Lifetime Access on your Scholars Resort account.
                    </p>
                    {grantedSuccess ? (
                      <div className="p-3 bg-emerald-600 text-white rounded-lg font-bold text-xs">
                        Account Successfully Activated with Lifetime Access!
                      </div>
                    ) : (
                      <Button
                        onClick={handleClaimMeritScholarship}
                        disabled={grantingAccess}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
                      >
                        {grantingAccess ? 'Activating Scholarship...' : 'Claim 100% Free Lifetime Access'}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-muted/30 border border-border rounded-xl max-w-md mx-auto space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Don't worry! If you are facing financial hardship, you can submit an Indigent Financial Aid Application for manual review by our team.
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTestCompleted(false);
                          setCurrentQIndex(0);
                          setUserAnswers({});
                        }}
                        className="text-xs"
                      >
                        Retake Test
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('apply')}
                        className="text-xs bg-primary hover:bg-primary/90 font-bold"
                      >
                        Apply for Financial Aid
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Indigent Financial Aid Form */}
      {activeTab === 'apply' && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-primary" /> Indigent Financial Aid Application
            </CardTitle>
            <CardDescription className="text-xs">
              Tell us about your academic goals and financial background. Applications are reviewed within 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appSubmitted ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-lg font-bold text-foreground">Application Received!</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Thank you for applying. Our scholarship review committee will examine your request. Once approved, your account will be activated automatically with lifetime access.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitAidForm} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Full Name *</Label>
                    <Input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Samuel Olawale"
                      required
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Phone Number (WhatsApp) *</Label>
                    <Input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="08012345678"
                      required
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">State of Origin</Label>
                    <Input
                      value={stateOfOrigin}
                      onChange={e => setStateOfOrigin(e.target.value)}
                      placeholder="e.g. Oyo"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Target Course</Label>
                    <Input
                      value={targetCourse}
                      onChange={e => setTargetCourse(e.target.value)}
                      placeholder="e.g. Medicine & Surgery"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Target Institution</Label>
                    <Input
                      value={targetUni}
                      onChange={e => setTargetUni(e.target.value)}
                      placeholder="e.g. UI / UNILAG / OAU"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Statement of Need / Why You Need This Scholarship *</Label>
                  <textarea
                    rows={4}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Briefly explain your financial situation, family background, and your dedication to scoring high in JAMB UTME..."
                    className="w-full text-xs rounded-md border border-input bg-background p-3 font-medium resize-none"
                    required
                  />
                </div>

                <Button type="submit" disabled={submittingApp} className="bg-primary hover:bg-primary/90 font-bold text-xs">
                  {submittingApp ? 'Submitting Application...' : 'Submit Scholarship Application'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Redeem Voucher Code */}
      {activeTab === 'redeem' && (
        <Card className="border-border bg-card shadow-sm max-w-lg">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Redeem Scholarship Voucher
            </CardTitle>
            <CardDescription className="text-xs">
              If you received a 100% scholarship code from an administrator, partner school, or sponsor, enter it below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Scholarship Voucher Code</Label>
              <Input
                placeholder="e.g. SCHOLAR2026, MERIT100"
                value={voucherInput}
                onChange={e => setVoucherInput(e.target.value.toUpperCase())}
                className="font-mono text-sm font-bold tracking-wider"
              />
            </div>

            {grantedSuccess ? (
              <div className="p-3 bg-emerald-600 text-white rounded-lg font-bold text-xs text-center">
                🎉 Scholarship Code Redeemed! Full Lifetime Access Activated.
              </div>
            ) : (
              <Button
                onClick={handleRedeemVoucher}
                disabled={redeemingVoucher}
                className="w-full bg-primary hover:bg-primary/90 font-bold text-xs"
              >
                {redeemingVoucher ? 'Verifying Voucher...' : 'Redeem Scholarship Access'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Scholarship;
