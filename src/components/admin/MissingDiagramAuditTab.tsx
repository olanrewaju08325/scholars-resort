import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, Image as ImageIcon, Search, CheckCircle2, 
  Upload, Sparkles, Filter, RefreshCw, Eye, BookOpen, Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { fetchAllRowsPaginated } from '@/lib/supabasePagination';
import { OFFICIAL_JAMB_SUBJECTS, normalizeSubjectName } from '@/utils/subjectUtils';
import { toast } from 'sonner';

interface FlaggedQuestion {
  id: string;
  subject_id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  year?: number;
  quality_flags?: string[];
  image_url?: string;
  subjectName?: string;
}

export const MissingDiagramAuditTab: React.FC = () => {
  const [questions, setQuestions] = useState<FlaggedQuestion[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Load flagged questions from Supabase
  const loadFlaggedQuestions = async () => {
    setLoading(true);
    try {
      // 1. Load subjects map
      const { data: dbSubs } = await supabase.from('subjects').select('id, name');
      const subMap: Record<string, string> = {};
      if (dbSubs) {
        dbSubs.forEach(s => { subMap[s.id] = s.name; });
      }
      setSubjectsMap(subMap);

      // 2. Load all questions with 'needs_diagram' flag
      const allQuestions = await fetchAllRowsPaginated<FlaggedQuestion>(() =>
        supabase.from('questions')
          .select('id, subject_id, question_text, options, correct_answer, explanation, year, quality_flags')
          .contains('quality_flags', ['needs_diagram'])
      );

      const decorated = allQuestions.map(q => ({
        ...q,
        subjectName: subMap[q.subject_id] || 'Unknown Subject'
      }));

      setQuestions(decorated);
    } catch (err: any) {
      console.warn('Error loading flagged questions:', err);
      toast.error('Could not load flagged visual questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlaggedQuestions();
  }, []);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchSubject = selectedSubject === 'all' || 
        normalizeSubjectName(q.subjectName || '').toLowerCase() === selectedSubject.toLowerCase();
      const matchSearch = !searchQuery || 
        q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(q.year || '').includes(searchQuery);
      return matchSubject && matchSearch;
    });
  }, [questions, selectedSubject, searchQuery]);

  // Subject counts breakdown
  const subjectBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach(q => {
      const name = normalizeSubjectName(q.subjectName || 'Unknown');
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [questions]);

  // Remove flag (resolve question)
  const handleRemoveFlag = async (questionId: string) => {
    setResolvingId(questionId);
    try {
      const target = questions.find(q => q.id === questionId);
      const flags = (target?.quality_flags || []).filter(f => f !== 'needs_diagram' && f !== 'missing_figure');

      const { error } = await supabase
        .from('questions')
        .update({ quality_flags: flags })
        .eq('id', questionId);

      if (error) throw error;

      setQuestions(prev => prev.filter(q => q.id !== questionId));
      toast.success('Question visual requirement marked resolved!');
    } catch (err: any) {
      toast.error('Failed to resolve flag: ' + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  // Upload/Attach Diagram Image
  const handleAttachImage = async (questionId: string, file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        const target = questions.find(q => q.id === questionId);
        const flags = (target?.quality_flags || []).filter(f => f !== 'needs_diagram' && f !== 'missing_figure');

        let updatedQuestionText = target?.question_text || '';
        if (!updatedQuestionText.includes('![Diagram]')) {
          updatedQuestionText = `![Diagram](${dataUrl})\n\n${updatedQuestionText}`;
        }

        // Store diagram in question stem and remove flags
        const { error } = await supabase
          .from('questions')
          .update({
            question_text: updatedQuestionText,
            quality_flags: flags
          })
          .eq('id', questionId);

        if (error) throw error;

        setQuestions(prev => prev.filter(q => q.id !== questionId));
        toast.success('Diagram attached successfully! Question moved to verified pool.');
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error('Failed to attach diagram: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stat Banner */}
      <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-card shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold font-display">
                  Missing Diagrams & Figures Audit Hub
                </CardTitle>
                <CardDescription>
                  Identifies all {questions.length} questions referencing visuals ("in the diagram above", "circuit", "apparatus", "graph") that need figures.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadFlaggedQuestions}
              disabled={loading}
              className="font-bold text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Audit</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Subject Pills Breakdown */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all ${
                selectedSubject === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              All Subjects ({questions.length})
            </button>
            {Object.entries(subjectBreakdown).map(([name, count]) => (
              <button
                key={name}
                onClick={() => setSelectedSubject(name)}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all ${
                  selectedSubject.toLowerCase() === name.toLowerCase()
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
                }`}
              >
                {name} ({count})
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search flagged questions by text or year..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Flagged Questions List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          Auditing visual question requirements...
        </div>
      ) : filteredQuestions.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h4 className="font-bold text-foreground text-sm">No Missing Diagram Questions Found</h4>
          <p className="text-xs text-muted-foreground mt-1">
            All questions for the selected filter have diagrams attached or have been verified!
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q, idx) => (
            <Card key={q.id || idx} className="border-border bg-card hover:border-amber-500/40 transition-all">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-sm text-foreground">{q.subjectName}</span>
                    {q.year && (
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        JAMB {q.year}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase">
                      Missing Visual Figure
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Attach Image Upload Button */}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleAttachImage(q.id, e.target.files[0]);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        asChild
                        className="h-8 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 gap-1.5"
                      >
                        <span>
                          <Upload className="w-3.5 h-3.5" /> Attach Diagram Image
                        </span>
                      </Button>
                    </label>

                    {/* Mark Resolved / Unflag Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveFlag(q.id)}
                      disabled={resolvingId === q.id}
                      className="h-8 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                    </Button>
                  </div>
                </div>

                {/* Question Text */}
                <p className="text-xs sm:text-sm text-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/60">
                  {q.question_text}
                </p>

                {/* Options List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {(q.options || []).map((opt, oIdx) => (
                    <div key={oIdx} className="bg-muted/40 p-2 rounded-md border border-border/40">
                      <strong>{['A', 'B', 'C', 'D'][oIdx] || oIdx + 1})</strong> {opt}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
