import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Bookmark, Share2, Lightbulb, Check } from 'lucide-react';
import { toast } from 'sonner';

interface StudyTip {
  id: number;
  category: 'Strategy' | 'Motivation' | 'English Lexis' | 'Time Management' | 'Memory Hack';
  tip: string;
  author: string;
  subjectFocus?: string;
}

const STUDY_TIPS: StudyTip[] = [
  {
    id: 1,
    category: 'Time Management',
    tip: 'In JAMB CBT, you have 180 questions for 120 minutes (40s per question). Tackle Use of English comprehension passages FIRST when your mind is freshest, then allocate 35s per calculation question.',
    author: 'UTME Chief Examiner Guide',
    subjectFocus: 'General Strategy'
  },
  {
    id: 2,
    category: 'Strategy',
    tip: 'The Elimination Method: When unsure of a question, eliminate the two most obvious wrong answers first. Your probability of guessing correctly instantly jumps from 25% to 50%.',
    author: 'Scholars CBT Mentors',
    subjectFocus: 'All Subjects'
  },
  {
    id: 3,
    category: 'English Lexis',
    tip: 'Antonyms & Synonyms in JAMB: Watch out for contextual meaning rather than literal dictionary definitions. A word like "sanction" can mean both "to approve" and "to penalize" depending on syntax.',
    author: 'JAMB Use of English Faculty',
    subjectFocus: 'Use of English'
  },
  {
    id: 4,
    category: 'Memory Hack',
    tip: 'Feynman Technique for Sciences: If you cannot explain Physics kinematics or Chemistry electrolysis in simple terms to a non-science student, you do not truly understand it yet. Practice explaining aloud.',
    author: 'Prof. Richard Feynman',
    subjectFocus: 'Physics & Chemistry'
  },
  {
    id: 5,
    category: 'Motivation',
    tip: 'Consistency beats intensity every single time. 45 minutes of daily focused CBT drill beats a frantic 8-hour cram session the night before the exam. Keep your daily streak alive!',
    author: 'Scholars Resort Academy',
    subjectFocus: 'Daily Mindset'
  },
  {
    id: 6,
    category: 'Strategy',
    tip: 'Never leave any question blank! JAMB has NO negative marking. If time is running out (under 2 minutes), quickly pick an educated guess for all remaining unanswered questions.',
    author: 'JAMB Official Exam Regulations',
    subjectFocus: 'Exam Speed'
  },
  {
    id: 7,
    category: 'Memory Hack',
    tip: 'Novel Study Strategy: Focus on character relationships in "The Life Changer". Who helped whom? What were their motivations? JAMB rarely asks dates; they test character decisions and moral consequences.',
    author: 'Literature Desk',
    subjectFocus: 'Compulsory Novel'
  }
];

export const DailyStudyTip = () => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Pick daily tip based on day of year
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    setCurrentTipIndex(dayOfYear % STUDY_TIPS.length);
  }, []);

  const handleNextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % STUDY_TIPS.length);
    setSaved(false);
  };

  const handleCopy = () => {
    const tip = STUDY_TIPS[currentTipIndex];
    navigator.clipboard.writeText(`💡 Daily UTME Tip: "${tip.tip}" — ${tip.author}`);
    setCopied(true);
    toast.success('Tip copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBookmark = () => {
    setSaved(!saved);
    toast.success(saved ? 'Tip removed from bookmarks' : 'Tip saved to your study notes!');
  };

  const tip = STUDY_TIPS[currentTipIndex];

  return (
    <Card className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
      
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 text-amber-500 dark:text-amber-400 rounded-lg">
              <Lightbulb className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
              Daily High-Yield Study Tip
            </span>
            <span className="text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
              {tip.category}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleBookmark}
              title="Bookmark Tip"
            >
              <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-amber-500 text-amber-500' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              title="Copy Tip"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleNextTip}
              title="Next Tip"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <p className="text-sm font-medium text-foreground/90 leading-relaxed">
          "{tip.tip}"
        </p>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-amber-500/10">
          <span className="flex items-center gap-1 text-xs">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="font-semibold text-foreground/80">{tip.author}</span>
          </span>
          <span className="font-mono text-[10px] bg-muted/50 px-2 py-0.5 rounded border border-border/50">
            {tip.subjectFocus}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
