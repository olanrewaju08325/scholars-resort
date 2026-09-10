import React, { useState, useRef } from 'react';
import { 
  Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, X, Play, 
  FileSpreadsheet, Download, Check, ShieldCheck, Layers 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import { parseQuestionsCsv, importQuestionsToDatabase, type CsvParseResult } from '@/lib/csvQuestionParser';

interface BulkQuestionUploaderProps {
  onSuccess?: () => void;
}

export const BulkQuestionUploader: React.FC<BulkQuestionUploaderProps> = ({ onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [progressText, setProgressText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = "subject,topic,question,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,exam_year\n";
    const sample = [
      'Mathematics,Quadratic Equations,"What is the discriminant of the quadratic equation ax^2 + bx + c = 0?",b^2 - 4ac,b^2 + 4ac,4ac - b^2,2ab - c,b^2 - 4ac,"The discriminant is given by the formula b^2 - 4ac from the quadratic formula.",medium,2023',
      'Physics,Waves,"Which of the following electromagnetic waves has the highest frequency?",Radio waves,X-rays,Infrared rays,Microwaves,X-rays,"X-rays have a much higher frequency and shorter wavelength than radio, infrared, or microwaves.",hard,2024'
    ].join('\n');

    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'scholars_resort_question_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample CSV template downloaded successfully!');
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv') && !selectedFile.type.includes('csv')) {
      toast.error('Please upload a valid CSV file.');
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);
    setProgressText('Reading and validating CSV structure...');

    try {
      const text = await selectedFile.text();
      const result = await parseQuestionsCsv(text, { checkDbDuplicates: true });
      setParseResult(result);
      setIsParsing(false);

      if (result.validQuestions.length > 0) {
        toast.success(`Successfully parsed ${result.validQuestions.length} valid question(s)!`);
      } else {
        toast.warning('No valid questions found in CSV. Please verify required columns.');
      }
    } catch (err: any) {
      console.error('CSV Parse Error:', err);
      toast.error('Failed to parse CSV file: ' + err.message);
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadToDatabase = async () => {
    if (!parseResult || parseResult.validQuestions.length === 0) {
      toast.error('No valid questions to import.');
      return;
    }

    setIsUploading(true);
    setProgressText('Preparing batch insert into Supabase...');

    try {
      const result = await importQuestionsToDatabase(parseResult.validQuestions, {
        publishImmediately,
        onProgress: (processed, total, status) => {
          setProgressText(`Importing: ${processed}/${total} - ${status}`);
        }
      });

      setIsUploading(false);
      if (result.successCount > 0) {
        toast.success(`Successfully imported ${result.successCount} question(s) to database!`);
        onSuccess?.();
        setFile(null);
        setParseResult(null);
      } else {
        toast.error('Import completed with 0 successes. Check validation errors.');
      }
    } catch (err: any) {
      setIsUploading(false);
      toast.error('Database import error: ' + err.message);
    }
  };

  return (
    <Card className="bg-white border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Robust Bulk Question Uploader (CSV)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Upload questions with columns: subject, topic, question, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, exam_year.
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download CSV Template
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {!file ? (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-all group"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">Click to browse or drag and drop your CSV file</h4>
            <p className="text-xs text-slate-500 mt-1">Supports UTF-8 CSV with mandatory validation for all 11 columns</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-indigo-600" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">{file.name}</div>
                  <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFile(null); setParseResult(null); }}
                disabled={isUploading || isParsing}
                className="text-slate-500 hover:text-red-600"
              >
                <X className="w-4 h-4 mr-1" /> Remove
              </Button>
            </div>

            {isParsing && (
              <div className="flex items-center justify-center gap-3 py-6 text-indigo-600 text-sm font-medium">
                <RefreshCw className="w-5 h-5 animate-spin" />
                {progressText}
              </div>
            )}

            {parseResult && !isParsing && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-800">{parseResult.totalRows}</div>
                    <div className="text-xs text-slate-500 font-medium">Total Rows</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-emerald-700">{parseResult.validQuestions.length}</div>
                    <div className="text-xs text-emerald-600 font-medium">Valid Ready</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-amber-700">
                      {parseResult.duplicateQuestionsInFile.length + parseResult.duplicateQuestionsInDb.length}
                    </div>
                    <div className="text-xs text-amber-600 font-medium">Duplicates Flagged</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-700">{parseResult.failedRows.length}</div>
                    <div className="text-xs text-red-600 font-medium">Validation Errors</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="bulkPublishToggle"
                      checked={publishImmediately}
                      onChange={e => setPublishImmediately(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <label htmlFor="bulkPublishToggle" className="text-xs font-medium text-slate-700 cursor-pointer">
                      Publish questions immediately as active (uncheck to save as drafts)
                    </label>
                  </div>

                  <Button
                    onClick={handleUploadToDatabase}
                    disabled={isUploading || parseResult.validQuestions.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {progressText}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        Batch Insert {parseResult.validQuestions.length} Questions
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
