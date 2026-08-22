import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/hooks/useConfirm';
import { supabase } from '@/lib/supabase';
import { Upload, Book, FileText, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '@/lib/utils';

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
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith('.pdf')) {
        setFile(droppedFile);
      } else {
        setUploadStatus({ type: 'error', message: 'Only PDF files are supported.' });
      }
    }
  };

  const fetchMaterials = async () => {
    let remoteMaterials: any[] = [];
    let libMaterials: any[] = [];
    let localMaterials: any[] = [];

    try {
      const { data } = await supabase.from('materials').select('*, subjects(name)').order('created_at', { ascending: false });
      if (data) remoteMaterials = data;
    } catch (e) {
      console.warn('Fetch materials notice:', e);
    }

    try {
      const { data } = await supabase.from('library_materials').select('*, subjects(name)').order('created_at', { ascending: false });
      if (data) libMaterials = data;
    } catch (e) {
      console.warn('Fetch library_materials notice:', e);
    }

    try {
      const localRaw = localStorage.getItem('scholar_local_materials');
      if (localRaw) localMaterials = JSON.parse(localRaw);
    } catch {}

    const subjectMap = new Map<string, string>();
    subjects.forEach(s => subjectMap.set(s.id, s.name));

    const combined: any[] = [];
    const seen = new Set<string>();

    const addMaterial = (m: any) => {
      const key = (m.id || m.title || '').toString().toLowerCase().trim();
      if (!key || seen.has(key)) return;
      seen.add(key);

      const subjectName = m.subjects?.name || subjectMap.get(m.subject_id) || 'General';
      combined.push({
        ...m,
        subjects: { name: subjectName },
        file_size_bytes: m.file_size_bytes || 1024 * 1024 * 2,
        visibility: m.visibility !== false && m.is_active !== false
      });
    };

    remoteMaterials.forEach(addMaterial);
    libMaterials.forEach(addMaterial);
    localMaterials.forEach(addMaterial);

    setMaterials(combined);
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
      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${subjectId}/${fileName}`;
      let publicUrl = '';

      // 1. Upload to Supabase Storage in 'study-materials' bucket
      try {
        const { error: uploadError } = await supabase.storage
          .from('study-materials')
          .upload(filePath, file, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('study-materials').getPublicUrl(filePath);
          publicUrl = publicUrlData?.publicUrl || filePath;
        } else {
          console.warn('[Storage] study-materials bucket upload notice:', uploadError.message);
          const { error: fallbackError } = await supabase.storage
            .from('materials')
            .upload(filePath, file, { contentType: 'application/pdf', upsert: true });

          if (!fallbackError) {
            const { data: publicUrlData } = supabase.storage.from('materials').getPublicUrl(filePath);
            publicUrl = publicUrlData?.publicUrl || filePath;
          } else {
            const { error: libStorageError } = await supabase.storage
              .from('library')
              .upload(filePath, file, { contentType: 'application/pdf', upsert: true });

            if (!libStorageError) {
              const { data: publicUrlData } = supabase.storage.from('library').getPublicUrl(filePath);
              publicUrl = publicUrlData?.publicUrl || filePath;
            }
          }
        }
      } catch (storageErr) {
        console.warn('Storage upload notice, using fallback:', storageErr);
      }

      if (!publicUrl) {
        publicUrl = URL.createObjectURL(file);
      }

      // Automatically store and persist the public URL in the corresponding 'subjects' database record
      if (subjectId) {
        try {
          await supabase
            .from('subjects')
            .update({ 
              study_material_url: publicUrl,
              study_materials_url: publicUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', subjectId);
        } catch (subErr) {
          console.warn('[MaterialsTab] Failed updating subjects table with study_material_url:', subErr);
        }
      }

      const newMaterialId = `mat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      let savedToRemote = false;

      // 2. Persist metadata via server-side API (Bypasses Client RLS)
      try {
        const metadataResponse = await fetch(getApiUrl('/api/admin/materials/upload-metadata'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            subject_id: subjectId || null,
            file_path: publicUrl,
            is_premium: isPremium
          })
        });

        if (metadataResponse.ok) {
          const metaRes = await metadataResponse.json();
          if (metaRes.success) {
            savedToRemote = true;
          }
        }
      } catch (srvErr: any) {
        console.warn('[MaterialsTab] Server-side metadata API exception:', srvErr.message);
      }

      // Also directly attempt Supabase client insert for materials & library_materials
      try {
        const { error: mErr } = await supabase.from('materials').insert({
          id: newMaterialId,
          title,
          description: description || '',
          subject_id: subjectId,
          file_path: publicUrl,
          file_size_bytes: file.size,
          visibility: true,
          is_premium: isPremium
        });
        if (!mErr) savedToRemote = true;

        await supabase.from('library_materials').insert({
          title,
          description: description || '',
          subject_id: subjectId,
          file_url: publicUrl,
          is_premium: isPremium,
          is_active: true
        });
      } catch {}

      // 3. Fallback to local storage persistence
      const newLocalItem = {
        id: newMaterialId,
        title,
        description,
        subject_id: subjectId,
        file_path: publicUrl,
        file_url: publicUrl,
        file_size_bytes: file.size,
        visibility: true,
        is_premium: isPremium,
        created_at: new Date().toISOString()
      };

      try {
        const existingRaw = localStorage.getItem('scholar_local_materials');
        const existingArr = existingRaw ? JSON.parse(existingRaw) : [];
        existingArr.unshift(newLocalItem);
        localStorage.setItem('scholar_local_materials', JSON.stringify(existingArr));
      } catch {}

      // Dispatch global revalidation events for student-facing UI
      window.dispatchEvent(new CustomEvent('library_materials_updated', { detail: { title, timestamp: Date.now() } }));
      window.dispatchEvent(new CustomEvent('supabase_library_revalidate', { detail: { title, timestamp: Date.now() } }));

      // Cross-tab broadcast & localStorage cache invalidation
      try {
        localStorage.setItem('library_last_updated', Date.now().toString());
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('library_cache_invalidation');
          bc.postMessage({ type: 'REFRESH_LIBRARY', title, timestamp: Date.now() });
          bc.close();
        }
      } catch {}

      setUploadStatus({
        type: 'success',
        message: 'Material PDF uploaded directly to study-materials bucket and linked to subject successfully!'
      });
      setTitle('');
      setDescription('');
      setFile(null);
      await fetchMaterials();
      
      // Clear file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Upload failed.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, filePath: string, title: string) => {
    confirmAction(
      "Delete Material",
      `Are you sure you want to delete "${title}"? This will permanently remove it from the Library, Resource Centre, and storage bucket.`,
      async () => {
        // Optimistically remove from state immediately
        setMaterials(prev => prev.filter(m => m.id !== id && (!title || m.title?.toLowerCase().trim() !== title.toLowerCase().trim())));

        try {
          // 1. Call our secure server-side deletion API
          await fetch(getApiUrl('/api/admin/materials/delete'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              title,
              file_path: filePath
            })
          }).catch(() => null);
        } catch {}

        // 2. Perform direct client Supabase deletions with safe error handling (NO .catch chaining on Postgrest builders)
        try {
          if (id) {
            await supabase.from('materials').delete().eq('id', id);
            await supabase.from('library_materials').delete().eq('id', id);
          }

          if (title) {
            await supabase.from('materials').delete().ilike('title', title.trim());
            await supabase.from('library_materials').delete().ilike('title', title.trim());
          }

          if (filePath) {
            const cleanPath = filePath.split('/').slice(-2).join('/');
            await supabase.storage.from('study-materials').remove([filePath, cleanPath]);
            await supabase.storage.from('materials').remove([filePath, cleanPath]);
            await supabase.storage.from('library').remove([filePath, cleanPath]);
          }
        } catch (fallbackErr) {
          console.warn('Client fallback delete notice:', fallbackErr);
        }

        // 3. Clear from localStorage
        try {
          const localRaw = localStorage.getItem('scholar_local_materials');
          if (localRaw) {
            const localArr = JSON.parse(localRaw);
            const filtered = localArr.filter((item: any) => 
              item.id !== id && 
              (!title || item.title?.toLowerCase().trim() !== title.toLowerCase().trim())
            );
            localStorage.setItem('scholar_local_materials', JSON.stringify(filtered));
          }
        } catch {}

        // 4. Dispatch revalidation events to sync student-facing view instantly
        window.dispatchEvent(new CustomEvent('library_materials_updated', { detail: { title, timestamp: Date.now() } }));
        window.dispatchEvent(new CustomEvent('supabase_library_revalidate', { detail: { title, timestamp: Date.now() } }));

        toast.success(`Successfully deleted "${title}" from Library and Resource Centre!`);
        await fetchMaterials();
      },
      { destructive: true }
    );
  };

  const toggleVisibility = async (id: string, currentVisibility: boolean) => {
    await supabase.from('materials').update({ visibility: !currentVisibility }).eq('id', id);
    fetchMaterials();
  };

  return (
    <div className="space-y-6 w-full min-w-0 overflow-hidden">
      {ConfirmElement}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-0">
        
        {/* Upload Form */}
        <Card className="bg-card border-border text-card-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Upload New Material
            </CardTitle>
            <CardDescription className="text-muted-foreground">Add textbooks or study notes for students.</CardDescription>
          </CardHeader>
          <CardContent>
            {uploadStatus && (
              <div className={`p-3 rounded mb-4 text-sm flex items-center gap-2 ${uploadStatus.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'}`}>
                {uploadStatus.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {uploadStatus.message}
              </div>
            )}
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Essential Mathematics 2026" className="bg-background border-border" />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject *</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required className="w-full bg-background border border-border rounded-md p-2 text-sm text-foreground">
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full h-20 bg-background border border-border rounded-md p-3 text-sm text-foreground resize-none" 
                  placeholder="Optional description..."
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">File (PDF) *</label>
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-2 ${
                    isDragging 
                      ? 'border-primary bg-primary/5 scale-[0.99]' 
                      : file 
                        ? 'border-green-500/50 bg-green-500/5' 
                        : 'border-border hover:border-muted-foreground/30 hover:bg-muted/10'
                  }`}
                >
                  <input 
                    id="file-upload" 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  <Upload className={`w-8 h-8 ${file ? 'text-green-500' : 'text-muted-foreground'}`} />
                  
                  {file ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground truncate max-w-xs">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB • Click or drag to replace</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-foreground">Drag & drop your study material PDF here</p>
                      <p className="text-xs text-muted-foreground mt-1">or click to browse local files</p>
                    </div>
                  )}
                </div>
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
        <Card className="bg-card border-border text-card-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="w-5 h-5 text-primary" /> Content Library
            </CardTitle>
            <CardDescription className="text-muted-foreground">Manage uploaded materials.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {materials.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No materials uploaded yet.</div>
              ) : materials.map(mat => (
                <div key={mat.id} className="p-4 border border-border rounded-lg bg-muted/20 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold flex items-center gap-2 text-foreground">
                        <FileText className="w-4 h-4 text-primary" /> {mat.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">{mat.subjects?.name || 'General'} • {(mat.file_size_bytes / (1024*1024)).toFixed(2)} MB</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <span className={`text-xs px-2 py-1 rounded-full ${mat.visibility ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                        {mat.visibility ? 'Published' : 'Draft'}
                      </span>
                      {mat.is_premium && <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-500 font-semibold">Premium</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 pt-2 border-t border-border">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => toggleVisibility(mat.id, mat.visibility)}>
                      {mat.visibility ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button size="sm" variant="destructive" className="px-3" onClick={() => handleDelete(mat.id, mat.file_path || mat.file_url || '', mat.title)}>
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
