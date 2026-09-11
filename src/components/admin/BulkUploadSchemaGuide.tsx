import React, { useState, useEffect } from 'react';
import { 
  Database, 
  HelpCircle, 
  CheckCircle2, 
  PlusCircle, 
  Layers, 
  BookOpen, 
  Sparkles, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { OFFICIAL_JAMB_SUBJECTS, normalizeSubjectName } from '@/utils/subjectUtils';
import { toast } from 'sonner';

interface SubjectInfo {
  id: string;
  name: string;
  questionCount: number;
  topicCount: number;
  isExisting: boolean;
}

export const BulkUploadSchemaGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [subjectsData, setSubjectsData] = useState<SubjectInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  useEffect(() => {
    loadDatabaseCurriculum();
  }, []);

  const loadDatabaseCurriculum = async () => {
    setLoading(true);
    try {
      const [{ data: subjects }, { data: topics }, { data: questions }] = await Promise.all([
        supabase.from('subjects').select('id, name, is_active'),
        supabase.from('topics').select('id, subject_id, name'),
        supabase.from('questions').select('id, subject_id')
      ]);

      const subList: SubjectInfo[] = (subjects || []).map(s => {
        const qCount = (questions || []).filter(q => q.subject_id === s.id).length;
        const tCount = (topics || []).filter(t => t.subject_id === s.id).length;
        return {
          id: s.id,
          name: s.name,
          questionCount: qCount,
          topicCount: tCount,
          isExisting: true
        };
      });

      // Sort with highest question count first
      subList.sort((a, b) => b.questionCount - a.questionCount);
      setSubjectsData(subList);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied "${label}" to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const schemaColumns = [
    {
      name: 'subject',
      alias: 'Subject, course, Subject Name',
      required: true,
      description: 'The UTME or WAEC subject name. If the subject already exists in Supabase (e.g., "Economics", "Commerce"), the importer links it instantly to its UUID. If a new subject name is given, it is automatically created in the database.',
      example: 'Economics',
      dbTarget: 'subjects.name -> questions.subject_id'
    },
    {
      name: 'topic',
      alias: 'Topic, topic_name, Chapter',
      required: false,
      description: 'The syllabus topic. If the topic already exists for this subject, it links to its UUID. If it is a new topic, it is automatically created in the topics table and linked to the subject.',
      example: 'Theory of Demand and Supply',
      dbTarget: 'topics.name -> questions.topic_id'
    },
    {
      name: 'question',
      alias: 'Question, question_text, Stem',
      required: true,
      description: 'The full question stem. Supports standard text, math equations, formulas, and LaTeX formatting.',
      example: 'Which of the following is an example of an indirect tax?',
      dbTarget: 'questions.question_text'
    },
    {
      name: 'option_a',
      alias: 'Option A, optionA, A, choice_a',
      required: true,
      description: 'The text for choice A.',
      example: 'Value Added Tax (VAT)',
      dbTarget: 'questions.option_a & questions.options[0]'
    },
    {
      name: 'option_b',
      alias: 'Option B, optionB, B, choice_b',
      required: true,
      description: 'The text for choice B.',
      example: 'Personal Income Tax (PAYE)',
      dbTarget: 'questions.option_b & questions.options[1]'
    },
    {
      name: 'option_c',
      alias: 'Option C, optionC, C, choice_c',
      required: true,
      description: 'The text for choice C.',
      example: 'Company Income Tax',
      dbTarget: 'questions.option_c & questions.options[2]'
    },
    {
      name: 'option_d',
      alias: 'Option D, optionD, D, choice_d',
      required: true,
      description: 'The text for choice D.',
      example: 'Capital Gains Tax',
      dbTarget: 'questions.option_d & questions.options[3]'
    },
    {
      name: 'correct_answer',
      alias: 'Correct Answer, answer, correct_option, Key',
      required: true,
      description: 'The correct option. Accepts letter ("A", "B", "C", "D") OR the full text matching one of the options.',
      example: 'A',
      dbTarget: 'questions.correct_answer'
    },
    {
      name: 'explanation',
      alias: 'Explanation, rationale, solution',
      required: false,
      description: 'Detailed step-by-step solution shown to students during CBT practice review.',
      example: 'VAT is levied on goods and services, not directly on income.',
      dbTarget: 'questions.explanation'
    },
    {
      name: 'difficulty',
      alias: 'Difficulty, level',
      required: false,
      description: 'Question difficulty level. Allowed values: "easy", "medium", or "hard". Defaults to "medium".',
      example: 'medium',
      dbTarget: 'questions.difficulty'
    },
    {
      name: 'year',
      alias: 'Year, exam_year',
      required: false,
      description: 'Past UTME / WAEC examination year (4-digit integer).',
      example: '2024',
      dbTarget: 'questions.year'
    }
  ];

  return (
    <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl overflow-hidden">
      <CardHeader className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              CSV Column Mapping & Database Schema Guide
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                Auto Subject & Topic Sync
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Clear explanation of existing vs. new subjects, auto-created topics, and required table columns.
            </CardDescription>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsOpen(prev => !prev)}
          className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold gap-1"
        >
          {isOpen ? (
            <>Hide Field Guide <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>Show Field Guide <ChevronDown className="w-4 h-4" /></>
          )}
        </Button>
      </CardHeader>

      {isOpen && (
        <CardContent className="p-4 space-y-6">
          {/* Key Ingestion Mechanisms */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Existing Subjects</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                If the CSV subject matches an existing subject name (e.g., <em>Economics</em>), the importer automatically maps all questions to the existing database UUID and increments its question count.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-semibold text-blue-400">
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>New Subjects & Topics</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                If you introduce a brand-new subject or topic name not yet in Supabase, the system <strong>automatically registers and links it</strong> in the database during the upload.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-semibold text-amber-400">
                <Layers className="w-4 h-4 shrink-0" />
                <span>Updating Existing Records</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Select <strong>"Update Existing Questions"</strong> during upload if you want the CSV to revise questions with improved explanations, corrected answers, or updated topics.
              </p>
            </div>
          </div>

          {/* Database Subjects Directory */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                Live Database Subjects & Topic Counts ({subjectsData.length} Registered)
              </h4>
              <span className="text-[11px] text-slate-400">
                Click any subject name to copy for CSV
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {subjectsData.map(s => (
                <button
                  key={s.id}
                  onClick={() => copyToClipboard(s.name, s.name)}
                  className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500/50 text-left transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 truncate">
                      {s.name}
                    </span>
                    {copiedField === s.name ? (
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                    <span className="text-emerald-400 font-mono">{s.questionCount} Qs</span>
                    <span>•</span>
                    <span>{s.topicCount} Topics</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Column Specifications Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
              Required & Optional CSV Header Columns
            </h4>

            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <th className="p-2.5">Column Name</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Supported Aliases</th>
                    <th className="p-2.5">Description & DB Target</th>
                    <th className="p-2.5">Sample Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                  {schemaColumns.map((col) => (
                    <tr key={col.name} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-blue-300">
                        {col.name}
                      </td>
                      <td className="p-2.5">
                        {col.required ? (
                          <Badge variant="destructive" className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">
                            Required
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px]">
                            Optional
                          </Badge>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-300 font-mono text-[11px]">
                        {col.alias}
                      </td>
                      <td className="p-2.5 text-slate-300">
                        <div>{col.description}</div>
                        <div className="text-[10px] font-mono text-slate-300 mt-0.5">Target: {col.dbTarget}</div>
                      </td>
                      <td className="p-2.5 font-mono text-slate-300 text-[11px]">
                        "{col.example}"
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
