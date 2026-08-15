import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Footer } from '../components/Footer';
import { 
  ArrowRight, ShieldCheck, CheckCircle2, Sparkles, BookOpen, 
  BrainCircuit, LayoutDashboard, Clock, Activity, BarChart, 
  BookMarked, Zap, Target, Users, Trophy, ChevronRight, PlayCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { supabase } from '@/lib/supabase';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function Landing() {
  const [stats, setStats] = useState({ students: 1000, exams: 25000 });
  const [daysToJamb, setDaysToJamb] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: settings } = await supabase.from('admin_settings').select('setting_value').eq('setting_key', 'global_config').single();
        const targetDate = settings?.setting_value?.jamb_date ? new Date(settings.setting_value.jamb_date) : new Date('2026-04-15T08:00:00');
        
        const diff = Math.floor((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        setDaysToJamb(diff > 0 ? diff : 0);

        const { count: studentsCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
        if (studentsCount) setStats(s => ({ ...s, students: Math.max(1245, studentsCount) }));
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, []);

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, 100]);

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100 overflow-hidden font-sans selection:bg-primary/30">
      <Navbar />
      
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] rounded-full bg-purple-600/5 blur-[100px]" />
      </div>
      
      {/* 1. Hero Section (Linear / Vercel style) */}
      <section className="relative pt-40 pb-32 container mx-auto px-6 z-10 flex flex-col items-center text-center">
        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="max-w-4xl mx-auto flex flex-col items-center">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary mb-8 backdrop-blur-md shadow-[0_0_15px_rgba(37,99,235,0.2)]"
          >
            <Sparkles className="w-4 h-4" /> Next-Gen UTME Prep Platform
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-display font-extrabold leading-[1.05] tracking-tight mb-8"
          >
            The smart way to <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-primary to-purple-500">
              crush your JAMB.
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl font-light"
          >
            Stop guessing. Start scoring. Scholars Resort uses AI to analyze your weaknesses, build adaptive study plans, and simulate the exact JAMB CBT experience.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Button asChild size="lg" className="h-14 px-8 text-lg rounded-2xl shadow-premium shadow-primary/25 transition-all hover:scale-[1.02]">
              <Link to="/signup">Start Practicing Free <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg rounded-2xl border-slate-700 hover:bg-slate-800 transition-all">
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.8 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-slate-500 font-medium"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>{stats.students.toLocaleString()}+ Active Students</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-slate-800" />
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>{stats.exams.toLocaleString()}+ Mock Exams Taken</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. App Preview / Dashboard Showcase */}
      <section className="relative z-10 pb-32">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }}
            className="relative rounded-2xl overflow-hidden border border-slate-800/60 bg-slate-900/50 backdrop-blur-sm p-2 shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#020817] via-transparent to-transparent z-10 pointer-events-none" />
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
              <div className="h-10 border-b border-slate-800 flex items-center px-4 gap-2 bg-slate-900">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <div className="mx-auto bg-slate-950 px-4 py-1 rounded text-xs text-slate-400 font-mono flex items-center gap-2">
                  <Lock className="w-3 h-3" /> scholarsresort.com
                </div>
              </div>
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80" alt="Dashboard Preview" className="w-full object-cover opacity-60" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. Features (Bento Grid) */}
      <section className="py-24 relative z-10 bg-slate-900/20 border-y border-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Everything you need to <span className="text-primary">succeed.</span></h2>
            <p className="text-lg text-slate-400">We replaced boring textbooks with interactive, AI-driven practice that actually improves your score week over week.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 row-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group hover:border-primary/50 transition-colors">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
              <BrainCircuit className="w-12 h-12 text-primary mb-6" />
              <h3 className="text-2xl font-bold mb-3">AI Personal Tutor</h3>
              <p className="text-slate-400 text-lg mb-8 max-w-md">Stuck on a Physics equation? Our AI tutor breaks down complex problems into simple, step-by-step explanations exactly when you need them.</p>
              
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 w-full max-w-sm ml-auto rotate-[-2deg] shadow-xl group-hover:rotate-0 transition-transform">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0" />
                  <div className="bg-slate-800 text-slate-300 p-3 rounded-2xl rounded-tl-sm text-sm">Can you explain Newton's second law simply?</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"><Sparkles className="w-4 h-4 text-primary" /></div>
                  <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-2xl rounded-tr-sm text-sm">Think of it like pushing a shopping cart. The harder you push (Force), the faster it moves (Acceleration)...</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 group hover:border-blue-500/50 transition-colors">
              <LayoutDashboard className="w-10 h-10 text-blue-400 mb-4" />
              <h3 className="text-xl font-bold mb-2">Exact CBT Replica</h3>
              <p className="text-slate-400 text-sm">Our exam interface is a 1:1 replica of the real JAMB CBT engine. No surprises on exam day.</p>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 group hover:border-amber-500/50 transition-colors">
              <BarChart className="w-10 h-10 text-amber-400 mb-4" />
              <h3 className="text-xl font-bold mb-2">Deep Analytics</h3>
              <p className="text-slate-400 text-sm">We track your speed and accuracy across 100+ micro-topics to identify exactly what you need to study next.</p>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 group hover:border-purple-500/50 transition-colors">
              <Trophy className="w-10 h-10 text-purple-400 mb-4" />
              <h3 className="text-xl font-bold mb-2">Live Tournaments</h3>
              <p className="text-slate-400 text-sm">Compete in weekly mocks against thousands of students. See your rank nationally before the real exam.</p>
            </div>

            <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 flex items-center gap-8 group hover:border-green-500/50 transition-colors">
              <div className="flex-1">
                <Users className="w-10 h-10 text-green-400 mb-4" />
                <h3 className="text-xl font-bold mb-2">Guardian Portal</h3>
                <p className="text-slate-400 text-sm">Parents and sponsors get a dedicated dashboard to monitor attendance, mock scores, and overall readiness without having to ask.</p>
              </div>
              <div className="hidden sm:block w-32 h-32 rounded-full border-4 border-slate-800 relative">
                <div className="absolute inset-0 rounded-full border-4 border-green-500" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 0 75%)' }} />
                <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl text-green-400">75%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. JAMB Countdown */}
      <section className="py-24 relative z-10">
        <div className="container mx-auto px-6">
          <div className="bg-primary border border-primary-foreground/10 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl shadow-primary/20">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl font-display font-bold text-white mb-6">JAMB is approaching fast.</h2>
              
              <div className="flex justify-center gap-4 md:gap-8 mb-10">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-24 md:w-32 md:h-36 bg-slate-950/40 rounded-2xl flex items-center justify-center text-4xl md:text-7xl font-bold text-white font-mono shadow-inner border border-white/10 backdrop-blur-md">
                    {Math.floor(daysToJamb / 30)}
                  </div>
                  <span className="text-primary-foreground/80 mt-3 font-semibold uppercase tracking-widest text-xs">Months</span>
                </div>
                <div className="text-4xl md:text-7xl font-bold text-white/50 self-center pb-8">:</div>
                <div className="flex flex-col items-center">
                  <div className="w-20 h-24 md:w-32 md:h-36 bg-slate-950/40 rounded-2xl flex items-center justify-center text-4xl md:text-7xl font-bold text-white font-mono shadow-inner border border-white/10 backdrop-blur-md">
                    {daysToJamb % 30}
                  </div>
                  <span className="text-primary-foreground/80 mt-3 font-semibold uppercase tracking-widest text-xs">Days</span>
                </div>
              </div>
              
              <Button asChild size="lg" className="bg-white text-primary hover:bg-slate-100 h-14 px-10 text-lg rounded-xl font-bold shadow-xl transition-all">
                <Link to="/signup">Start Your Preparation Today</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Lock(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
