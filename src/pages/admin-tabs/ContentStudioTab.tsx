import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2, Database, FileJson, PlayCircle, Sparkles, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { analyzeDocumentWithGroq } from '@/services/aiService';
import { extractTextFromFile } from '@/lib/pdfExtractor';

export const ContentStudioTab = () => {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Direct Text Ingestion Option
  const [rawText, setRawText] = useState('');
  const [processingText, setProcessingText] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('content_ingestion_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  const handleProcessRawText = async () => {
    if (!rawText.trim()) {
      toast.error('Please paste syllabus or document text first.');
      return;
    }

    setProcessingText(true);
    try {
      const result = await analyzeDocumentWithGroq(rawText, 'Pasted Document Text');

      if (result?.questions && result.questions.length > 0) {
        // Fetch default subject
        const { data: defaultSubjects } = await supabase.from('subjects').select('id, name').limit(1);
        const defaultSubId = defaultSubjects?.[0]?.id || null;

        const questionsToInsert = result.questions.map((q: any) => ({
          subject_id: defaultSubId,
          question_text: q.question,
          options: JSON.stringify(q.options),
          correct_answer: q.correct_answer,
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          is_active: true,
          quality_score: 95,
        }));

        const { error: insertErr } = await supabase.from('questions').insert(questionsToInsert);
        if (insertErr) throw insertErr;

        toast.success(`Groq extracted and saved ${result.questions.length} high-quality JAMB questions to database!`);
        setRawText('');
      } else {
        toast.info('Groq analyzed the document. Topics: ' + (result?.topics?.join(', ') || 'General'));
      }
    } catch (err: any) {
      toast.error(`Ingestion error: ${err.message}`);
    }
    setProcessingText(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      // Extract text content cleanly from PDF, TXT, MD, or JSON
      const textContent = await extractTextFromFile(selectedFile);
      const result = await analyzeDocumentWithGroq(textContent, selectedFile.name);

      if (result?.questions && result.questions.length > 0) {
        const { data: defaultSubjects } = await supabase.from('subjects').select('id, name').limit(1);
        const defaultSubId = defaultSubjects?.[0]?.id || null;

        const questionsToInsert = result.questions.map((q: any) => ({
          subject_id: defaultSubId,
          question_text: q.question,
          options: JSON.stringify(q.options),
          correct_answer: q.correct_answer,
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          is_active: true,
          quality_score: 95,
        }));

        await supabase.from('questions').insert(questionsToInsert);

        // Record job in content_ingestion_jobs
        await supabase.from('content_ingestion_jobs').insert({
          admin_id: profile?.id,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          status: 'completed',
          total_questions_found: result.questions.length,
          extracted_data: result.questions,
          created_at: new Date().toISOString()
        });

        toast.success(`Extracted & imported ${result.questions.length} questions from ${selectedFile.name}!`);
        setSelectedFile(null);
        fetchJobs();
      } else {
        toast.info(`Document processed. Found topics: ${result.topics?.join(', ')}`);
      }
    } catch (err: any) {
      toast.error(`File processing failed: ${err.message}`);
    }
    setUploading(false);
  };

  const handleImport = async () => {
    if (!selectedJob) return;
    try {
      const extractedList = selectedJob.extracted_data || [];
      if (extractedList.length > 0) {
        const { data: defaultSubjects } = await supabase.from('subjects').select('id, name').limit(1);
        const defaultSubId = defaultSubjects?.[0]?.id || null;

        const questionsToInsert = extractedList.map((q: any) => ({
          subject_id: defaultSubId,
          question_text: q.question || 'Sample Question',
          options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || [q.option_a, q.option_b, q.option_c, q.option_d]),
          correct_answer: q.correct_answer || 'A',
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          is_active: true,
          quality_score: 90,
        }));

        await supabase.from('questions').insert(questionsToInsert);
      }

      await supabase.from('content_ingestion_jobs').update({ status: 'completed' }).eq('id', selectedJob.id);
      toast.success(`${selectedJob.total_questions_found} questions imported into Question Bank!`);
      setShowPreview(false);
      setSelectedJob(null);
      fetchJobs();
    } catch (err: any) {
      toast.error('Failed to import questions: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold">Content Studio & AI Document Ingestion</h2>
        <p className="text-muted-foreground text-sm mt-1">Upload files or paste document text for automatic Groq question extraction and subject categorization.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File Upload Zone */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-primary" /> Upload Syllabus / Document File
            </CardTitle>
            <CardDescription>Select a text, markdown, or JSON document to extract questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/40 transition-colors">
              <UploadCloud className="w-8 h-8 text-primary mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Groq AI will OCR, extract questions, detect topics, and format questions automatically.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <Input 
                  type="file" 
                  accept=".pdf,.txt,.md,.json,.csv,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="cursor-pointer file:text-primary file:bg-primary/10 file:border-0 file:rounded-md file:px-3 file:py-1 hover:file:bg-primary/20 text-xs"
                />
                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || uploading}
                  className="w-full sm:w-auto font-bold shrink-0"
                >
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                  {uploading ? 'Analyzing...' : 'Ingest File'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Raw Text Ingestion */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" /> Direct Text / Passage Ingestion
            </CardTitle>
            <CardDescription>Paste syllabus sections, textbook notes, or raw past questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              rows={4}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Paste document or passage text here..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono text-slate-200 outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              onClick={handleProcessRawText}
              disabled={processingText || !rawText.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold"
            >
              {processingText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {processingText ? 'Groq Extracting Questions...' : 'Extract Questions with Groq AI'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Ingestion Jobs Queue */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" /> Ingestion Queue & Extraction History
        </h3>
        
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center p-12 bg-muted/10 border border-border rounded-xl text-muted-foreground">
            No active or past ingestion jobs found.
          </div>
        ) : (
          <div className="grid gap-3">
            {jobs.map(job => (
              <Card key={job.id} className="border-border shadow-sm hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      job.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                      job.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {job.status === 'completed' ? <CheckCircle className="w-5 h-5" /> :
                       job.status === 'failed' ? <AlertCircle className="w-5 h-5" /> :
                       <FileJson className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{job.file_name || 'Document Ingestion'}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="uppercase tracking-wider font-semibold">{job.status}</span>
                        <span>•</span>
                        <span>{new Date(job.created_at).toLocaleString()}</span>
                        {job.total_questions_found > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-primary font-bold">{job.total_questions_found} Qs Extracted</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {job.status === 'review_ready' && (
                    <Button variant="default" size="sm" className="font-bold bg-yellow-500 hover:bg-yellow-600 text-black" onClick={() => {
                      setSelectedJob(job);
                      setShowPreview(true);
                    }}>
                      Preview & Import
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      {showPreview && selectedJob && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col border-border shadow-premium">
            <CardHeader className="border-b border-border bg-muted/20 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle>Import Preview: {selectedJob.file_name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                  Close
                </Button>
              </div>
              <CardDescription>Review extracted questions before saving to the Question Bank.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-4">
                {(selectedJob.extracted_data || []).map((q: any, i: number) => (
                  <div key={i} className="border rounded-lg p-4 bg-card border-border">
                    <p className="font-medium text-sm mb-3">{q.question}</p>
                  </div>
                ))}
              </div>
            </CardContent>
            <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPreview(false)}>Cancel</Button>
              <Button onClick={handleImport} className="font-bold">
                Import Extracted Questions
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
