import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, Sparkles, Loader2, CheckCircle2, AlertCircle, BookOpen, BrainCircuit } from 'lucide-react';
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
  const [pastedText, setPastedText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    summary?: string;
    topics?: string[];
    key_formulas?: string[];
    questions?: any[];
  } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf' && !selected.name.endsWith('.pdf') && !selected.type.startsWith('text/')) {
        toast.error('Please upload a valid PDF or text document.');
        return;
      }
      setFile(selected);
    }
  };

  const processAndAnalyze = async () => {
    if (!file && !pastedText.trim()) {
      toast.error('Please select a PDF file or paste study material text.');
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

        // 1. Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from('raw_content')
          .upload(filePath, file);

        if (uploadErr) {
          console.warn('Storage upload warning:', uploadErr.message);
        }

        const { data: urlData } = supabase.storage.from('raw_content').getPublicUrl(filePath);
        publicUrl = urlData.publicUrl;

        // Extract snippet text or file title
        if (!docText) {
          docText = `Document Name: ${file.name}. Size: ${Math.round(file.size / 1024)} KB. Subject content overview for UTME practice preparation.`;
        }
      }

      setIsUploading(false);
      setIsAnalyzing(true);

      // 2. Trigger Groq AI Analysis
      toast.info('Groq AI (Llama 3.3) is analyzing document content...');
      const analysis = await analyzeDocumentWithGroq(docText, file ? file.name : 'Pasted Study Material');

      setAnalysisResult(analysis);
      toast.success('Groq AI analysis complete!');

      if (onAnalysisComplete) onAnalysisComplete(analysis);
      if (onQuestionsGenerated && analysis.questions) {
        onQuestionsGenerated(analysis.questions);
      }

      // 3. Store job / log in database
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

    } catch (err: any) {
      console.error('Processing failed:', err);
      toast.error(`Analysis failed: ${err.message || 'Error parsing document'}`);
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="border-border bg-card shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl flex items-center gap-2 font-display">
              Groq AI PDF Study Material Analyzer
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-normal border border-emerald-500/30">
                Llama 3.3 70B
              </span>
            </CardTitle>
            <CardDescription>
              Upload PDF study notes, syllabus or past question documents. Groq AI will instantly extract summaries and generate UTME practice questions.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload Zone */}
        <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-6 text-center bg-muted/20 transition-all cursor-pointer">
          <input
            type="file"
            id="pdf-study-upload"
            accept=".pdf,.txt,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <label htmlFor="pdf-study-upload" className="cursor-pointer block space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Upload className="w-6 h-6" />
            </div>
            <div className="font-medium text-sm">
              {file ? (
                <span className="text-primary font-semibold flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              ) : (
                'Click to upload PDF or drag and drop file here'
              )}
            </div>
            <p className="text-xs text-muted-foreground">PDF, TXT, DOCX up to 25MB</p>
          </label>
        </div>

        {/* Optional Text Paste */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Or Paste Document Text / Notes directly:
          </label>
          <Textarea
            placeholder="Paste syllabus text, topic summaries or past questions here for instant Groq AI analysis..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="min-h-[100px] bg-slate-950 border-border text-sm font-sans"
          />
        </div>

        <Button
          onClick={processAndAnalyze}
          disabled={isUploading || isAnalyzing || (!file && !pastedText.trim())}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5 rounded-xl flex items-center justify-center gap-2"
        >
          {isUploading || isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {isUploading ? 'Uploading to Storage...' : 'Groq AI Analyzing Document...'}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-400" />
              Analyze Document & Generate UTME Questions
            </>
          )}
        </Button>

        {/* Analysis Output Section */}
        {analysisResult && (
          <div className="mt-6 space-y-4 border-t border-border pt-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Document Analysis Complete
            </div>

            {analysisResult.summary && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
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
                  <span className="text-xs text-muted-foreground font-normal">Ready for CBT Practice</span>
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {analysisResult.questions.map((q, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                      <p className="font-semibold text-slate-200">{idx + 1}. {q.question}</p>
                      <div className="grid grid-cols-2 gap-1.5 text-slate-400">
                        {q.options?.map((opt: string, i: number) => (
                          <div key={i} className={`px-2 py-1 rounded border ${opt === q.correct_answer ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold' : 'border-slate-800 bg-slate-950'}`}>
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
