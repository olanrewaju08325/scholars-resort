import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BrainCircuit, BookOpen, Target, Sparkles, Trophy, Users, ShieldCheck, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Features() {
  useEffect(() => {
    // Scroll to hash if present on mount
    if (window.location.hash === '#about') {
      setTimeout(() => {
        const el = document.getElementById('about');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <Navbar />

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <main className="container mx-auto px-6 pt-32 pb-24">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6 backdrop-blur-md">
              <Sparkles className="w-4 h-4" /> Unfair Advantage
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-extrabold leading-tight mb-6">
              Everything you need to <span className="gradient-text">score 300+</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              We've engineered the perfect environment for JAMB success. Discover the features that make Scholars Resort the ultimate preparation platform.
            </p>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32">
          {/* Feature 1 */}
          <div className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-premium transition-shadow">
            <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-6">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-display mb-3">Realistic CBT Simulator</h3>
            <p className="text-muted-foreground leading-relaxed">
              Experience the exact interface and time pressure of the real JAMB exam. Build confidence and eliminate exam anxiety.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-premium transition-shadow">
            <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 mb-6">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-display mb-3">AI Smart Tutor</h3>
            <p className="text-muted-foreground leading-relaxed">
              Stuck on a question? Our AI tutor explains complex topics instantly, breaking them down into easy-to-understand concepts.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-premium transition-shadow">
            <div className="w-14 h-14 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 mb-6">
              <Target className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-display mb-3">Weakness Drill</h3>
            <p className="text-muted-foreground leading-relaxed">
              Our algorithm tracks your performance and automatically generates custom practice sessions targeting your weakest topics.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-premium transition-shadow">
            <div className="w-14 h-14 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500 mb-6">
              <BarChart3 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-display mb-3">Performance Analytics</h3>
            <p className="text-muted-foreground leading-relaxed">
              Real-time score tracking, speed analytics, national percentile rankings, and comprehensive topic-by-topic breakdowns.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-premium transition-shadow">
            <div className="w-14 h-14 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500 mb-6">
              <Trophy className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-display mb-3">Weekly Tournaments</h3>
            <p className="text-muted-foreground leading-relaxed">
              Compete with thousands of students nationwide in our scheduled weekend mock exams and climb the leaderboard.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-premium transition-shadow">
            <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-500 mb-6">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-display mb-3">Offline Sync</h3>
            <p className="text-muted-foreground leading-relaxed">
              No data? No problem. Practice offline and sync your results automatically when you reconnect to the internet.
            </p>
          </div>
        </div>

        {/* About Section */}
        <section id="about" className="pt-20 border-t border-border">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-8">About Scholars Resort</h2>
            <div className="prose prose-invert prose-lg mx-auto text-muted-foreground leading-relaxed">
              <p>
                Scholars Resort was founded with a singular mission: to democratize access to high-quality JAMB preparation for Nigerian students. 
              </p>
              <p className="mt-6">
                We observed that many brilliant students fail the UTME not because of a lack of knowledge, but due to unfamiliarity with the Computer Based Test (CBT) environment, time management issues, and an inability to pinpoint their weak areas before the exam.
              </p>
              <p className="mt-6">
                By combining cutting-edge web technologies, artificial intelligence, and deep educational analytics, we have built a platform that doesn't just test you—it teaches you, guides you, and ensures you walk into the exam hall completely prepared.
              </p>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
