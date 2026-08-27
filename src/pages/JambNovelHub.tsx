import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, Sparkles, CheckCircle2, UserCheck, 
  Bookmark, ArrowRight, ArrowLeft, Search, RefreshCw, Layers, Quote, BookA,
  FileText, Eye, Download, Maximize2, Lock, ShieldAlert
} from 'lucide-react';
import { fetchJambBooks, fetchLiteratureLockStatus } from '@/services/novelService';
import type { LiteratureBook, NovelChapter } from '@/data/jambNovelsData';
import { toast } from 'sonner';

export const JambNovelHub = () => {
  const [books, setBooks] = useState<LiteratureBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('the-life-changer');
  const [selectedChapter, setSelectedChapter] = useState<NovelChapter | null>(null);
  const [activeQuizMode, setActiveQuizMode] = useState(false);
  const [viewingPdfMode, setViewingPdfMode] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Concept Matrix Game state
  const [showMatrixGame, setShowMatrixGame] = useState(false);
  const [matrixQIndex, setMatrixQIndex] = useState(0);
  const [selectedMatrixAns, setSelectedMatrixAns] = useState<string | null>(null);
  const [showMatrixExplanation, setShowMatrixExplanation] = useState(false);
  const [matrixScore, setMatrixScore] = useState(0);

  const matrixQuestions = [
    {
      category: "Character Concept Matching",
      question: "Which of the following describes SALMA from 'The Life Changer'?",
      options: [
        "A confident, outspoken, and highly independent girl who unfortunately gets involved in exam malpractice.",
        "A quiet, silent orphan boy who lives a mystifying life and gets caught up in a kidnapping ring.",
        "The bright young daughter of the family who easily challenges her French language teacher with grammar rules.",
        "The wealthy local politician who uses his influence to buy expensive gifts for campus girls."
      ],
      correct: 0,
      explanation: "Salma represents independence and outspokenness. However, her pressure to pass leads her into exam malpractice, which forms a major moral lesson of the novel."
    },
    {
      category: "Character Concept Matching",
      question: "Which option best matches TALLE?",
      options: [
        "The student who gains admission into University of Lafayette with a high UTME score.",
        "The silent, quiet man in Lafayette who becomes suddenly rich but is exposed as part of a kidnapping conspiracy.",
        "The friendly female roommate who helps Salma reflect on her moral choices.",
        "The Dean of Student Affairs who forgives Salma after her hearing."
      ],
      correct: 1,
      explanation: "Talle is known as the 'quiet one' in Lafayette. His sudden wealth causes suspicion, and he's eventually arrested as an accomplice in a kidnapping ring."
    },
    {
      category: "Character Concept Matching",
      question: "Who is Omar and what is his academic accomplishment?",
      options: [
        "The eldest son who was admitted to study Law with an outstanding UTME score of 230.",
        "Bint's elder brother who dropped out of school to become a local merchant.",
        "The school taxi driver who gives moral advice to female students.",
        "The security officer who arrested Talle in the village of Lafayette."
      ],
      correct: 0,
      explanation: "Omar is the first-born child in the family, who makes his mother proud by gaining admission into the University of Lafayette to study Law with a 230 UTME score."
    },
    {
      category: "Literary Device Matching",
      question: "What literary device is used in the quote: 'Trust is a fragile thing, like a mirror once broken...'?",
      options: [
        "Metaphor - It direct compares trust to a mirror without using comparative words.",
        "Simile - It compares trust's fragility directly to a broken mirror using 'like'.",
        "Onomatopoeia - It imitates the physical sound of breaking glass.",
        "Personification - It gives trust human attributes and emotions."
      ],
      correct: 1,
      explanation: "The quote uses 'like a mirror once broken...', which is a classic Simile comparing trust's fragility directly using the word 'like'."
    },
    {
      category: "Scene Mood Matching",
      question: "Which mood best captures the 'French class incident' with Bint in Chapter 1?",
      options: [
        "High tension and grief as students struggle to pass their final exams.",
        "Humorous defiance and brilliant lightheartedness as Bint outwits her teacher.",
        "Tense panic and fear of strict school administrators.",
        "Boredom and disinterest as students sleep through lessons."
      ],
      correct: 1,
      explanation: "Bint's interaction with her French teacher, where she uses her knowledge to challenge him playfully, creates a lighthearted, humorous, and proud mood in the household."
    },
    {
      category: "Character Concept Matching",
      question: "Who is Kabir in 'The Life Changer'?",
      options: [
        "A notorious gambler and fraudster who eventually swindles Salma's associates of their cash.",
        "The brilliant French teacher who inspires Bint's love for language.",
        "The honest shopkeeper who gives free grocery items to Lafayette orphans.",
        "The Vice Chancellor of University of Lafayette."
      ],
      correct: 0,
      explanation: "Kabir is a gambling addict who tricks Salma's friends out of a large sum of money. He represents the destructive nature of greed and vice."
    },
    {
      category: "Theme & Quote Matching",
      question: "Who says: 'He who has knowledge but cannot communicate it is no better than him who has no knowledge at all'?",
      options: [
        "Daddy (Omar and Bint's father), quoting Dr. Samuel Johnson to emphasize speaking and communication.",
        "Salma, during her defense before the exam malpractice committee.",
        "The French teacher, when Bint failed to answer his introductory greetings.",
        "The District Head of Lafayette, when interrogating Talle."
      ],
      correct: 0,
      explanation: "This famous quote belongs to Dr. Samuel Johnson, and is cited by Daddy to teach his daughters the supreme value of communication and expressive knowledge."
    },
    {
      category: "Character Concept Matching",
      question: "Which role does HABIB play in the novel?",
      options: [
        "A corrupt but wealthy politician who attempts to lure young female students with luxury gifts.",
        "The university registrar who strictly enforces anti-malpractice rules.",
        "The local police officer who arrests Kabir at the gambling den.",
        "Omar's favorite university roommate."
      ],
      correct: 0,
      explanation: "Habib is a wealthy politician who represents external material temptations targeting female campus students, attempting to gain favor through expensive gifts."
    }
  ];

  // Lock State
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState('');

  // Load books & lock status from live database
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const lockInfo = await fetchLiteratureLockStatus();
        setIsLocked(lockInfo.isLocked);
        if (lockInfo.lockReason) setLockReason(lockInfo.lockReason);

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
      toast.success('Correct Answer!');
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

  if (isLocked) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-amber-500/30 text-card-foreground shadow-2xl text-center p-8 space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/30">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-display">Literature Hub Currently Locked</h2>
            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
              {lockReason || "The academic team is currently updating the official JAMB UTME literature prescribed texts for this session. Please check back shortly!"}
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="font-bold text-xs">
              <Link to="/practice?mode=subject">Go to CBT Practice Mode</Link>
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()} className="text-xs font-semibold">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Check Again
            </Button>
          </div>
        </Card>
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
          <div className="pt-2 flex gap-3">
            <Button 
              onClick={() => {
                setShowMatrixGame(true);
                setMatrixQIndex(0);
                setSelectedMatrixAns(null);
                setShowMatrixExplanation(false);
                setMatrixScore(0);
              }}
              className="bg-amber-500 hover:bg-amber-600 font-bold gap-2 text-xs h-9 px-4 text-slate-950"
            >
              <Sparkles className="w-4 h-4 text-slate-950" /> Launch 5-Minute Concept Matrix Quiz Game
            </Button>
          </div>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {currentBook?.fileDataUrl && (
                          <Button
                            variant={viewingPdfMode ? "default" : "outline"}
                            onClick={() => setViewingPdfMode(!viewingPdfMode)}
                            className="text-xs h-9 font-bold gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                          >
                            <FileText className="w-4 h-4 text-emerald-500" />
                            {viewingPdfMode ? "View Chapter Notes" : "Read Full PDF Textbook"}
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            setActiveQuizMode(true);
                            setViewingPdfMode(false);
                            resetQuiz();
                          }}
                          className="bg-primary hover:bg-primary/90 font-bold gap-2 text-xs h-9"
                        >
                          <Sparkles className="w-4 h-4" /> Practice Chapter Questions ({selectedChapter.sampleQuestions?.length || 0})
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 sm:p-6 space-y-6">
                    {/* Interactive PDF Reader or Chapter Plot Summary */}
                    {viewingPdfMode && currentBook?.fileDataUrl ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/30">
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                            <Eye className="w-4 h-4" /> Reading Full Document: {currentBook.title}
                          </p>
                          <a 
                            href={currentBook.fileDataUrl} 
                            download={`${currentBook.title.replace(/\s+/g, '_')}.pdf`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" /> Download Document
                          </a>
                        </div>
                        <div className="w-full h-[650px] rounded-xl overflow-hidden border border-border shadow-inner bg-slate-900">
                          <iframe 
                            src={currentBook.fileDataUrl} 
                            className="w-full h-full border-none"
                            title={`PDF Reader - ${currentBook.title}`}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}

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

      {/* Literature Concept Matrix Quiz Game Modal Overlay */}
      {showMatrixGame && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl border border-amber-500/30 bg-slate-900 text-slate-100 shadow-2xl relative">
            <CardHeader className="border-b border-slate-800 bg-slate-950 pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 tracking-widest uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Concept Matrix Game
                  </span>
                  <CardTitle className="text-base sm:text-lg font-bold text-white mt-1">
                    5-Minute UTME Literature Fast Drill
                  </CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowMatrixGame(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Exit Game
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-6">
              {matrixQIndex < matrixQuestions.length ? (
                <>
                  {/* Current question status */}
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Question {matrixQIndex + 1} of {matrixQuestions.length}</span>
                    <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-bold">
                      Score: {matrixScore} XP
                    </span>
                  </div>

                  {/* Question Prompt */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[9px] font-mono font-bold text-indigo-400 tracking-wider bg-indigo-500/10 px-2 py-1 rounded-full uppercase">
                      {matrixQuestions[matrixQIndex].category}
                    </span>
                    <p className="text-sm sm:text-base font-semibold text-white mt-3 leading-relaxed">
                      {matrixQuestions[matrixQIndex].question}
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-2.5">
                    {matrixQuestions[matrixQIndex].options.map((opt, i) => {
                      const isCorrect = i === matrixQuestions[matrixQIndex].correct;
                      const isSelected = selectedMatrixAns === opt;

                      let btnStyle = "border-slate-800 bg-slate-950 hover:border-amber-500/40 text-slate-200";
                      if (selectedMatrixAns !== null) {
                        if (isCorrect) btnStyle = "border-green-500/50 bg-green-500/10 text-green-400 font-semibold";
                        else if (isSelected) btnStyle = "border-rose-500/50 bg-rose-500/10 text-rose-400 font-semibold";
                        else btnStyle = "border-slate-800 bg-slate-950/40 text-slate-500 opacity-60";
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => {
                            if (selectedMatrixAns === null) {
                              setSelectedMatrixAns(opt);
                              setShowMatrixExplanation(true);
                              if (isCorrect) setMatrixScore(prev => prev + 10);
                            }
                          }}
                          disabled={selectedMatrixAns !== null}
                          className={`w-full p-3.5 rounded-xl text-left border text-xs sm:text-sm transition-all flex items-center justify-between ${btnStyle}`}
                        >
                          <span className="flex-1">{opt}</span>
                          {selectedMatrixAns !== null && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation panel */}
                  {showMatrixExplanation && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 animate-in fade-in">
                      <p className="font-extrabold text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                        Syllabus Insight & Explanation:
                      </p>
                      <p className="text-slate-300 leading-relaxed">
                        {matrixQuestions[matrixQIndex].explanation}
                      </p>
                    </div>
                  )}

                  {/* Next Step Button */}
                  {selectedMatrixAns !== null && (
                    <Button 
                      onClick={() => {
                        setMatrixQIndex(prev => prev + 1);
                        setSelectedMatrixAns(null);
                        setShowMatrixExplanation(false);
                      }} 
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold h-10"
                    >
                      {matrixQIndex < matrixQuestions.length - 1 ? 'Next Question' : 'Complete Flash Quiz'}
                    </Button>
                  )}
                </>
              ) : (
                /* Completed matrix quiz screen */
                <div className="py-6 text-center space-y-6">
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">Fast-Drill Mastery Achieved!</h3>
                    <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                      Awesome effort! You completed the 5-Minute Literature & Novel Concept matrix. Practice like this trains your instinctual recall of characters, motifs, and direct syllabus devices!
                    </p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl max-w-xs mx-auto">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Total Reward Granted</p>
                    <p className="text-2xl font-mono font-extrabold text-amber-400">+{matrixScore} XP Points</p>
                  </div>
                  <div className="flex gap-3 justify-center pt-2">
                    <Button 
                      onClick={() => {
                        setMatrixQIndex(0);
                        setSelectedMatrixAns(null);
                        setShowMatrixExplanation(false);
                        setMatrixScore(0);
                      }}
                      variant="outline" 
                      className="text-xs font-semibold border-slate-700 hover:bg-slate-800"
                    >
                      Play Again
                    </Button>
                    <Button 
                      onClick={() => setShowMatrixGame(false)}
                      className="bg-primary hover:bg-primary/90 text-xs font-bold px-5"
                    >
                      Return to Syllabus
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
