import React, { useState } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, Timer, Trophy, Flame, Sparkles, ChevronRight, ChevronLeft, 
  CheckCircle2, Play, HardDrive, HelpCircle, ShieldCheck, Zap, Coins
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface StudentGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StudentGuideModal: React.FC<StudentGuideModalProps> = ({ open, onOpenChange }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const guideSteps = [
    {
      title: 'Welcome to Scholars Resort! 👋',
      subtitle: 'Your Simple 3-Step Guide to Scoring 300+ in JAMB/UTME',
      badge: 'Getting Started',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      description: 'We built this platform to be super easy to use, even if this is your first time using a study web app. Everything you need to pass JAMB is organized in one place.',
      icon: Sparkles,
      iconColor: 'text-primary',
      highlights: [
        { label: 'Real JAMB Past Questions', desc: 'Over 25,000+ verified past questions with full step-by-step explanations.' },
        { label: 'Earn As You Practice', desc: 'Get Scholar Coins & XP points every day you practice to unlock free prize tournaments!' },
        { label: '100% Mobile & Offline Friendly', desc: 'Works smoothly on your phone, even with slow or no internet connection.' }
      ]
    },
    {
      title: '1. Master CBT Exam Practice ⏱️',
      subtitle: 'Simulate the Real JAMB Computer Based Test',
      badge: 'Core Feature',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      description: 'Practice with standard JAMB 4-subject combinations (English, Mathematics, Physics, Chemistry, Biology, Economics, Government, Literature, etc.).',
      icon: Timer,
      iconColor: 'text-blue-500',
      highlights: [
        { label: '8-Key Keyboard Mode', desc: 'Supports JAMB official keys (A, B, C, D for options, P/N for Previous/Next, S for Submit).' },
        { label: 'Timed Mock Simulations', desc: 'Train your speed with real 2-hour timers so you never run out of time in the exam hall.' },
        { label: 'Instant Score & Corrections', desc: 'See your score breakdown immediately and learn from your mistakes.' }
      ],
      actionButton: {
        text: 'Try CBT Center Now',
        link: '/cbt'
      }
    },
    {
      title: '2. Daily Study Sequence & Coins ⚡',
      subtitle: 'Never Break Your Streak to Unlock Mega Rewards',
      badge: 'Rewards Engine',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      description: 'Consistency is what gets you into the university of your dreams. Doing just 5 to 10 questions a day builds your Sequence Streak.',
      icon: Flame,
      iconColor: 'text-amber-500',
      highlights: [
        { label: '3-Day, 7-Day & 14-Day Rewards', desc: 'Unlock Mystery Chests containing bonus XP, Scholar Coins, and Streak Shields.' },
        { label: 'Scholar Coins = Free Tournament Tickets', desc: 'Spend your earned coins to enter cash/airtime prize tournaments without paying real money.' },
        { label: 'Streak Freeze Protection', desc: 'Keep a Streak Freeze active so a busy day or power cut doesn’t reset your streak.' }
      ],
      actionButton: {
        text: 'View My Rewards & Streak',
        link: '/dashboard'
      }
    },
    {
      title: '3. Prize Tournaments & AI Tutor 🏆',
      subtitle: 'Compete, Win Real Prizes & Get Instant Explanations',
      badge: 'Competitions & AI',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      description: 'Challenge candidates across Nigeria in proctored live tournaments with real cash and airtime prizes!',
      icon: Trophy,
      iconColor: 'text-purple-500',
      highlights: [
        { label: 'Live Proctored Arena', desc: 'Fair, secure competitions with anti-cheat protection and live leaderboard rankings.' },
        { label: 'Instant AI Explanations', desc: 'Stuck on any calculation or tricky question? Ask the AI Tutor to break it down simply.' },
        { label: 'JAMB Novel Hub', desc: 'Read chapter summaries and test yourself on official UTME literature novels.' }
      ],
      actionButton: {
        text: 'Explore Tournament Arena',
        link: '/tournaments'
      }
    }
  ];

  const step = guideSteps[currentStep];
  const StepIcon = step.icon;

  const handleNext = () => {
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full p-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl">
        {/* Top Header */}
        <div className="bg-muted/40 p-5 sm:p-6 border-b border-border relative">
          <div className="flex items-center justify-between mb-3">
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${step.badgeColor}`}>
              {step.badge}
            </span>
            <span className="text-xs font-mono font-bold text-muted-foreground">
              Step {currentStep + 1} of {guideSteps.length}
            </span>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-card border border-border shadow-xs shrink-0">
              <StepIcon className={`w-7 h-7 ${step.iconColor}`} />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold font-display text-foreground">
                {step.title}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-medium">
                {step.subtitle}
              </DialogDescription>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mt-4">
            {guideSteps.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 flex-1 rounded-full cursor-pointer transition-all ${
                  idx === currentStep
                    ? 'bg-primary'
                    : idx < currentStep
                    ? 'bg-primary/40'
                    : 'bg-muted-foreground/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
            {step.description}
          </p>

          <div className="space-y-2.5">
            {step.highlights.map((h, idx) => (
              <div 
                key={idx} 
                className="p-3 rounded-xl bg-muted/30 border border-border/80 flex items-start gap-3"
              >
                <div className="p-1 rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">{h.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-normal">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {step.actionButton && (
            <div className="pt-1">
              <Button
                asChild
                variant="outline"
                className="w-full border-primary/30 text-primary hover:bg-primary/10 font-bold text-xs h-10 gap-2"
                onClick={() => onOpenChange(false)}
              >
                <Link to={step.actionButton.link}>
                  <Play className="w-3.5 h-3.5 fill-primary" />
                  {step.actionButton.text}
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="text-xs font-semibold gap-1 text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip Guide
            </Button>

            <Button
              size="sm"
              onClick={handleNext}
              className="bg-primary text-primary-foreground font-bold text-xs gap-1.5 px-4 h-9 shadow-xs"
            >
              {currentStep === guideSteps.length - 1 ? 'Ready to Start! 🚀' : 'Next Step'}
              {currentStep !== guideSteps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
