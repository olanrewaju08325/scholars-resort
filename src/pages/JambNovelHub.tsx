import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Sparkles, CheckCircle2, HelpCircle, UserCheck, Bookmark, ArrowRight, ArrowLeft, RefreshCw, Trophy } from 'lucide-react';
import { toast } from 'sonner';

interface NovelChapter {
  id: number;
  title: string;
  summary: string;
  keyThemes: string[];
  charactersInvolved: string[];
  sampleQuestions: {
    question: string;
    options: string[];
    correct: string;
    explanation: string;
  }[];
}

const NOVEL_DATA: NovelChapter[] = [
  {
    id: 1,
    title: "Chapter 1: The Encounter & Classroom Rules",
    summary: "Ummi, a mother of four, shares a story with her children about her university entry experience and Mr. Salako. The chapter establishes the setting at Lafayette University and introduces Omar, who has just gained admission to study Law after scoring 230 in UTME.",
    keyThemes: ["Education", "Familial Bond", "Integrity vs Compromise"],
    charactersInvolved: ["Ummi", "Omar", "Bint", "Jamila", "Mr. Salako"],
    sampleQuestions: [
      {
        question: "What course was Omar offered admission to study at Lafayette University?",
        options: ["A) Medicine", "B) Law", "C) Accounting", "D) Mass Communication"],
        correct: "B",
        explanation: "Omar was offered admission to study Law at Lafayette University after scoring 230 in JAMB."
      },
      {
        question: "Who told the children the story about university life?",
        options: ["A) Bint", "B) Mr. Salako", "C) Ummi", "D) Dr. Samuel"],
        correct: "C",
        explanation: "Ummi is the mother who gathers her children to share stories and prepare Omar for university."
      }
    ]
  },
  {
    id: 2,
    title: "Chapter 2: The Admission Process & Registration",
    summary: "Detailing the registration procedures, hostel allocation challenges, and the bureaucracy new university students face upon arrival at campus.",
    keyThemes: ["Bureaucracy", "Patience", "Peer Pressure"],
    charactersInvolved: ["Omar", "Talle", "Quiet One"],
    sampleQuestions: [
      {
        question: "Why was Talle nicknamed 'The Quiet One' in the village?",
        options: ["A) He was dumb", "B) He rarely spoke and lived a reserved life", "C) He was deaf", "D) He was an outcast"],
        correct: "B",
        explanation: "Talle gained the nickname 'The Quiet One' because of his extremely silent and non-confrontational nature."
      }
    ]
  },
  {
    id: 3,
    title: "Chapter 3: Examination Malpractice & Integrity",
    summary: "Explores the consequences of examination malpractice, impersonation in JAMB/UTME exams, and how students fall victim to syndicate fraud.",
    keyThemes: ["Exam Fraud", "Ethics", "Justice"],
    charactersInvolved: ["Habiba", "Kabilu", "EMC Officials"],
    sampleQuestions: [
      {
        question: "What is the primary theme explored in Chapter 3 regarding university examinations?",
        options: ["A) Cultism", "B) Examination Malpractice", "C) Strike actions", "D) Sports competitions"],
        correct: "B",
        explanation: "Chapter 3 focuses heavily on the dangers and penal consequences of examination malpractice."
      }
    ]
  }
];

export const JambNovelHub = () => {
  const [selectedChapter, setSelectedChapter] = useState<NovelChapter>(NOVEL_DATA[0]);
  const [activeQuizMode, setActiveQuizMode] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  const handleAnswerSelect = (optLetter: string) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(optLetter);
    setShowExplanation(true);
    if (optLetter === selectedChapter.sampleQuestions[currentQIndex].correct) {
      setScore(prev => prev + 1);
      toast.success('Correct Answer!');
    } else {
      toast.error('Incorrect. Review explanation.');
    }
  };

  const handleNextQuestion = () => {
    if (currentQIndex < selectedChapter.sampleQuestions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      toast.success(`Chapter Quiz Completed! You scored ${score + (selectedAnswer === selectedChapter.sampleQuestions[currentQIndex].correct ? 1 : 0)} / ${selectedChapter.sampleQuestions.length}`);
    }
  };

  const resetQuiz = () => {
    setCurrentQIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero Banner */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-primary/20 via-indigo-900/30 to-purple-900/20 border border-primary/30 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" /> Compulsory Use of English Novel Hub
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-foreground">
            Official JAMB Novel Breakdown & Practice
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Master every chapter, character profile, theme, and key quote with 200+ compulsory novel questions curated for 100% score in JAMB English.
          </p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chapter Navigation Sidebar */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-primary" /> Chapter Directory
          </h3>
          {NOVEL_DATA.map((ch) => (
            <Card
              key={ch.id}
              onClick={() => {
                setSelectedChapter(ch);
                setActiveQuizMode(false);
                resetQuiz();
              }}
              className={`cursor-pointer transition-all border ${
                selectedChapter.id === ch.id
                  ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/30'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-primary uppercase">Chapter {ch.id}</p>
                  <p className="text-sm font-bold text-foreground line-clamp-1 mt-0.5">{ch.title.split(': ')[1] || ch.title}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selected Chapter View / Quiz View */}
        <div className="lg:col-span-2 space-y-6">
          {!activeQuizMode ? (
            <Card className="border-border bg-card text-card-foreground shadow-lg">
              <CardHeader className="border-b border-border bg-muted/20">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-xl font-bold font-display text-foreground">
                    {selectedChapter.title}
                  </CardTitle>
                  <Button onClick={() => setActiveQuizMode(true)} className="bg-primary hover:bg-primary/90 font-bold gap-2">
                    <Sparkles className="w-4 h-4" /> Practice Chapter Questions
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-2">Chapter Plot Summary</h4>
                  <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-4 rounded-xl border border-border">
                    {selectedChapter.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-muted/20 p-4 rounded-xl border border-border space-y-2">
                    <h4 className="text-xs font-extrabold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4" /> Characters Involved
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedChapter.charactersInvolved.map((c, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-md text-xs font-bold bg-muted text-foreground border border-border">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-muted/20 p-4 rounded-xl border border-border space-y-2">
                    <h4 className="text-xs font-extrabold text-purple-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Bookmark className="w-4 h-4" /> Key Themes
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedChapter.keyThemes.map((t, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Chapter Quiz View */
            <Card className="border-primary/30 bg-card text-card-foreground shadow-xl">
              <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Chapter {selectedChapter.id} Quiz ({currentQIndex + 1} of {selectedChapter.sampleQuestions.length})
                  </CardTitle>
                  <CardDescription className="text-xs">Select the correct option based on the novel storyline.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActiveQuizMode(false)} className="gap-1 font-semibold">
                  <ArrowLeft className="w-4 h-4" /> Exit Quiz
                </Button>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-base font-bold text-foreground">
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
                        className={`w-full p-4 rounded-xl text-left border text-sm font-semibold transition-all flex items-center justify-between ${btnStyle}`}
                      >
                        <span>{opt}</span>
                        {selectedAnswer !== null && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {showExplanation && (
                  <div className="p-4 rounded-xl bg-muted border border-border text-xs space-y-1 animate-in fade-in">
                    <p className="font-extrabold text-primary uppercase">Official Novel Explanation:</p>
                    <p className="text-muted-foreground">{selectedChapter.sampleQuestions[currentQIndex]?.explanation}</p>
                  </div>
                )}

                {selectedAnswer !== null && (
                  <Button onClick={handleNextQuestion} className="w-full font-bold bg-primary hover:bg-primary/90">
                    {currentQIndex < selectedChapter.sampleQuestions.length - 1 ? 'Next Question' : 'Complete Chapter Quiz'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
