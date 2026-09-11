import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlayCircle, CheckCircle2, XCircle, HelpCircle, Clock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InstantCBTSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: any | null;
}

export const InstantCBTSimulatorModal: React.FC<InstantCBTSimulatorModalProps> = ({ isOpen, onClose, question }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  if (!question) return null;

  const options: string[] = Array.isArray(question.options) ? question.options : [];
  const correctAnswer = question.correct_answer || question.correctAnswer || 'A';
  const explanation = question.explanation || 'No detailed explanation provided for this question yet.';
  const questionText = question.question_text || question.questionText || '';
  const subjectName = question.subjectName || question.subject_id || 'General';
  const examYear = question.year || 2024;

  const handleSelect = (optKey: string) => {
    setSelectedOption(optKey);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-slate-950 text-slate-100 border-slate-800 p-0 overflow-hidden shadow-2xl">
        {/* CBT Header bar matching live exam */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-lg">
              CBT
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-100 flex items-center gap-2">
                {subjectName} <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">UTME Mock Simulator</span>
              </h3>
              <p className="text-xs text-slate-400">Exam Year: {examYear} • Live Preview Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-amber-400">
              <Clock className="w-4 h-4" /> 01:59:45 remaining
            </div>
          </div>
        </div>

        {/* Question Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <span>Question 1 of 1</span>
              <span className="text-primary">Confidence Verified</span>
            </div>
            <div className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
              {questionText}
            </div>
          </div>

          {/* Options Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Select Answer Option:</h4>
            {options.map((opt, idx) => {
              const optKey = String.fromCharCode(65 + idx); // A, B, C, D...
              const isSelected = selectedOption === optKey;
              const isCorrect = optKey.toUpperCase() === correctAnswer.toUpperCase();

              let borderStyle = 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700';
              if (isSelected) {
                borderStyle = showExplanation && isCorrect 
                  ? 'border-emerald-500 bg-emerald-950/30 text-emerald-100'
                  : showExplanation && !isCorrect 
                  ? 'border-rose-500 bg-rose-950/30 text-rose-100'
                  : 'border-primary bg-primary/10 text-white';
              } else if (showExplanation && isCorrect) {
                borderStyle = 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(optKey)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 group ${borderStyle}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
                  }`}>
                    {optKey}
                  </span>
                  <div className="flex-1 text-sm sm:text-base pt-1">
                    {opt}
                  </div>
                  {showExplanation && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 self-center" />
                  )}
                  {showExplanation && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0 self-center" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation Box */}
          {showExplanation && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary/10 border border-primary/30 rounded-2xl p-5 space-y-2"
            >
              <h5 className="text-sm font-bold text-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Pedagogical Explanation (Correct Answer: {correctAnswer})
              </h5>
              <p className="text-sm text-slate-200 leading-relaxed">
                {explanation}
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setShowExplanation(!showExplanation)}
            className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 text-xs gap-2"
          >
            <HelpCircle className="w-4 h-4 text-primary" /> {showExplanation ? 'Hide Explanation' : 'Show Answer & Explanation'}
          </Button>

          <Button 
            onClick={onClose}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-6"
          >
            Close CBT Simulator
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const InstantCBTSimulator = InstantCBTSimulatorModal;
