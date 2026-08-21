import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, Sparkles, CheckCircle2, UserCheck, 
  Bookmark, ArrowRight, ArrowLeft, Search, RefreshCw, Layers, Quote, BookA
} from 'lucide-react';
import { fetchJambBooks } from '@/services/novelService';
import type { LiteratureBook, NovelChapter } from '@/data/jambNovelsData';
import { toast } from 'sonner';

export const JambNovelHub = () => {
  const [books, setBooks] = useState<LiteratureBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('the-life-changer');
  const [selectedChapter, setSelectedChapter] = useState<NovelChapter | null>(null);
  const [activeQuizMode, setActiveQuizMode] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Load books from live database
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchJambBooks();
        setBooks(data);
        if (data.length > 0) {
          setSelectedBookId(data[0].id);
          if (data[0].chapters.length > 0) {
            setSelectedChapter(data[0].chapters[0]);
          }
        }
      } catch (err) {
        console.error('Error loading novel data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();

    const handleUpdate = () => {
      load();
    };
    window.addEventListener('literature_updated', handleUpdate);
    return () => window.removeEventListener('literature_updated', handleUpdate);
  }, []);

  const currentBook = books.find(b => b.id === selectedBookId) || books[0];

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    setActiveQuizMode(false);
    resetQuiz();
    const bk = books.find(b => b.id === bookId);
    if (bk && bk.chapters.length > 0) {
      setSelectedChapter(bk.chapters[0]);
    } else {
      setSelectedChapter(null);
    }
  };

  const filteredChapters = currentBook?.chapters.filter(ch => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ch.title.toLowerCase().includes(q) ||
      ch.summary.toLowerCase().includes(q) ||
      ch.keyThemes.some(t => t.toLowerCase().includes(q)) ||
      ch.charactersInvolved.some(c => c.toLowerCase().includes(q))
    );
  }) || [];

  const handleAnswerSelect = (optLetter: string) => {
    if (selectedAnswer !== null || !selectedChapter) return;
    setSelectedAnswer(optLetter);
    setShowExplanation(true);
    if (optLetter === selectedChapter.sampleQuestions[currentQIndex]?.correct) {
      setScore(prev => prev + 1);
      toast.success('Correct Answer! 🎉');
    } else {
      toast.error('Incorrect. Review syllabus explanation.');
    }
  };

  const handleNextQuestion = () => {
    if (!selectedChapter) return;
    if (currentQIndex < selectedChapter.sampleQuestions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      const finalScore = score + (selectedAnswer === selectedChapter.sampleQuestions[currentQIndex]?.correct ? 1 : 0);
      toast.success(`Chapter Quiz Completed! You scored ${finalScore} / ${selectedChapter.sampleQuestions.length}`);
    }
  };

  const resetQuiz = () => {
    setCurrentQIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">Loading Official JAMB Literature & Novel Hub...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-primary/20 via-indigo-950/40 to-purple-950/30 border border-primary/30 relative overflow-hidden shadow-lg">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" /> Compulsory Use of English & Literature Hub
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold font-display text-foreground">
            Official JAMB UTME Literature & Novel Masterclass
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-3xl leading-relaxed">
            Master every chapter of <strong className="text-foreground">The Life Changer</strong> and official JAMB Literature texts with chapter summaries, character analyses, key themes, vocabulary drills, and real UTME practice questions.
          </p>
        </div>
      </div>

      {/* Book Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {books.map((bk) => (
          <button
            key={bk.id}
            onClick={() => handleSelectBook(bk.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${
              selectedBookId === bk.id
                ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/20'
                : 'bg-card text-muted-foreground hover:text-foreground border-border hover:border-primary/40'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{bk.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-mono">
              {bk.genre}
            </span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Search by chapter title, character (e.g. Omar, Talle, Salma), theme, or plot keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 text-xs bg-card border-border"
        />
      </div>

      {/* Main Content Layout */}
      {currentBook && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chapter Navigation Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" /> Chapter Directory ({filteredChapters.length})
              </h3>
              <span className="text-[11px] font-semibold text-primary">{currentBook.author}</span>
            </div>

            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {filteredChapters.map((ch) => (
                <Card
                  key={ch.id}
                  onClick={() => {
                    setSelectedChapter(ch);
                    setActiveQuizMode(false);
                    resetQuiz();
                  }}
                  className={`cursor-pointer transition-all border ${
                    selectedChapter?.id === ch.id
                      ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/40'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <CardContent className="p-3.5 flex items-center justify-between">
                    <div className="truncate pr-2">
                      <p className="text-[11px] font-bold text-primary uppercase">
                        Chapter {ch.chapterNumber || ch.id}
                      </p>
                      <p className="text-xs font-bold text-foreground truncate mt-0.5">
                        {ch.title.split(': ')[1] || ch.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {ch.sampleQuestions?.length || 0} Questions • {ch.charactersInvolved?.length || 0} Characters
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}

              {filteredChapters.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                  No chapters match your search query.
                </div>
              )}
            </div>
          </div>

          {/* Selected Chapter View / Quiz View */}
          <div className="lg:col-span-8 space-y-6">
            {selectedChapter ? (
              !activeQuizMode ? (
                <Card className="border-border bg-card text-card-foreground shadow-lg">
                  <CardHeader className="border-b border-border bg-muted/20 pb-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-xs font-bold text-primary uppercase tracking-wide">
                          {currentBook.title} • {currentBook.genre}
                        </span>
                        <CardTitle className="text-lg sm:text-xl font-bold font-display text-foreground mt-0.5">
                          {selectedChapter.title}
                        </CardTitle>
                      </div>
                      <Button
                        onClick={() => {
                          setActiveQuizMode(true);
                          resetQuiz();
                        }}
                        className="bg-primary hover:bg-primary/90 font-bold gap-2 text-xs h-9"
                      >
                        <Sparkles className="w-4 h-4" /> Practice Chapter Questions ({selectedChapter.sampleQuestions?.length || 0})
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 sm:p-6 space-y-6">
                    {/* Plot Summary */}
                    <div>
                      <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" /> Chapter Plot Summary & Key Events
                      </h4>
                      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed bg-muted/30 p-4 rounded-xl border border-border whitespace-pre-wrap">
                        {selectedChapter.summary}
                      </p>
                    </div>

                    {/* Characters & Themes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Characters */}
                      <div className="bg-muted/20 p-4 rounded-xl border border-border space-y-2">
                        <h4 className="text-xs font-extrabold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4" /> Characters in this Chapter
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedChapter.charactersInvolved?.map((c, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-md text-xs font-semibold bg-card text-foreground border border-border">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Themes */}
                      <div className="bg-muted/20 p-4 rounded-xl border border-border space-y-2">
                        <h4 className="text-xs font-extrabold text-purple-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Bookmark className="w-4 h-4" /> Key Themes & Morals
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedChapter.keyThemes?.map((t, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Key Quotes if available */}
                    {selectedChapter.keyQuotes && selectedChapter.keyQuotes.length > 0 && (
                      <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl space-y-2">
                        <h4 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Quote className="w-4 h-4" /> Notable Quotes & Literary Lines
                        </h4>
                        <div className="space-y-1.5">
                          {selectedChapter.keyQuotes.map((q, i) => (
                            <p key={i} className="text-xs italic text-foreground/90 font-serif">
                              {q}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vocabulary Drills if available */}
                    {selectedChapter.vocabulary && selectedChapter.vocabulary.length > 0 && (
                      <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl space-y-2">
                        <h4 className="text-xs font-extrabold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                          <BookA className="w-4 h-4" /> High-Yield Vocabulary
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedChapter.vocabulary.map((v, i) => (
                            <div key={i} className="p-2 bg-card rounded border border-border text-xs">
                              <strong className="text-primary">{v.word}:</strong> <span className="text-muted-foreground">{v.meaning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Call to Action */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-xs font-bold text-foreground">Ready to test your comprehension?</p>
                        <p className="text-[11px] text-muted-foreground">Practice {selectedChapter.sampleQuestions?.length || 0} real past UTME questions from this chapter.</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveQuizMode(true);
                          resetQuiz();
                        }}
                        className="bg-primary hover:bg-primary/90 font-bold text-xs"
                      >
                        Start Practice Drill
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              ) : (
                /* Chapter Quiz View */
                <Card className="border-primary/30 bg-card text-card-foreground shadow-xl">
                  <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between pb-4">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Chapter {selectedChapter.chapterNumber || selectedChapter.id} Practice Quiz
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Question {currentQIndex + 1} of {selectedChapter.sampleQuestions.length} • Score: {score}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActiveQuizMode(false)} className="gap-1 font-semibold text-xs h-8">
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Notes
                    </Button>
                  </CardHeader>

                  <CardContent className="p-5 sm:p-6 space-y-6">
                    {selectedChapter.sampleQuestions && selectedChapter.sampleQuestions.length > 0 ? (
                      <>
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                          <span className="text-[10px] font-bold text-primary uppercase">Question {currentQIndex + 1}</span>
                          <p className="text-sm sm:text-base font-bold text-foreground mt-1">
                            {selectedChapter.sampleQuestions[currentQIndex]?.question}
                          </p>
                        </div>

                        <div className="space-y-3">
                          {selectedChapter.sampleQuestions[currentQIndex]?.options.map((opt, i) => {
                            const optLetter = opt.substring(0, 1);
                            const isCorrect = optLetter === selectedChapter.sampleQuestions[currentQIndex].correct;
                            const isSelected = selectedAnswer === optLetter;

                            let btnStyle = "border-border hover:border-primary/50 bg-background text-foreground";
                            if (selectedAnswer !== null) {
                              if (isCorrect) btnStyle = "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400 font-bold";
                              else if (isSelected) btnStyle = "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 font-bold";
                            }

                            return (
                              <button
                                key={i}
                                onClick={() => handleAnswerSelect(optLetter)}
                                disabled={selectedAnswer !== null}
                                className={`w-full p-3.5 rounded-xl text-left border text-xs sm:text-sm font-semibold transition-all flex items-center justify-between ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {selectedAnswer !== null && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>

                        {showExplanation && (
                          <div className="p-4 rounded-xl bg-muted border border-border text-xs space-y-1 animate-in fade-in">
                            <p className="font-extrabold text-primary uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Official Novel Syllabus Explanation:
                            </p>
                            <p className="text-foreground/90 leading-relaxed">
                              {selectedChapter.sampleQuestions[currentQIndex]?.explanation}
                            </p>
                          </div>
                        )}

                        {selectedAnswer !== null && (
                          <Button onClick={handleNextQuestion} className="w-full font-bold bg-primary hover:bg-primary/90 text-xs h-10">
                            {currentQIndex < selectedChapter.sampleQuestions.length - 1 ? 'Next Question' : 'Finish Chapter Quiz'}
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                        No practice questions have been uploaded for this chapter yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            ) : (
              <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
                Select a chapter from the directory to review notes.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
