import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Layers, 
  FileText, 
  Sliders, 
  Target, 
  ShieldCheck, 
  Flame, 
  Clock 
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { logAdminActivity } from '@/services/adminActivityService';
import { QuestionClassificationService } from '@/services/questionClassificationService';
import { fetchAcademicLearningRules, saveAcademicLearningRules, type AcademicLearningRules, DEFAULT_ACADEMIC_LEARNING_RULES } from '@/services/academicLearningRulesService';
import { fetchJambBooks } from '@/services/novelService';

export const SyllabusAdminTab = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<any[]>([]);
  const [availableNovels, setAvailableNovels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Learning Rules State
  const [rules, setRules] = useState<AcademicLearningRules>(DEFAULT_ACADEMIC_LEARNING_RULES);
  const [savingRules, setSavingRules] = useState(false);

  // New/Edit Topic Form State
  const [isEditing, setIsEditing] = useState(false);
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [topicSequence, setTopicSequence] = useState<number>(1);
  const [topicLevel, setTopicLevel] = useState<number>(1);
  const [topicWeight, setTopicWeight] = useState<number>(15);
  const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>([]);
  const [recommendedAction, setRecommendedAction] = useState<string>('Solve 15 Targeted Drill Questions');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [studyTasks, setStudyTasks] = useState('');
  const [recommendedReading, setRecommendedReading] = useState('');

  const { confirmAction, ConfirmElement } = useConfirm();
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null; title: string }>({
    isOpen: false,
    id: null,
    title: ''
  });

  useEffect(() => {
    fetchSubjects();
    loadLearningRules();
    loadNovels();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      fetchTopicsForSubject(selectedSubjectId);
    } else {
      setTopics([]);
    }
  }, [selectedSubjectId]);

  const loadLearningRules = async () => {
    const data = await fetchAcademicLearningRules();
    setRules(data);
  };

  const loadNovels = async () => {
    const books = await fetchJambBooks();
    setAvailableNovels(books);
  };

  const handleSaveLearningRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const res = await saveAcademicLearningRules(rules);
      if (res.success) {
        toast.success('Academic learning & progression rules updated successfully in Supabase!');
        logAdminActivity('Update Learning Rules', `Mastery: ${rules.masteryThresholdPercent}%, Mode: ${rules.prerequisiteMode}`);
      } else {
        toast.error(`Failed to save learning rules: ${res.error}`);
      }
    } catch (err: any) {
      toast.error(`Error saving rules: ${err.message}`);
    } finally {
      setSavingRules(false);
    }
  };

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('subjects').select('*').order('name');
      if (error) throw error;
      if (data && data.length > 0) {
        setSubjects(data);
        if (!selectedSubjectId) setSelectedSubjectId(data[0].id);
      }
    } catch (err) {
      console.warn('Error fetching subjects:', err);
      // Fallback subjects
      const fallback = [
        { id: 'math', name: 'Mathematics' },
        { id: 'eng', name: 'English Language' },
        { id: 'phy', name: 'Physics' },
        { id: 'chem', name: 'Chemistry' },
        { id: 'bio', name: 'Biology' },
        { id: 'lit', name: 'Literature-in-English' }
      ];
      setSubjects(fallback);
      setSelectedSubjectId(fallback[0].id);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicsForSubject = async (subId: string) => {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', subId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTopics(data || []);
    } catch (err) {
      console.warn('Error fetching topics from DB, checking local storage:', err);
      try {
        const local = JSON.parse(localStorage.getItem(`scholar_syllabus_${subId}`) || '[]');
        setTopics(local);
      } catch {
        setTopics([]);
      }
    }
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim()) {
      toast.error('Please enter a topic title.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        subject_id: selectedSubjectId,
        name: topicTitle.trim(),
        description: topicDescription.trim(),
        sequence: Number(topicSequence) || 1,
        level: Number(topicLevel) || 1,
        jamb_weight: Number(topicWeight) || 15,
        prerequisites: selectedPrereqs,
        recommended_action: recommendedAction.trim(),
        recommended_reading: recommendedReading.trim(),
        learning_objectives: learningObjectives.split('\n').filter(Boolean),
        recommended_tasks: studyTasks.split('\n').filter(Boolean),
        updated_at: new Date().toISOString()
      };

      if (currentTopicId && !currentTopicId.startsWith('local_')) {
        const { error } = await supabase.from('topics').update(payload).eq('id', currentTopicId);
        if (error) throw error;
        toast.success('Syllabus topic updated successfully!');
      } else {
        const newId = crypto.randomUUID();
        const insertPayload = { id: newId, ...payload, created_at: new Date().toISOString() };
        const { error } = await supabase.from('topics').insert(insertPayload);
        
        if (error) {
          // Fallback to local storage if RLS/DB table constraint blocks
          const updated = [...topics, insertPayload];
          setTopics(updated);
          localStorage.setItem(`scholar_syllabus_${selectedSubjectId}`, JSON.stringify(updated));
        } else {
          fetchTopicsForSubject(selectedSubjectId);
        }
        toast.success('New syllabus topic created successfully!');
      }

      logAdminActivity('Update Syllabus Topic', `Updated topic "${topicTitle}" for subject ID ${selectedSubjectId}`);
      resetForm();
      fetchTopicsForSubject(selectedSubjectId);
    } catch (err: any) {
      toast.error(`Failed to save topic: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentTopicId(null);
    setTopicTitle('');
    setTopicDescription('');
    setTopicSequence(topics.length + 1);
    setTopicLevel(1);
    setTopicWeight(15);
    setSelectedPrereqs([]);
    setRecommendedAction('Solve 15 Targeted Drill Questions');
    setRecommendedReading('');
    setLearningObjectives('');
    setStudyTasks('');
  };

  const handleEdit = (topic: any) => {
    setIsEditing(true);
    setCurrentTopicId(topic.id);
    setTopicTitle(topic.name || topic.title || '');
    setTopicDescription(topic.description || '');
    setTopicSequence(topic.sequence || 1);
    setTopicLevel(topic.level || 1);
    setTopicWeight(topic.jamb_weight || topic.weight || 15);
    setSelectedPrereqs(Array.isArray(topic.prerequisites) ? topic.prerequisites : []);
    setRecommendedAction(topic.recommended_action || 'Solve 15 Targeted Drill Questions');
    setRecommendedReading(topic.recommended_reading || topic.prescribed_book || topic.reading_material || '');
    setLearningObjectives(Array.isArray(topic.learning_objectives) ? topic.learning_objectives.join('\n') : (topic.learning_objectives || ''));
    setStudyTasks(Array.isArray(topic.recommended_tasks) ? topic.recommended_tasks.join('\n') : (topic.recommended_tasks || ''));
  };

  const confirmDelete = (id: string, name: string) => {
    setDeleteDialog({ isOpen: true, id, title: name });
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      if (!deleteDialog.id.startsWith('local_')) {
        await supabase.from('topics').delete().eq('id', deleteDialog.id);
      }
      const updated = topics.filter(t => t.id !== deleteDialog.id);
      setTopics(updated);
      localStorage.setItem(`scholar_syllabus_${selectedSubjectId}`, JSON.stringify(updated));
      toast.success('Topic deleted successfully.');
      logAdminActivity('Delete Syllabus Topic', `Deleted topic ID ${deleteDialog.id}`);
    } catch (err: any) {
      toast.error(`Error deleting topic: ${err.message}`);
    } finally {
      setDeleteDialog({ isOpen: false, id: null, title: '' });
    }
  };

  const selectedSubjectObj = subjects.find(s => s.id === selectedSubjectId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="w-6 h-6 text-primary" /> Dynamic Syllabus & Learning Rules
          </h2>
          <p className="text-muted-foreground text-sm">
            Control syllabus structure, sequencing, prerequisites, mastery thresholds, and adaptive learning rules that govern the Student Journey Map and Adaptive Path.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            onClick={async () => {
              toast.info('Synchronizing canonical 20-subject syllabus hierarchy to database...');
              const res = await QuestionClassificationService.syncCanonicalSyllabusToDatabase();
              if (res.success) {
                toast.success(res.message);
                fetchTopicsForSubject(selectedSubjectId);
              } else {
                toast.error(res.message);
              }
            }}
            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          >
            <BookOpen className="w-4 h-4 mr-2 text-purple-400" /> Sync 20-Subject Syllabus
          </Button>
          <Button variant="outline" onClick={fetchSubjects}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh Subjects
          </Button>
          {!isEditing && (
            <Button onClick={() => { resetForm(); setIsEditing(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add New Topic
            </Button>
          )}
        </div>
      </div>

      {/* Global Academic Learning Rules Configuration Card */}
      <Card className="border-primary/30 bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" /> Authoritative Learning Progression Rules
              </CardTitle>
              <CardDescription>
                These parameters determine topic mastery, unlock conditions, and adaptive weakness triggers across the Student Dashboard, Journey Map, and Adaptive Path.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
              Real-time DB Sync
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSaveLearningRules} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mastery Threshold (%)
                </label>
                <Input 
                  type="number" 
                  min="50" 
                  max="100" 
                  value={rules.masteryThresholdPercent} 
                  onChange={e => setRules({ ...rules, masteryThresholdPercent: Number(e.target.value) || 75 })} 
                  required
                />
                <span className="text-[11px] text-muted-foreground">Min accuracy to mark a topic mastered</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Min Attempts For Mastery
                </label>
                <Input 
                  type="number" 
                  min="1" 
                  max="50" 
                  value={rules.minAttemptsForMastery} 
                  onChange={e => setRules({ ...rules, minAttemptsForMastery: Number(e.target.value) || 3 })} 
                  required
                />
                <span className="text-[11px] text-muted-foreground">Min questions answered before unlocking</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Weakness Alert Trigger (%)
                </label>
                <Input 
                  type="number" 
                  min="10" 
                  max="70" 
                  value={rules.weaknessTriggerPercent} 
                  onChange={e => setRules({ ...rules, weaknessTriggerPercent: Number(e.target.value) || 50 })} 
                  required
                />
                <span className="text-[11px] text-muted-foreground">Below this triggers critical adaptive drill</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Prerequisite Mode
                </label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={rules.prerequisiteMode}
                  onChange={e => setRules({ ...rules, prerequisiteMode: e.target.value as 'strict' | 'advisory' })}
                >
                  <option value="strict">Strict (Locked until prereq mastered)</option>
                  <option value="advisory">Advisory (Accessible with warning)</option>
                </select>
                <span className="text-[11px] text-muted-foreground">Enforce sequence lock vs open access</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Prescribed Literature Novel (Current Academic Year)
                </label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={rules.activePrescribedNovelId || ''}
                  onChange={e => {
                    const novelId = e.target.value;
                    const found = availableNovels.find(b => b.id === novelId);
                    setRules({
                      ...rules,
                      activePrescribedNovelId: novelId,
                      activePrescribedNovelTitle: found ? found.title : ''
                    });
                  }}
                >
                  <option value="">-- No Active Novel Prescribed --</option>
                  {availableNovels.map(bk => (
                    <option key={bk.id} value={bk.id}>
                      {bk.title} {bk.author ? `by ${bk.author}` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-muted-foreground">
                  Only the active novel configured here is recommended to students in Use of English paths.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Daily Study Target (Minutes)
                </label>
                <Input 
                  type="number" 
                  min="10" 
                  max="240" 
                  value={rules.dailyStudyTargetMinutes} 
                  onChange={e => setRules({ ...rules, dailyStudyTargetMinutes: Number(e.target.value) || 30 })} 
                  required
                />
                <span className="text-[11px] text-muted-foreground">Recommended daily practice target</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={savingRules} className="font-bold">
                <Save className="w-4 h-4 mr-2" /> {savingRules ? 'Saving Rules...' : 'Save Learning Progression Rules'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Subject selector pills */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
        {subjects.map(sub => (
          <Button
            key={sub.id}
            variant={selectedSubjectId === sub.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedSubjectId(sub.id); resetForm(); }}
          >
            {sub.name}
          </Button>
        ))}
      </div>

      {isEditing && (
        <Card className="border-primary/50 shadow-md bg-card">
          <CardHeader>
            <CardTitle>{currentTopicId ? 'Edit Syllabus Topic' : 'Add New Syllabus Topic'}</CardTitle>
            <CardDescription>Configure sequencing, difficulty level, prerequisites, and learning goals for {selectedSubjectObj?.name || 'Selected Subject'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveTopic} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Topic Title</label>
                  <Input 
                    value={topicTitle} 
                    onChange={e => setTopicTitle(e.target.value)} 
                    placeholder="e.g. Differentiation and Integration of Algebraic Functions" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brief Description</label>
                  <Input 
                    value={topicDescription} 
                    onChange={e => setTopicDescription(e.target.value)} 
                    placeholder="Short summary of what this topic covers" 
                  />
                </div>
              </div>

              {/* Sequencing, Level, JAMB Weight, Prerequisites */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sequence Number</label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="100" 
                    value={topicSequence} 
                    onChange={e => setTopicSequence(Number(e.target.value) || 1)} 
                    required 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Difficulty Level</label>
                  <select 
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={topicLevel}
                    onChange={e => setTopicLevel(Number(e.target.value) || 1)}
                  >
                    <option value={1}>Level 1: Foundation</option>
                    <option value={2}>Level 2: Core Intermediate</option>
                    <option value={3}>Level 3: Advanced Mastery</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">JAMB Weight (%)</label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="50" 
                    value={topicWeight} 
                    onChange={e => setTopicWeight(Number(e.target.value) || 15)} 
                    required 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended Action</label>
                  <Input 
                    value={recommendedAction} 
                    onChange={e => setRecommendedAction(e.target.value)} 
                    placeholder="e.g. Solve 15 Targeted Drills" 
                  />
                </div>
              </div>

              {/* Prerequisites Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Prerequisite Topics (Students must master these before unlocking)</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-muted/30 border border-border rounded-lg">
                  {topics
                    .filter(t => t.id !== currentTopicId)
                    .map(t => {
                      const isSelected = selectedPrereqs.includes(t.id);
                      return (
                        <Badge
                          key={t.id}
                          variant={isSelected ? 'default' : 'outline'}
                          className="cursor-pointer select-none py-1 px-2.5 text-xs"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedPrereqs(selectedPrereqs.filter(id => id !== t.id));
                            } else {
                              setSelectedPrereqs([...selectedPrereqs, t.id]);
                            }
                          }}
                        >
                          {isSelected ? '✓ ' : '+ '} {t.name || t.title}
                        </Badge>
                      );
                    })}
                  {topics.filter(t => t.id !== currentTopicId).length === 0 && (
                    <span className="text-xs text-muted-foreground">No other topics in this subject yet to set as prerequisites.</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Prescribed Reading / Where to Study (Book, Textbook Chapter, or Official Reading Text)</label>
                <Input 
                  value={recommendedReading} 
                  onChange={e => setRecommendedReading(e.target.value)} 
                  placeholder="e.g. Lambert Comprehensive Physics Chapter 4, Official JAMB Syllabus, or Prescribed Literature Text" 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Learning Objectives (One per line)</label>
                  <textarea 
                    className="w-full min-h-[90px] p-3 rounded-md border border-input bg-background text-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                    value={learningObjectives} 
                    onChange={e => setLearningObjectives(e.target.value)} 
                    placeholder="Understand product and quotient rules&#10;Apply chain rule in trigonometric functions"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recommended Study Tasks (One per line)</label>
                  <textarea 
                    className="w-full min-h-[90px] p-3 rounded-md border border-input bg-background text-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                    value={studyTasks} 
                    onChange={e => setStudyTasks(e.target.value)} 
                    placeholder="Solve 20 past JAMB questions on calculus&#10;Review summary notes on logarithmic differentiation"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Syllabus Topic'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Topics list */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading syllabus topics...</div>
        ) : topics.length === 0 ? (
          <Card className="p-8 text-center bg-card border-dashed border-border">
            <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">No Topics Found for {selectedSubjectObj?.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">Add the first syllabus topic to populate student study recommendations.</p>
            <Button onClick={() => setIsEditing(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Topic
            </Button>
          </Card>
        ) : (
          topics.map((topic, index) => (
            <Card key={topic.id || index} className="border border-border bg-card shadow-sm hover:border-primary/30 transition-all">
              <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-bold">
                      Seq #{topic.sequence || index + 1}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Level {topic.level || 1}
                    </Badge>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                      {topic.jamb_weight || 15}% UTME Weight
                    </Badge>
                    <h3 className="text-lg font-semibold text-foreground">{topic.name || topic.title}</h3>
                  </div>
                  {topic.description && <p className="text-sm text-muted-foreground">{topic.description}</p>}
                  
                  {topic.recommended_reading && (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 w-fit">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Prescribed Reading: {topic.recommended_reading}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {topic.learning_objectives && topic.learning_objectives.length > 0 && (
                      <div className="bg-muted/30 p-3 rounded-lg border border-border/50 text-xs">
                        <span className="font-semibold block text-foreground mb-1">Learning Objectives:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                          {topic.learning_objectives.map((obj: string, i: number) => (
                            <li key={i}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {topic.recommended_tasks && topic.recommended_tasks.length > 0 && (
                      <div className="bg-muted/30 p-3 rounded-lg border border-border/50 text-xs">
                        <span className="font-semibold block text-foreground mb-1">Recommended Study Tasks:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                          {topic.recommended_tasks.map((task: string, i: number) => (
                            <li key={i}>{task}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(topic)}>
                    <Edit2 className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => confirmDelete(topic.id, topic.name || topic.title)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, title: '' })}
        onConfirm={handleDelete}
        title="Delete Syllabus Topic"
        description={`Are you sure you want to delete "${deleteDialog.title}"? Students will no longer see this topic in their syllabus tracker.`}
        isDeleting={false}
      />
    </div>
  );
};

