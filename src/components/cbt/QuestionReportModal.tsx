import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Send, CheckCircle2, MessageSquare, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { reportStudentProblem } from '@/services/problemReporterService';
import { toast } from 'sonner';

interface QuestionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: any;
  questionIndex: number;
  subjectName?: string;
  year?: string | number;
}

export const QuestionReportModal: React.FC<QuestionReportModalProps> = ({
  isOpen,
  onClose,
  question,
  questionIndex,
  subjectName,
  year
}) => {
  const [issueCategory, setIssueCategory] = useState<'question_error' | 'math_render_issue' | 'missing_explanation' | 'general_student_struggle'>('question_error');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !question) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const qTextSnippet = typeof question.question_text === 'string' 
        ? question.question_text.slice(0, 100) 
        : 'Question details';

      const categoryLabels: Record<string, string> = {
        question_error: 'Typo / Incorrect Answer Key / Bad Option',
        math_render_issue: 'Mathematical Equation Formatting Error',
        missing_explanation: 'Missing / Unclear Explanation',
        general_student_struggle: 'Ambiguous Question Wording'
      };

      const success = await reportStudentProblem({
        type: issueCategory,
        title: `Question Issue (Q${questionIndex + 1}): ${categoryLabels[issueCategory] || 'Reported Issue'}`,
        description: `Student reported issue on Q${questionIndex + 1}:\n"${details.trim() || 'No additional note provided.'}"\n\nQuestion Text Snippet: "${qTextSnippet}"`,
        subject_name: subjectName || question.subject_name || 'General',
        year: year || question.year || 'N/A',
        question_id: question.id,
        metadata: {
          question_text: question.question_text,
          options: question.options,
          correct_option: question.correct_option
        }
      });

      if (success) {
        setIsSuccess(true);
        toast.success('Thank you! Admin team has been notified of this question issue.');
        setTimeout(() => {
          setIsSuccess(false);
          setDetails('');
          onClose();
        }, 1500);
      } else {
        toast.error('Could not send report. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative w-full max-w-lg bg-card text-card-foreground rounded-2xl shadow-2xl border border-border p-6 overflow-hidden z-10 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  Report Question #{questionIndex + 1} Issue
                  <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600 dark:text-red-400">
                    Direct Admin Dispatch
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  {subjectName || question.subject_name || 'JAMB UTME'} {year ? `(${year})` : ''}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full h-8 w-8 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-base text-foreground">Alert Dispatched to Admins!</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Our academic reviewers monitor this queue continuously to correct typos, answer keys, or formatting errors.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Question Text Snippet Preview */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground line-clamp-2">
                <strong className="text-foreground font-semibold">Q{questionIndex + 1}:</strong> {question.question_text || 'Question Content'}
              </div>

              {/* Issue Category Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Issue Category</label>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="question_error">❌ Incorrect Options / Wrong Answer Key / Typo</option>
                  <option value="math_render_issue">📐 Mathematical Equation Formatting Error</option>
                  <option value="missing_explanation">💡 Missing or Incomplete Solution Step</option>
                  <option value="general_student_struggle">❓ Confusing / Ambiguous Wording</option>
                </select>
              </div>

              {/* Details Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Explain What Is Wrong (Optional)</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="e.g. Option B says 45m/s but calculated answer is 50m/s..."
                  className="w-full h-24 p-3 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Sending Alert...' : 'Alert Admin Team'}
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
