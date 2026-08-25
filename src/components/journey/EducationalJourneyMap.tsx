import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchEducationalJourneyProgress } from '@/services/educationalJourneyService';
import type { OverallJourneyProgress, JourneyNode, SubjectJourney } from '@/services/educationalJourneyService';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  Lock, 
  Play, 
  Sparkles, 
  Award, 
  BookOpen, 
  Zap, 
  ChevronRight, 
  RotateCcw, 
  Check, 
  HelpCircle,
  X,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const EducationalJourneyMap: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<OverallJourneyProgress | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('use_of_english');
  const [selectedNodeModal, setSelectedNodeModal] = useState<JourneyNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadJourney = async () => {
      setIsLoading(true);
      const res = await fetchEducationalJourneyProgress(user?.id);
      setData(res);
      setIsLoading(false);
    };
    loadJourney();
  }, [user?.id]);

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[350px] bg-card border border-border rounded-2xl shadow-sm">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-muted-foreground font-medium">Generating your Educational Journey Map...</p>
      </div>
    );
  }

  if (!data) return null;

  const currentSubjectJourney: SubjectJourney | undefined = data.subjectJourneys[selectedSubject];

  const subjectTabs = [
    { id: 'use_of_english', name: 'Use of English', icon: '📝' },
    { id: 'mathematics', name: 'Mathematics', icon: '📐' },
    { id: 'physics', name: 'Physics', icon: '⚡' },
    { id: 'chemistry', name: 'Chemistry', icon: '🧪' },
    { id: 'biology', name: 'Biology', icon: '🧬' }
  ];

  const handleLaunchPractice = (node: JourneyNode) => {
    setSelectedNodeModal(null);
    navigate(`/practice?subject=${encodeURIComponent(node.subjectName)}&topic=${encodeURIComponent(node.topicName)}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-card border border-primary/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 transition-colors">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" /> UTME Syllabus Map
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">Updated Real-Time</span>
          </div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-foreground">
            Educational Journey Map
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Track your mastery through the official JAMB syllabus. Unlock topics, conquer weak areas, and build complete exam readiness.
          </p>
        </div>

        {/* Global Progress Radial / Bar */}
        <div className="flex items-center gap-4 bg-background/80 backdrop-blur-md p-4 rounded-xl border border-border shadow-sm z-10 w-full md:w-auto shrink-0">
          <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-muted/30"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-primary transition-all duration-1000 ease-out"
                strokeDasharray={`${data.overallPercentage}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-bold font-mono text-primary">{data.overallPercentage}%</span>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Syllabus Mastered</div>
            <div className="text-lg font-bold text-foreground">
              {data.totalMastered} / {data.totalTopics} <span className="text-xs text-muted-foreground font-normal">Topics</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subject Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {subjectTabs.map((tab) => {
          const subJourney = data.subjectJourneys[tab.id];
          const isSel = selectedSubject === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedSubject(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap shrink-0 border ${
                isSel
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-105'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.name}</span>
              {subJourney && (
                <Badge 
                  variant="secondary" 
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isSel ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {subJourney.completionPercentage}%
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Interactive Map Canvas Container */}
      {currentSubjectJourney && (
        <div className="bg-card border border-border rounded-2xl p-6 md:p-10 shadow-sm relative overflow-hidden min-h-[420px]">
          {/* Subtle Grid Background pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

          {/* Subject Header */}
          <div className="relative z-10 flex items-center justify-between mb-8 pb-4 border-b border-border">
            <div>
              <h3 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                <span>{currentSubjectJourney.subjectName} Syllabus Path</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click any topic node to view formula sheets, accuracy stats, or launch targeted practice.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
              <Award className="w-4 h-4 text-amber-500" />
              <span>{currentSubjectJourney.masteredNodes} of {currentSubjectJourney.totalNodes} Mastered</span>
            </div>
          </div>

          {/* Gamified Visual Node Tree */}
          <div className="relative z-10 max-w-3xl mx-auto py-4">
            <div className="space-y-12 relative">
              {currentSubjectJourney.nodes.map((node, index) => {
                const isMastered = node.status === 'mastered';
                const isInProgress = node.status === 'in_progress';
                const isLocked = node.status === 'locked';

                // Alternate offset for gamified map path
                const isEven = index % 2 === 0;

                return (
                  <div key={node.id} className="relative">
                    {/* Connecting Path Line to next node */}
                    {index < currentSubjectJourney.nodes.length - 1 && (
                      <div className="absolute left-1/2 top-12 bottom-0 -mb-12 w-1 -translate-x-1/2 z-0 pointer-events-none">
                        <div 
                          className={`w-full h-full transition-colors ${
                            isMastered ? 'bg-emerald-500/60' : 'bg-border border-dashed'
                          }`} 
                        />
                      </div>
                    )}

                    <div className={`flex items-center gap-4 ${isEven ? 'flex-row' : 'flex-row-reverse'} justify-center`}>
                      {/* Node Interactive Card */}
                      <motion.div
                        whileHover={{ scale: isLocked ? 1 : 1.03 }}
                        whileTap={{ scale: isLocked ? 1 : 0.97 }}
                        onClick={() => setSelectedNodeModal(node)}
                        className={`cursor-pointer p-4 rounded-2xl border transition-all duration-300 w-full max-w-sm relative z-10 shadow-sm ${
                          isMastered
                            ? 'bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500 shadow-emerald-500/10'
                            : isInProgress
                            ? 'bg-primary/10 border-primary shadow-md shadow-primary/10 ring-2 ring-primary/20'
                            : 'bg-muted/40 border-border opacity-70 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Icon Circle */}
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 shadow-sm transition-transform ${
                              isMastered
                                ? 'bg-emerald-500 text-white'
                                : isInProgress
                                ? 'bg-primary text-primary-foreground animate-pulse'
                                : 'bg-muted-foreground/20 text-muted-foreground'
                            }`}>
                              {isMastered ? (
                                <CheckCircle2 className="w-6 h-6" />
                              ) : isInProgress ? (
                                <Zap className="w-5 h-5" />
                              ) : (
                                <Lock className="w-5 h-5" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold font-mono tracking-wider text-muted-foreground">
                                  Level {node.level} • Node {node.sequence}
                                </span>
                                {isMastered && (
                                  <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0 border-none">
                                    Mastered
                                  </Badge>
                                )}
                                {isInProgress && (
                                  <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0 border-none">
                                    Active Focus
                                  </Badge>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-foreground mt-0.5 line-clamp-1">
                                {node.topicName}
                              </h4>
                            </div>
                          </div>

                          <ChevronRight className={`w-5 h-5 shrink-0 ${
                            isMastered ? 'text-emerald-500' : isInProgress ? 'text-primary' : 'text-muted-foreground'
                          }`} />
                        </div>

                        {/* Card Footer Info */}
                        <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-[11px] truncate">{node.unitName}</span>
                          <span className="font-mono text-[11px] font-bold text-foreground">
                            UTME Weight: {node.jambWeightPercent}%
                          </span>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Node Details Modal Dialog */}
      <AnimatePresence>
        {selectedNodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedNodeModal(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                  selectedNodeModal.status === 'mastered'
                    ? 'bg-emerald-500 text-white'
                    : selectedNodeModal.status === 'in_progress'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {selectedNodeModal.status === 'mastered' ? (
                    <Award className="w-6 h-6" />
                  ) : (
                    <BookOpen className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] font-mono mb-1">
                    {selectedNodeModal.subjectName} • Level {selectedNodeModal.level}
                  </Badge>
                  <h3 className="text-lg font-bold font-display text-foreground leading-snug">
                    {selectedNodeModal.topicName}
                  </h3>
                </div>
              </div>

              <p className="text-sm text-muted-foreground bg-muted/30 p-3.5 rounded-xl border border-border/50">
                {selectedNodeModal.description}
              </p>

              {/* Accuracy & Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-card border border-border rounded-xl">
                  <div className="text-xs text-muted-foreground">Historical Accuracy</div>
                  <div className="text-xl font-bold font-mono text-primary mt-0.5">
                    {selectedNodeModal.accuracyPercentage}%
                  </div>
                </div>
                <div className="p-3 bg-card border border-border rounded-xl">
                  <div className="text-xs text-muted-foreground">UTME Exam Weight</div>
                  <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                    {selectedNodeModal.jambWeightPercent}%
                  </div>
                </div>
              </div>

              {/* Key Concept Formula & Outline */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-primary" /> Key Concepts & Formula Cheat-Sheet
                </h4>
                <div className="space-y-1.5">
                  {selectedNodeModal.keyConcepts.map((concept, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-foreground bg-background p-2 rounded-lg border border-border/60">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{concept}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-border">
                <Button variant="outline" onClick={() => setSelectedNodeModal(null)}>
                  Close
                </Button>
                <Button 
                  onClick={() => handleLaunchPractice(selectedNodeModal)}
                  className="bg-primary text-primary-foreground font-bold flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" /> Start Target Drill
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
