import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  UploadCloud, CheckCircle, AlertCircle, Loader2, Database, FileText, 
  Sparkles, BookOpen, Layers, BarChart2, Eye, Check, X, AlertTriangle, Image as ImageIcon,
  CheckSquare, Square, RefreshCw, Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { extractAllQuestionsFromPdfText } from '@/services/aiService';
import { extractDocumentWithOcrOrText } from '@/lib/pdfExtractor';
import { saveCustomQuestions } from '@/lib/offlineStore';
import { normalizeSubjectName } from '@/utils/subjectUtils';
import { authFetch } from '@/lib/apiAuth';
import { MathText } from '@/components/MathText';

export interface StagedQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  subject_id: string;
  topic_id?: string;
  image_url?: string;
  has_diagram?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  needs_review?: boolean;
  review_reason?: string;
  is_duplicate?: boolean;
  selected: boolean;
}

export const ContentStudioTab = () => {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Cumulative Metrics
  const [totalQuestionsCount, setTotalQuestionsCount] = useState<number>(0);
  const [subjectCounts, setSubjectCounts] = useState<{ [subjectId: string]: { name: string; count: number } }>({});

  // Direct Text Ingestion Option
  const [rawText, setRawText] = useState('');
  const [processingText, setProcessingText] = useState(false);

  // Staged Question Review Stage State
  const [stagedQuestions, setStagedQuestions] = useState<StagedQuestion[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [ocrProviderUsed, setOcrProviderUsed] = useState<string>('');
  const [sourceDocumentName, setSourceDocumentName] = useState<string>('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      fetchTopicsForSubject(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const fetchTopicsForSubject = async (subId: string) => {
    try {
      const { data } = await supabase.from('topics').select('id, name').eq('subject_id', subId).order('name');
      setTopics(data || []);
    } catch {
      setTopics([]);
    }
  };

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

      const { data: allQuestions } = await supabase
        .from('questions')
        .select('id, subject_id, subjects(id, name)')
        .limit(50000);

      const counts: { [id: string]: { name: string; count: number } } = {};
      loadedSubjects.forEach((s: any) => {
        counts[s.id] = { name: s.name, count: 0 };
      });

      if (allQuestions) {
        allQuestions.forEach((q: any) => {
          const rawSub = q.subjects?.name || q.subject_id;
          const canonical = normalizeSubjectName(rawSub || '');
          const targetSub = loadedSubjects.find(s => 
            s.id === q.subject_id || normalizeSubjectName(s.name) === canonical
          );
          if (targetSub && counts[targetSub.id]) {
            counts[targetSub.id].count += 1;
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

  // Process Document Upload (PDF, Scanned PDF, Image, CSV, TXT)
  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setSourceDocumentName(selectedFile.name);

    try {
      const targetSubId = selectedSubjectId || subjects[0]?.id || '';
      const subObj = subjects.find(s => s.id === targetSubId);
      const subjectName = subObj?.name || 'General';

      // 1. CSV File Handling
      if (selectedFile.name.endsWith('.csv')) {
        const textContent = await selectedFile.text();
        const csvQuestions = parseCSVQuestions(textContent);
        if (csvQuestions.length > 0) {
          stageExtractedQuestions(csvQuestions, targetSubId, 'CSV Ingestion Engine');
          setUploading(false);
          return;
        }
      }

      // 2. Advanced Document Extraction (Handles Text PDFs, Scanned Image PDFs, and Image Files)
      toast.info(`Analyzing document structure for ${selectedFile.name}...`);
      const extractionResult = await extractDocumentWithOcrOrText(selectedFile);

      let rawExtractedList: any[] = [];
      let providerName = 'Text Stream Extraction';

      if (extractionResult.isScanned || extractionResult.isImage) {
        toast.info('Scanned document or image detected. Executing AI Vision OCR extraction...');
        
        const ocrRes = await authFetch('/api/admin/ocr-extract', {
          method: 'POST',
          body: JSON.stringify({
            images: extractionResult.pageImages,
            text: extractionResult.extractedText,
            fileName: selectedFile.name,
            subjectHint: subjectName
          })
        });

        const ocrData = await ocrRes.json();
        if (ocrData.success && Array.isArray(ocrData.questions) && ocrData.questions.length > 0) {
          rawExtractedList = ocrData.questions;
          providerName = ocrData.provider || 'Server Gemini/Groq Vision OCR';
        } else {
          toast.warning('OCR vision scan completed with no clear question blocks. Falling back to AI text parser...');
        }
      }

      // 3. Fallback AI Text Parser if OCR vision returned empty or file is a Text PDF
      if (rawExtractedList.length === 0 && extractionResult.extractedText) {
        toast.info('Extracting structured questions from document text...');
        rawExtractedList = await extractAllQuestionsFromPdfText(extractionResult.extractedText, selectedFile.name);
        providerName = 'Groq LLM Text Engine';
      }

      if (rawExtractedList.length > 0) {
        await stageExtractedQuestions(rawExtractedList, targetSubId, providerName);
      } else {
        toast.error('Could not extract any questions from this file format. Please check document quality or paste raw text.');
      }

    } catch (err: any) {
      toast.error(`File processing failed: ${err.message}`);
    }
    setUploading(false);
  };

  const handleProcessRawText = async () => {
    if (!rawText.trim()) return;
    setProcessingText(true);
    setSourceDocumentName('Direct Passage Text');
    try {
      const targetSubId = selectedSubjectId || subjects[0]?.id || '';
      const extractedQuestions = await extractAllQuestionsFromPdfText(rawText, 'Direct Passage / Raw Text');
      if (extractedQuestions.length > 0) {
        await stageExtractedQuestions(extractedQuestions, targetSubId, 'Direct Text Parser');
        setRawText('');
      } else {
        toast.error('Could not parse questions from the provided text.');
      }
    } catch (err: any) {
      toast.error('Failed to process text: ' + err.message);
    }
    setProcessingText(false);
  };

  // Convert raw extracted items into Staged Questions with Duplicate Detection
  const stageExtractedQuestions = async (rawItems: any[], targetSubId: string, providerName: string) => {
    setOcrProviderUsed(providerName);

    // Fetch existing questions for duplicate checking
    let existingTextSet = new Set<string>();
    try {
      const { data: existingQs } = await supabase
        .from('questions')
        .select('question_text')
        .eq('subject_id', targetSubId);

      if (existingQs) {
        existingQs.forEach(q => {
          existingTextSet.add(q.question_text.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
        });
      }
    } catch (err) {
      console.warn('Duplicate check notice:', err);
    }

    const staged: StagedQuestion[] = rawItems.map((q: any, idx: number) => {
      const qText = q.question_text || q.question || `Extracted Question #${idx + 1}`;
      let opts = q.options;
      if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch { opts = [q.option_a, q.option_b, q.option_c, q.option_d]; }
      }
      if (!Array.isArray(opts) || opts.length < 2) {
        opts = ['Option A', 'Option B', 'Option C', 'Option D'];
      }

      const normalized = qText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const isDup = existingTextSet.has(normalized);

      let corrAns = (q.correct_answer || 'A').toUpperCase().trim();
      if (!['A', 'B', 'C', 'D'].includes(corrAns)) {
        corrAns = 'A';
      }

      return {
        id: `staged_${Date.now()}_${idx}`,
        question_text: qText,
        options: opts,
        correct_answer: corrAns,
        explanation: q.explanation || '',
        subject_id: targetSubId,
        topic_id: '',
        image_url: q.image_url || '',
        has_diagram: !!q.has_diagram,
        confidence: q.confidence || (isDup ? 'low' : 'high'),
        needs_review: q.needs_review || isDup || opts.some((o: string) => !o || o.trim().length === 0),
        review_reason: isDup ? 'Possible duplicate already present in database' : q.review_reason || '',
        is_duplicate: isDup,
        selected: !isDup
      };
    });

    setStagedQuestions(staged);
    setReviewMode(true);
    toast.success(`Extracted ${staged.length} questions! Review and edit before publishing.`);
  };

  // Update a single staged question field
  const handleUpdateStaged = (id: string, field: keyof StagedQuestion, value: any) => {
    setStagedQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  // Update an option string
  const handleUpdateOption = (qId: string, optIdx: number, val: string) => {
    setStagedQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const newOpts = [...q.options];
      newOpts[optIdx] = val;
      return { ...q, options: newOpts };
    }));
  };

  // Remove a question from review queue
  const handleRemoveStaged = (id: string) => {
    setStagedQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleToggleSelectAll = (select: boolean) => {
    setStagedQuestions(prev => prev.map(q => ({ ...q, selected: select })));
  };

  // Publish Selected Approved Questions to Supabase
  const handlePublishQuestions = async () => {
    const selectedToPublish = stagedQuestions.filter(q => q.selected);
    if (selectedToPublish.length === 0) {
      toast.error('Please select at least one question to publish.');
      return;
    }

    setPublishing(true);
    try {
      const dbPayload = selectedToPublish.map(q => ({
        subject_id: q.subject_id || selectedSubjectId || subjects[0]?.id,
        topic_id: q.topic_id || null,
        question_text: q.question_text.trim(),
        options: JSON.stringify(q.options),
        correct_answer: q.correct_answer,
        explanation: q.explanation || '',
        image_url: q.image_url?.trim() || null,
        difficulty: 'medium',
        is_active: true,
        quality_score: 95
      }));

      const res = await authFetch('/api/questions/insert', {
        method: 'POST',
        body: JSON.stringify({ questions: dbPayload })
      });

      const data = await res.json();
      if (!data.success && data.error) {
        // Fallback to direct supabase insert
        const { error: directErr } = await supabase.from('questions').insert(dbPayload);
        if (directErr) {
          throw new Error(directErr.message);
        }
      }

      saveCustomQuestions(dbPayload);

      // Log Ingestion Job
      try {
        await supabase.from('content_ingestion_jobs').insert({
          admin_id: profile?.id,
          file_name: sourceDocumentName || 'Ingestion_Batch.pdf',
          file_type: 'document',
          status: 'completed',
          total_questions_found: selectedToPublish.length,
          extracted_data: selectedToPublish,
          created_at: new Date().toISOString()
        });
      } catch {}

      const subName = subjects.find(s => s.id === selectedSubjectId)?.name || 'Subject';
      toast.success(`Published ${selectedToPublish.length} questions into Question Bank for ${subName}!`);

      setStagedQuestions([]);
      setReviewMode(false);
      setSelectedFile(null);
      fetchInitialData();

    } catch (err: any) {
      toast.error(`Publish failed: ${err.message}`);
    }
    setPublishing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Content Studio & AI Ingestion</h2>
        <p className="text-muted-foreground text-sm mt-1">Extract real UTME/JAMB questions from PDFs, scanned images, or documents and review before publishing.</p>
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

      {/* STAGE 1: Document Upload & Ingestion Controls */}
      {!reviewMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-primary" /> Document & Image Ingestion
              </CardTitle>
              <CardDescription>Upload Text PDFs, Scanned PDFs, Photos of questions, or CSV files.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Target Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-sm font-semibold text-foreground"
                >
                  {subjects.map((sub: any) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div className="border-2 border-dashed border-border hover:border-primary/50 transition-all rounded-xl p-6 text-center bg-muted/20">
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="document-upload-input"
                />
                <label htmlFor="document-upload-input" className="cursor-pointer flex flex-col items-center justify-center">
                  <FileText className="w-10 h-10 text-primary mb-2" />
                  <span className="text-sm font-semibold text-foreground">
                    {selectedFile ? selectedFile.name : 'Click or Drag document/image file here'}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Supports PDFs, Scanned Images, PNG, JPG, CSV (Max 20MB)</span>
                </label>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full bg-primary text-primary-foreground font-bold py-5 rounded-xl flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing & Extracting Content...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Extract Questions & Start Review</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> Direct Passage & Text Ingestion
              </CardTitle>
              <CardDescription>Paste raw question text, comprehension passages, or formula drills directly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste UTME questions here..."
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="bg-background border-border text-sm font-mono"
              />

              <Button
                onClick={handleProcessRawText}
                disabled={!rawText.trim() || processingText}
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-5 rounded-xl flex items-center justify-center gap-2"
              >
                {processingText ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Parsing Text Structure...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Extract Text Questions</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STAGE 2: Interactive Admin Review & Correction Grid */}
      {reviewMode && (
        <Card className="border-primary/30 bg-card shadow-md">
          <CardHeader className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <CheckCircle className="w-5 h-5 text-emerald-500" /> Admin Review & Correction Stage
                </CardTitle>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  {ocrProviderUsed}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Inspect, edit, and approve extracted questions before publishing into Supabase. (Document: {sourceDocumentName})
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleSelectAll(true)}
                className="text-xs h-8"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1" /> Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleSelectAll(false)}
                className="text-xs h-8"
              >
                <Square className="w-3.5 h-3.5 mr-1" /> Deselect All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewMode(false)}
                className="text-xs h-8"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Cancel Review
              </Button>

              <Button
                onClick={handlePublishQuestions}
                disabled={publishing || stagedQuestions.filter(q => q.selected).length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-4 text-xs rounded-lg shadow-sm flex items-center gap-1.5"
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span>Publish {stagedQuestions.filter(q => q.selected).length} Questions to Supabase</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
            {stagedQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No staged questions to review.</p>
            ) : (
              stagedQuestions.map((q, idx) => (
                <div 
                  key={q.id} 
                  className={`p-4 rounded-xl border-2 transition-all ${
                    q.selected ? 'border-primary/50 bg-background' : 'border-border bg-muted/10 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.selected}
                        onChange={(e) => handleUpdateStaged(q.id, 'selected', e.target.checked)}
                        className="w-4 h-4 text-primary rounded border-border"
                      />
                      <span className="font-bold text-sm text-foreground">Question #{idx + 1}</span>
                      
                      {q.is_duplicate && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Possible Duplicate
                        </span>
                      )}

                      {q.needs_review && !q.is_duplicate && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Needs Review ({q.review_reason || 'Check options'})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={q.correct_answer}
                        onChange={(e) => handleUpdateStaged(q.id, 'correct_answer', e.target.value)}
                        className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded px-2 py-1 text-xs font-bold"
                      >
                        <option value="A">Correct Answer: A</option>
                        <option value="B">Correct Answer: B</option>
                        <option value="C">Correct Answer: C</option>
                        <option value="D">Correct Answer: D</option>
                      </select>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStaged(q.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column: Edit Fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Question Text</label>
                        <Textarea
                          rows={3}
                          value={q.question_text}
                          onChange={(e) => handleUpdateStaged(q.id, 'question_text', e.target.value)}
                          className="text-xs bg-background border-border"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx}>
                            <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Option {String.fromCharCode(65 + oIdx)}</label>
                            <Input
                              value={opt}
                              onChange={(e) => handleUpdateOption(q.id, oIdx, e.target.value)}
                              className="text-xs bg-background border-border h-8"
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Diagram Image URL (Optional)
                        </label>
                        <Input
                          placeholder="https://... or upload in Image Question Manager"
                          value={q.image_url || ''}
                          onChange={(e) => handleUpdateStaged(q.id, 'image_url', e.target.value)}
                          className="text-xs bg-background border-border h-8"
                        />
                      </div>
                    </div>

                    {/* Right Column: Live Math & Scientific Rendering Preview */}
                    <div className="bg-muted/20 p-3 rounded-lg border border-border/60 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">Live Student Preview</span>
                      
                      <div className="text-sm font-medium text-foreground bg-background p-2.5 rounded border border-border">
                        <MathText text={q.question_text} />
                        {q.image_url && (
                          <img src={q.image_url} alt="Question Diagram" className="mt-2 max-h-32 object-contain rounded border border-border" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {q.options.map((opt, oIdx) => {
                          const letter = String.fromCharCode(65 + oIdx);
                          const isCorr = q.correct_answer === letter;
                          return (
                            <div 
                              key={oIdx}
                              className={`p-1.5 rounded text-xs border ${
                                isCorr ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold' : 'bg-background border-border text-foreground'
                              }`}
                            >
                              <span className="font-bold mr-1">{letter}.</span>
                              <MathText text={opt.replace(/^[A-D]\)\s*/i, '')} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
