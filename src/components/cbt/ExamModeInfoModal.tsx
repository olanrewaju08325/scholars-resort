import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Timer, 
  Sparkles, 
  Check, 
  ShieldAlert, 
  Award, 
  HelpCircle, 
  Zap, 
  BookOpen, 
  ArrowRight,
  BrainCircuit,
  Lock,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ExamModeInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode?: (mode: 'exam' | 'practice') => void;
}

export const ExamModeInfoModal: React.FC<ExamModeInfoModalProps> = ({
  isOpen,
  onClose,
  onSelectMode
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-3xl max-h-[90vh] bg-card text-card-foreground rounded-2xl shadow-2xl border border-border flex flex-col z-10 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exam-mode-guide-title"
        >
          {/* Header */}
          <div className="p-5 border-b border-border bg-gradient-to-r from-primary/10 via-background to-purple-500/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 id="exam-mode-guide-title" className="font-bold text-lg text-foreground flex items-center gap-2">
                  Learning Mode Guide
                  <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    JAMB / WAEC Optimized
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Understand the difference between CBT Exam Mode & Interactive Practice
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full text-muted-foreground hover:text-foreground h-9 w-9"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-6">
            
            {/* Side by Side Mode Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* CBT Exam Mode Card */}
              <div className="rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-500/5 via-card to-card p-5 flex flex-col justify-between space-y-4 shadow-xs hover:border-red-500/50 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 font-bold text-xs flex items-center gap-1.5">
                      <Timer className="w-4 h-4" /> Timed & Strict
                    </span>
                    <Badge variant="outline" className="border-red-500/30 text-red-600 dark:text-red-400 text-[10px] uppercase font-bold">
                      Exam Simulation
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-foreground">CBT Exam Mode</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Mirrors the exact official JAMB/WAEC CBT software layout, time limits, and strict proctored environment.
                    </p>
                  </div>

                  <ul className="space-y-2 pt-2 text-xs text-foreground/90">
                    <li className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                      <span><strong>120-Minute Countdown:</strong> Real exam timer with automatic submission upon expiry.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock className="w-3 h-3" />
                      </div>
                      <span><strong>Proctor Security:</strong> Keyboard shortcuts disabled & tab-switch warnings enabled.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Award className="w-3 h-3" />
                      </div>
                      <span><strong>Strict Scoring:</strong> Official score out of 400 + JAMB national rank percentile.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                      <span><strong>Post-Exam Review:</strong> Detailed explanations unlocked ONLY after full submission.</span>
                    </li>
                  </ul>
                </div>

                {onSelectMode && (
                  <Button 
                    onClick={() => {
                      onSelectMode('exam');
                      onClose();
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-10 gap-2 mt-2"
                  >
                    Start CBT Exam Mode <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Interactive Practice Card */}
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 via-card to-card p-5 flex flex-col justify-between space-y-4 shadow-xs hover:border-emerald-500/50 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                      <Zap className="w-4 h-4" /> Untimed & Learning
                    </span>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold">
                      Mastery Mode
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-foreground">Interactive Practice</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Self-paced study environment designed to build core subject mastery with immediate feedback.
                    </p>
                  </div>

                  <ul className="space-y-2 pt-2 text-xs text-foreground/90">
                    <li className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                      <span><strong>No Time Pressure:</strong> Untimed practice allows you to dissect each question thoroughly.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="w-3 h-3" />
                      </div>
                      <span><strong>Instant Feedback:</strong> See if your selected option is right or wrong immediately.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <BrainCircuit className="w-3 h-3" />
                      </div>
                      <span><strong>On-Demand AI Tutor:</strong> AI explanations breaking down formulas, steps & tricks.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <BookOpen className="w-3 h-3" />
                      </div>
                      <span><strong>Option Striker:</strong> Eliminate wrong options and practice active recall.</span>
                    </li>
                  </ul>
                </div>

                {onSelectMode && (
                  <Button 
                    onClick={() => {
                      onSelectMode('practice');
                      onClose();
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 gap-2 mt-2"
                  >
                    Start Interactive Practice <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>

            </div>

            {/* Direct Comparison Matrix */}
            <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-primary" /> Feature Comparison Matrix
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold">
                      <th className="py-2 px-3">Feature</th>
                      <th className="py-2 px-3 text-red-600 dark:text-red-400">CBT Exam Mode</th>
                      <th className="py-2 px-3 text-emerald-600 dark:text-emerald-400">Interactive Practice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-foreground">Countdown Timer</td>
                      <td className="py-2 px-3 text-foreground font-medium">Strict 120-min limit</td>
                      <td className="py-2 px-3 text-muted-foreground">Untimed (or optional Stopwatch)</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-foreground">Answer Feedback</td>
                      <td className="py-2 px-3 text-muted-foreground">Hidden until exam finish</td>
                      <td className="py-2 px-3 text-foreground font-medium">Instant right/wrong reveal</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-foreground">AI Tutor Step-by-Step</td>
                      <td className="py-2 px-3 text-muted-foreground">Available in Post-Exam Review</td>
                      <td className="py-2 px-3 text-foreground font-medium">Available immediately per question</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-foreground">Proctor Anti-Cheat</td>
                      <td className="py-2 px-3 text-foreground font-medium">Active (Shortcut & Focus locks)</td>
                      <td className="py-2 px-3 text-muted-foreground">Relaxed for learning</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-foreground">Scoring & Ranking</td>
                      <td className="py-2 px-3 text-foreground font-medium">Official 400 Scale + Leaderboard</td>
                      <td className="py-2 px-3 text-muted-foreground">Accuracy % & Mastery Badge</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommendation Helper */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-3 text-xs">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-foreground block text-sm">Study Strategy Tip:</span>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  Start with <strong>Interactive Practice</strong> to build deep conceptual understanding, then switch to <strong>CBT Exam Mode</strong> in your final weeks to master speed and pressure management!
                </p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-card flex items-center justify-end">
            <Button
              onClick={onClose}
              variant="outline"
              className="font-semibold text-xs h-9 px-5"
            >
              Got It, Close Guide
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
