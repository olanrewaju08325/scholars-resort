import React, { useState, useRef } from 'react';
import { 
  FileText, Upload, CheckCircle2, AlertTriangle, Image as ImageIcon,
  Sparkles, Download, Trash2, Eye, EyeOff, RefreshCw, Check, ArrowRight, BookOpen
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  extractQuestionsAndDiagramsFromPdf, 
  type ExtractedVisualQuestion, 
  type PdfVisualExtractionResult 
} from '@/lib/pdfVisualQuestionExtractor';
import { OFFICIAL_JAMB_SUBJECTS, normalizeSubjectName } from '@/utils/subjectUtils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const PdfVisualQuestionExtractor: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('Physics');
  const [examYear, setExamYear] = useState<number>(2024);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  
  const [extractionResult, setExtractionResult] = useState<PdfVisualExtractionResult | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedVisualQuestion[]>([]);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Please upload a PDF past question file.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleStartExtraction = async () => {
    if (!selectedFile) {
      toast.error('Please select a PDF document first.');
      return;
    }

    setIsProcessing(true);
    setProgressStatus('Initializing PDF parser...');
    setProgressPercent(5);

    try {
      const result = await extractQuestionsAndDiagramsFromPdf(
        selectedFile,
        selectedSubject,
        (status, percent) => {
          setProgressStatus(status);
          setProgressPercent(percent);
        }
      );

      setExtractionResult(result);
      // Attach selected subject and year to all extracted questions
      const initializedQuestions = result.questions.map(q => ({
        ...q,
        year: examYear
      }));
      setExtractedQuestions(initializedQuestions);

      toast.success(`Extracted ${result.totalQuestions} questions! (${result.questionsWithDiagrams} with diagrams isolated)`);
    } catch (err: any) {
      console.error('PDF extraction failed:', err);
      toast.error(`Extraction failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressPercent(100);
    }
  };

  // 1-Click Save all extracted questions & diagrams directly to Supabase
  const handleIngestAllQuestions = async () => {
    if (extractedQuestions.length === 0) return;

    setIsIngesting(true);
    toast.info('Ingesting questions and diagrams to database...');

    try {
      // Resolve subject ID from Supabase
      const canonical = normalizeSubjectName(selectedSubject);
      let subjectId = '';
      const { data: dbSubs } = await supabase.from('subjects').select('id, name');
      if (dbSubs) {
        const matched = dbSubs.find(s => normalizeSubjectName(s.name).toLowerCase() === canonical.toLowerCase());
        subjectId = matched?.id || dbSubs[0]?.id || '';
      }

      const payloads = extractedQuestions.map(q => {
        const qualityFlags = q.hasVisualReference && !q.diagramImageUrl
          ? ['needs_diagram', 'missing_figure']
          : [];

        // If diagram image was isolated from PDF, embed in markdown and question stem
        let finalQuestionText = q.questionText.trim();
        if (q.diagramImageUrl && !finalQuestionText.includes('![Diagram]')) {
          finalQuestionText = `![Diagram](${q.diagramImageUrl})\n\n${finalQuestionText}`;
        }

        return {
          subject_id: subjectId,
          question_text: finalQuestionText,
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

      // Insert in chunks of 50
      const CHUNK_SIZE = 50;
      let insertedCount = 0;
      for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
        const chunk = payloads.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('questions').insert(chunk);
        if (error) {
          throw error;
        }
        insertedCount += chunk.length;
      }

      toast.success(`Successfully added ${insertedCount} authentic questions to ${selectedSubject} question bank!`);
      setExtractedQuestions([]);
      setExtractionResult(null);
      setSelectedFile(null);
    } catch (err: any) {
      console.error('Ingest error:', err);
      toast.error(`Ingestion failed: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  const removeQuestion = (index: number) => {
    setExtractedQuestions(prev => prev.filter((_, i) => i !== index));
    toast.info('Question removed from batch.');
  };

  const updateQuestionField = (index: number, field: keyof ExtractedVisualQuestion, value: any) => {
    setExtractedQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  return (
    <div className="space-y-6">
      {/* Module Overview Banner */}
      <Card className="border-primary/30 bg-gradient-to-r from-card via-card to-primary/5 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold font-display">
                Automated PDF Question & Diagram Extractor
              </CardTitle>
              <CardDescription>
                Upload any past questions PDF. The engine automatically isolates diagram figures (chemistry apparatus, physics circuits, math graphs) and writes questions directly without manual typing.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Target Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm font-bold text-foreground"
              >
                {OFFICIAL_JAMB_SUBJECTS.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Past Question Year
              </label>
              <Input
                type="number"
                min={1978}
                max={2026}
                value={examYear}
                onChange={(e) => setExamYear(Number(e.target.value))}
                className="h-10 text-sm font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                PDF Document File
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-10 justify-start text-xs font-bold border-dashed gap-2"
              >
                <Upload className="w-4 h-4 text-primary" />
                <span className="truncate">{selectedFile ? selectedFile.name : 'Select PDF Document...'}</span>
              </Button>
            </div>
          </div>

          {/* Action Button & Progress */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Button
              onClick={handleStartExtraction}
              disabled={!selectedFile || isProcessing}
              className="w-full sm:w-auto bg-primary font-bold h-11 px-6 gap-2 shadow-xs"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{progressStatus || 'Extracting Diagrams & Text...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Extract Questions & Isolate Diagrams</span>
                </>
              )}
            </Button>

            {isProcessing && (
              <div className="w-full sm:w-64 space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                  <span>{progressPercent}% Complete</span>
                  <span>{progressStatus}</span>
                </div>
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extracted Questions Review & Batch Ingestion Table */}
      {extractedQuestions.length > 0 && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold">
                Review Extracted Questions ({extractedQuestions.length})
              </CardTitle>
              <CardDescription>
                Verify question texts and diagrams before publishing to live student question bank.
              </CardDescription>
            </div>

            <Button
              onClick={handleIngestAllQuestions}
              disabled={isIngesting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-2 shadow-xs"
            >
              {isIngesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Ingesting to Database...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Ingest All {extractedQuestions.length} Questions</span>
                </>
              )}
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-4 max-h-[600px] overflow-y-auto p-1 custom-scrollbar">
              {extractedQuestions.map((q, idx) => (
                <div 
                  key={q.id || idx}
                  className="p-4 rounded-xl border border-border bg-muted/20 hover:border-primary/40 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-extrabold text-xs">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        Page {q.pageNumber} • JAMB {q.year}
                      </span>
                      {q.diagramImageUrl ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Diagram Attached
                        </span>
                      ) : q.hasVisualReference ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Needs Diagram
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeQuestion(idx)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs h-8 p-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>

                  {/* Question Stem Text Area */}
                  <div>
                    <textarea
                      value={q.questionText}
                      onChange={(e) => updateQuestionField(idx, 'questionText', e.target.value)}
                      rows={2}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  {/* Diagram Preview if present */}
                  {q.diagramImageUrl && (
                    <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-lg border border-border">
                      <img 
                        src={q.diagramImageUrl} 
                        alt="Question Diagram" 
                        className="w-20 h-16 object-cover rounded border border-border cursor-pointer"
                        onClick={() => setSelectedPreviewImage(q.diagramImageUrl!)}
                      />
                      <div className="text-xs space-y-1">
                        <span className="font-bold text-foreground block">Isolated Page Diagram</span>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setSelectedPreviewImage(q.diagramImageUrl!)}
                          className="text-[11px] h-6 px-2"
                        >
                          <Eye className="w-3 h-3 mr-1" /> View Full Image
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt, oIdx) => {
                      const letter = ['A', 'B', 'C', 'D'][oIdx] || String(oIdx + 1);
                      const isCorrect = q.correctAnswer === letter || q.correctAnswer === opt;
                      return (
                        <div 
                          key={oIdx}
                          className={`flex items-center gap-2 p-2 rounded-lg border ${
                            isCorrect ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200' : 'border-border bg-background'
                          }`}
                        >
                          <span className="font-bold shrink-0">{letter})</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...q.options];
                              newOpts[oIdx] = e.target.value;
                              updateQuestionField(idx, 'options', newOpts);
                            }}
                            className="w-full bg-transparent text-xs focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Diagram Zoom Modal */}
      {selectedPreviewImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Isolated Question Diagram Preview</span>
              <Button size="sm" variant="ghost" onClick={() => setSelectedPreviewImage(null)}>
                Close
              </Button>
            </div>
            <div className="max-h-[500px] overflow-auto flex items-center justify-center p-2 bg-muted rounded-xl">
              <img src={selectedPreviewImage} alt="Diagram" className="max-h-[460px] object-contain rounded" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
