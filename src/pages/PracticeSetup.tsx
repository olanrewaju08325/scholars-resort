import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { BookOpen, PlayCircle, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { checkSubjectDataIntegrity } from '@/utils/subjectUtils';

const PracticeSetup = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'subject';

  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [difficulty, setDifficulty] = useState('mixed');
  const [questionCount, setQuestionCount] = useState('20');
  const [learningStyle, setLearningStyle] = useState('normal');
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [availableQCount, setAvailableQCount] = useState<number | null>(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);

  useEffect(() => {
    const fetchSubjects = async () => {
      // Check feature toggle
      const { data: settingsData } = await supabase.from('admin_settings').select('*').eq('setting_key', 'feature_toggles').single();
      if (settingsData && settingsData.setting_value && settingsData.setting_value.cbt_enabled === false) {
        setEnabled(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase.from('subjects').select('*').eq('is_active', true);
      if (data) setSubjects(data);
      setLoading(false);
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      setVerifyingIntegrity(true);
      
      // Perform Data Integrity Check
      const subjObj = subjects.find(s => s.id === selectedSubject);
      const subjNameOrId = subjObj ? subjObj.name : selectedSubject;

      checkSubjectDataIntegrity(subjNameOrId).then(res => {
        setAvailableQCount(res.availableCount);
        setVerifyingIntegrity(false);
      });

      supabase.from('topics').select('*').eq('subject_id', selectedSubject)
        .then(({ data }) => setTopics(data || []));
    } else {
      setTopics([]);
      setSelectedTopic('');
      setAvailableQCount(null);
    }
  }, [selectedSubject, subjects]);

  const handleStart = async () => {
    if (!profile?.has_paid) {
      toast.error("Practice Mode requires an active premium subscription.");
      navigate('/pricing');
      return;
    }
    if (!selectedSubject) {
      toast.error("Please select a subject to practice.");
      return;
    }
    
    // Final Data Integrity Verification prior to navigation
    const subjObj = subjects.find(s => s.id === selectedSubject);
    const subjNameOrId = subjObj ? subjObj.name : selectedSubject;
    
    const integrityResult = await checkSubjectDataIntegrity(subjNameOrId);
    console.log('[CBT Engine Session Verification]', integrityResult);

    navigate('/practice/session', { 
      state: { 
        subjectId: selectedSubject, 
        topicId: selectedTopic,
        difficulty,
        questionCount: parseInt(questionCount),
        expectedQCount: availableQCount ?? integrityResult.availableCount,
        learningStyle
      } 
    });
  };

  if (!enabled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <BookOpen className="w-16 h-16 text-blue-500 mb-6" />
        <h1 className="text-3xl font-bold font-display mb-4">CBT Module is currently offline.</h1>
        <p className="text-muted-foreground max-w-md mb-8">We are updating the question bank for this module. Please check back later!</p>
        <Button asChild>
          <Link to="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-xl">
        <CardHeader className="text-center">
          <PlayCircle className="w-12 h-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl font-display">
            {mode === 'topic' ? 'Topic Drill' : mode === 'speed' ? 'Speed Test' : mode === 'daily' ? 'Daily Quiz' : 'Subject Practice'}
          </CardTitle>
          <CardDescription>
            {mode === 'topic' ? 'Select a subject and topic to drill down.' : mode === 'speed' ? '20 questions, 10 minutes. Go!' : 'Select a subject to begin.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center text-muted-foreground">Loading subjects...</div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> Subject
                  </label>
                  {selectedSubject && (
                    <span className="text-xs font-semibold flex items-center gap-1">
                      {verifyingIntegrity ? (
                        <span className="text-muted-foreground animate-pulse">Checking DB...</span>
                      ) : availableQCount !== null && availableQCount > 0 ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {availableQCount} Questions Ready
                        </span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> 0 DB Questions Found
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <select 
                  className="w-full bg-muted border border-border rounded-md p-3"
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                >
                  <option value="">-- Choose Subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {topics.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Topic (Optional)
                  </label>
                  <select 
                    className="w-full bg-muted border border-border rounded-md p-3"
                    value={selectedTopic}
                    onChange={e => setSelectedTopic(e.target.value)}
                  >
                    <option value="">All Topics</option>
                    {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <select 
                    className="w-full bg-muted border border-border rounded-md p-3"
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="mixed">Mixed</option>
                    <option value="adaptive">Adaptive</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Questions</label>
                  <select 
                    className="w-full bg-muted border border-border rounded-md p-3"
                    value={questionCount}
                    onChange={e => setQuestionCount(e.target.value)}
                  >
                    <option value="10">10 Questions</option>
                    <option value="20">20 Questions</option>
                    <option value="30">30 Questions</option>
                    <option value="50">50 Questions</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Learning Style</label>
                <select 
                  className="w-full bg-muted border border-border rounded-md p-3"
                  value={learningStyle}
                  onChange={e => setLearningStyle(e.target.value)}
                >
                  <option value="normal">Normal Practice</option>
                  <option value="rapid">Rapid Fire</option>
                  <option value="weakness">Weakness Drill</option>
                  <option value="revision">Revision Mode</option>
                </select>
              </div>

              <Button onClick={handleStart} className="w-full h-12 text-lg font-bold" disabled={!selectedSubject}>
                Start Practice Session
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')} className="w-full">
                Cancel
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeSetup;
