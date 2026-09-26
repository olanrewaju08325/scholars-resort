import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Image as ImageIcon, Upload, FileText, CheckCircle2, AlertTriangle, 
  Trash2, RefreshCw, Eye, Sparkles, BookOpen, Layers, Search, 
  Maximize2, X, Scissors, HelpCircle, Check, ArrowRight, Lightbulb, 
  Compass, ShieldCheck, Download
} from 'lucide-react';
import { 
  extractQuestionsAndDiagramsFromPdf, 
  renderPdfPagesForVisualSnapping,
  cropRegionFromPageDataUrl,
  type ExtractedVisualQuestion,
  type RenderedPdfPage
} from '@/lib/pdfVisualQuestionExtractor';
import { OFFICIAL_JAMB_SUBJECTS, normalizeSubjectName } from '@/utils/subjectUtils';
import { supabase } from '@/lib/supabase';
import { fetchAllRowsPaginated } from '@/lib/supabasePagination';
import { MathText } from '@/components/MathText';
import { toast } from 'sonner';

const VISUAL_KEYWORDS = [
  'diagram', 'figure', 'fig.', 'fig ', 'circuit', 'apparatus', 
  'shown above', 'shown below', 'structure above', 'structure below', 
  'graph above', 'graph below', 'illustrated above', 'illustrated below',
  'chart above', 'chart below', 'in the table above', 'in the table below',
  'refer to diagram', 'as shown in the'
];

export const VisualQuestionDiagramStudio: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('Physics');
  const [activeTab, setActiveTab] = useState<'extractor' | 'gallery' | 'audit' | 'training'>('extractor');
  const [loading, setLoading] = useState<boolean>(false);

  // Subject Question Data & Stats
  const [subjectQuestions, setSubjectQuestions] = useState<any[]>([]);
  const [missingDiagramQuestions, setMissingDiagramQuestions] = useState<any[]>([]);
  const [diagramQuestions, setDiagramQuestions] = useState<any[]>([]);

  // Extractor State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [examYear, setExamYear] = useState<number>(2024);
  const [extractVisualOnly, setExtractVisualOnly] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedVisualQuestion[]>([]);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);

  // Interactive PDF Page Snapper & Visual Cropper
  const [renderedPages, setRenderedPages] = useState<RenderedPdfPage[]>([]);
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [isSnapping, setIsSnapping] = useState<boolean>(false);
  const [cropBox, setCropBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [isDrawingCrop, setIsDrawingCrop] = useState<boolean>(false);
  const [snappedDiagramUrl, setSnappedDiagramUrl] = useState<string | null>(null);
  const [targetQuestionIndex, setTargetQuestionIndex] = useState<number>(0);

  // Lightbox & Preview
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const imageCanvasRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Subject Data & Audit
  const fetchSubjectData = async () => {
    setLoading(true);
    try {
      const canonical = normalizeSubjectName(selectedSubject);
      const { data: dbSubs } = await supabase.from('subjects').select('id, name');
      const matched = dbSubs?.find(s => normalizeSubjectName(s.name).toLowerCase() === canonical.toLowerCase());
      const subId = matched?.id || dbSubs?.[0]?.id || '';

      const questions = await fetchAllRowsPaginated<any>(() =>
        supabase.from('questions')
          .select('id, subject_id, question_text, options, correct_answer, explanation, year, quality_flags')
          .eq('subject_id', subId)
      );

      setSubjectQuestions(questions);

      // Separate into: Has diagram vs Missing diagram
      const hasDiagram: any[] = [];
      const missingDiagram: any[] = [];

      questions.forEach(q => {
        const text = ((q.question_text || '') + ' ' + (q.explanation || '')).toLowerCase();
        const hasVisualRef = VISUAL_KEYWORDS.some(kw => text.includes(kw));
        const hasImage = text.includes('data:image') || text.includes('http') || text.includes('![') || text.includes('<img');
        const flags = Array.isArray(q.quality_flags) ? q.quality_flags : [];
        const hasFlag = flags.includes('needs_diagram') || flags.includes('missing_figure');

        if (hasImage) {
          hasDiagram.push(q);
        } else if (hasVisualRef || hasFlag) {
          missingDiagram.push(q);
        }
      });

      setDiagramQuestions(hasDiagram);
      setMissingDiagramQuestions(missingDiagram);
    } catch (err: any) {
      console.error('Error fetching subject questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjectData();
  }, [selectedSubject]);

  // Handle PDF file selection & auto-detection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Please upload a PDF document.');
        return;
      }
      setSelectedFile(file);

      // Detect year & subject from filename
      const yearMatch = file.name.match(/(19[8-9]\d|20[0-2]\d)/);
      if (yearMatch && yearMatch[1]) {
        setExamYear(parseInt(yearMatch[1], 10));
      }

      const lowerName = file.name.toLowerCase();
      const detectedSub = OFFICIAL_JAMB_SUBJECTS.find(s => 
        lowerName.includes(s.name.toLowerCase()) || lowerName.includes(s.id.toLowerCase())
      );
      if (detectedSub) {
        setSelectedSubject(detectedSub.name);
      }

      toast.info(`Loaded PDF: ${file.name}. Ready to extract diagrams!`);
    }
  };

  // Run Automated Extraction
  const handleStartExtraction = async () => {
    if (!selectedFile) {
      toast.error('Please select a past question PDF first.');
      return;
    }

    setIsProcessing(true);
    setProgressStatus('Reading PDF pages and isolating diagrams...');
    setProgressPercent(10);

    try {
      const result = await extractQuestionsAndDiagramsFromPdf(
        selectedFile,
        selectedSubject,
        (status, percent) => {
          setProgressStatus(status);
          setProgressPercent(percent);
        }
      );

      let processedQuestions = result.questions.map(q => ({
        ...q,
        year: examYear
      }));

      if (extractVisualOnly) {
        const visualOnly = processedQuestions.filter(q => q.hasVisualReference || Boolean(q.diagramImageUrl));
        if (visualOnly.length > 0) {
          processedQuestions = visualOnly;
          toast.success(`Isolated ${visualOnly.length} questions requiring diagrams!`);
        } else {
          toast.info('No explicit diagram references detected. Showing all questions.');
        }
      } else {
        toast.success(`Extracted ${result.totalQuestions} questions! (${result.questionsWithDiagrams} with diagrams isolated)`);
      }

      setExtractedQuestions(processedQuestions);

      // Also render page snapshots for interactive visual cropper
      setProgressStatus('Generating high-resolution page viewer for interactive cropping...');
      const pages = await renderPdfPagesForVisualSnapping(selectedFile, 1.8, (curr, total) => {
        setProgressPercent(80 + Math.round((curr / total) * 18));
      });
      setRenderedPages(pages);
      if (pages.length > 0) setSelectedPageNum(1);

    } catch (err: any) {
      console.error('PDF extraction failed:', err);
      toast.error(`Extraction failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressPercent(100);
    }
  };

  // Interactive Drag & Crop on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSnapping || !imageCanvasRef.current) return;
    const rect = imageCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawingCrop(true);
    setCropBox({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingCrop || !cropBox || !imageCanvasRef.current) return;
    const rect = imageCanvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    setCropBox(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
  };

  const handleMouseUp = async () => {
    if (!isDrawingCrop || !cropBox || !imageCanvasRef.current) return;
    setIsDrawingCrop(false);

    const rect = imageCanvasRef.current.getBoundingClientRect();
    const pageObj = renderedPages.find(p => p.pageNumber === selectedPageNum);
    if (!pageObj) return;

    // Calculate scale ratio between displayed element and original high-res canvas
    const scaleX = pageObj.width / rect.width;
    const scaleY = pageObj.height / rect.height;

    const x = Math.min(cropBox.startX, cropBox.currentX) * scaleX;
    const y = Math.min(cropBox.startY, cropBox.currentY) * scaleY;
    const width = Math.abs(cropBox.currentX - cropBox.startX) * scaleX;
    const height = Math.abs(cropBox.currentY - cropBox.startY) * scaleY;

    if (width < 20 || height < 20) {
      setCropBox(null);
      return;
    }

    try {
      const croppedUrl = await cropRegionFromPageDataUrl(pageObj.dataUrl, { x, y, width, height });
      setSnappedDiagramUrl(croppedUrl);
      toast.success('Diagram cropped successfully! Ready to link to a question.');
    } catch (cropErr: any) {
      toast.error('Could not crop region: ' + cropErr.message);
    }
  };

  // Attach snapped diagram to a question in the extracted batch
  const handleApplyCroppedDiagramToQuestion = (index: number) => {
    if (!snappedDiagramUrl) {
      toast.error('Crop a diagram from the PDF page first.');
      return;
    }

    setExtractedQuestions(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        diagramImageUrl: snappedDiagramUrl,
        hasVisualReference: true,
        status: 'ready'
      };
      return copy;
    });

    toast.success(`Attached cropped diagram to Question #${index + 1}!`);
    setSnappedDiagramUrl(null);
    setCropBox(null);
    setIsSnapping(false);
  };

  // Save all extracted visual questions to database
  const handleIngestAllQuestions = async () => {
    if (extractedQuestions.length === 0) return;

    setIsIngesting(true);
    toast.info(`Ingesting ${extractedQuestions.length} visual questions for ${selectedSubject}...`);

    try {
      const canonical = normalizeSubjectName(selectedSubject);
      let subjectId = '';
      const { data: dbSubs } = await supabase.from('subjects').select('id, name');
      if (dbSubs) {
        const matched = dbSubs.find(s => normalizeSubjectName(s.name).toLowerCase() === canonical.toLowerCase());
        subjectId = matched?.id || dbSubs[0]?.id || '';
      }

      const payloads = extractedQuestions.map(q => {
        let qText = q.questionText.trim();
        if (q.diagramImageUrl && !qText.includes('![Diagram]')) {
          qText = `![Diagram](${q.diagramImageUrl})\n\n${qText}`;
        }

        const qualityFlags = q.hasVisualReference && !q.diagramImageUrl
          ? ['needs_diagram', 'missing_figure']
          : [];

        return {
          subject_id: subjectId,
          question_text: qText,
          options: q.options,
          correct_answer: q.correctAnswer,
          explanation: q.explanation,
          year: q.year || examYear,
          difficulty: 'medium',
          is_active: true,
          is_draft: false,
          quality_flags: qualityFlags
        };
      });

      const CHUNK_SIZE = 50;
      let insertedCount = 0;
      for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
        const chunk = payloads.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('questions').insert(chunk);
        if (error) throw error;
        insertedCount += chunk.length;
      }

      toast.success(`Successfully published ${insertedCount} authentic questions & diagrams to ${selectedSubject}!`);
      setExtractedQuestions([]);
      setSelectedFile(null);
      fetchSubjectData();
    } catch (err: any) {
      console.error('Ingest error:', err);
      toast.error(`Ingestion failed: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  // Attach Diagram to a Question in the Missing Diagrams Hub
  const handleAttachImageToQuestion = async (questionId: string, file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        const target = missingDiagramQuestions.find(q => q.id === questionId);
        const flags = (target?.quality_flags || []).filter((f: string) => f !== 'needs_diagram' && f !== 'missing_figure');

        let updatedText = target?.question_text || '';
        if (!updatedText.includes('![Diagram]')) {
          updatedText = `![Diagram](${dataUrl})\n\n${updatedText}`;
        }

        const { error } = await supabase
          .from('questions')
          .update({
            question_text: updatedText,
            quality_flags: flags
          })
          .eq('id', questionId);

        if (error) throw error;

        toast.success('Diagram attached! Question moved to visual ready pool.');
        fetchSubjectData();
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error('Failed to attach diagram: ' + err.message);
    }
  };

  // Delete Single Question
  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('Delete this question from database?')) return;
    try {
      const { error } = await supabase.from('questions').delete().eq('id', questionId);
      if (error) throw error;
      toast.success('Question deleted.');
      fetchSubjectData();
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message);
    }
  };

  // Bulk Purge Missing Diagram Questions for Subject
  const handlePurgeMissingDiagramQuestions = async () => {
    if (missingDiagramQuestions.length === 0) return;
    if (!window.confirm(`Permanently delete all ${missingDiagramQuestions.length} missing diagram questions in ${selectedSubject}?`)) {
      return;
    }

    setIsPurging(true);
    toast.info(`Purging ${missingDiagramQuestions.length} questions...`);

    try {
      const ids = missingDiagramQuestions.map(q => q.id);
      const CHUNK_SIZE = 100;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('questions').delete().in('id', chunk);
        if (error) throw error;
      }

      toast.success(`Deleted ${ids.length} broken visual questions from ${selectedSubject}!`);
      fetchSubjectData();
    } catch (err: any) {
      toast.error('Purge error: ' + err.message);
    } finally {
      setIsPurging(false);
    }
  };

  const activePageObj = renderedPages.find(p => p.pageNumber === selectedPageNum);

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP COMMAND BAR: SUBJECT SELECTOR & REAL-TIME STATS
      ───────────────────────────────────────────────────────────── */}
      <Card className="border-primary/40 bg-gradient-to-br from-slate-900 via-slate-900 to-primary/10 text-white shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shadow-inner">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold font-display text-white">
                  Visual Diagram & Question Studio
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-0.5">
                  Universal engine for extracting, cropping, and managing visual diagram questions across all subjects.
                </CardDescription>
              </div>
            </div>

            {/* Subject Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider hidden sm:inline">
                Target Subject:
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {OFFICIAL_JAMB_SUBJECTS.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Real-time Visual Quality Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Questions</span>
              <span className="text-xl font-extrabold text-white">{subjectQuestions.length}</span>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-xl">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Diagrams Attached
              </span>
              <span className="text-xl font-extrabold text-emerald-300">{diagramQuestions.length}</span>
            </div>

            <div className="bg-amber-950/40 border border-amber-800/50 p-3 rounded-xl">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Needs Diagram Figure
              </span>
              <span className="text-xl font-extrabold text-amber-300">{missingDiagramQuestions.length}</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Visual Readiness</span>
              <span className="text-xl font-extrabold text-blue-400">
                {missingDiagramQuestions.length === 0 && subjectQuestions.length > 0 ? '100% Ready' : 
                 subjectQuestions.length > 0 ? `${Math.round(((subjectQuestions.length - missingDiagramQuestions.length) / subjectQuestions.length) * 100)}%` : '0%'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVIGATION TABS (UNIFIED INTERFACE)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('extractor')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'extractor'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Scissors className="w-4 h-4" /> PDF Diagram Extractor & Visual Cropper
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'gallery'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Eye className="w-4 h-4" /> Visual Gallery ({diagramQuestions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Missing Diagrams Hub ({missingDiagramQuestions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('training')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'training'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Compass className="w-4 h-4" /> Interactive Training & Guide
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSubjectData}
          disabled={loading}
          className="text-xs font-bold gap-1.5 h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh {selectedSubject}</span>
        </Button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: PDF DIAGRAM EXTRACTOR & INTERACTIVE VISUAL CROPPER
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'extractor' && (
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" />
                Upload {selectedSubject} Past Questions PDF
              </CardTitle>
              <CardDescription>
                Upload any official past question PDF document. The engine parses questions, locates diagram references, and renders pages for high-res cropping.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Exam Year
                  </label>
                  <Input
                    type="number"
                    value={examYear}
                    onChange={(e) => setExamYear(Number(e.target.value))}
                    min={1980}
                    max={2030}
                    className="h-10 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Extraction Mode
                  </label>
                  <select
                    value={extractVisualOnly ? 'visual' : 'all'}
                    onChange={(e) => setExtractVisualOnly(e.target.value === 'visual')}
                    className="w-full h-10 bg-background border border-border rounded-lg px-3 text-xs font-bold text-foreground"
                  >
                    <option value="visual">Visual & Diagram Questions Only</option>
                    <option value="all">All Questions (Visual + Text)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Select PDF Document
                  </label>
                  <label className="flex items-center justify-center gap-2 h-10 px-3 bg-muted/40 hover:bg-muted/70 border border-dashed border-border rounded-lg cursor-pointer text-xs font-bold text-foreground truncate">
                    <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="truncate">{selectedFile ? selectedFile.name : 'Choose PDF File...'}</span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <Button
                  onClick={handleStartExtraction}
                  disabled={!selectedFile || isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-2 h-11 px-6 shadow-md"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{progressStatus || 'Processing PDF...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Extract Questions & Render Diagram Canvas</span>
                    </>
                  )}
                </Button>

                {extractedQuestions.length > 0 && (
                  <Button
                    onClick={handleIngestAllQuestions}
                    disabled={isIngesting}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold gap-2 h-11 px-6 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Publish {extractedQuestions.length} Questions to Live Bank</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Interactive PDF Page Viewer & Visual Snapper */}
          {renderedPages.length > 0 && (
            <Card className="border-emerald-500/40 bg-card shadow-md">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Scissors className="w-4 h-4" /> Interactive PDF Page Snapper & Cropper
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Draw a box on the PDF page below to crop and isolate any circuit, apparatus, or graph figure.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isSnapping ? 'default' : 'outline'}
                      onClick={() => setIsSnapping(!isSnapping)}
                      className={`text-xs font-bold gap-1.5 ${isSnapping ? 'bg-emerald-600 text-white' : ''}`}
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>{isSnapping ? 'Snapping Mode Active (Drag on Image)' : 'Enable Snapping Mode'}</span>
                    </Button>

                    {/* Page selector */}
                    <select
                      value={selectedPageNum}
                      onChange={(e) => setSelectedPageNum(Number(e.target.value))}
                      className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    >
                      {renderedPages.map(p => (
                        <option key={p.pageNumber} value={p.pageNumber}>
                          Page {p.pageNumber} of {renderedPages.length}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Snapped preview bar if user just cropped */}
                {snappedDiagramUrl && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={snappedDiagramUrl}
                        alt="Cropped visual figure"
                        className="h-16 w-auto max-w-[150px] object-contain bg-white rounded border border-border p-1"
                      />
                      <div>
                        <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 block">
                          Diagram Cropped & Isolated!
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Choose which extracted question below to link this diagram to.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={targetQuestionIndex}
                        onChange={(e) => setTargetQuestionIndex(Number(e.target.value))}
                        className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-bold"
                      >
                        {extractedQuestions.map((q, idx) => (
                          <option key={idx} value={idx}>
                            Question #{idx + 1}: {q.questionText.slice(0, 30)}...
                          </option>
                        ))}
                      </select>

                      <Button
                        size="sm"
                        onClick={() => handleApplyCroppedDiagramToQuestion(targetQuestionIndex)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Attach to Question
                      </Button>
                    </div>
                  </div>
                )}

                {/* Page Interactive Display */}
                {activePageObj && (
                  <div
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className={`relative overflow-auto max-h-[600px] border border-border rounded-xl bg-slate-900 flex justify-center p-2 select-none ${
                      isSnapping ? 'cursor-crosshair' : 'cursor-default'
                    }`}
                  >
                    <img
                      ref={imageCanvasRef}
                      src={activePageObj.dataUrl}
                      alt={`PDF Page ${selectedPageNum}`}
                      className="max-w-full h-auto object-contain rounded shadow-lg pointer-events-none"
                    />

                    {/* Crop Selection Bounding Box */}
                    {cropBox && isDrawingCrop && (
                      <div
                        className="absolute border-2 border-dashed border-emerald-400 bg-emerald-400/20 pointer-events-none z-20"
                        style={{
                          left: `${Math.min(cropBox.startX, cropBox.currentX)}px`,
                          top: `${Math.min(cropBox.startY, cropBox.currentY)}px`,
                          width: `${Math.abs(cropBox.currentX - cropBox.startX)}px`,
                          height: `${Math.abs(cropBox.currentY - cropBox.startY)}px`,
                        }}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Extracted Questions Review Grid */}
          {extractedQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Extracted Questions Review Board ({extractedQuestions.length})
                </h3>
                <span className="text-xs text-muted-foreground">
                  Verify questions and diagrams before 1-click publishing.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {extractedQuestions.map((q, idx) => (
                  <Card key={idx} className="border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        Question #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        JAMB {q.year || examYear}
                      </span>
                    </div>

                    {/* Question text with live academic preview */}
                    <div className="p-3 bg-muted/20 border border-border/60 rounded-lg text-xs sm:text-sm">
                      <MathText text={q.questionText} subject={selectedSubject} />
                    </div>

                    {/* Diagram Preview */}
                    {q.diagramImageUrl && (
                      <div className="p-2 bg-card border border-border rounded-lg inline-block">
                        <img
                          src={q.diagramImageUrl}
                          alt="Question diagram"
                          className="max-h-40 w-auto object-contain rounded cursor-pointer"
                          onClick={() => setZoomedImage(q.diagramImageUrl!)}
                        />
                      </div>
                    )}

                    {/* Options list */}
                    <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="p-1.5 bg-muted/30 border border-border/50 rounded">
                          <strong>{['A', 'B', 'C', 'D'][oIdx]}:</strong> <MathText text={opt} subject={selectedSubject} />
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      Correct Answer: {q.correctAnswer}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SUBJECT VISUAL GALLERY & IMAGE EXPLORER
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'gallery' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {selectedSubject} Diagram & Visual Gallery ({diagramQuestions.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                All questions in {selectedSubject} with verified visual diagrams and illustrations attached.
              </p>
            </div>

            <div className="w-full sm:w-64">
              <Input
                placeholder="Search visual questions..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {diagramQuestions.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <ImageIcon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-foreground">No diagram questions found for {selectedSubject}</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Use the PDF Diagram Extractor tab to upload a past questions PDF and auto-extract apparatus, circuits, and graph diagrams.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {diagramQuestions
                .filter(q => !searchFilter || q.question_text.toLowerCase().includes(searchFilter.toLowerCase()))
                .map((q, idx) => (
                  <Card key={q.id || idx} className="border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">#{idx + 1} • JAMB {q.year || 2024}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="text-xs sm:text-sm leading-relaxed">
                      <MathText text={q.question_text} subject={selectedSubject} />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                      {(q.options || []).map((opt: string, oIdx: number) => (
                        <div key={oIdx} className="p-1 bg-muted/20 border border-border/40 rounded">
                          <strong>{['A', 'B', 'C', 'D'][oIdx]}:</strong> <MathText text={opt} subject={selectedSubject} />
                        </div>
                      ))}
                    </div>

                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Answer: {q.correct_answer}
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: MISSING DIAGRAMS HUB & RESOLUTION
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div>
              <h3 className="text-base font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Missing Diagrams in {selectedSubject} ({missingDiagramQuestions.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                These questions reference figures ("diagram", "circuit", "apparatus", "graph") but lack images.
              </p>
            </div>

            {missingDiagramQuestions.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handlePurgeMissingDiagramQuestions}
                disabled={isPurging}
                className="font-bold text-xs gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPurging ? 'Purging...' : `Purge ${missingDiagramQuestions.length} Questions from DB`}</span>
              </Button>
            )}
          </div>

          {missingDiagramQuestions.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-emerald-500/30 bg-emerald-500/5">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-foreground">Zero Missing Diagrams in {selectedSubject}!</h4>
              <p className="text-xs text-muted-foreground mt-1">
                All visual questions for this subject have valid figures attached or have been verified.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {missingDiagramQuestions.map((q, idx) => (
                <Card key={q.id || idx} className="border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-500">#{idx + 1} • JAMB {q.year || 2024}</span>

                    <div className="flex items-center gap-1.5">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleAttachImageToQuestion(q.id, e.target.files[0]);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-7 text-xs font-bold text-primary border-primary/40 gap-1"
                        >
                          <span><Upload className="w-3 h-3" /> Attach Figure</span>
                        </Button>
                      </label>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs sm:text-sm leading-relaxed p-2.5 rounded bg-muted/20 border border-border/50">
                    <p>{q.question_text}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                    {(q.options || []).map((opt: string, oIdx: number) => (
                      <div key={oIdx} className="p-1 bg-muted/30 border border-border/40 rounded">
                        <strong>{['A', 'B', 'C', 'D'][oIdx]}:</strong> {opt}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: INTERACTIVE TRAINING & OPERATIONAL MANUAL
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'training' && (
        <div className="space-y-6">
          <Card className="border-purple-500/30 bg-gradient-to-br from-card via-card to-purple-500/5 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Administrator Visual Questions Training Guide</CardTitle>
                  <CardDescription>
                    Plain-English, step-by-step training manual for operating the PDF Diagram Extractor and Visual Studio.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">Upload Past Question PDF</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Select your target subject (e.g. Physics) and upload the past question PDF file. The system automatically reads the exam year from the title and prepares the extraction engine.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-extrabold flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">Auto-Extraction & Interactive Page Cropping</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Click <strong>Extract Questions & Render Diagram Canvas</strong>. The engine scans for questions mentioning apparatus, circuits, or graphs. You can also use the <strong>Interactive Page Snapper</strong> to draw a box around any image on the PDF page to snip and attach it directly to Question #1, #2, etc.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-extrabold flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">Review Academic KaTeX Formatted Preview</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Verify the extracted stems and options in the Live Academic Preview. Formulas for Chemistry ($H_2SO_4$), Physics ($m/s^2, \Omega$), and Math ($\frac{a}{b}, x^2$) are rendered automatically.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="w-8 h-8 rounded-full bg-purple-500 text-white font-extrabold flex items-center justify-center shrink-0">
                  4
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">1-Click Publish to Live Bank & Offline CBT Terminal</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hit <strong>Publish Questions to Live Bank</strong>. All questions and diagrams are saved to Supabase and automatically bundled for students taking online practice or downloading offline question packs.
                  </p>
                </div>
              </div>

              {/* Pro Tip Box */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4" /> Pro-Tip for Broken Questions:
                </span>
                <p className="text-xs text-muted-foreground">
                  If an old question in your database is missing a diagram and cannot be resolved, go to the <strong>Missing Diagrams Hub</strong> tab and click <strong>Purge Questions from DB</strong>. This keeps your question bank 100% clean and professional.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lightbox for Zoomed Images */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-card p-3 rounded-2xl border border-border shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 bg-muted hover:bg-muted/80 text-foreground p-2 rounded-full z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedImage}
              alt="Enlarged Diagram"
              className="max-h-[80vh] w-auto object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
