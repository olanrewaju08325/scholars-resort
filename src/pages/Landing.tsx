import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Footer } from '../components/Footer';
import { 
  ArrowRight, ShieldCheck, Sparkles, BrainCircuit, LayoutDashboard, BarChart, 
  Users, Trophy, Lock, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

const HERO_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1600&auto=format&fit=crop',
    caption: 'Students collaborating with AI study engine'
  },
  {
    url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1600&auto=format&fit=crop',
    caption: 'Realistic JAMB CBT Exam Simulation'
  },
  {
    url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1600&auto=format&fit=crop',
    caption: 'Master UTME prep with step-by-step explanations'
  }
];

export default function Landing() {
  const [stats, setStats] = useState({ students: 1250, exams: 25400 });
  const [daysToJamb, setDaysToJamb] = useState(0);
  const [heroImageIdx, setHeroImageIdx] = useState(0);
  const [telegramSupport, setTelegramSupport] = useState('https://t.me/+6dtsZgQpwrNhZDM8');
  const [telegramAnnouncements, setTelegramAnnouncements] = useState('https://t.me/+9WU6HrQE6DJhYTRk');

  // Dynamic Landing Page Feature Cards
  const [card1, setCard1] = useState({ title: "AI Personal Tutor", desc: "Stuck on a Physics equation or Chemistry reaction? Our AI tutor breaks down complex problems into step-by-step explanations instantly." });
  const [card2, setCard2] = useState({ title: "Exact CBT Replica", desc: "Our exam interface mimics the official JAMB UTME testing environment, including timer controls, question grid navigation, and key shortcuts." });
  const [card3, setCard3] = useState({ title: "Weakness Analytics", desc: "We measure your speed and accuracy per topic to recommend customized drills before exam day." });
  const [card4, setCard4] = useState({ title: "National Mocks & Battles", desc: "Compete against thousands of Nigerian students in weekly live tournaments and view your national percentile." });
  const [card5, setCard5] = useState({ title: "AI Smart Tutor & Adaptive Path", desc: "Get 24/7 step-by-step problem resolution, customized weak-topic drills, and AI study recommendations." });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: settings } = await supabase.from('admin_settings').select('setting_value').eq('setting_key', 'global_config').single();
        const targetDate = settings?.setting_value?.jamb_date ? new Date(settings.setting_value.jamb_date) : new Date('2026-04-15T08:00:00');
        
        const diff = Math.floor((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        setDaysToJamb(diff > 0 ? diff : 0);

        if (settings?.setting_value?.telegram_support_link) {
          setTelegramSupport(settings.setting_value.telegram_support_link);
        }
        if (settings?.setting_value?.telegram_announcement_link) {
          setTelegramAnnouncements(settings.setting_value.telegram_announcement_link);
        }

        const { data: landingSettings } = await supabase.from('admin_settings').select('setting_value').eq('setting_key', 'landing_config').maybeSingle();
        if (landingSettings?.setting_value) {
          const lConf = landingSettings.setting_value;
          if (lConf.card1_title) setCard1(prev => ({ ...prev, title: lConf.card1_title }));
          if (lConf.card1_desc) setCard1(prev => ({ ...prev, desc: lConf.card1_desc }));
          if (lConf.card2_title) setCard2(prev => ({ ...prev, title: lConf.card2_title }));
          if (lConf.card2_desc) setCard2(prev => ({ ...prev, desc: lConf.card2_desc }));
          if (lConf.card3_title) setCard3(prev => ({ ...prev, title: lConf.card3_title }));
          if (lConf.card3_desc) setCard3(prev => ({ ...prev, desc: lConf.card3_desc }));
          if (lConf.card4_title) setCard4(prev => ({ ...prev, title: lConf.card4_title }));
          if (lConf.card4_desc) setCard4(prev => ({ ...prev, desc: lConf.card4_desc }));
          if (lConf.card5_title) setCard5(prev => ({ ...prev, title: lConf.card5_title }));
          if (lConf.card5_desc) setCard5(prev => ({ ...prev, desc: lConf.card5_desc }));
        }

        const { count: studentsCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
        if (studentsCount) setStats(s => ({ ...s, students: Math.max(1245, studentsCount) }));
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();

    // Rotate Hero Background Images smoothly every 6 seconds
    const interval = setInterval(() => {
      setHeroImageIdx(prev => (prev + 1) % HERO_IMAGES.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, 80]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/30 transition-colors duration-300">
      <Navbar />
      
      {/* 1. Hero Section with Background Slideshow */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-20 container mx-auto px-6 z-10 text-center">
        {/* Animated Smooth Transition Background Image Container */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-3xl my-4 mx-2 md:mx-6 border border-border/40 shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.img
              key={heroImageIdx}
              src={HERO_IMAGES[heroImageIdx].url}
              alt={HERO_IMAGES[heroImageIdx].caption}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 0.18, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="w-full h-full object-cover dark:opacity-20 opacity-15"
            />
          </AnimatePresence>
          {/* Theme-aware overlay gradient to ensure 100% legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/85 to-background" />
        </div>

        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />

        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs sm:text-sm font-bold text-primary mb-6 shadow-sm backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-primary animate-spin-slow" /> Next-Gen JAMB UTME & CBT Platform
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.2rem] font-display font-black leading-[1.08] tracking-tight mb-6 text-foreground"
          >
            The smart way to <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-primary to-purple-600 dark:from-blue-400 dark:via-primary dark:to-purple-400">
              crush your JAMB score.
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg md:text-xl text-foreground/80 mb-10 max-w-2xl font-medium leading-relaxed"
          >
            Stop guessing. Start scoring 300+. Scholars Resort leverages AI to pinpoint your subject weaknesses, construct personalized study plans, and replicate the real JAMB CBT engine.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Button asChild size="lg" className="h-14 px-8 text-lg rounded-2xl shadow-xl shadow-primary/20 font-bold transition-all hover:scale-[1.02] bg-primary text-primary-foreground">
              <Link to="/signup">Start Practicing Free <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg rounded-2xl border-border bg-card text-foreground hover:bg-accent font-semibold transition-all">
              <Link to="/pricing">View Pricing Plans</Link>
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-foreground/80 text-sm font-semibold"
          >
            <div className="flex items-center gap-2 bg-card/60 border border-border px-3.5 py-1.5 rounded-full shadow-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{stats.students.toLocaleString()}+ Active UTME Candidates</span>
            </div>
            <div className="flex items-center gap-2 bg-card/60 border border-border px-3.5 py-1.5 rounded-full shadow-xs">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>{stats.exams.toLocaleString()}+ CBT Exams Completed</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. App Preview / Dashboard Showcase */}
      <section className="relative z-10 pb-20 md:pb-28">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }}
            className="relative rounded-2xl overflow-hidden border border-border bg-card p-2 shadow-2xl"
          >
            <div className="bg-muted/40 rounded-xl border border-border overflow-hidden">
              <div className="h-10 border-b border-border flex items-center px-4 gap-2 bg-muted/80">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <div className="mx-auto bg-background border border-border px-4 py-1 rounded text-xs text-foreground font-mono flex items-center gap-2 font-semibold">
                  <Lock className="w-3 h-3 text-primary" /> scholarsresort.com/dashboard
                </div>
              </div>
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80" alt="Scholars Resort Platform Interface" className="w-full h-auto aspect-[16/10] sm:aspect-[16/9] md:h-[480px] object-cover object-top transition-all duration-300" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. Features Grid */}
      <section className="py-24 relative z-10 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-extrabold mb-6 text-foreground">Everything you need to <span className="text-primary">excel.</span></h2>
            <p className="text-lg text-foreground/80 font-medium leading-relaxed">We replaced boring textbooks with interactive AI tutoring, real-time mock tournaments, and adaptive weakness drills.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-card border border-border rounded-3xl p-8 relative overflow-hidden group hover:border-primary/50 transition-colors shadow-sm">
              <BrainCircuit className="w-12 h-12 text-primary mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-card-foreground">{card1.title}</h3>
              <p className="text-foreground/80 text-base mb-8 max-w-md">{card1.desc}</p>
              
              <div className="bg-muted/80 border border-border rounded-xl p-4 w-full max-w-sm ml-auto shadow-md">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs text-primary shrink-0">YOU</div>
                  <div className="bg-background text-foreground border border-border p-3 rounded-2xl rounded-tl-sm text-xs font-medium">Explain Newton's second law simply for JAMB.</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0"><Sparkles className="w-3.5 h-3.5 text-primary-foreground" /></div>
                  <div className="bg-primary/10 border border-primary/20 text-foreground p-3 rounded-2xl rounded-tr-sm text-xs leading-relaxed font-medium">Force = mass × acceleration (F = ma). The harder you push an object, the faster it accelerates...</div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-3xl p-8 group hover:border-blue-500/50 transition-colors shadow-sm">
              <LayoutDashboard className="w-10 h-10 text-blue-500 mb-4" />
              <h3 className="text-xl font-bold mb-2 text-card-foreground">{card2.title}</h3>
              <p className="text-foreground/80 text-sm leading-relaxed">{card2.desc}</p>
            </div>

            <div className="bg-card border border-border rounded-3xl p-8 group hover:border-amber-500/50 transition-colors shadow-sm">
              <BarChart className="w-10 h-10 text-amber-500 mb-4" />
              <h3 className="text-xl font-bold mb-2 text-card-foreground">{card3.title}</h3>
              <p className="text-foreground/80 text-sm leading-relaxed">{card3.desc}</p>
            </div>

            <div className="bg-card border border-border rounded-3xl p-8 group hover:border-purple-500/50 transition-colors shadow-sm">
              <Trophy className="w-10 h-10 text-purple-500 mb-4" />
              <h3 className="text-xl font-bold mb-2 text-card-foreground">{card4.title}</h3>
              <p className="text-foreground/80 text-sm leading-relaxed">{card4.desc}</p>
            </div>

            <div className="md:col-span-2 bg-card border border-border rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-8 group hover:border-emerald-500/50 transition-colors shadow-sm">
              <div className="flex-1">
                <Users className="w-10 h-10 text-emerald-500 mb-4" />
                <h3 className="text-xl font-bold mb-2 text-card-foreground">{card5.title}</h3>
                <p className="text-foreground/80 text-sm leading-relaxed">{card5.desc}</p>
              </div>
              <div className="w-28 h-28 rounded-full border-4 border-border relative flex items-center justify-center shrink-0">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 0 75%)' }} />
                <div className="font-extrabold text-2xl text-emerald-600 dark:text-emerald-400">88%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. JAMB Exam Countdown Section */}
      <section className="py-24 relative z-10">
        <div className="container mx-auto px-6">
          <div className="bg-primary text-primary-foreground rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl font-display font-extrabold text-white mb-6">JAMB UTME is approaching fast!</h2>
              
              <div className="flex justify-center gap-4 md:gap-8 mb-10">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-24 md:w-32 md:h-36 bg-black/30 rounded-2xl flex items-center justify-center text-4xl md:text-7xl font-bold text-white font-mono shadow-inner border border-white/20 backdrop-blur-md">
                    {Math.floor(daysToJamb / 30)}
                  </div>
                  <span className="text-white/90 mt-3 font-semibold uppercase tracking-widest text-xs">Months</span>
                </div>
                <div className="text-4xl md:text-7xl font-bold text-white/50 self-center pb-8">:</div>
                <div className="flex flex-col items-center">
                  <div className="w-20 h-24 md:w-32 md:h-36 bg-black/30 rounded-2xl flex items-center justify-center text-4xl md:text-7xl font-bold text-white font-mono shadow-inner border border-white/20 backdrop-blur-md">
                    {daysToJamb % 30}
                  </div>
                  <span className="text-white/90 mt-3 font-semibold uppercase tracking-widest text-xs">Days</span>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-6">
                <Button asChild size="lg" className="bg-white text-primary hover:bg-slate-100 h-14 px-10 text-lg rounded-xl font-extrabold shadow-xl transition-all">
                  <Link to="/signup">Start Your Preparation Now</Link>
                </Button>

                <div className="w-full max-w-2xl mt-8 pt-8 border-t border-white/20">
                  <h3 className="text-lg md:text-xl font-bold text-white mb-4">Join Our Official Telegram Platforms</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a 
                      href={telegramSupport} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center justify-center gap-3 bg-black/35 hover:bg-black/50 border border-white/25 rounded-2xl p-4 text-white font-bold transition-all text-sm group"
                    >
                      <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15.15-.31.33-.5.53l-8.02 8.02c-.18.18-.42.28-.68.28s-.5-.1-.68-.28L4.4 15.02c-.37-.37-.37-.97 0-1.34.37-.37.97-.37 1.34 0l1.62 1.62L14.7 8.1c.37-.37.97-.37 1.34 0s.37.97 0 1.34l-.4.36z" />
                      </svg>
                      <div>
                        <div className="text-left font-extrabold text-white text-sm">Join Support System</div>
                        <div className="text-left text-xs text-white/70 font-normal">Direct help & setup support</div>
                      </div>
                    </a>

                    <a 
                      href={telegramAnnouncements} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center justify-center gap-3 bg-black/35 hover:bg-black/50 border border-white/25 rounded-2xl p-4 text-white font-bold transition-all text-sm group"
                    >
                      <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-6h2v6zm0-8h-2V7h2v1z" />
                      </svg>
                      <div>
                        <div className="text-left font-extrabold text-white text-sm">Join Announcements</div>
                        <div className="text-left text-xs text-white/70 font-normal">Exam updates & study keys</div>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
