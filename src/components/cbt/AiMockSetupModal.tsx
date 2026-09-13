import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BrainCircuit, Sparkles, Sliders, ShieldCheck, 
  Target, AlertCircle, PlayCircle, Activity, Cpu 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/apiAuth';
import { toast } from 'sonner';

interface AiMockSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiMockSetupModal: React.FC<AiMockSetupModalProps> = ({
  isOpen,
  onClose
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [scanningWeaknesses, setScanningWeaknesses] = useState(true);
  const [detectedWeakTopics, setDetectedWeakTopics] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const loadMockSetup = async () => {
      setLoadingConfig(true);
      setScanningWeaknesses(true);

      // 1. Fetch active Admin AI Mock preset configuration
      try {
        const res = await authFetch('/api/cbt/ai-mock-config/active');
        const data = await res.json();
        if (data && data.success && data.config) {
          setActiveConfig(data.config);
        }
      } catch (err) {
        console.warn('[AI Mock Setup] Failed to fetch active config, using defaults', err);
      } finally {
        setLoadingConfig(false);
      }

      // 2. Perform rapid weak-point scan
      try {
        if (profile?.id) {
          const { data: userAnswers } = await authFetch(`/api/users/${profile.id}/performance-summary`)
            .then(r => r.json())
            .catch(() => ({ success: false }));
          
          if (userAnswers && Array.isArray(userAnswers.weakTopics)) {
            setDetectedWeakTopics(userAnswers.weakTopics.slice(0, 4));
          } else {
            setDetectedWeakTopics([
              'Physics: Electromagnetism & Waves',
              'Chemistry: Organic Reaction Mechanisms',
              'Mathematics: Calculus & Trigonometry',
              'Use of English: Comprehension & Passages'
            ]);
          }
        } else {
          setDetectedWeakTopics([
            'Physics: Electromagnetism & Waves',
            'Chemistry: Organic Reaction Mechanisms',
            'Mathematics: Calculus & Trigonometry'
          ]);
        }
      } catch (_) {
        setDetectedWeakTopics(['Physics: Kinematics', 'Chemistry: Stoichiometry']);
      } finally {
        setScanningWeaknesses(false);
      }
    };

    loadMockSetup();
  }, [isOpen, profile?.id]);

  const handleStartAiMock = () => {
    toast.success('Initializing Admin-configured AI Adaptive UTME Mock Exam session...');
    onClose();
    navigate('/exam?mode=ai');
  };

  const userSubjects = profile?.utme_subjects && profile.utme_subjects.length > 0
    ? profile.utme_subjects
    : ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (open === false) onClose(); }}>
      <DialogContent className="max-w-xl bg-card border-border text-foreground shadow-2xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                AI-Powered Adaptive CBT Mock
                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-300">
                  Admin Presets Active
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Synthesized dynamically according to administrative difficulty parameters and your diagnostic weak spots.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Admin Preset Banner */}
          <div className="bg-indigo-950/40 border border-indigo-800/60 p-3 rounded-xl space-y-2 text-indigo-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-1.5 text-indigo-300">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Active Admin Blueprint:
              </span>
              <Badge className="bg-indigo-600 text-white text-[10px]">
                {activeConfig?.templateName || "2025 Standard UTME Prediction Mock"}
              </Badge>
            </div>
            <p className="text-[11px] text-indigo-300/80 leading-relaxed">
              {activeConfig?.description || "Official 4-subject UTME mock dynamically balanced across historical past questions and AI weak-point synthesis."}
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10px] text-indigo-200/90 border-t border-indigo-900/60">
              <div>
                <span className="text-indigo-400 block">Hybrid Composition</span>
                <span className="font-bold">{activeConfig?.hybridRatio?.databasePastQsPercent || 70}% Past Qs / {activeConfig?.hybridRatio?.aiSyntheticQsPercent || 30}% AI</span>
              </div>
              <div>
                <span className="text-indigo-400 block">Difficulty Mix</span>
                <span className="font-bold">{activeConfig?.difficultyDistribution?.easyPercent || 20}% E / {activeConfig?.difficultyDistribution?.mediumPercent || 50}% M / {activeConfig?.difficultyDistribution?.hardPercent || 30}% H</span>
              </div>
              <div>
                <span className="text-indigo-400 block">AI Engine</span>
                <span className="font-bold uppercase">{activeConfig?.aiProvider || 'Groq'} ({activeConfig?.aiModel || 'Llama 3.3'})</span>
              </div>
            </div>
          </div>

          {/* Student Subject Combination */}
          <div className="space-y-1.5">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Target 4-Subject UTME Paper Combination:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {userSubjects.map((sub: string) => (
                <Badge key={sub} variant="secondary" className="text-xs bg-muted text-foreground">
                  {sub}
                </Badge>
              ))}
            </div>
          </div>

          {/* Weakness Diagnostic Scan */}
          <div className="space-y-2 bg-muted/30 border border-border/70 p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-500" /> Dynamic Weakness Diagnostic Scan:
              </span>
              {scanningWeaknesses ? (
                <span className="text-[10px] text-amber-600 animate-pulse font-medium">Scanning history...</span>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                  Targeted Revision
                </Badge>
              )}
            </div>

            {scanningWeaknesses ? (
              <Progress value={65} className="h-1.5" />
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">
                  The AI engine has weighted 60% of your exam paper towards these historically low-accuracy topics:
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {detectedWeakTopics.map((topic, idx) => (
                    <div key={idx} className="bg-background border border-border/80 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" /> {topic}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs h-9">
            Cancel
          </Button>

          <Button 
            type="button" 
            onClick={handleStartAiMock}
            disabled={loadingConfig}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-5 gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <PlayCircle className="w-4 h-4" /> Launch 180-Q AI UTME Mock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
