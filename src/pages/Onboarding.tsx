import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Target, BookOpen, Clock, ChevronRight, CheckCircle2, 
  GraduationCap, Sparkles, School, Trophy, Users, 
  ArrowRight, Brain, Zap, Smartphone, ShieldCheck, Lock, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const JAMB_SUBJECTS = [
  'Use of English', 'Mathematics', 'Physics', 'Chemistry',
  'Biology', 'Economics', 'Government', 'Literature in English',
  'CRS / IRS', 'Geography', 'Accounting', 'Commerce',
  'Agricultural Science', 'Civic Education', 'History', 'Computer Studies'
];

const TOP_UNIVERSITIES = [
  'University of Lagos (UNILAG)', 'University of Ibadan (UI)', 
  'Obafemi Awolowo University (OAU)', 'Ahmadu Bello University (ABU)',
  'University of Nigeria Nsukka (UNN)', 'University of Benin (UNIBEN)',
  'Federal University of Technology Akure (FUTA)', 'Covenant University',
  'University of Ilorin (UNILORIN)', 'Lagos State University (LASU)',
];

const TOTAL_STEPS = 5;

const Onboarding = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Immediate role redirection - guardians and admins should never see student onboarding
  useEffect(() => {
    if (profile) {
      if (profile.role === 'guardian') {
        navigate('/guardian', { replace: true });
      } else if (profile.role === 'admin' || (profile.email && ['admitwise2@gmail.com'].includes(profile.email))) {
        navigate('/dashboard', { replace: true });
      } else if (profile.onboarding_completed) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [profile, navigate]);
  
  const [targetScore, setTargetScore] = useState('270');
  const [targetUni, setTargetUni] = useState('');
  const [dailyGoal, setDailyGoal] = useState('60');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Use of English']);
  const [intendedCourse, setIntendedCourse] = useState('');

  const toggleSubject = (subject: string) => {
    if (subject === 'Use of English') return;
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(prev => prev.filter(s => s !== subject));
    } else {
      if (selectedSubjects.length < 4) {
        setSelectedSubjects(prev => [...prev, subject]);
      } else {
        toast.warning('You can only select 4 subjects. Remove one first.');
      }
    }
  };

  const handleComplete = async () => {
    if (!profile || selectedSubjects.length !== 4) {
      toast.error('Please select exactly 4 UTME subjects');
      return;
    }
    setLoading(true);
    
    try {
      const res = await fetch(getApiUrl('/api/onboarding/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          target_score: parseInt(targetScore) || 270,
          target_university: targetUni || 'Not Specified',
          daily_study_goal_minutes: parseInt(dailyGoal) || 60,
          utme_subjects: selectedSubjects,
          intended_course: intendedCourse || null,
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete onboarding');
      }

      await supabase.from('profiles').update({
        target_score: parseInt(targetScore) || 270,
        target_university: targetUni || 'Not Specified',
        daily_study_goal_minutes: parseInt(dailyGoal) || 60,
        onboarding_completed: true,
        utme_subjects: selectedSubjects,
        intended_course: intendedCourse || null,
      }).eq('id', profile.id);

      toast.success('Onboarding completed successfully!');
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete onboarding');
      setLoading(false);
    }
  };

  const stepVariants = {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/15 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-display font-bold text-xl">Scholars Resort</span>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <motion.div 
            key={i} 
            animate={{ width: step > i ? '2.5rem' : '0.5rem' }}
            className={`h-2 rounded-full transition-all duration-500 ${step > i ? 'bg-primary' : 'bg-slate-700'}`}
          />
        ))}
      </div>

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <motion.div key="s1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.35 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <Sparkles className="w-12 h-12 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 bg-primary text-white text-xs px-2 py-1 rounded-full font-bold">NEW</div>
              </div>
              <div>
                <h2 className="text-3xl font-bold font-display text-white mb-3">
                  Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
                </h2>
                <p className="text-slate-400 leading-relaxed">
                  You're about to begin your journey to a 300+ JAMB score. Let's set up your personalised learning experience in 2 minutes.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 py-2">
                {[
                  { icon: Brain, label: 'AI-Powered', color: 'text-purple-400' },
                  { icon: Trophy, label: 'Gamified', color: 'text-yellow-400' },
                  { icon: Users, label: 'Community', color: 'text-green-400' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center">
                      <Icon className={`w-6 h-6 ${color}`} />
                    </div>
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                ))}
              </div>

              {/* Single Device Policy Information */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-left space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Single-Device Protection Policy</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Your account is protected and tied to <strong>1 active device</strong> to ensure UTME mock exam integrity and leaderboard fairness. If you ever switch devices or phones, you can request an instant 1-click reset.
                </p>
              </div>

              <Button className="w-full h-12 text-lg" onClick={() => setStep(2)}>
                Get Started <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* Step 2: UTME Subjects */}
          {step === 2 && (
            <motion.div key="s2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.35 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-5">
              <div>
                <h2 className="text-2xl font-bold font-display text-white mb-2">Select Your UTME Subjects</h2>
                <p className="text-slate-400 text-sm">English is mandatory. Choose exactly 3 more subjects for your JAMB exam.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedSubjects.map(s => (
                  <span key={s} className="bg-primary/20 text-primary border border-primary/30 text-xs px-3 py-1 rounded-full font-bold">{s}</span>
                ))}
                {selectedSubjects.length < 4 && (
                  <span className="bg-slate-800 text-slate-500 text-xs px-3 py-1 rounded-full border border-dashed border-slate-700">
                    {4 - selectedSubjects.length} more needed
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {JAMB_SUBJECTS.map(subject => {
                  const selected = selectedSubjects.includes(subject);
                  const locked = subject === 'Use of English';
                  const disabled = !selected && selectedSubjects.length >= 4;
                  return (
                    <button key={subject}
                      onClick={() => toggleSubject(subject)}
                      disabled={disabled || locked}
                      className={`p-3 rounded-xl border text-sm font-medium text-left transition-all duration-200
                        ${locked ? 'border-primary/50 bg-primary/10 text-primary cursor-not-allowed opacity-80' :
                          selected ? 'border-primary bg-primary/10 text-primary' :
                          disabled ? 'border-slate-800 bg-slate-900/50 text-slate-700 cursor-not-allowed' :
                          'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-primary/50 hover:bg-primary/5'
                        }`}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{subject}</span>
                        {selected && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="w-1/3" onClick={() => setStep(1)}>Back</Button>
                <Button className="w-2/3" onClick={() => setStep(3)} disabled={selectedSubjects.length !== 4}>
                  Continue <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Target Score & University */}
          {step === 3 && (
            <motion.div key="s3" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.35 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
              <div>
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Target className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold font-display text-white mb-2">Set Your Targets</h2>
                <p className="text-slate-400 text-sm">Define your goals and we'll build your study plan around them.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Target JAMB Score</label>
                  <div className="flex gap-3">
                    {['220', '250', '270', '300', '320', '350'].map(score => (
                      <button key={score} onClick={() => setTargetScore(score)}
                        className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all ${targetScore === score ? 'border-primary bg-primary text-white' : 'border-slate-700 text-slate-400 hover:border-primary/50'}`}>
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Dream University</label>
                  <select 
                    value={targetUni} onChange={e => setTargetUni(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-primary outline-none">
                    <option value="">Select a university...</option>
                    {TOP_UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                    <option value="Other">Other University</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Intended Course (Optional)</label>
                  <Input placeholder="e.g. Medicine & Surgery, Computer Science..."
                    value={intendedCourse} onChange={e => setIntendedCourse(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="w-1/3" onClick={() => setStep(2)}>Back</Button>
                <Button className="w-2/3" onClick={() => setStep(4)}>Continue <ChevronRight className="w-5 h-5 ml-1" /></Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Daily Commitment */}
          {step === 4 && (
            <motion.div key="s4" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.35 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
              <div>
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold font-display text-white mb-2">Daily Study Goal</h2>
                <p className="text-slate-400 text-sm">Consistency is everything. How long can you commit daily?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { mins: 30, label: '30 mins', sub: 'Light revision' },
                  { mins: 60, label: '1 hour', sub: 'Steady progress' },
                  { mins: 90, label: '1.5 hours', sub: 'Strong preparation' },
                  { mins: 120, label: '2 hours', sub: 'Elite performance' },
                ].map(({ mins, label, sub }) => (
                  <button key={mins}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${parseInt(dailyGoal) === mins ? 'border-green-500 bg-green-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-green-500/40'}`}
                    onClick={() => setDailyGoal(mins.toString())}>
                    <p className={`font-bold text-lg ${parseInt(dailyGoal) === mins ? 'text-green-400' : 'text-slate-200'}`}>{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="w-1/3" onClick={() => setStep(3)}>Back</Button>
                <Button className="w-2/3 bg-green-600 hover:bg-green-700 text-white" onClick={() => setStep(5)}>
                  Almost Done! <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 5: Summary & Launch */}
          {step === 5 && (
            <motion.div key="s5" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.35 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                  <Zap className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold font-display text-white mb-2">You're All Set!</h2>
                <p className="text-slate-400 text-sm">Here's a summary of your learning profile.</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
                {[
                  { label: 'Target Score', value: targetScore, icon: Target },
                  { label: 'Dream University', value: targetUni || 'Not set', icon: School },
                  { label: 'UTME Subjects', value: selectedSubjects.join(', '), icon: BookOpen },
                  { label: 'Daily Goal', value: `${dailyGoal} minutes`, icon: Clock },
                  { label: 'Device Pairing', value: '1 Active Device (Hardware Locked)', icon: Smartphone },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-sm font-semibold text-slate-200 leading-snug">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-blue-950/30 border border-blue-800/30 rounded-xl text-left text-xs space-y-1">
                <p className="font-semibold text-blue-300 flex items-center gap-1.5 text-xs">
                  <Lock className="w-3.5 h-3.5" />
                  Hardware Security Active
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Launching your dashboard will register this device. If you ever switch to a new phone or tablet, you can easily request a 1-click device reset from the login screen.
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="w-1/3" onClick={() => setStep(4)}>Back</Button>
                <Button 
                  className="w-2/3 h-12 text-lg shadow-lg shadow-primary/30" 
                  onClick={handleComplete}
                  disabled={loading}>
                  {loading ? 'Launching...' : 'Launch My Dashboard'} <GraduationCap className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-8 text-slate-600 text-sm">You can always update these settings in your profile.</p>
    </div>
  );
};

export default Onboarding;
