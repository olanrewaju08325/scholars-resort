import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { Image as ImageIcon, Upload, Plus, Trash2, Edit2, Save, RefreshCw, CheckCircle, FileText, Eye, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { logAdminActivity } from '@/services/adminActivityService';
import { MathText } from '@/components/MathText';

export const ImageQuestionManagerTab = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State for Image-Based Question
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOption, setCorrectOption] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null; title: string }>({
    isOpen: false,
    id: null,
    title: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: subData } = await supabase.from('subjects').select('*').eq('is_active', true);
      if (subData) {
        setSubjects(subData);
        if (subData.length > 0 && !subjectId) setSubjectId(subData[0].id);
      }

      // Fetch questions that have image_url
      const { safeSupabaseQuery } = await import('@/lib/safeSupabase');
      const qRes = await safeSupabaseQuery<any[]>(
        supabase.from('questions').select('*').not('image_url', 'is', null).order('created_at', { ascending: false }),
        { contextName: 'ImageQuestionManagerTab', fallbackValue: [] }
      );
      const qData = qRes.data || [];
      
      let localImgQuestions: any[] = [];
      try {
        localImgQuestions = JSON.parse(localStorage.getItem('scholar_image_questions') || '[]');
      } catch {}

      const combined = [...(qData || []), ...localImgQuestions];
      setQuestions(combined);
    } catch (err) {
      console.warn('Error fetching image questions:', err);
      try {
        const local = JSON.parse(localStorage.getItem('scholar_image_questions') || '[]');
        setQuestions(local);
      } catch {
        setQuestions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    setUploadingImg(true);
    try {
      // 1. Try uploading to Supabase storage bucket 'materials' or 'question_images'
      const fileName = `question_img_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await supabase.storage.from('materials').upload(fileName, file);

      if (!error && data?.path) {
        const { data: publicUrlData } = supabase.storage.from('materials').getPublicUrl(fileName);
        if (publicUrlData?.publicUrl) {
          setImageUrl(publicUrlData.publicUrl);
          toast.success('Diagram / question image uploaded successfully to Supabase Storage!');
          setUploadingImg(false);
          return;
        }
      }

      // 2. Fallback to base64 data URL if storage bucket upload is not configured
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImageUrl(base64String);
        toast.success('Image loaded via local preview successfully!');
        setUploadingImg(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(`Image upload failed: ${err.message}`);
      setUploadingImg(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !imageUrl.trim()) {
      toast.error('Question text and diagram image are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        subject_id: subjectId,
        question: questionText.trim(),
        image_url: imageUrl.trim(),
        option_a: optA.trim(),
        option_b: optB.trim(),
        option_c: optC.trim(),
        option_d: optD.trim(),
        correct_option: correctOption.toUpperCase(),
        explanation: explanation.trim(),
        difficulty: 'medium',
        updated_at: new Date().toISOString()
      };

      if (currentId && !currentId.startsWith('local_img_')) {
        const { error } = await supabase.from('questions').update(payload).eq('id', currentId);
        if (error) throw error;
        toast.success('Image-based question updated successfully!');
      } else {
        const newId = `local_img_${Math.random().toString(36).substring(2, 9)}`;
        const insertPayload = { id: newId, ...payload, created_at: new Date().toISOString() };
        
        const { error } = await supabase.from('questions').insert(insertPayload);
        
        const localCurrent = JSON.parse(localStorage.getItem('scholar_image_questions') || '[]');
        const updatedLocal = currentId 
          ? localCurrent.map((q: any) => q.id === currentId ? { ...q, ...payload } : q)
          : [insertPayload, ...localCurrent];
        localStorage.setItem('scholar_image_questions', JSON.stringify(updatedLocal));

        toast.success('Image-based JAMB question published successfully!');
      }

      logAdminActivity('Manage Image Question', `Saved image question: ${questionText.substring(0, 30)}...`);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(`Failed to save question: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId(null);
    setQuestionText('');
    setImageUrl('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setCorrectOption('A');
    setExplanation('');
  };

  const handleEdit = (q: any) => {
    setIsEditing(true);
    setCurrentId(q.id);
    setSubjectId(q.subject_id || subjects[0]?.id || '');
    setQuestionText(q.question || q.question_text || '');
    setImageUrl(q.image_url || '');
    setOptA(q.option_a || q.options?.[0] || '');
    setOptB(q.option_b || q.options?.[1] || '');
    setOptC(q.option_c || q.options?.[2] || '');
    setOptD(q.option_d || q.options?.[3] || '');
    setCorrectOption(q.correct_option || 'A');
    setExplanation(q.explanation || '');
  };

  const confirmDelete = (id: string, title: string) => {
    setDeleteDialog({ isOpen: true, id, title });
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      if (!deleteDialog.id.startsWith('local_img_')) {
        await supabase.from('questions').delete().eq('id', deleteDialog.id);
      }
      const local = JSON.parse(localStorage.getItem('scholar_image_questions') || '[]');
      const filtered = local.filter((q: any) => q.id !== deleteDialog.id);
      localStorage.setItem('scholar_image_questions', JSON.stringify(filtered));

      setQuestions(prev => prev.filter(q => q.id !== deleteDialog.id));
      toast.success('Question deleted successfully.');
      logAdminActivity('Delete Image Question', `Deleted question ID ${deleteDialog.id}`);
    } catch (err: any) {
      toast.error(`Error deleting question: ${err.message}`);
    } finally {
      setDeleteDialog({ isOpen: false, id: null, title: '' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">JAMB Diagram & Image Question Manager</h2>
          <p className="text-muted-foreground">Upload and manage visual CBT questions requiring diagrams, graphs, physics circuits, or biological illustrations.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh Questions
          </Button>
          {!isEditing && (
            <Button onClick={() => { resetForm(); setIsEditing(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Image Question
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <Card className="border-primary/50 shadow-md bg-card">
          <CardHeader>
            <CardTitle>{currentId ? 'Edit Image-Based Question' : 'Upload New Image-Based CBT Question'}</CardTitle>
            <CardDescription>Attach diagram figures, mathematical graphs, or illustrations for JAMB CBT testing.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <select 
                    className="w-full p-2.5 rounded-md border border-input bg-background text-foreground text-sm"
                    value={subjectId} 
                    onChange={e => setSubjectId(e.target.value)}
                  >
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Upload Diagram / Figure (PNG, JPG, SVG)</label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      disabled={uploadingImg}
                    />
                  </div>
                  {uploadingImg && <p className="text-xs text-primary animate-pulse">Uploading image asset...</p>}
                </div>
              </div>

              {imageUrl && (
                <div className="p-3 bg-muted/40 rounded-lg border border-border flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Diagram Preview:</span>
                  <img src={imageUrl} alt="Question diagram preview" className="max-h-48 object-contain rounded border border-border bg-white p-1" />
                  <Input 
                    value={imageUrl} 
                    onChange={e => setImageUrl(e.target.value)} 
                    placeholder="Image URL" 
                    className="text-xs text-muted-foreground"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Question Prompt (Supports LaTeX math like $x^2 + y^2$)</label>
                <textarea 
                  className="w-full min-h-[90px] p-3 rounded-md border border-input bg-background text-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                  value={questionText} 
                  onChange={e => setQuestionText(e.target.value)} 
                  placeholder="Based on the circuit diagram above, calculate the total resistance..." 
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Option A</label>
                  <Input value={optA} onChange={e => setOptA(e.target.value)} placeholder="Option A text" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Option B</label>
                  <Input value={optB} onChange={e => setOptB(e.target.value)} placeholder="Option B text" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Option C</label>
                  <Input value={optC} onChange={e => setOptC(e.target.value)} placeholder="Option C text" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Option D</label>
                  <Input value={optD} onChange={e => setOptD(e.target.value)} placeholder="Option D text" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Correct Option</label>
                  <select 
                    className="w-full p-2.5 rounded-md border border-input bg-background text-foreground text-sm"
                    value={correctOption} 
                    onChange={e => setCorrectOption(e.target.value)}
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Detailed Explanation</label>
                  <Input value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Step-by-step solution breakdown..." />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Publish Image Question'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Questions list */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading image questions...</div>
        ) : questions.length === 0 ? (
          <Card className="p-8 text-center bg-card border-dashed border-border">
            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">No Image Questions Uploaded Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload diagram questions to empower students with rich multimedia practice.</p>
            <Button onClick={() => setIsEditing(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Image Question
            </Button>
          </Card>
        ) : (
          questions.map((q) => (
            <Card key={q.id} className="border border-border bg-card shadow-sm">
              <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary">
                      {q.subjects?.name || 'Subject'}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">ID: {q.id}</span>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 items-start">
                    {q.image_url && (
                      <img src={q.image_url} alt="Question diagram" className="w-36 h-36 object-contain rounded border border-border bg-white p-1 shrink-0" />
                    )}
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-medium text-foreground"><MathText text={q.question || q.question_text} /></p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className={`p-1.5 rounded border ${q.correct_option === 'A' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 font-semibold' : 'bg-muted/30 border-border'}`}>A: <MathText text={q.option_a || q.options?.[0]} /></div>
                        <div className={`p-1.5 rounded border ${q.correct_option === 'B' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 font-semibold' : 'bg-muted/30 border-border'}`}>B: <MathText text={q.option_b || q.options?.[1]} /></div>
                        <div className={`p-1.5 rounded border ${q.correct_option === 'C' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 font-semibold' : 'bg-muted/30 border-border'}`}>C: <MathText text={q.option_c || q.options?.[2]} /></div>
                        <div className={`p-1.5 rounded border ${q.correct_option === 'D' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 font-semibold' : 'bg-muted/30 border-border'}`}>D: <MathText text={q.option_d || q.options?.[3]} /></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(q)}>
                    <Edit2 className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => confirmDelete(q.id, q.question)}>
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
        title="Delete Image Question"
        description="Are you sure you want to delete this image question?"
        isDeleting={false}
      />
    </div>
  );
};
