import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Activity, Brain, Bell, Users, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GuardianLanding() {
  const benefits = [
    { icon: Activity, title: 'Real-Time Monitoring', desc: 'Track your ward\'s study hours, mock exam scores, and syllabus coverage live.' },
    { icon: Brain, title: 'AI Performance Insights', desc: 'Receive detailed AI-generated reports on their strengths and weak subjects.' },
    { icon: Bell, title: 'Instant Alerts', desc: 'Get notified immediately if they miss a scheduled study session or mock exam.' },
    { icon: ShieldCheck, title: 'Secure Access', desc: 'Your account is securely linked to your ward via a unique invite link.' }
  ];

  return (
    <div className="min-h-screen bg-slate-950/50 flex flex-col">
      {/* Navbar */}
      <header className="py-6 px-4 md:px-8 max-w-7xl w-full mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-display font-bold">Scholars Resort <span className="text-primary font-normal text-sm uppercase tracking-wider ml-1">For Guardians</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild><Link to="/login">Guardian Login</Link></Button>
          <Button asChild className="hidden md:flex"><Link to="/signup">Create Free Account</Link></Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm border border-primary/20">
            <CheckCircle2 className="w-4 h-4" /> Trusted by 10,000+ Nigerian Parents
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight leading-tight">
            Take the guesswork out of <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">JAMB Prep.</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Get total visibility into your ward's academic progress. Monitor their CBT scores, study streaks, and AI performance reports from anywhere.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg shadow-xl shadow-primary/20" asChild>
              <Link to="/signup">Start Monitoring for Free</Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-4 sm:mt-0 sm:ml-4">Requires an invite link from a registered student.</p>
          </div>
        </motion.div>
      </section>

      {/* Benefits Grid */}
      <section className="py-20 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Complete Peace of Mind</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Our Guardian OS gives you the exact tools you need to ensure they are on the right track for university admission.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((b, i) => (
              <Card key={i} className="bg-background border-border shadow-sm hover:border-primary/50 transition-colors">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <b.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold font-display mb-3">{b.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 text-center text-muted-foreground border-t border-border">
        <p>&copy; {new Date().getFullYear()} Scholars Resort. All rights reserved.</p>
      </footer>
    </div>
  );
}
