import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PomodoroTimer } from '@/components/study-plan/PomodoroTimer';
import { StudySchedule } from '@/components/study-plan/StudySchedule';
import { BurnoutDetector } from '@/components/study-plan/BurnoutDetector';
import { AIRecommendations } from '@/components/AIRecommendations';
import { JAMBScorePredictor } from '@/components/dashboard/JAMBScorePredictor';
import { Calendar, BrainCircuit, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function StudyPlan() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<{ history: { name: string, score: number }[] }>({ history: [] });
  
  useEffect(() => {
    if (profile?.id) {
      supabase.from('exam_sessions').select('*').eq('user_id', profile.id).eq('status', 'submitted').then(({ data }) => {
        if (data) {
          const hist = data.map((ex, i) => ({
            name: `Exam ${i+1}`,
            score: Math.round(((ex.score || 0) / (ex.total_questions || 50)) * 400)
          }));
          setStats({ history: hist });
        }
      });
    }
  }, [profile]);

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto space-y-8 bg-slate-950/50 min-h-screen pb-20">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6"
      >
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Intelligent Study Plan</h1>
          <p className="text-muted-foreground mt-1 text-lg">Your personalized, AI-driven roadmap to JAMB success.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column (Main) */}
        <div className="lg:col-span-8 space-y-8">
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <PomodoroTimer />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <h2 className="text-xl font-bold font-display mb-4">AI Recommended Focus Areas</h2>
            <AIRecommendations profileId={profile?.id || ''} examsData={stats.history} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <StudySchedule />
          </motion.div>

        </div>

        {/* Right Column (Sidebar) */}
        <div className="lg:col-span-4 space-y-8">
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <BurnoutDetector />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
            <JAMBScorePredictor />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            {/* Motivational Quote */}
            <Card className="bg-primary/10 border-primary/20 shadow-sm relative overflow-hidden">
              <Quote className="absolute -top-4 -right-4 w-24 h-24 text-primary/10 rotate-12" />
              <CardContent className="p-6 relative z-10">
                <p className="italic text-lg font-display font-medium text-foreground mb-4">
                  "Education is the most powerful weapon which you can use to change the world."
                </p>
                <p className="text-sm font-bold text-primary uppercase tracking-wider">— Nelson Mandela</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
            {/* Mini Calendar */}
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center py-10">
                <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="font-bold mb-2">Monthly Calendar</h3>
                <p className="text-sm text-muted-foreground mb-4">View your full month's study schedule and exam dates.</p>
                <Button variant="outline" className="w-full">Open Calendar</Button>
              </CardContent>
            </Card>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
