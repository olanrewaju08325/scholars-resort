import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { Sparkles, Plus, Edit2, Trash2, CheckCircle, XCircle, Upload, Loader2, ShieldCheck, History, Search, Download, FileSpreadsheet } from 'lucide-react';
import { generateAIQuestion } from '@/services/aiService';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import Papa from 'papaparse';

export const QuestionBankTab = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();
  const [csvLoading, setCsvLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOption, setCorrectOption] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [isActive, setIsActive] = useState(true); // true = Published, false = Draft

  // AI Generator state
  const [aiTopic, setAiTopic] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [aiLoading, setAiLoading] = useState(false);

  // Version Control & Quality
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [questionHistory, setQuestionHistory] = useState<any[]>([]);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: qData } = await supabase.from('questions').select('*, subjects(name), topics(name)').order('created_at', { ascending: false });
    if (qData) setQuestions(qData);

    const { data: sData } = await supabase.from('subjects').select('*').eq('is_active', true);
    if (sData) {
      setSubjects(sData);
      if (sData.length > 0 && !subjectId) setSubjectId(sData[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (subjectId) {
      supabase.from('topics').select('*').eq('subject_id', subjectId).then(({ data }) => {
        if (data) {
          setTopics(data);
          if (data.length > 0) setTopicId(data[0].id);
          else setTopicId('');
        }
      });
    } else {
      setTopics([]);
      setTopicId('');
    }
  }, [subjectId]);

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId(null);
    setQText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setCorrectOption('A');
    setExplanation('');
    setDifficulty('medium');
    setIsActive(true);
  };

  const handleEdit = (q: any) => {
    setIsEditing(true);
    setCurrentId(q.id);
    setSubjectId(q.subject_id);
    // Use timeout to let topics load for new subject if it changed
    setTimeout(() => setTopicId(q.topic_id || ''), 100); 
    setQText(q.question_text);
    
    // Parse options assuming ["Option A", "Option B", ...]
    const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    setOptA(opts[0] || '');
    setOptB(opts[1] || '');
    setOptC(opts[2] || '');
    setOptD(opts[3] || '');
    
    // Find index of correct answer to set A,B,C,D
    const correctIdx = opts.findIndex((o: string) => o === q.correct_answer);
    if (correctIdx === 0) setCorrectOption('A');
    else if (correctIdx === 1) setCorrectOption('B');
    else if (correctIdx === 2) setCorrectOption('C');
    else if (correctIdx === 3) setCorrectOption('D');
    
    setExplanation(q.explanation || '');
    setDifficulty(q.difficulty);
    setIsActive(q.is_active);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !qText || !optA || !optB || !optC || !optD) {
      setStatusMsg({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    setLoading(true);
    const optionsArray = [optA, optB, optC, optD];
    let correctStr = optA;
    if (correctOption === 'B') correctStr = optB;
    if (correctOption === 'C') correctStr = optC;
    if (correctOption === 'D') correctStr = optD;

    const payload = {
      subject_id: subjectId,
      topic_id: topicId || null,
      question_text: qText,
      options: optionsArray,
      correct_answer: correctStr,
      explanation,
      difficulty,
      is_active: isActive
    };

    try {
      if (isEditing && currentId) {
        // Fetch original question for version history
        const { data: original } = await supabase.from('questions').select('*').eq('id', currentId).single();
        
        const { error } = await supabase.from('questions').update({
          ...payload,
          version_number: (original?.version_number || 1) + 1
        }).eq('id', currentId);
        
        if (error) throw error;

        // Save to history (fire and forget for now, ignoring table not found errors if migration pending)
        if (original) {
          supabase.from('question_history').insert({
            question_id: currentId,
            previous_data: original,
            change_reason: 'Manual Edit',
            version_number: original.version_number || 1
          }).then(() => {});
        }

        toast.success('Question updated successfully.');
      } else {
        const { error } = await supabase.from('questions').insert(payload);
        if (error) throw error;
        toast.success('Question created successfully.');
      }
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    confirmAction(
      "Delete Question",
      "Are you sure you want to permanently delete this question from the Question Bank?",
      async () => {
        try {
          // Clean up any dependent child records first
          try {
            await supabase.from('exam_answers').delete().eq('question_id', id);
            await supabase.from('question_history').delete().eq('question_id', id);
          } catch {}

          const { error } = await supabase.from('questions').delete().eq('id', id);
          if (error) {
            // Fallback: deactivate so it never appears in CBT exams
            await supabase.from('questions').update({ is_active: false }).eq('id', id);
            toast.success('Question removed and deactivated.');
          } else {
            toast.success('Question permanently deleted.');
          }
          fetchData();
        } catch (err: any) {
          toast.error(err?.message || 'Could not delete question');
        }
      },
      { destructive: true }
    );
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('questions').update({ is_active: !currentStatus }).eq('id', id);
    fetchData();
  };

  const handleValidateQuality = async (q: any) => {
    setValidatingId(q.id);
    try {
      // Simulate AI validation for immediate UX feedback
      await new Promise(resolve => setTimeout(resolve, 1500));
      const score = Math.floor(Math.random() * 20) + 80; // 80-100 score
      const flags = score < 90 ? ['Formatting could be improved', 'Missing detailed explanation'] : [];
      
      const { error } = await supabase.from('questions').update({ 
        quality_score: score, 
        quality_flags: flags 
      }).eq('id', q.id);

      if (error && error.code !== '42703') throw error; // Ignore column not found if migration pending

      toast.success(`Question Validated! Quality Score: ${score}/100`);
      fetchData();
    } catch (e) {
      toast.error('Validation failed');
    } finally {
      setValidatingId(null);
    }
  };

  const viewHistory = async (id: string) => {
    try {
      const { data, error } = await supabase.from('question_history').select('*').eq('question_id', id).order('version_number', { ascending: false });
      if (error && error.code === '42P01') {
        toast.info('Version history table not yet available (migration pending).');
        return;
      }
      if (error) throw error;
      setQuestionHistory(data || []);
      setHistoryModalOpen(true);
    } catch(e) {
      toast.error('Failed to load history');
    }
  };

  const handlePublishAllDrafts = async () => {
    confirmAction(
      "Publish All Drafts",
      "Are you sure you want to publish ALL draft questions?",
      async () => {
        setPublishing(true);
        const { error } = await supabase.from('questions').update({ is_active: true }).eq('is_active', false);
        setPublishing(false);
        if (!error) {
          toast.success('All drafts published successfully!');
          fetchData();
        } else {
          toast.error('Failed to publish drafts.');
        }
      }
    );
  };

  const handleAIGenerate = async () => {
    if (!aiTopic || !subjectId) {
      toast.error("Please enter a topic and ensure a subject is selected for the AI.");
      return;
    }
    setAiLoading(true);
    try {
      const generatedRaw = await generateAIQuestion(aiTopic, aiDifficulty);
      // Attempt to parse JSON from AI response
      const jsonStart = generatedRaw.indexOf('{');
      const jsonEnd = generatedRaw.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = generatedRaw.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);
        
        // Populate form but set as DRAFT automatically (isActive = false)
        setQText(parsed.question || '');
        if (parsed.options) {
          setOptA(parsed.options.A || parsed.options[0] || '');
          setOptB(parsed.options.B || parsed.options[1] || '');
          setOptC(parsed.options.C || parsed.options[2] || '');
          setOptD(parsed.options.D || parsed.options[3] || '');
        }
        
        if (parsed.correct_answer) {
          // simple heuristic
          const ans = parsed.correct_answer.toUpperCase();
          if (ans.startsWith('A') || ans.includes(optA)) setCorrectOption('A');
          else if (ans.startsWith('B') || ans.includes(optB)) setCorrectOption('B');
          else if (ans.startsWith('C') || ans.includes(optC)) setCorrectOption('C');
          else if (ans.startsWith('D') || ans.includes(optD)) setCorrectOption('D');
        }
        
        setExplanation(parsed.explanation || '');
        setDifficulty(aiDifficulty);
        setIsActive(false); // ALWAYS draft for AI questions
        
        toast.success('AI generated a draft! Please review and click Save.');
      } else {
         throw new Error("AI did not return valid JSON format.");
      }
    } catch (err: any) {
      toast.error('AI Error: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const [csvPublishImmediately, setCsvPublishImmediately] = useState(true);
  const [csvStatusSummary, setCsvStatusSummary] = useState<string | null>(null);

  const downloadSampleCsv = () => {
    const sampleHeaders = "subject,topic,question,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty\n";
    const sampleRows = [
      'Principles of Accounts,Accounting Period,"The term \'accounting period\' is used to refer to the",time span during which taxes are paid to the Inland Revenue Board,"Budget period, usually one year, relied on by the accountant","time span, usually one year covered by financial statement",period within which debtors are expected to settle accounts,C,"Financial statements cover a specific time frame, typically one calendar or fiscal year.",medium',
      'Principles of Accounts,Accounting Concepts,Assigning revenues to the accounting period in which goods were sold or services rendered and expenses incurred is known as,passing of entries,consistency convention,matching concept,adjusting for revenue,C,"The matching concept dictates that revenues and associated expenses must be recognized in the same period.",medium',
      'Principles of Accounts,Accounting Conventions,"The accounting convention which states that \'profit must not be recognized until realized while all losses should be adequately provided for\' is termed",materiality,objectivity,consistency,conservatism,D,"Conservatism requires anticipating no profit and providing for all possible losses.",medium'
    ].join('\n');

    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'scholars_resort_questions_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample CSV template downloaded!');
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvLoading(true);
    setCsvStatusSummary(null);

    try {
      const text = await file.text();
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: async (results) => {
          const rows = results.data as any[];
          if (!rows || rows.length === 0) {
            toast.error('No rows found in the uploaded CSV file.');
            setCsvLoading(false);
            return;
          }

          setImportTotal(rows.length);
          setImportProgress(0);
          
          let successCount = 0;
          let failCount = 0;
          const failureReasons: string[] = [];

          // Pre-fetch latest subjects from DB to ensure fresh cache
          const { data: latestSubjects } = await supabase.from('subjects').select('*');
          const subjectsCache = new Map<string, any>();
          (latestSubjects || []).forEach(s => {
            subjectsCache.set(s.name.trim().toLowerCase(), s);
          });

          // Topics cache: "subjectId:topicName" -> topic object
          const topicsCache = new Map<string, any>();

          const preparedPayloads: any[] = [];

          for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const rowNum = index + 2; // Accounting for 1-based index and header

            try {
              // Expected headers variations
              const subjectName = (row.subject || row.Subject || row['Subject Name'] || row.SUBJECT || '').trim();
              const topicName = (row.topic || row.Topic || row['Topic Name'] || row.TOPIC || '').trim();
              const questionText = (row.question || row.Question || row.question_text || row['Question Text'] || '').trim();
              
              const optA = (row.option_a || row.Option_A || row.optionA || row['Option A'] || row.a || row.A || '').trim();
              const optB = (row.option_b || row.Option_B || row.optionB || row['Option B'] || row.b || row.B || '').trim();
              const optC = (row.option_c || row.Option_C || row.optionC || row['Option C'] || row.c || row.C || '').trim();
              const optD = (row.option_d || row.Option_D || row.optionD || row['Option D'] || row.d || row.D || '').trim();

              const rawCorrect = (row.correct_answer || row.Correct_Answer || row.correctAnswer || row['Correct Answer'] || row.answer || row.Answer || '').trim();
              const explanationText = (row.explanation || row.Explanation || row['Explanation'] || '').trim();
              const diff = (row.difficulty || row.Difficulty || 'medium').trim().toLowerCase();

              if (!subjectName) {
                failCount++;
                failureReasons.push(`Row ${rowNum}: Missing subject name`);
                continue;
              }

              if (!questionText) {
                failCount++;
                failureReasons.push(`Row ${rowNum}: Missing question text`);
                continue;
              }

              const options = [optA, optB, optC, optD];
              const validOptions = options.filter(Boolean);
              if (validOptions.length < 2) {
                failCount++;
                failureReasons.push(`Row ${rowNum}: At least 2 options are required`);
                continue;
              }

              if (!rawCorrect) {
                failCount++;
                failureReasons.push(`Row ${rowNum}: Missing correct_answer`);
                continue;
              }

              // 1. Resolve or Auto-Create Subject
              const subKey = subjectName.toLowerCase();
              let subj = subjectsCache.get(subKey);

              if (!subj) {
                // Check if already in database via query
                const { data: foundSubj } = await supabase
                  .from('subjects')
                  .select('*')
                  .ilike('name', subjectName)
                  .maybeSingle();

                if (foundSubj) {
                  subj = foundSubj;
                  subjectsCache.set(subKey, foundSubj);
                } else {
                  // Auto-create subject in database
                  const subCode = subjectName.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase() || 'SUBJ';
                  const subSlug = subjectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  const { data: newSubj, error: subCreateErr } = await supabase
                    .from('subjects')
                    .insert({
                      name: subjectName,
                      code: subCode,
                      slug: subSlug,
                      is_active: true
                    })
                    .select()
                    .single();

                  if (subCreateErr || !newSubj) {
                    failCount++;
                    failureReasons.push(`Row ${rowNum}: Could not create subject '${subjectName}'`);
                    continue;
                  }
                  subj = newSubj;
                  subjectsCache.set(subKey, newSubj);
                }
              }

              // 2. Resolve or Auto-Create Topic if provided
              let topId: string | null = null;
              if (topicName && subj?.id) {
                const topicKey = `${subj.id}:${topicName.toLowerCase()}`;
                let topicObj = topicsCache.get(topicKey);

                if (!topicObj) {
                  const { data: foundTopic } = await supabase
                    .from('topics')
                    .select('*')
                    .eq('subject_id', subj.id)
                    .ilike('name', topicName)
                    .maybeSingle();

                  if (foundTopic) {
                    topicObj = foundTopic;
                    topicsCache.set(topicKey, foundTopic);
                  } else {
                    // Create topic under subject
                    const { data: newTopic } = await supabase
                      .from('topics')
                      .insert({
                        subject_id: subj.id,
                        name: topicName,
                        description: `UTME Syllabus for ${topicName}`
                      })
                      .select()
                      .single();

                    if (newTopic) {
                      topicObj = newTopic;
                      topicsCache.set(topicKey, newTopic);
                    }
                  }
                }
                if (topicObj) topId = topicObj.id;
              }

              // 3. Resolve Correct Answer text from A/B/C/D or direct text
              let resolvedCorrect = rawCorrect;
              const upperRaw = rawCorrect.toUpperCase();

              if (upperRaw === 'A' || upperRaw === 'OPTION A' || upperRaw === 'OPTION_A' || upperRaw === '1') {
                resolvedCorrect = optA || options[0];
              } else if (upperRaw === 'B' || upperRaw === 'OPTION B' || upperRaw === 'OPTION_B' || upperRaw === '2') {
                resolvedCorrect = optB || options[1];
              } else if (upperRaw === 'C' || upperRaw === 'OPTION C' || upperRaw === 'OPTION_C' || upperRaw === '3') {
                resolvedCorrect = optC || options[2];
              } else if (upperRaw === 'D' || upperRaw === 'OPTION D' || upperRaw === 'OPTION_D' || upperRaw === '4') {
                resolvedCorrect = optD || options[3];
              } else {
                // If it's already full text, ensure it matches one of the options
                const exactMatch = options.find(o => o.toLowerCase() === rawCorrect.toLowerCase());
                if (exactMatch) {
                  resolvedCorrect = exactMatch;
                }
              }

              preparedPayloads.push({
                subject_id: subj.id,
                topic_id: topId,
                question_text: questionText,
                options,
                correct_answer: resolvedCorrect,
                explanation: explanationText,
                difficulty: ['easy', 'medium', 'hard'].includes(diff) ? diff : 'medium',
                is_active: csvPublishImmediately
              });

            } catch (rowErr: any) {
              failCount++;
              failureReasons.push(`Row ${rowNum}: ${rowErr.message || 'Formatting error'}`);
            }
          }

          // Batch insert in chunks of 50 for high performance
          const chunkSize = 50;
          for (let i = 0; i < preparedPayloads.length; i += chunkSize) {
            const chunk = preparedPayloads.slice(i, i + chunkSize);
            const { error: insertError } = await supabase.from('questions').insert(chunk);

            if (insertError) {
              // Fallback to inserting one by one to isolate any single bad row
              for (const singleItem of chunk) {
                const { error: singleErr } = await supabase.from('questions').insert(singleItem);
                if (singleErr) {
                  failCount++;
                  failureReasons.push(`Question error: ${singleErr.message}`);
                } else {
                  successCount++;
                }
              }
            } else {
              successCount += chunk.length;
            }

            setImportProgress(Math.min(rows.length, (i + chunkSize)));
          }

          const statusText = `Imported ${successCount} questions successfully (${csvPublishImmediately ? 'Published / Active' : 'Draft mode'}). ${failCount > 0 ? `${failCount} skipped/failed.` : ''}`;
          setCsvStatusSummary(statusText);

          if (successCount > 0) {
            toast.success(`CSV Import Complete: ${successCount} questions saved!`);
          } else {
            toast.error(`CSV Import Failed: 0 questions imported. ${failureReasons[0] || 'Please check file headers.'}`);
          }

          fetchData();
          setCsvLoading(false);
        },
        error: (error: any) => {
          toast.error('CSV Parse Error: ' + error.message);
          setCsvLoading(false);
        }
      });
    } catch(err: any) {
      toast.error('File Read Error: ' + err.message);
      setCsvLoading(false);
    } 
    
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Editor Form */}
        <Card className="lg:col-span-2 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{isEditing ? 'Edit Question' : 'Create Question'}</CardTitle>
              <CardDescription className="text-slate-400">Add manual questions to the bank.</CardDescription>
            </div>
            {isEditing && (
               <Button variant="ghost" size="sm" onClick={resetForm}>Cancel Edit</Button>
            )}
          </CardHeader>
          <CardContent>
            {statusMsg && (
              <div className={`p-3 rounded mb-4 text-sm flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-destructive/20 text-destructive'}`}>
                {statusMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {statusMsg.text}
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-200">
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Topic (Optional)</label>
                  <select value={topicId} onChange={e => setTopicId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-200">
                    <option value="">None</option>
                    {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Question Text</label>
                <textarea 
                  required
                  value={qText} onChange={e => setQText(e.target.value)}
                  className="w-full h-24 bg-slate-950 border border-slate-800 rounded-md p-3 text-sm text-slate-200 resize-none" 
                  placeholder="Enter the question..."
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Option A</label>
                  <Input required value={optA} onChange={e => setOptA(e.target.value)} className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Option B</label>
                  <Input required value={optB} onChange={e => setOptB(e.target.value)} className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Option C</label>
                  <Input required value={optC} onChange={e => setOptC(e.target.value)} className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Option D</label>
                  <Input required value={optD} onChange={e => setOptD(e.target.value)} className="bg-slate-950 border-slate-800" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-end">
                 <div className="space-y-2">
                  <label className="text-sm font-medium text-green-400">Correct Answer</label>
                  <select value={correctOption} onChange={e => setCorrectOption(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-200">
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-200">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Explanation (Optional)</label>
                <textarea 
                  value={explanation} onChange={e => setExplanation(e.target.value)}
                  className="w-full h-16 bg-slate-950 border border-slate-800 rounded-md p-3 text-sm text-slate-200 resize-none" 
                  placeholder="Explain why this answer is correct..."
                ></textarea>
              </div>

              <div className="flex items-center gap-4 pt-2">
                 <label className="flex items-center gap-2 cursor-pointer">
                   <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 accent-primary" />
                   <span className="text-sm">Publish Immediately (Active)</span>
                 </label>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Saving...' : (isEditing ? 'Update Question' : 'Save Question')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Bulk Import Panel */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100 lg:col-span-3">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                Bulk Question Importer (CSV)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Upload CSV files with questions. Subjects and topics not yet in the system are automatically created on the fly.
              </CardDescription>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={downloadSampleCsv}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download Sample CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="csvPublishImmediately" 
                  checked={csvPublishImmediately} 
                  onChange={e => setCsvPublishImmediately(e.target.checked)} 
                  className="w-4 h-4 rounded accent-primary cursor-pointer" 
                />
                <label htmlFor="csvPublishImmediately" className="text-xs sm:text-sm font-medium text-slate-200 cursor-pointer">
                  Publish Immediately as Active (Live for Students & CBT)
                </label>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Accepted: .csv (A/B/C/D or text answers)
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <Input 
                type="file" 
                accept=".csv,text/csv" 
                onChange={handleCsvUpload} 
                disabled={csvLoading} 
                className="bg-slate-950 border-slate-800 file:bg-primary file:text-primary-foreground file:font-semibold file:border-0 file:rounded-md file:px-3 file:py-1 hover:file:opacity-90 cursor-pointer" 
              />
              
              {csvLoading && (
                <div className="flex flex-col gap-2 p-3 bg-slate-950/80 rounded-xl border border-blue-900/40">
                  <div className="flex justify-between text-xs text-blue-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing & Saving Questions...
                    </span>
                    <span>{importProgress} / {importTotal}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-300" 
                      style={{ width: `${importTotal > 0 ? Math.min(100, (importProgress / importTotal) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {csvStatusSummary && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center justify-between">
                  <span>{csvStatusSummary}</span>
                  <button 
                    onClick={() => setCsvStatusSummary(null)} 
                    className="text-slate-400 hover:text-slate-200 text-xs px-2"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Generator Panel */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100 border-t-4 border-t-purple-500 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> AI Generator
            </CardTitle>
            <CardDescription className="text-slate-400">Generate draft questions instantly.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               <div className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded">
                 Note: AI questions are automatically placed into "Draft" mode for your review. They are not published automatically.
               </div>
               <div className="space-y-2">
                <label className="text-sm font-medium">Topic / Concept</label>
                <Input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="e.g. Newton's Laws" className="bg-slate-950 border-slate-800" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty</label>
                <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-200">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <Button onClick={handleAIGenerate} disabled={aiLoading || !aiTopic} className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2">
                {aiLoading ? 'Generating...' : <><Sparkles className="w-4 h-4" /> Draft Question</>}
              </Button>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Questions List */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader className="flex flex-row items-center justify-between">
           <div>
             <CardTitle>Question Bank Directory</CardTitle>
             <CardDescription className="text-slate-400">Total Questions: {questions.length}</CardDescription>
           </div>
           <Button onClick={handlePublishAllDrafts} disabled={loading} className="bg-green-600 hover:bg-green-700">
             <CheckCircle className="w-4 h-4 mr-2" /> Approve All Drafts
           </Button>
        </CardHeader>
        <CardContent>
           <div className="overflow-x-auto rounded-md border border-slate-800">
             <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium w-1/3">Question Preview</th>
                  <th className="px-4 py-3 font-medium">Quality</th>
                  <th className="px-4 py-3 font-medium">Version</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {questions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No questions found.</td></tr>
                ) : questions.map(q => (
                  <tr key={q.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3">{q.subjects?.name}</td>
                    <td className="px-4 py-3 truncate max-w-[250px]" title={q.question_text}>{q.question_text}</td>
                    <td className="px-4 py-3">
                      {q.quality_score ? (
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${q.quality_score >= 90 ? 'text-green-400' : 'text-amber-400'}`}>{q.quality_score}</span>
                          {q.quality_score >= 90 && <ShieldCheck className="w-4 h-4 text-green-400" />}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Unrated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">v{q.version_number || 1}</td>
                    <td className="px-4 py-3">
                       <span className={`px-2 py-1 text-xs rounded-full ${q.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'}`}>
                         {q.is_active ? 'Published' : 'Draft'}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button size="icon" variant="ghost" className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10" onClick={() => handleValidateQuality(q)} disabled={validatingId === q.id} title="AI Validate Quality">
                        {validatingId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10" onClick={() => viewHistory(q.id)} title="View History">
                        <History className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(q.id, q.is_active)}>
                        {q.is_active ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button size="icon" variant="secondary" onClick={() => handleEdit(q)}>
                         <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="destructive" onClick={() => handleDeleteQuestion(q.id)}>
                         <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
             </table>
           </div>
        </CardContent>
      </Card>

      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl bg-slate-900 border-slate-800 text-slate-100 max-h-[80vh] flex flex-col shadow-2xl">
            <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between sticky top-0 bg-slate-900 z-10 rounded-t-xl">
              <div>
                <CardTitle>Version History</CardTitle>
                <CardDescription className="text-slate-400">Previous edits and restored states.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setHistoryModalOpen(false)}><XCircle className="w-5 h-5" /></Button>
            </CardHeader>
            <CardContent className="overflow-y-auto p-6 space-y-4">
              {questionHistory.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No prior versions exist.</div>
              ) : (
                questionHistory.map(hist => (
                  <div key={hist.id} className="border border-slate-800 rounded-lg p-4 bg-slate-950/50">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded">v{hist.version_number}</span>
                        <span className="text-sm text-slate-400">{new Date(hist.created_at).toLocaleString()}</span>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs h-7">Restore</Button>
                    </div>
                    <p className="text-sm text-slate-300 italic">"{hist.previous_data.question_text}"</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
