import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, Database, FileJson, PlayCircle, Sparkles, BookOpen, Layers, BarChart2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { analyzeDocumentWithGroq, extractAllQuestionsFromPdfText } from '@/services/aiService';
import { extractTextFromFile } from '@/lib/pdfExtractor';

export const ContentStudioTab = () => {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Cumulative Question Metrics
  const [totalQuestionsCount, setTotalQuestionsCount] = useState<number>(0);
  const [subjectCounts, setSubjectCounts] = useState<{ [subjectId: string]: { name: string; count: number } }>({});

  // Direct Text Ingestion Option
  const [rawText, setRawText] = useState('');
  const [processingText, setProcessingText] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: subData } = await supabase.from('subjects').select('id, name').order('name');
      const loadedSubjects = subData || [];
      setSubjects(loadedSubjects);
      if (loadedSubjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(loadedSubjects[0].id);
      }

      const { data: jobsData } = await supabase
        .from('content_ingestion_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      setJobs(jobsData || []);

      const { count: totalCount } = await supabase.from('questions').select('id', { count: 'exact', head: true });
      setTotalQuestionsCount(totalCount || 0);

      const { data: allQuestions } = await supabase.from('questions').select('subject_id');
      const counts: { [id: string]: { name: string; count: number } } = {};
      
      loadedSubjects.forEach((s: any) => {
        counts[s.id] = { name: s.name, count: 0 };
      });

      if (allQuestions) {
        allQuestions.forEach((q: any) => {
          if (q.subject_id && counts[q.subject_id]) {
            counts[q.subject_id].count += 1;
          }
        });
      }
      setSubjectCounts(counts);

    } catch (err) {
      console.warn('Error loading Content Studio metrics:', err);
    }
    setLoading(false);
  };

  const parseCSVQuestions = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;

      const qText = cols[headers.indexOf('question')] || cols[0] || 'Sample Question';
      const optA = cols[headers.indexOf('option_a')] || cols[1] || 'Option A';
      const optB = cols[headers.indexOf('option_b')] || cols[2] || 'Option B';
      const optC = cols[headers.indexOf('option_c')] || cols[3] || 'Option C';
      const optD = cols[headers.indexOf('option_d')] || cols[4] || 'Option D';
      const ans = cols[headers.indexOf('correct_answer')] || cols[5] || 'A';
      const exp = cols[headers.indexOf('explanation')] || cols[6] || '';

      results.push({
        question: qText,
        options: [optA, optB, optC, optD],
        correct_answer: ans.toUpperCase().trim(),
        explanation: exp
      });
    }
    return results;
  };

  const batchInsertQuestions = async (questionsToInsert: any[]) => {
    const batchSize = 100;
    for (let i = 0; i < questionsToInsert.length; i += batchSize) {
      const batch = questionsToInsert.slice(i, i + batchSize);
      const { error } = await supabase.from('questions').insert(batch);
      if (error) console.warn('Batch insert warning:', error);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const targetSubId = selectedSubjectId || subjects[0]?.id || null;

      if (selectedFile.name.endsWith('.csv')) {
        const textContent = await selectedFile.text();
        const csvQuestions = parseCSVQuestions(textContent);

        if (csvQuestions.length > 0) {
          const questionsToInsert = csvQuestions.map((q: any) => ({
            subject_id: targetSubId,
            question_text: q.question,
            options: JSON.stringify(q.options),
            correct_answer: q.correct_answer || 'A',
            explanation: q.explanation || '',
            difficulty: 'medium',
            is_active: true,
            quality_score: 95,
          }));

          await batchInsertQuestions(questionsToInsert);

          const subName = subjects.find(s => s.id === targetSubId)?.name || 'Subject';
          toast.success(`Successfully imported all ${csvQuestions.length} CSV questions into database for ${subName}!`);
          setSelectedFile(null);
          fetchInitialData();
          setUploading(false);
          return;
        }
      }

      // PDF or general document processing with Groq AI (Extracting ALL questions across whole document)
      const textContent = await extractTextFromFile(selectedFile);
      toast.info('Extracting all questions from PDF document using Groq AI...');
      
      const extractedQuestions = await extractAllQuestionsFromPdfText(textContent, selectedFile.name);

      if (extractedQuestions.length > 0) {
        const questionsToInsert = extractedQuestions.map((q: any) => ({
          subject_id: targetSubId,
          question_text: q.question,
          options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options),
          correct_answer: q.correct_answer || 'A',
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          is_active: true,
          quality_score: 95,
        }));

        await batchInsertQuestions(questionsToInsert);

        await supabase.from('content_ingestion_jobs').insert({
          admin_id: profile?.id,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          status: 'completed',
          total_questions_found: extractedQuestions.length,
          extracted_data: extractedQuestions,
          created_at: new Date().toISOString()
        });

        const subName = subjects.find(s => s.id === targetSubId)?.name || 'Subject';
        toast.success(`Extracted & saved ALL ${extractedQuestions.length} questions into database for ${subName}!`);
        setSelectedFile(null);
        fetchInitialData();
      } else {
        toast.error('No questions could be extracted from this file format.');
      }
    } catch (err: any) {
      toast.error(`File processing failed: ${err.message}`);
    }
    setUploading(false);
  };

  const handleProcessRawText = async () => {
    if (!rawText.trim()) return;
    setProcessingText(true);
    try {
      const targetSubId = selectedSubjectId || subjects[0]?.id || null;
      const extractedQuestions = await extractAllQuestionsFromPdfText(rawText, 'Direct Passage / Raw Text');

      if (extractedQuestions.length > 0) {
        const questionsToInsert = extractedQuestions.map((q: any) => ({
          subject_id: targetSubId,
          question_text: q.question,
          options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options),
          correct_answer: q.correct_answer || 'A',
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          is_active: true,
          quality_score: 95,
        }));

        await batchInsertQuestions(questionsToInsert);

        const subName = subjects.find(s => s.id === targetSubId)?.name || 'Subject';
        toast.success(`Extracted & inserted ${extractedQuestions.length} questions into ${subName}!`);
        setRawText('');
        fetchInitialData();
      } else {
        toast.error('Could not parse questions from the provided text.');
      }
    } catch (err: any) {
      toast.error('Failed to process text: ' + err.message);
    }
    setProcessingText(false);
  };

  const handleImport = async () => {
    if (!selectedJob) return;
    try {
      const extractedList = selectedJob.extracted_data || [];
      if (extractedList.length > 0) {
        const targetSubId = selectedSubjectId || subjects[0]?.id || null;

        const questionsToInsert = extractedList.map((q: any) => ({
          subject_id: targetSubId,
          question_text: q.question || 'Extracted Question',
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
      fetchInitialData();
    } catch (err: any) {
      toast.error('Failed to import questions: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Content Studio & AI Ingestion</h2>
        <p className="text-muted-foreground text-sm mt-1">Extract real UTME/JAMB questions from PDFs or documents and save directly to your database by subject.</p>
      </div>

      {/* Cumulative Metrics & Subject Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Website Questions</p>
              <p className="text-2xl font-black text-foreground mt-0.5">{totalQuestionsCount.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border-border bg-card">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" /> Questions Stored Per Subject
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {Object.values(subjectCounts).length === 0 ? (
              <span className="text-xs text-muted-foreground">Loading subject distribution...</span>
            ) : (
              Object.values(subjectCounts).map((item, idx) => (
                <div key={idx} className="px-3 py-1 rounded-full bg-muted border border-border text-xs flex items-center gap-2 font-medium">
                  <span className="text-foreground">{item.name}:</span>
                  <span className="text-primary font-bold">{item.count} Qs</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Target Subject Selector */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Target Subject for Ingestion</p>
              <p className="text-xs text-muted-foreground">Extracted questions will be assigned to this subject category in the question bank.</p>
            </div>
          </div>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full sm:w-64 bg-background border border-border rounded-lg p-2.5 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary"
          >
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File Upload Zone */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-primary" /> Upload Syllabus or PDF Past Questions
            </CardTitle>
            <CardDescription>Select a PDF, text, markdown, or JSON document to parse.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/40 transition-colors">
              <UploadCloud className="w-8 h-8 text-primary mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Groq AI will read your document, extract past questions, and format options automatically.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <Input 
                  type="file" 
                  accept=".pdf,.txt,.md,.json,.csv,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="cursor-pointer text-xs"
                />
                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || uploading}
                  className="w-full sm:w-auto font-bold shrink-0"
                >
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                  {uploading ? 'Extracting...' : 'Ingest PDF/File'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Direct Text Ingestion */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" /> Direct Text / Passage Ingestion
            </CardTitle>
            <CardDescription>Paste syllabus sections, textbook notes, or raw past questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              rows={4}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Paste document text or question passage here..."
              className="w-full bg-background border border-border rounded-lg p-3 text-sm font-mono text-foreground outline-none focus:ring-2 focus:ring-primary"
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

      {/* Ingestion History */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
          <Database className="w-5 h-5 text-primary" /> Extraction History
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
                      <p className="font-bold text-sm text-foreground">{job.file_name || 'Document Ingestion'}</p>
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
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col border-border shadow-2xl">
            <CardHeader className="border-b border-border bg-muted/20 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle>Import Preview: {selectedJob.file_name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto space-y-4">
              <p className="text-sm text-muted-foreground">
                Found <strong>{selectedJob.extracted_data?.length || 0}</strong> questions ready for database import.
              </p>
              <div className="space-y-3">
                {selectedJob.extracted_data?.map((q: any, i: number) => (
                  <div key={i} className="p-3 border border-border rounded-lg bg-muted/30 text-xs space-y-1">
                    <p className="font-bold text-foreground">Q{i + 1}: {q.question}</p>
                    <p className="text-muted-foreground">Correct: <span className="text-green-500 font-bold">{q.correct_answer}</span></p>
                  </div>
                ))}
              </div>
              <Button onClick={handleImport} className="w-full font-bold">
                Confirm & Import All Questions to Database
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
