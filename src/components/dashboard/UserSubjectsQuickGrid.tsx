import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, Calculator, Atom, FlaskConical, Dna, Sprout, 
  TrendingUp, ShoppingBag, Receipt, Landmark, Compass, 
  PlayCircle, Layers, CheckCircle2, ChevronRight, Settings2,
  Sparkles, Check, AlertCircle, HelpCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  CANONICAL_UTME_SUBJECTS, 
  getCanonicalSubjectByName, 
  normalizeToCanonicalSubjectName,
  type CanonicalSubject 
} from '@/utils/subjectTaxonomy';

const SUBJECT_ICON_MAP: Record<string, React.ElementType> = {
  'book-open': BookOpen,
  'calculator': Calculator,
  'atom': Atom,
  'flask-conical': FlaskConical,
  'dna': Dna,
  'sprout': Sprout,
  'trending-up': TrendingUp,
  'shopping-bag': ShoppingBag,
  'receipt': Receipt,
  'landmark': Landmark,
  'compass': Compass,
};

const SUBJECT_COLOR_THEMES: Record<string, { bg: string; text: string; border: string; badge: string; ring: string }> = {
  'Use of English': {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30 hover:border-blue-500/60',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    ring: 'focus:ring-blue-500'
  },
  'Mathematics': {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30 hover:border-amber-500/60',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    ring: 'focus:ring-amber-500'
  },
  'Physics': {
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/30 hover:border-purple-500/60',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    ring: 'focus:ring-purple-500'
  },
  'Chemistry': {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    ring: 'focus:ring-emerald-500'
  },
  'Biology': {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30 hover:border-rose-500/60',
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    ring: 'focus:ring-rose-500'
  },
  'Economics': {
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/30 hover:border-cyan-500/60',
    badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    ring: 'focus:ring-cyan-500'
  },
  'Government': {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/30 hover:border-indigo-500/60',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    ring: 'focus:ring-indigo-500'
  },
  'Literature in English': {
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/30 hover:border-violet-500/60',
    badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    ring: 'focus:ring-violet-500'
  }
};

const DEFAULT_THEME = {
  bg: 'bg-primary/10',
  text: 'text-primary',
  border: 'border-border hover:border-primary/50',
  badge: 'bg-muted text-foreground border-border',
  ring: 'focus:ring-primary'
};

export const UserSubjectsQuickGrid: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'sciences' | 'commercial' | 'arts'>('all');

  // Resolved user subjects
  const rawSubjects = (profile?.utme_subjects && profile.utme_subjects.length > 0)
    ? profile.utme_subjects
    : ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];

  const userSubjectsList = rawSubjects.map((sName) => {
    const canonical = getCanonicalSubjectByName(sName);
    return {
      name: canonical ? canonical.name : normalizeToCanonicalSubjectName(sName),
      id: canonical ? canonical.id : sName,
      code: canonical ? canonical.code : 'UTME',
      iconName: canonical ? canonical.icon : 'book-open',
      isCompulsory: canonical?.isCompulsory || sName.toLowerCase().includes('english')
    };
  });

  // When edit modal opens, sync current selection
  const handleOpenEdit = () => {
    setSelectedSubjects(userSubjectsList.map(s => s.name));
    setIsEditModalOpen(true);
  };

  const toggleSubjectSelection = (subjName: string) => {
    if (subjName === 'Use of English') {
      toast.info('Use of English is compulsory for all UTME candidates.');
      return;
    }

    if (selectedSubjects.includes(subjName)) {
      setSelectedSubjects(prev => prev.filter(s => s !== subjName));
    } else {
      if (selectedSubjects.length >= 4) {
        toast.warning('JAMB allows exactly 4 subjects (Use of English + 3 electives). Remove one first.');
        return;
      }
      setSelectedSubjects(prev => [...prev, subjName]);
    }
  };

  const handleSaveSubjects = async () => {
    if (!profile?.id) {
      toast.error('Please log in to save your subjects.');
      return;
    }

    if (!selectedSubjects.includes('Use of English')) {
      toast.error('Use of English is compulsory for all UTME candidates.');
      return;
    }

    if (selectedSubjects.length !== 4) {
      toast.warning(`Please choose exactly 4 subjects (currently ${selectedSubjects.length} selected).`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ utme_subjects: selectedSubjects })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Your 4 UTME subjects have been saved successfully!');
      setIsEditModalOpen(false);
    } catch (err: any) {
      toast.error('Could not save subjects: ' + (err.message || 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const filteredElectives = CANONICAL_UTME_SUBJECTS.filter(s => {
    if (activeCategoryFilter === 'all') return true;
    return s.category === activeCategoryFilter;
  });

  return (
    <section className="space-y-3">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span>Your 4 UTME Subjects</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your registered exam combination. Tap any subject to solve past questions instantly.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenEdit}
          className="h-8 text-xs font-semibold gap-1.5 self-start sm:self-auto border-border/80 hover:bg-muted"
        >
          <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Change 4 Subjects</span>
        </Button>
      </div>

      {/* 4 Subjects Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {userSubjectsList.map((subject, idx) => {
          const theme = SUBJECT_COLOR_THEMES[subject.name] || DEFAULT_THEME;
          const IconComp = SUBJECT_ICON_MAP[subject.iconName] || BookOpen;

          return (
            <Card 
              key={subject.id || idx}
              className={`border transition-all duration-200 shadow-xs hover:shadow-md bg-card flex flex-col justify-between ${theme.border}`}
            >
              <CardContent className="p-4 flex flex-col h-full justify-between gap-3">
                {/* Subject Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className={`w-10 h-10 rounded-xl ${theme.bg} flex items-center justify-center shrink-0`}>
                      <IconComp className={`w-5 h-5 ${theme.text}`} />
                    </div>
                    {subject.isCompulsory ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        Compulsory
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        {subject.code}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-foreground line-clamp-1">
                    {subject.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Official UTME past questions with step-by-step explanations
                  </p>
                </div>

                {/* Direct Action Buttons */}
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                  <Button
                    onClick={() => navigate(`/practice?subjectId=${encodeURIComponent(subject.id)}&mode=subject`)}
                    className="w-full h-8 text-xs font-bold gap-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 transition-all"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Practice Past Qs</span>
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/practice?subjectId=${encodeURIComponent(subject.id)}&mode=topic`)}
                    className="w-full h-7 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 gap-1"
                  >
                    <Layers className="w-3 h-3 text-muted-foreground" />
                    <span>Study by Topic</span>
                    <ChevronRight className="w-3 h-3 ml-auto opacity-70" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Subjects Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-5 sm:p-6 bg-card border-border">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span>Choose Your 4 UTME Subjects</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select exactly 4 subjects for your JAMB exam combination. Use of English is compulsory for all candidates.
            </DialogDescription>
          </DialogHeader>

          {/* Current Selection Summary Banner */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Selected:</span>
              <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                selectedSubjects.length === 4 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}>
                {selectedSubjects.length} / 4 Subjects
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {selectedSubjects.length === 4 ? 'Ready to save!' : `Select ${4 - selectedSubjects.length} more`}
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1 custom-scrollbar">
            {(['all', 'sciences', 'commercial', 'arts'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                  activeCategoryFilter === cat
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {cat === 'all' ? 'All Subjects' : cat}
              </button>
            ))}
          </div>

          {/* Subjects List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[340px] custom-scrollbar py-2">
            {filteredElectives.map((subj) => {
              const isSelected = selectedSubjects.includes(subj.name);
              const isCompulsory = subj.isCompulsory;
              const IconComp = SUBJECT_ICON_MAP[subj.icon] || BookOpen;

              return (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => toggleSubjectSelection(subj.name)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-primary font-semibold shadow-xs'
                      : 'bg-card hover:bg-muted/50 border-border text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold truncate flex items-center gap-2">
                        <span>{subj.name}</span>
                        {isCompulsory && (
                          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                            Compulsory
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {subj.category} • Code: {subj.code}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      isSelected 
                        ? 'bg-primary border-primary text-primary-foreground' 
                        : 'border-muted-foreground/40'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <DialogFooter className="pt-3 border-t border-border flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSubjects}
              disabled={saving || selectedSubjects.length !== 4}
              className="text-xs h-9 font-bold bg-primary text-primary-foreground gap-1.5"
            >
              {saving ? 'Saving...' : 'Save 4 Subjects'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
