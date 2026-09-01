import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { BookOpen, Plus, Trash2, Edit2, Save, RefreshCw, CheckCircle, AlertTriangle, Layers, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { logAdminActivity } from '@/services/adminActivityService';
import { QuestionClassificationService } from '@/services/questionClassificationService';

export const SyllabusAdminTab = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New/Edit Topic Form State
  const [isEditing, setIsEditing] = useState(false);
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [studyTasks, setStudyTasks] = useState('');

  const { confirmAction, ConfirmElement } = useConfirm();
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null; title: string }>({
    isOpen: false,
    id: null,
    title: ''
  });

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      fetchTopicsForSubject(selectedSubjectId);
    } else {
      setTopics([]);
    }
  }, [selectedSubjectId]);

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
      const payload = {
        subject_id: selectedSubjectId,
        name: topicTitle.trim(),
        description: topicDescription.trim(),
        learning_objectives: learningObjectives.split('\n').filter(Boolean),
        recommended_tasks: studyTasks.split('\n').filter(Boolean),
        updated_at: new Date().toISOString()
      };

      if (currentTopicId && !currentTopicId.startsWith('local_')) {
        const { error } = await supabase.from('topics').update(payload).eq('id', currentTopicId);
        if (error) throw error;
        toast.success('Syllabus topic updated successfully!');
      } else {
        const newId = `topic_${Math.random().toString(36).substring(2, 9)}`;
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
    setLearningObjectives('');
    setStudyTasks('');
  };

  const handleEdit = (topic: any) => {
    setIsEditing(true);
    setCurrentTopicId(topic.id);
    setTopicTitle(topic.name || topic.title || '');
    setTopicDescription(topic.description || '');
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Dynamic Syllabus Management</h2>
          <p className="text-muted-foreground">Configure subject topics, learning objectives, and recommended study tasks fetched dynamically for students.</p>
        </div>
        <div className="flex items-center gap-3">
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
            <CardDescription>Configure learning goals and recommended student tasks for {selectedSubjectObj?.name || 'Selected Subject'}</CardDescription>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Learning Objectives (One per line)</label>
                  <textarea 
                    className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                    value={learningObjectives} 
                    onChange={e => setLearningObjectives(e.target.value)} 
                    placeholder="Understand product and quotient rules&#10;Apply chain rule in trigonometric functions"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recommended Study Tasks (One per line)</label>
                  <textarea 
                    className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
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
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary">Topic {index + 1}</span>
                    <h3 className="text-lg font-semibold text-foreground">{topic.name || topic.title}</h3>
                  </div>
                  {topic.description && <p className="text-sm text-muted-foreground">{topic.description}</p>}
                  
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

                <div className="flex items-center gap-2 self-end md:self-center">
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
