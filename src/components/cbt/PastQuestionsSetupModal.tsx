import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  History, BookOpen, Calendar, Clock, CheckCircle2, 
  Sparkles, PlayCircle, Layers, RefreshCw 
} from 'lucide-react';
import { OFFICIAL_JAMB_SUBJECTS } from '@/utils/subjectUtils';
import { authFetch } from '@/lib/apiAuth';

interface PastQuestionsSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExam?: (params: { subject: string; year: string; drillMode: 'exam' | 'practice'; count: number }) => void;
}

export const PastQuestionsSetupModal: React.FC<PastQuestionsSetupModalProps> = ({
  isOpen,
  onClose,
  onStartExam
}) => {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string>('Use of English');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [drillMode, setDrillMode] = useState<'exam' | 'practice'>('exam');
  const [questionCount, setQuestionCount] = useState<number>(40);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loadingYears, setLoadingYears] = useState<boolean>(false);

  // Fetch available years for the selected subject
  useEffect(() => {
    if (isOpen) {
      const fetchYears = async () => {
        setLoadingYears(true);
        try {
          const res = await authFetch(`/api/cbt/past-question-years?subjectId=${encodeURIComponent(selectedSubject)}`);
          const data = await res.json();
          if (data && data.success && Array.isArray(data.years) && data.years.length > 0) {
            setAvailableYears(data.years);
          } else {
            setAvailableYears([2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010]);
          }
        } catch (_) {
          setAvailableYears([2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010]);
        } finally {
          setLoadingYears(false);
        }
      };
      fetchYears();
    }
  }, [isOpen, selectedSubject]);

  const handleLaunch = () => {
    if (onStartExam) {
      onStartExam({
        subject: selectedSubject,
        year: selectedYear,
        drillMode,
        count: questionCount
      });
    } else {
      navigate(`/cbt/past-questions?subject=${encodeURIComponent(selectedSubject)}&year=${selectedYear}&drillMode=${drillMode}&count=${questionCount}`);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl bg-card border-border shadow-2xl p-6 text-foreground">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
              <History className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-display flex items-center gap-2">
                JAMB UTME Past Question Drills
                <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px] font-semibold">
                  Official Archives
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select your JAMB subject, paper year, and drill mode to launch targeted practice.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1: JAMB Subject Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-primary" /> Select JAMB UTME Subject
            </Label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-muted/40 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {OFFICIAL_JAMB_SUBJECTS.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Year Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-orange-500" /> Exam Paper Year
              </Label>
              {loadingYears && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Syncing Years...</span>}
            </div>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-muted/40 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">🔀 All-Time Master Shuffle (Random Past Papers)</option>
              <option value="last_5">⚡ Recent 5 Years Combined (2020 - 2024)</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  JAMB UTME {yr} Official Paper
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: Drill Mode Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-500" /> Practice & Timer Mode
            </Label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDrillMode('exam')}
                className={`p-3 rounded-xl border text-left transition-all text-xs space-y-1 ${
                  drillMode === 'exam'
                    ? 'border-orange-500 bg-orange-500/10 text-foreground font-semibold shadow-xs'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <div className="font-bold flex items-center justify-between text-foreground">
                  <span>CBT Exam Mode</span>
                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/30">Timed</Badge>
                </div>
                <p className="text-[11px] opacity-80 font-normal">Strict exam timer, score out of 400, solutions revealed after submission.</p>
              </button>

              <button
                type="button"
                onClick={() => setDrillMode('practice')}
                className={`p-3 rounded-xl border text-left transition-all text-xs space-y-1 ${
                  drillMode === 'practice'
                    ? 'border-orange-500 bg-orange-500/10 text-foreground font-semibold shadow-xs'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <div className="font-bold flex items-center justify-between text-foreground">
                  <span>Interactive Practice</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Untimed</Badge>
                </div>
                <p className="text-[11px] opacity-80 font-normal">Step-by-step instant answer verification and AI explanations per question.</p>
              </button>
            </div>
          </div>

          {/* Step 4: Question Quantity */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-500" /> Question Quantity
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {[20, 40, 60].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                    questionCount === count
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  {count} Questions {count === 40 ? '(Standard)' : count === 60 ? '(English)' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs h-9 px-4"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleLaunch}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs h-10 px-6 gap-2 shadow-lg shadow-orange-600/30"
          >
            <PlayCircle className="w-4 h-4" /> Start {selectedSubject} Drill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
