import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/hooks/useConfirm';
import { supabase } from '@/lib/supabase';
import { Upload, Book, FileText, Trash2, CheckCircle, XCircle } from 'lucide-react';

export const MaterialsTab = () => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const fetchMaterials = async () => {
    const { data } = await supabase.from('materials').select('*, subjects(name)').order('created_at', { ascending: false });
    if (data) setMaterials(data);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').eq('is_active', true);
    if (data) {
      setSubjects(data);
      if (data.length > 0) setSubjectId(data[0].id);
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchSubjects();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title || !subjectId) {
      setUploadStatus({ type: 'error', message: 'Please fill in required fields and select a file.' });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${subjectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: userData } = await supabase.auth.getUser();

      const { error: dbError } = await supabase.from('materials').insert({
        title,
        description,
        subject_id: subjectId,
        file_path: filePath,
        file_size_bytes: file.size,
        visibility: true, // Auto publish for now
        is_premium: isPremium,
        uploaded_by: userData?.user?.id
      });

      if (dbError) throw dbError;

      setUploadStatus({ type: 'success', message: 'Material uploaded successfully!' });
      setTitle('');
      setDescription('');
      setFile(null);
      fetchMaterials();
      
      // Clear file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if(fileInput) fileInput.value = '';

    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Upload failed.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    confirmAction(
      "Delete Material",
      "Are you sure you want to delete this material?",
      async () => {
        // Delete from storage
        await supabase.storage.from('materials').remove([filePath]);
        
        // Delete from DB
        await supabase.from('materials').delete().eq('id', id);
        fetchMaterials();
      },
      { destructive: true }
    );
  };

  const toggleVisibility = async (id: string, currentVisibility: boolean) => {
    await supabase.from('materials').update({ visibility: !currentVisibility }).eq('id', id);
    fetchMaterials();
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Upload Form */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" /> Upload New Material
            </CardTitle>
            <CardDescription className="text-slate-400">Add textbooks or study notes for students.</CardDescription>
          </CardHeader>
          <CardContent>
            {uploadStatus && (
              <div className={`p-3 rounded mb-4 text-sm flex items-center gap-2 ${uploadStatus.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-destructive/20 text-destructive'}`}>
                {uploadStatus.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {uploadStatus.message}
              </div>
            )}
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Essential Mathematics 2026" className="bg-slate-950 border-slate-800" />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject *</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-200">
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full h-20 bg-slate-950 border border-slate-800 rounded-md p-3 text-sm text-slate-200 resize-none" 
                  placeholder="Optional description..."
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">File (PDF) *</label>
                <Input id="file-upload" type="file" accept=".pdf" onChange={handleFileChange} required className="bg-slate-950 border-slate-800" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="premium" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} className="w-4 h-4 accent-primary" />
                <label htmlFor="premium" className="text-sm">Premium Material (Requires active subscription)</label>
              </div>

              <Button type="submit" disabled={isUploading || !file} className="w-full">
                {isUploading ? 'Uploading...' : 'Upload Material'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Materials List */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="w-5 h-5 text-green-400" /> Content Library
            </CardTitle>
            <CardDescription className="text-slate-400">Manage uploaded materials.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {materials.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No materials uploaded yet.</div>
              ) : materials.map(mat => (
                <div key={mat.id} className="p-4 border border-slate-800 rounded-lg bg-slate-950/50 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" /> {mat.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">{mat.subjects?.name} • {(mat.file_size_bytes / (1024*1024)).toFixed(2)} MB</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <span className={`text-xs px-2 py-1 rounded-full ${mat.visibility ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                        {mat.visibility ? 'Published' : 'Draft'}
                      </span>
                      {mat.is_premium && <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">Premium</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 pt-2 border-t border-slate-800">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => toggleVisibility(mat.id, mat.visibility)}>
                      {mat.visibility ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button size="sm" variant="destructive" className="px-3" onClick={() => handleDelete(mat.id, mat.file_path)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
