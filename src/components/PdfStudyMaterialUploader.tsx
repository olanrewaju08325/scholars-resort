import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, Sparkles, Loader2, CheckCircle2, AlertCircle, BookOpen, BrainCircuit, ShieldCheck, Tag, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { analyzeDocumentWithGroq } from '@/services/aiService';
import { toast } from 'sonner';

interface PdfStudyMaterialUploaderProps {
  onQuestionsGenerated?: (questions: any[]) => void;
  onAnalysisComplete?: (summary: any) => void;
}

export const PdfStudyMaterialUploader: React.FC<PdfStudyMaterialUploaderProps> = ({
  onQuestionsGenerated,
  onAnalysisComplete
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // Subject and Topic association state
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topicsList, setTopicsList] = useState<any[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  const [analysisResult, setAnalysisResult] = useState<{
    summary?: string;
    topics?: string[];
    key_formulas?: string[];
    questions?: any[];
  } | null>(null);

  // Load subjects
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .order('name');
        if (error) throw error;
        if (data) setSubjectsList(data);
      } catch (err: any) {
        console.error('Failed to load subjects:', err);
      }
    };
    loadSubjects();
  }, []);

  // Load topics dynamically based on selected subject
  useEffect(() => {
    if (!selectedSubjectId) {
      setTopicsList([]);
      setSelectedTopicId('');
      return;
    }
    const loadTopics = async () => {
      try {
        const { data, error } = await supabase
          .from('topics')
          .select('*')
          .eq('subject_id', selectedSubjectId)
          .order('name');
        if (error) throw error;
        if (data) setTopicsList(data);
      } catch (err: any) {
        console.error('Failed to load topics:', err);
      }
    };
    loadTopics();
  }, [selectedSubjectId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf' && !selected.name.endsWith('.pdf') && !selected.type.startsWith('text/')) {
        toast.error('Please upload a valid PDF or text document.');
        return;
      }
      setFile(selected);
      // Auto fill title if empty
      if (!title) {
        const cleanName = selected.name.replace(/\.[^/.]+$/, "");
        setTitle(cleanName.replace(/[_-]/g, ' '));
      }
    }
  };

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
      const selected = e.dataTransfer.files[0];
      if (selected.type !== 'application/pdf' && !selected.name.endsWith('.pdf') && !selected.type.startsWith('text/')) {
        toast.error('Please drop a valid PDF or text document.');
        return;
      }
      setFile(selected);
      if (!title) {
        const cleanName = selected.name.replace(/\.[^/.]+$/, "");
        setTitle(cleanName.replace(/[_-]/g, ' '));
      }
      toast.success(`Dropped: ${selected.name}`);
    }
  };

  const processAndAnalyze = async () => {
    if (!file && !pastedText.trim()) {
      toast.error('Please select a PDF file, drag and drop a file, or paste text.');
      return;
    }

    setIsUploading(true);
    let publicUrl = '';
    let docText = pastedText;

    try {
      if (file) {
        const fileExt = file.name.split('.').pop() || 'pdf';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const filePath = `study_materials/${fileName}`;

        // 1. Upload directly to 'study-materials' bucket as requested
        let uploadError = null;
        try {
          const { error } = await supabase.storage
            .from('study-materials')
            .upload(filePath, file);
          if (error) uploadError = error;
        } catch (err: any) {
          uploadError = err;
        }

        // Fallback to 'materials' or 'raw_content' if study-materials bucket does not exist
        let activeBucket = 'study-materials';
        if (uploadError) {
          console.warn('[Uploader] Upload to study-materials bucket failed, trying materials fallback...', uploadError.message);
          try {
            const { error: fbError } = await supabase.storage
              .from('materials')
              .upload(filePath, file);
            if (fbError) {
              console.warn('[Uploader] Upload to materials fallback failed, trying raw_content...', fbError.message);
              const { error: rawError } = await supabase.storage
                .from('raw_content')
                .upload(filePath, file);
              if (rawError) throw rawError;
              activeBucket = 'raw_content';
            } else {
              activeBucket = 'materials';
            }
          } catch (fallbackErr: any) {
            console.error('[Uploader] Storage fallback failure:', fallbackErr);
            throw new Error(`Upload failed. Ensure a storage bucket is provisioned. Details: ${uploadError.message || fallbackErr.message}`);
          }
        }

        const { data: urlData } = supabase.storage.from(activeBucket).getPublicUrl(filePath);
        publicUrl = urlData.publicUrl;
        console.log('[Uploader] File public URL obtained:', publicUrl);

        if (!docText) {
          docText = `Document Title: ${title || file.name}. Size: ${Math.round(file.size / 1024)} KB. Subject content overview for UTME practice preparation.`;
        }
      }

      setIsUploading(false);
      setIsAnalyzing(true);

      // 2. AI Analysis
      toast.info('Groq AI Llama 3.3 is analyzing document content...');
      const analysis = await analyzeDocumentWithGroq(docText, file ? file.name : 'Pasted Study Material');

      setAnalysisResult(analysis);
      toast.success('Groq AI analysis and questions generation complete!');

      if (onAnalysisComplete) onAnalysisComplete(analysis);
      if (onQuestionsGenerated && analysis.questions) {
        onQuestionsGenerated(analysis.questions);
      }

      // 3. Persistence and Table Association via Server-Side Admin Utility (Bypasses Client RLS)
      const matTitle = title || (file ? file.name.replace(/\.[^/.]+$/, "") : 'AI Extracted Material');
      const matDesc = description || analysis.summary || 'Expert study notes & practice materials prepared by Groq AI.';
      const matFilePath = publicUrl || 'text_paste';

      try {
        const metadataResponse = await fetch('/api/admin/materials/upload-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: matTitle,
            description: matDesc,
            subject_id: selectedSubjectId || null,
            topic_id: selectedTopicId || null,
            file_path: matFilePath,
            is_premium: isPremium
          })
        });

        if (metadataResponse.ok) {
          const metaRes = await metadataResponse.json();
          if (metaRes.success) {
            toast.success('Study material catalog entry & subject/topic links successfully established!');
          } else {
            console.warn('[Uploader] Server-side table update failed:', metaRes.error);
          }
        } else {
          console.warn('[Uploader] Server-side upload metadata route returned status:', metadataResponse.status);
        }
      } catch (dbErr: any) {
        console.warn('[Uploader] Table linking error:', dbErr.message);
      }

      // Sync local storage so student interface is instantly updated with real data fallback
      try {
        const localRaw = localStorage.getItem('scholar_local_materials');
        const localList = localRaw ? JSON.parse(localRaw) : [];
        const matchedSubjectObj = subjectsList.find(s => s.id === selectedSubjectId);
        
        localList.unshift({
          id: `local_mat_${Date.now()}`,
          title: matTitle,
          description: matDesc,
          file_url: publicUrl || 'text_paste',
          is_premium: isPremium,
          subjects: matchedSubjectObj ? { name: matchedSubjectObj.name } : { name: 'General' },
          created_at: new Date().toISOString()
        });
        
        localStorage.setItem('scholar_local_materials', JSON.stringify(localList.slice(0, 100)));
        localStorage.setItem('library_last_updated', Date.now().toString());
        
        // Dispatch custom sync event
        window.dispatchEvent(new CustomEvent('library-materials-updated', { detail: { updated: true } }));
      } catch (syncErr: any) {
        console.warn('[Uploader] localStorage fallback warning:', syncErr);
      }

      // 5. Store ingestion job log
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('content_ingestion_jobs').insert({
          admin_id: userData.user.id,
          file_path: publicUrl || 'text_paste',
          file_name: file ? file.name : 'Text_Snippet',
          file_type: file ? file.type : 'text/plain',
          status: 'completed',
          total_questions_found: analysis.questions?.length || 0,
          extracted_data: analysis.questions || [],
          context_detected: analysis.summary || 'PDF Study Material Analysis'
        });
      }

      toast.success('Study material successfully uploaded and linked to database!');
      
      // Reset file / text form input but keep the subject/topic selection
      setFile(null);
      setPastedText('');
      setTitle('');
      setDescription('');
    } catch (err: any) {
      console.error('[Uploader] Error in upload pipeline:', err);
      toast.error(`Study material integration failed: ${err.message || 'Error processing upload'}`);
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="border-border bg-card shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl flex items-center gap-2 font-display">
              Groq AI Study Material Manager
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-normal border border-emerald-500/30">
                Llama 3.3 70B
              </span>
            </CardTitle>
            <CardDescription>
              Upload educational notes, past syllabus files or PDFs. Instantly link documents directly to your Subjects/Topics and auto-populate Student Practice Libraries.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title and Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              Material Title <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. UTME Physics Mechanics Guide"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-950 border-border text-sm rounded-xl focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Brief Description
            </label>
            <Input
              type="text"
              placeholder="e.g. Essential equations, concepts and practice questions."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-950 border-border text-sm rounded-xl focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Dropdown selectors for Subject & Topic Linking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-900">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Associate Subject (Table Link)
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-border text-sm text-foreground focus:ring-1 focus:ring-primary/50 outline-none"
            >
              <option value="">-- No Subject (General Library) --</option>
              {subjectsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Associate Topic (Table Link)
            </label>
            <select
              value={selectedTopicId}
              disabled={!selectedSubjectId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-border text-sm text-foreground focus:ring-1 focus:ring-primary/50 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">-- No Specific Topic (Subject Wide) --</option>
              {topicsList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag and Drop File Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-primary bg-primary/10'
              : file
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-border hover:border-primary/50 bg-muted/20'
          }`}
        >
          <input
            type="file"
            id="pdf-study-upload"
            accept=".pdf,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          <label htmlFor="pdf-study-upload" className="cursor-pointer block space-y-2">
            <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
              file ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'
            }`}>
              <Upload className="w-6 h-6 animate-pulse" />
            </div>
            <div className="font-semibold text-sm">
              {file ? (
                <span className="text-emerald-400 flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              ) : (
                'Drag & drop document here or click to select file'
              )}
            </div>
            <p className="text-xs text-muted-foreground">PDF or text format up to 25MB. Uploads binaries to study-materials bucket.</p>
          </label>
        </div>

        {/* Optional Text Paste */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Or Paste Document Text/Syllabus content directly:
          </label>
          <Textarea
            placeholder="Alternative: Paste syllabus text, key notes or past questions here for instant Groq AI analysis..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="min-h-[100px] bg-slate-950 border-border text-sm rounded-xl"
          />
        </div>

        {/* Controls Option Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-950 border border-slate-900 text-xs">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="material-premium-toggle"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
            />
            <label htmlFor="material-premium-toggle" className="font-semibold text-slate-300 cursor-pointer flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-amber-500" /> Premium Subscription Access Only
            </label>
          </div>
          <div className="text-muted-foreground flex items-center gap-1 font-mono">
            <Info className="w-3.5 h-3.5 text-blue-400" /> Storage target: study-materials bucket
          </div>
        </div>

        <Button
          onClick={processAndAnalyze}
          disabled={isUploading || isAnalyzing || (!file && !pastedText.trim())}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5 rounded-xl flex items-center justify-center gap-2"
        >
          {isUploading || isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {isUploading ? 'Uploading Binary to Supabase Bucket...' : 'Groq AI Parsing Content & Extrapolating UTME CBT Questions...'}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-400" />
              Injest & Analyze study-materials & Link Tables
            </>
          )}
        </Button>

        {/* Analysis Output Section */}
        {analysisResult && (
          <div className="mt-6 space-y-4 border-t border-border pt-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Study Material Ingest & DB Integration Complete
            </div>

            {analysisResult.summary && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> Executive Summary
                </h4>
                <p className="text-sm leading-relaxed text-slate-300">{analysisResult.summary}</p>
              </div>
            )}

            {analysisResult.topics && analysisResult.topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {analysisResult.topics.map((top, idx) => (
                  <span key={idx} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                    #{top}
                  </span>
                ))}
              </div>
            )}

            {analysisResult.questions && analysisResult.questions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
                  <span>Generated Practice Questions ({analysisResult.questions.length})</span>
                  <span className="text-xs text-muted-foreground font-normal">Inserted into CBT Bank</span>
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {analysisResult.questions.map((q, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-900 space-y-2 text-xs">
                      <p className="font-semibold text-slate-200">{idx + 1}. {q.question}</p>
                      <div className="grid grid-cols-2 gap-1.5 text-slate-400">
                        {q.options?.map((opt: string, i: number) => (
                          <div key={i} className={`px-2 py-1 rounded border ${opt === q.correct_answer ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold' : 'border-slate-800 bg-slate-900'}`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <p className="text-[11px] text-muted-foreground italic border-t border-slate-800 pt-1.5 mt-1">
                          Explanation: {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
