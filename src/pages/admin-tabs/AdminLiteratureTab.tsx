import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Plus, Trash2, Edit3, Save, RefreshCw, HelpCircle, Layers, Bookmark, CheckSquare, Square, Search, Zap, Upload, FileUp, X, Lock, Unlock, ShieldAlert, Sparkles, Sliders, CheckCircle2, BookMarked, Library } from 'lucide-react';
import { 
  fetchJambBooks, 
  saveJambBooks, 
  fetchLiteratureLockStatus, 
  saveLiteratureLockStatus, 
  uploadTextbookFileToSupabaseStorage,
  fetchRecommendedTextsExamConfig,
  saveRecommendedTextsExamConfig,
  generateNovelQuestionsWithAI,
  type RecommendedTextsExamConfig,
  DEFAULT_RECOMMENDED_TEXTS_CONFIG
} from '@/services/novelService';
import type { LiteratureBook, NovelChapter, NovelQuestion } from '@/data/jambNovelsData';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { VirtualList } from '@/components/VirtualList';
import { queueOfflineOperation } from '@/services/offlineSyncService';
import { exportLiteratureToCSV, exportLiteratureToPDF } from '@/utils/exportUtils';
import { logAdminActivity } from '@/services/adminActivityService';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

export const AdminLiteratureTab = () => {
  const [books, setBooks] = useState<LiteratureBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('the-life-changer');
  const [selectedChapterId, setSelectedChapterId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Literature Lock State
  const [isLiteratureLocked, setIsLiteratureLocked] = useState(false);
  const [lockReason, setLockReason] = useState('Updating official 2026 JAMB UTME literature prescribed texts.');
  const [lockingInFlight, setLockingInFlight] = useState(false);

  // New Textbook / Book Upload Modal State
  const [addBookModalOpen, setAddBookModalOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookGenre, setNewBookGenre] = useState('Compulsory UTME Novel');
  const [newBookDesc, setNewBookDesc] = useState('');
  const [newBookPdfUrl, setNewBookPdfUrl] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Edit Textbook Modal State
  const [editBookModalOpen, setEditBookModalOpen] = useState(false);
  const [editBookTitle, setEditBookTitle] = useState('');
  const [editBookAuthor, setEditBookAuthor] = useState('');
  const [editBookGenre, setEditBookGenre] = useState('Compulsory UTME Novel');
  const [editBookDesc, setEditBookDesc] = useState('');
  const [editBookPdfUrl, setEditBookPdfUrl] = useState('');

  // Form State for active chapter
  const [editingChapter, setEditingChapter] = useState<NovelChapter | null>(null);
  const [newTheme, setNewTheme] = useState('');
  const [newChar, setNewChar] = useState('');
  
  // Question Form State
  const [editingQuestion, setEditingQuestion] = useState<NovelQuestion | null>(null);

  // Bulk Selection & Virtualization State
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<number[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([]);
  const [isVirtualQuestionsView, setIsVirtualQuestionsView] = useState(true);

  const [bulkDeleteDialogConfig, setBulkDeleteDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'chapters' | 'questions';
    isDeleting: boolean;
  }>({
    isOpen: false,
    title: '',
    description: '',
    type: 'questions',
    isDeleting: false
  });

  // Recommended Texts Exam Config
  const [recConfig, setRecConfig] = useState<RecommendedTextsExamConfig>(DEFAULT_RECOMMENDED_TEXTS_CONFIG);
  const [savingRecConfig, setSavingRecConfig] = useState(false);

  // AI Question Generation Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTextSource, setAiTextSource] = useState<'chapter' | 'custom'>('chapter');
  const [customAiText, setCustomAiText] = useState('');
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiFocusType, setAiFocusType] = useState('comprehensive');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [generatedQuestionsPreview, setGeneratedQuestionsPreview] = useState<NovelQuestion[]>([]);

  // Manual Custom Question Authoring Modal (Without AI)
  const [customQModalOpen, setCustomQModalOpen] = useState(false);
  const [customQText, setCustomQText] = useState('');
  const [customQPassage, setCustomQPassage] = useState('');
  const [customQOptionA, setCustomQOptionA] = useState('');
  const [customQOptionB, setCustomQOptionB] = useState('');
  const [customQOptionC, setCustomQOptionC] = useState('');
  const [customQOptionD, setCustomQOptionD] = useState('');
  const [customQCorrect, setCustomQCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [customQExplanation, setCustomQExplanation] = useState('');
  const [customQTargetChapterId, setCustomQTargetChapterId] = useState<number>(1);
  const [editingCustomQIndex, setEditingCustomQIndex] = useState<number | null>(null);

  // Delete Dialog State
  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    itemName?: string;
    type: 'book' | 'chapter' | 'question' | null;
    targetId?: number;
    targetBookId?: string;
    isDeleting: boolean;
  }>({
    isOpen: false,
    title: '',
    description: '',
    type: null,
    isDeleting: false
  });

  async function loadBooks() {
    setLoading(true);
    try {
      // Fetch lock status
      const lockData = await fetchLiteratureLockStatus();
      setIsLiteratureLocked(lockData.isLocked);
      if (lockData.lockReason) setLockReason(lockData.lockReason);

      // Fetch recommended texts CBT exam config
      const examCfg = await fetchRecommendedTextsExamConfig();
      setRecConfig(examCfg);

      const data = await fetchJambBooks();
      setBooks(data);
      if (data.length > 0) {
        setSelectedBookId(data[0].id);
        if (data[0].chapters.length > 0) {
          setSelectedChapterId(data[0].chapters[0].id);
          setEditingChapter({ ...data[0].chapters[0] });
          setCustomQTargetChapterId(data[0].chapters[0].id);
        }
      }
    } catch {
      toast.error('Failed to load literature books');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBooks();
  }, []);

  const handleSaveLockStatus = async (targetLockedState: boolean) => {
    setLockingInFlight(true);
    const res = await saveLiteratureLockStatus(targetLockedState, lockReason);
    setLockingInFlight(false);
    if (res.success) {
      setIsLiteratureLocked(targetLockedState);
      toast.success(targetLockedState 
        ? 'Literature Hub is now LOCKED for students.' 
        : 'Literature Hub is now UNLOCKED and live for students!'
      );
    } else {
      toast.error('Failed to update lock status.');
    }
  };

  const currentBook = books.find(b => b.id === selectedBookId) || books[0];

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    const bk = books.find(b => b.id === bookId);
    if (bk && bk.chapters.length > 0) {
      setSelectedChapterId(bk.chapters[0].id);
      setEditingChapter({ ...bk.chapters[0] });
    } else {
      setEditingChapter(null);
    }
  };

  const handleSelectChapter = (ch: NovelChapter) => {
    setSelectedChapterId(ch.id);
    setEditingChapter({ ...ch });
    setEditingQuestion(null);
  };

  const handleSaveAll = async (updatedBooksList?: LiteratureBook[]) => {
    setSaving(true);
    const payload = updatedBooksList || books;
    const res = await saveJambBooks(payload);
    setSaving(false);
    if (res.success) {
      toast.success('Literature & Novel data saved to live database successfully!');
    } else {
      toast.error(`Error: ${res.error}`);
    }
  };

  const handleSaveRecConfig = async () => {
    setSavingRecConfig(true);
    const res = await saveRecommendedTextsExamConfig(recConfig);
    setSavingRecConfig(false);
    if (res.success) {
      toast.success('JAMB Mock CBT Recommended Texts integration settings saved successfully!');
      logAdminActivity('UPDATE_LITERATURE_CBT_CONFIG', `Updated recommended texts in Use of English mock (${recConfig.includeNovelInEnglishMock ? 'Enabled' : 'Disabled'}, ${recConfig.novelQuestionCountInEnglish} Qs)`);
    } else {
      toast.error(`Failed to save CBT settings: ${res.error}`);
    }
  };

  const handleOpenCustomQModal = (existingQ?: NovelQuestion, existingIndex?: number) => {
    if (existingQ && existingIndex !== undefined) {
      setCustomQText(existingQ.question);
      setCustomQPassage(existingQ.passage || '');
      setCustomQOptionA(existingQ.options[0]?.replace(/^[A-D]\)\s*/, '') || '');
      setCustomQOptionB(existingQ.options[1]?.replace(/^[A-D]\)\s*/, '') || '');
      setCustomQOptionC(existingQ.options[2]?.replace(/^[A-D]\)\s*/, '') || '');
      setCustomQOptionD(existingQ.options[3]?.replace(/^[A-D]\)\s*/, '') || '');
      setCustomQCorrect((existingQ.correct as any) || 'A');
      setCustomQExplanation(existingQ.explanation || '');
      setEditingCustomQIndex(existingIndex);
    } else {
      setCustomQText('');
      setCustomQPassage(editingChapter?.summary?.slice(0, 200) || '');
      setCustomQOptionA('');
      setCustomQOptionB('');
      setCustomQOptionC('');
      setCustomQOptionD('');
      setCustomQCorrect('A');
      setCustomQExplanation('');
      setEditingCustomQIndex(null);
    }
    setCustomQTargetChapterId(selectedChapterId);
    setCustomQModalOpen(true);
  };

  const handleSaveCustomManualQuestion = async () => {
    if (!customQText.trim()) {
      toast.error('Question text is required.');
      return;
    }
    if (!customQOptionA.trim() || !customQOptionB.trim() || !customQOptionC.trim() || !customQOptionD.trim()) {
      toast.error('All 4 options (A, B, C, D) are required for authentic JAMB format.');
      return;
    }
    if (!currentBook) return;

    const formattedQ: NovelQuestion = {
      id: `custom_q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      question: customQText.trim(),
      passage: customQPassage.trim() || undefined,
      options: [
        customQOptionA.trim().startsWith('A)') ? customQOptionA.trim() : `A) ${customQOptionA.trim()}`,
        customQOptionB.trim().startsWith('B)') ? customQOptionB.trim() : `B) ${customQOptionB.trim()}`,
        customQOptionC.trim().startsWith('C)') ? customQOptionC.trim() : `C) ${customQOptionC.trim()}`,
        customQOptionD.trim().startsWith('D)') ? customQOptionD.trim() : `D) ${customQOptionD.trim()}`
      ],
      correct: customQCorrect,
      explanation: customQExplanation.trim() || `Reference: ${currentBook.title}`,
      bookTitle: currentBook.title,
      chapterTitle: editingChapter?.title || undefined
    };

    const targetChId = customQTargetChapterId || selectedChapterId;
    const updatedBooks = books.map(b => {
      if (b.id === selectedBookId) {
        return {
          ...b,
          chapters: b.chapters.map(c => {
            if (c.id === targetChId) {
              const prevQs = [...(c.sampleQuestions || [])];
              if (editingCustomQIndex !== null) {
                prevQs[editingCustomQIndex] = formattedQ;
              } else {
                prevQs.unshift(formattedQ);
              }
              return { ...c, sampleQuestions: prevQs };
            }
            return c;
          })
        };
      }
      return b;
    });

    setBooks(updatedBooks);
    const targetCh = updatedBooks.find(b => b.id === selectedBookId)?.chapters.find(c => c.id === targetChId);
    if (targetCh) setEditingChapter({ ...targetCh });

    await handleSaveAll(updatedBooks);
    setCustomQModalOpen(false);
    toast.success(editingCustomQIndex !== null ? 'Question updated successfully!' : 'Personal custom question created and added to book!');
  };

  const handleRunAIGeneration = async () => {
    const context = aiTextSource === 'chapter' ? (editingChapter?.summary || currentBook?.description || '') : customAiText;
    if (!context || context.trim().length < 20) {
      toast.error('Please provide at least 20 characters of textbook content or chapter summary for the AI.');
      return;
    }
    setGeneratingAi(true);
    try {
      const generated = await generateNovelQuestionsWithAI({
        bookTitle: currentBook?.title || 'Prescribed Novel',
        chapterTitle: editingChapter?.title || 'Chapter Excerpt',
        contextText: context,
        questionCount: aiQuestionCount,
        focusType: aiFocusType
      });
      setGeneratedQuestionsPreview(generated);
      if (generated.length > 0) {
        toast.success(`Synthesized ${generated.length} JAMB-standard questions! Review and save below.`);
      } else {
        toast.info('No questions generated. Check excerpt and try again.');
      }
    } catch (err: any) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleAddGeneratedQuestionsToBook = async () => {
    if (generatedQuestionsPreview.length === 0 || !editingChapter || !currentBook) return;

    const updatedBooks = books.map(b => {
      if (b.id === selectedBookId) {
        return {
          ...b,
          chapters: b.chapters.map(c => {
            if (c.id === editingChapter.id) {
              return {
                ...c,
                sampleQuestions: [...generatedQuestionsPreview, ...(c.sampleQuestions || [])]
              };
            }
            return c;
          })
        };
      }
      return b;
    });

    setBooks(updatedBooks);
    const refreshed = updatedBooks.find(b => b.id === selectedBookId)?.chapters.find(c => c.id === editingChapter.id);
    if (refreshed) setEditingChapter({ ...refreshed });

    await handleSaveAll(updatedBooks);
    setAiModalOpen(false);
    setGeneratedQuestionsPreview([]);
    toast.success(`Successfully saved ${generatedQuestionsPreview.length} questions into "${currentBook.title}" (${editingChapter.title})!`);
  };

  const handleUpdateChapterField = (field: keyof NovelChapter, value: any) => {
    if (!editingChapter) return;
    const updated = { ...editingChapter, [field]: value };
    setEditingChapter(updated);

    // Update in local books array
    const updatedBooks = books.map(b => {
      if (b.id === selectedBookId) {
        return {
          ...b,
          chapters: b.chapters.map(c => c.id === editingChapter.id ? updated : c)
        };
      }
      return b;
    });
    setBooks(updatedBooks);
  };

  const handleAddTheme = () => {
    if (!newTheme.trim() || !editingChapter) return;
    const themes = [...editingChapter.keyThemes, newTheme.trim()];
    handleUpdateChapterField('keyThemes', themes);
    setNewTheme('');
  };

  const handleRemoveTheme = (index: number) => {
    if (!editingChapter) return;
    const themes = editingChapter.keyThemes.filter((_, i) => i !== index);
    handleUpdateChapterField('keyThemes', themes);
  };

  const handleAddCharacter = () => {
    if (!newChar.trim() || !editingChapter) return;
    const chars = [...editingChapter.charactersInvolved, newChar.trim()];
    handleUpdateChapterField('charactersInvolved', chars);
    setNewChar('');
  };

  const handleRemoveCharacter = (index: number) => {
    if (!editingChapter) return;
    const chars = editingChapter.charactersInvolved.filter((_, i) => i !== index);
    handleUpdateChapterField('charactersInvolved', chars);
  };

  const handleAddNewChapter = () => {
    if (!currentBook) return;
    const newId = currentBook.chapters.length > 0 ? Math.max(...currentBook.chapters.map(c => c.id)) + 1 : 1;
    const newCh: NovelChapter = {
      id: newId,
      chapterNumber: newId,
      title: `Chapter ${newId}: New Chapter Title`,
      summary: 'Provide detailed plot analysis for this chapter...',
      keyThemes: ['Theme 1', 'Theme 2'],
      charactersInvolved: ['Character 1', 'Character 2'],
      sampleQuestions: [
        {
          question: 'Sample exam question based on this chapter?',
          options: ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'],
          correct: 'A',
          explanation: 'Official explanation for why option A is correct.'
        }
      ]
    };

    const updatedBooks = books.map(b => {
      if (b.id === selectedBookId) {
        return {
          ...b,
          chapters: [...b.chapters, newCh]
        };
      }
      return b;
    });

    setBooks(updatedBooks);
    setSelectedChapterId(newId);
    setEditingChapter(newCh);
    toast.success(`Created Chapter ${newId}`);
  };

  const openDeleteBookModal = (bk: LiteratureBook) => {
    setDeleteConfig({
      isOpen: true,
      title: 'Delete Entire Textbook',
      description: `Are you sure you want to permanently delete the textbook "${bk.title}" (${bk.genre || 'Novel'}) and all of its ${bk.chapters.length} chapter(s) and questions? This will be removed from student study access immediately.`,
      itemName: bk.title,
      type: 'book',
      targetBookId: bk.id,
      isDeleting: false
    });
  };

  const handleOpenEditBook = (bk: LiteratureBook) => {
    setEditBookTitle(bk.title);
    setEditBookAuthor(bk.author || '');
    setEditBookGenre(bk.genre || 'Compulsory UTME Novel');
    setEditBookDesc(bk.description || '');
    setEditBookPdfUrl(bk.pdfUrl || '');
    setEditBookModalOpen(true);
  };

  const handleSaveEditBook = async () => {
    if (!currentBook) return;
    if (!editBookTitle.trim()) {
      toast.error('Textbook title is required.');
      return;
    }

    const updatedBooks = books.map(b => {
      if (b.id === selectedBookId) {
        return {
          ...b,
          title: editBookTitle.trim(),
          author: editBookAuthor.trim(),
          genre: editBookGenre,
          description: editBookDesc.trim(),
          pdfUrl: editBookPdfUrl.trim() || undefined
        };
      }
      return b;
    });

    setSaving(true);
    const res = await saveJambBooks(updatedBooks);
    setSaving(false);
    if (res.success) {
      setBooks(updatedBooks);
      setEditBookModalOpen(false);
      logAdminActivity('UPDATE_LITERATURE_BOOK', `Updated textbook details for ${editBookTitle}`, 'literature_bank');
      toast.success('Textbook details updated and saved to live database!');
    } else {
      toast.error(`Failed to update textbook: ${res.error}`);
    }
  };

  const openDeleteChapterModal = (ch: NovelChapter) => {
    setDeleteConfig({
      isOpen: true,
      title: 'Delete Chapter',
      description: 'Are you sure you want to delete this chapter? All themes, character summaries, and practice questions inside this chapter will be permanently removed from Supabase.',
      itemName: ch.title,
      type: 'chapter',
      targetId: ch.id,
      isDeleting: false
    });
  };

  const openDeleteQuestionModal = (qIdx: number, questionText: string) => {
    setDeleteConfig({
      isOpen: true,
      title: 'Delete Literature Question',
      description: 'Are you sure you want to delete this question? This change will be saved to the database immediately.',
      itemName: questionText || `Question ${qIdx + 1}`,
      type: 'question',
      targetId: qIdx,
      isDeleting: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfig.type) return;

    setDeleteConfig(prev => ({ ...prev, isDeleting: true }));

    try {
      let updatedBooks = [...books];

      if (deleteConfig.type === 'book') {
        const bookIdToDelete = deleteConfig.targetBookId || selectedBookId;
        const targetBook = books.find(b => b.id === bookIdToDelete);
        updatedBooks = books.filter(b => b.id !== bookIdToDelete);

        if (updatedBooks.length === 0) {
          toast.error('Cannot delete all textbooks. At least one literature text must remain.');
          setDeleteConfig(prev => ({ ...prev, isOpen: false, isDeleting: false }));
          return;
        }

        const res = await saveJambBooks(updatedBooks);
        if (res.success) {
          setBooks(updatedBooks);
          const nextBook = updatedBooks[0];
          setSelectedBookId(nextBook.id);
          if (nextBook.chapters.length > 0) {
            setSelectedChapterId(nextBook.chapters[0].id);
            setEditingChapter({ ...nextBook.chapters[0] });
          } else {
            setEditingChapter(null);
          }
          logAdminActivity('DELETE_LITERATURE_BOOK', `Deleted textbook: ${targetBook?.title || bookIdToDelete}`, 'literature_bank');
          toast.success(`Textbook "${targetBook?.title || 'Book'}" deleted successfully from live database!`);
        } else {
          toast.error(`Deletion failed: ${res.error}`);
        }
      } else if (deleteConfig.type === 'chapter') {
        if (!currentBook || deleteConfig.targetId === undefined) return;
        const chId = deleteConfig.targetId;
        const updatedChapters = currentBook.chapters.filter(c => c.id !== chId);
        updatedBooks = books.map(b => {
          if (b.id === selectedBookId) {
            return { ...b, chapters: updatedChapters };
          }
          return b;
        });

        // Save to Supabase and localStorage immediately
        const res = await saveJambBooks(updatedBooks);
        if (res.success) {
          setBooks(updatedBooks);
          if (updatedChapters.length > 0) {
            setSelectedChapterId(updatedChapters[0].id);
            setEditingChapter({ ...updatedChapters[0] });
          } else {
            setEditingChapter(null);
          }
          toast.success('Chapter deleted from database successfully.');
        } else {
          toast.error(`Deletion failed: ${res.error}`);
        }
      } else if (deleteConfig.type === 'question') {
        if (!editingChapter || deleteConfig.targetId === undefined) return;
        const qIdx = deleteConfig.targetId;
        const updatedQs = editingChapter.sampleQuestions.filter((_, i) => i !== qIdx);
        
        const updatedChapter = { ...editingChapter, sampleQuestions: updatedQs };

        updatedBooks = books.map(b => {
          if (b.id === selectedBookId) {
            return {
              ...b,
              chapters: b.chapters.map(c => c.id === editingChapter.id ? updatedChapter : c)
            };
          }
          return b;
        });

        // Save to Supabase and localStorage immediately
        const res = await saveJambBooks(updatedBooks);
        if (res.success) {
          setEditingChapter(updatedChapter);
          setBooks(updatedBooks);
          toast.success('Question deleted from database successfully.');
        } else {
          toast.error(`Deletion failed: ${res.error}`);
        }
      }
    } catch (err: any) {
      toast.error(`Failed to delete: ${err?.message || 'Unknown error'}`);
    } finally {
      setDeleteConfig(prev => ({ ...prev, isOpen: false, isDeleting: false }));
    }
  };

  const handleToggleSelectAllQuestions = () => {
    if (!editingChapter || !editingChapter.sampleQuestions) return;
    if (selectedQuestionIndices.length >= editingChapter.sampleQuestions.length) {
      setSelectedQuestionIndices([]);
    } else {
      setSelectedQuestionIndices(editingChapter.sampleQuestions.map((_, i) => i));
    }
  };

  const handleToggleSelectQuestion = (idx: number) => {
    setSelectedQuestionIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleOpenBulkDeleteQuestions = () => {
    if (selectedQuestionIndices.length === 0) return;
    setBulkDeleteDialogConfig({
      isOpen: true,
      title: 'Mass Delete Practice Questions',
      description: `Are you sure you want to permanently delete all ${selectedQuestionIndices.length} selected question(s) from this chapter?`,
      type: 'questions',
      isDeleting: false
    });
  };

  const handleConfirmBulkDelete = async () => {
    setBulkDeleteDialogConfig(prev => ({ ...prev, isDeleting: true }));

    try {
      if (bulkDeleteDialogConfig.type === 'questions' && editingChapter && currentBook) {
        const remainingQuestions = editingChapter.sampleQuestions.filter((_, idx) => !selectedQuestionIndices.includes(idx));
        const updatedChapter = { ...editingChapter, sampleQuestions: remainingQuestions };
        const updatedChapters = currentBook.chapters.map(c => c.id === editingChapter.id ? updatedChapter : c);
        const updatedBooks = books.map(b => b.id === currentBook.id ? { ...b, chapters: updatedChapters } : b);

        if (navigator.onLine) {
          const res = await saveJambBooks(updatedBooks);
          if (res.success) {
            setEditingChapter(updatedChapter);
            setBooks(updatedBooks);
            logAdminActivity('BULK_DELETE_QUESTIONS', `Deleted ${selectedQuestionIndices.length} questions from ${editingChapter.title}`, 'literature_bank', { count: selectedQuestionIndices.length });
            toast.success(`Deleted ${selectedQuestionIndices.length} question(s) from chapter.`);
          } else {
            await queueOfflineOperation('literature_book', 'save_literature', { books: updatedBooks });
            toast.info('Saved mass deletion to offline queue.');
          }
        } else {
          await queueOfflineOperation('literature_book', 'save_literature', { books: updatedBooks });
          setEditingChapter(updatedChapter);
          setBooks(updatedBooks);
        }
        setSelectedQuestionIndices([]);
      }
    } catch (err: any) {
      toast.error(`Mass delete failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setBulkDeleteDialogConfig(prev => ({ ...prev, isOpen: false, isDeleting: false }));
    }
  };

  const handleAddQuestion = () => {
    if (!editingChapter) return;
    const newQ: NovelQuestion = {
      question: 'New UTME Novel Question?',
      options: ['A) First Option', 'B) Second Option', 'C) Third Option', 'D) Fourth Option'],
      correct: 'A',
      explanation: 'Detailed syllabus explanation.'
    };
    const updatedQs = [...editingChapter.sampleQuestions, newQ];
    handleUpdateChapterField('sampleQuestions', updatedQs);
    setEditingQuestion(newQ);
    toast.success('Added new question to chapter');
  };

  const handleSaveQuestion = (idx: number, updatedQ: NovelQuestion) => {
    if (!editingChapter) return;
    const updatedQs = editingChapter.sampleQuestions.map((q, i) => i === idx ? updatedQ : q);
    handleUpdateChapterField('sampleQuestions', updatedQs);
    toast.success('Question updated');
  };

  const handleDeleteQuestion = (idx: number) => {
    if (!editingChapter) return;
    const updatedQs = editingChapter.sampleQuestions.filter((_, i) => i !== idx);
    handleUpdateChapterField('sampleQuestions', updatedQs);
    toast.success('Question removed');
  };

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size exceeds 25MB limit.');
      return;
    }
    setUploadingPdf(true);
    
    try {
      const storageRes = await uploadTextbookFileToSupabaseStorage(file);
      if (storageRes.url) {
        setNewBookPdfUrl(storageRes.url);
        setUploadingPdf(false);
        toast.success(`Uploaded ${file.name} to Supabase Storage!`);
        return;
      }
    } catch {
      // Fallback to Data URL if storage fails or bucket is not provisioned
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setNewBookPdfUrl(dataUrl);
      setUploadingPdf(false);
      toast.success(`Attached ${file.name} successfully!`);
    };
    reader.onerror = () => {
      setUploadingPdf(false);
      toast.error('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const handleCreateBook = async () => {
    if (!newBookTitle.trim()) {
      toast.error('Please provide a textbook / novel title.');
      return;
    }

    const newId = newBookTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `book-${Date.now()}`;
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newBook: LiteratureBook = {
      id: newId,
      title: newBookTitle.trim(),
      author: newBookAuthor.trim() || 'Official JAMB Author',
      genre: newBookGenre as any,
      description: newBookDesc.trim() || 'Official UTME syllabus literature & textbook material.',
      coverColor: randomColor,
      fileDataUrl: newBookPdfUrl || undefined,
      chapters: [
        {
          id: 1,
          chapterNumber: 1,
          title: 'Chapter 1: Introductory Overview',
          summary: 'Detailed summary and syllabus plot overview for Chapter 1.',
          keyThemes: ['Core Plot Theme', 'Character Conflict'],
          charactersInvolved: ['Primary Protagonist', 'Supporting Character'],
          sampleQuestions: [
            {
              question: 'Which theme is predominantly explored in Chapter 1?',
              options: ['A) Courage & Integrity', 'B) Deception & Greed', 'C) Friendship & Loyalty', 'D) Academic Excellence'],
              correct: 'A',
              explanation: 'Official syllabus breakdown.'
            }
          ]
        }
      ]
    };

    const updatedBooks = [...books, newBook];
    setBooks(updatedBooks);
    setSelectedBookId(newBook.id);
    setSelectedChapterId(1);
    setEditingChapter(newBook.chapters[0]);

    // Persist
    await saveJambBooks(updatedBooks);
    toast.success(`Successfully added textbook "${newBook.title}" to Literature & Textbook Hub!`);

    // Reset Form
    setNewBookTitle('');
    setNewBookAuthor('');
    setNewBookGenre('Compulsory UTME Novel');
    setNewBookDesc('');
    setNewBookPdfUrl('');
    setAddBookModalOpen(false);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <p>Loading Literature and UTME Novel database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border border-border">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> JAMB Literature & Compulsory Novel Manager
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage compulsory UTME novels (The Life Changer), African/Non-African prose, drama texts, chapter breakdown, themes, and past questions.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => exportLiteratureToCSV(books, `JAMB_Literature_Bank_${Date.now()}.csv`)}
            className="text-xs font-semibold gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Export CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => exportLiteratureToPDF(books, `JAMB_Literature_Bank_${Date.now()}.pdf`)}
            className="text-xs font-semibold gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-red-500" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={loadBooks} disabled={saving}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => handleSaveAll()} disabled={saving} className="bg-primary hover:bg-primary/90 font-bold">
            <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving to Database...' : 'Save All Changes to Live DB'}
          </Button>
        </div>
      </div>

      {/* Literature Hub Lock Control Banner */}
      <div className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isLiteratureLocked 
          ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200' 
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
      }`}>
        <div className="flex items-start md:items-center gap-3">
          <div className={`p-2.5 rounded-lg shrink-0 ${
            isLiteratureLocked ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {isLiteratureLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">
                Literature Hub Access Status:
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                isLiteratureLocked ? 'bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              }`}>
                {isLiteratureLocked ? 'LOCKED FOR STUDENTS' : 'UNLOCKED (LIVE)'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLiteratureLocked 
                ? 'Students visiting the Literature Hub will see a maintenance notice while you verify JAMB prescribed texts.' 
                : 'Students have full access to study novels, plot summaries, and practice chapter drills.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <Input
            placeholder="Lock Reason (e.g. Updating 2026 JAMB Prescribed Texts)..."
            value={lockReason}
            onChange={e => setLockReason(e.target.value)}
            className="text-xs bg-background h-9 min-w-[260px]"
          />
          <Button
            size="sm"
            variant={isLiteratureLocked ? "default" : "destructive"}
            disabled={lockingInFlight}
            onClick={() => handleSaveLockStatus(!isLiteratureLocked)}
            className="text-xs font-bold shrink-0 gap-1.5"
          >
            {lockingInFlight ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : isLiteratureLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {isLiteratureLocked ? 'Unlock Hub for Students' : 'Lock Literature Hub'}
          </Button>
        </div>
      </div>

      {/* JAMB Mock CBT Integration Engine Card */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" /> JAMB Mock CBT Recommended Texts Integration Engine
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure whether questions from prescribed novels and literature texts automatically appear in the Full Mock CBT exams for Use of English & Literature in English.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleSaveRecConfig}
              disabled={savingRecConfig}
              className="bg-primary hover:bg-primary/90 text-xs font-bold gap-1.5 shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              {savingRecConfig ? 'Saving...' : 'Save CBT Exam Settings'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section 1: Use of English (Compulsory Novel) */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>Use of English: Compulsory Novel</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recConfig.includeNovelInEnglishMock}
                    onChange={(e) => setRecConfig(prev => ({ ...prev, includeNovelInEnglishMock: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <p className="text-xs text-muted-foreground">
                When enabled, the full mock exam for Use of English seamlessly includes questions directly from the active prescribed novel as Section A.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                    Questions Count in Mock
                  </label>
                  <Input
                    type="number"
                    min={5}
                    max={25}
                    value={recConfig.novelQuestionCountInEnglish}
                    onChange={(e) => setRecConfig(prev => ({ ...prev, novelQuestionCountInEnglish: Number(e.target.value) || 10 }))}
                    className="h-8 text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">Default: 10 Qs (Out of 60 total)</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                    Active Prescribed Novel
                  </label>
                  <select
                    value={recConfig.activeEnglishNovelId}
                    onChange={(e) => setRecConfig(prev => ({ ...prev, activeEnglishNovelId: e.target.value }))}
                    className="w-full h-8 text-xs font-semibold rounded-md border border-border bg-background px-2"
                  >
                    {books.map(b => (
                      <option key={b.id} value={b.id}>{b.title} ({b.genre})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-background/80 border border-border text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Structure: <strong>{recConfig.novelQuestionCountInEnglish} Novel Qs</strong> + <strong>{60 - recConfig.novelQuestionCountInEnglish} Grammar/Lexis Qs</strong></span>
                <span className="font-bold text-primary">= 60 Questions Total</span>
              </div>
            </div>

            {/* Section 2: Literature in English */}
            <div className="p-4 rounded-xl border border-secondary/20 bg-secondary/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Library className="w-4 h-4 text-primary" />
                  <span>Literature in English: Prescribed Texts</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recConfig.includePrescribedTextsInLitMock}
                    onChange={(e) => setRecConfig(prev => ({ ...prev, includePrescribedTextsInLitMock: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <p className="text-xs text-muted-foreground">
                Integrates African/Non-African prose, drama, and poetry questions into the Literature in English CBT mock.
              </p>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                  Prescribed Questions Count
                </label>
                <Input
                  type="number"
                  min={5}
                  max={30}
                  value={recConfig.litPrescribedQuestionCount}
                  onChange={(e) => setRecConfig(prev => ({ ...prev, litPrescribedQuestionCount: Number(e.target.value) || 15 }))}
                  className="h-8 text-xs font-bold max-w-[200px]"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">Default: 15 Qs (Out of 40 total)</span>
              </div>

              <div className="p-2.5 rounded-lg bg-background/80 border border-border text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Structure: <strong>{recConfig.litPrescribedQuestionCount} Prescribed Qs</strong> + <strong>{40 - recConfig.litPrescribedQuestionCount} Literary Appreciation Qs</strong></span>
                <span className="font-bold text-primary">= 40 Questions Total</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Book Tabs & Upload Button */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 no-scrollbar">
        <div className="flex gap-2 items-center flex-wrap">
          {books.map(bk => {
            const isSelected = selectedBookId === bk.id;
            return (
              <div key={bk.id} className="relative group flex items-center">
                <button
                  onClick={() => handleSelectBook(bk.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm pr-7'
                      : 'bg-card text-muted-foreground hover:text-foreground border-border pr-2'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{bk.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isSelected ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {bk.chapters.length} Chs
                  </span>
                </button>

                {/* Quick Delete icon directly on book tab */}
                {books.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteBookModal(bk);
                    }}
                    title={`Delete "${bk.title}"`}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-500 transition-colors ${
                      isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <Button 
          onClick={() => setAddBookModalOpen(true)} 
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 shrink-0 shadow-sm"
        >
          <Upload className="w-4 h-4" /> Add / Upload Textbook
        </Button>
      </div>

      {/* Active Textbook Details & Quick Action Bar */}
      {currentBook && (
        <div className="p-4 rounded-xl border border-border bg-card/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start md:items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground">
                  {currentBook.title}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-primary/15 text-primary">
                  {currentBook.genre || 'Compulsory UTME Novel'}
                </span>
                {currentBook.author && (
                  <span className="text-xs text-muted-foreground">
                    by <strong className="text-foreground">{currentBook.author}</strong>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {currentBook.description || 'No description recorded. Click Edit to add plot summary.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenEditBook(currentBook)}
              className="text-xs font-semibold gap-1.5 h-8 border-border hover:border-primary/40"
            >
              <Edit3 className="w-3.5 h-3.5 text-primary" /> Edit Textbook Details
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={() => openDeleteBookModal(currentBook)}
              className="text-xs font-bold gap-1.5 h-8 bg-red-600/90 hover:bg-red-600 text-white shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Textbook
            </Button>
          </div>
        </div>
      )}

      {/* Main Work Area */}
      {currentBook && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chapters Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" /> Chapters ({currentBook.chapters.length})
              </h3>
              <Button size="sm" variant="outline" onClick={handleAddNewChapter} className="h-7 text-xs font-bold gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Chapter
              </Button>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {currentBook.chapters.map(ch => (
                <div
                  key={ch.id}
                  onClick={() => handleSelectChapter(ch)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    editingChapter?.id === ch.id
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="text-[11px] font-bold text-primary uppercase">Ch {ch.chapterNumber || ch.id}</p>
                    <p className="text-xs font-semibold text-foreground truncate">{ch.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{ch.sampleQuestions?.length || 0} Questions</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-500/10 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteChapterModal(ch);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Chapter Details & Questions Editor */}
          <div className="lg:col-span-8 space-y-6">
            {editingChapter ? (
              <Card className="border-border bg-card">
                <CardHeader className="border-b border-border bg-muted/20 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-primary" /> Editing Chapter: {editingChapter.title}
                    </CardTitle>
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      {currentBook.title}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  {/* Title & Chapter Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-1 space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Chapter #</label>
                      <Input
                        type="number"
                        value={editingChapter.chapterNumber || editingChapter.id}
                        onChange={(e) => handleUpdateChapterField('chapterNumber', Number(e.target.value))}
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Chapter Title / Heading</label>
                      <Input
                        value={editingChapter.title}
                        onChange={(e) => handleUpdateChapterField('title', e.target.value)}
                        className="text-xs h-9 font-semibold"
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Comprehensive Plot Summary & Analysis</label>
                    <textarea
                      rows={5}
                      value={editingChapter.summary}
                      onChange={(e) => handleUpdateChapterField('summary', e.target.value)}
                      className="w-full text-xs p-3 rounded-lg bg-background border border-border text-foreground leading-relaxed focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Characters & Themes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Characters */}
                    <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
                      <label className="text-xs font-bold text-indigo-500 uppercase">Characters Involved</label>
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Add character (e.g. Salma)..."
                          value={newChar}
                          onChange={(e) => setNewChar(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCharacter()}
                          className="text-xs h-8 bg-background"
                        />
                        <Button size="sm" onClick={handleAddCharacter} className="h-8 text-xs font-bold">
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {editingChapter.charactersInvolved?.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-xs bg-muted text-foreground border border-border flex items-center gap-1 font-semibold">
                            {c}
                            <button onClick={() => handleRemoveCharacter(i)} className="text-red-400 hover:text-red-600">×</button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Themes */}
                    <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
                      <label className="text-xs font-bold text-purple-500 uppercase">Key Themes</label>
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Add theme (e.g. Integrity)..."
                          value={newTheme}
                          onChange={(e) => setNewTheme(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTheme()}
                          className="text-xs h-8 bg-background"
                        />
                        <Button size="sm" onClick={handleAddTheme} className="h-8 text-xs font-bold">
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {editingChapter.keyThemes?.map((t, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 flex items-center gap-1 font-semibold">
                            {t}
                            <button onClick={() => handleRemoveTheme(i)} className="text-red-400 hover:text-red-600">×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Chapter Practice Questions Section */}
                  <div className="space-y-4 pt-2 border-t border-border">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4" /> Practice Questions ({editingChapter.sampleQuestions?.length || 0})
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleToggleSelectAllQuestions}
                          className="h-7 text-xs font-bold gap-1"
                        >
                          {selectedQuestionIndices.length >= (editingChapter.sampleQuestions?.length || 0) && (editingChapter.sampleQuestions?.length || 0) > 0 ? (
                            <><CheckSquare className="w-3.5 h-3.5 text-primary" /> Deselect All</>
                          ) : (
                            <><Square className="w-3.5 h-3.5" /> Select All</>
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleOpenCustomQModal()} 
                          className="h-7 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> + Custom Question (Manual)
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setAiModalOpen(true);
                            setGeneratedQuestionsPreview([]);
                            setCustomAiText(editingChapter.summary || '');
                          }} 
                          className="h-7 text-xs font-bold gap-1 bg-gradient-to-r from-amber-600 to-primary hover:opacity-95 text-white shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> ⚡ Generate with AI
                        </Button>
                      </div>
                    </div>

                    {/* Questions Bulk Action Bar */}
                    {selectedQuestionIndices.length > 0 && (
                      <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <CheckSquare className="w-4 h-4" /> {selectedQuestionIndices.length} Question(s) Selected
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs font-semibold gap-1"
                            onClick={() => {
                              if (!editingChapter) return;
                              const selectedQs = editingChapter.sampleQuestions.filter((_, idx) => selectedQuestionIndices.includes(idx));
                              // Create mock book structure for selected questions export
                              const exportPayload = [{
                                id: currentBook?.id || 'book',
                                title: currentBook?.title || 'Book',
                                author: currentBook?.author || 'Author',
                                category: currentBook?.category || 'General',
                                chapters: [{ ...editingChapter, sampleQuestions: selectedQs }]
                              }];
                              exportLiteratureToCSV(exportPayload as LiteratureBook[], `Selected_Literature_Questions_${Date.now()}.csv`);
                            }}
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Export CSV
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs font-semibold gap-1"
                            onClick={() => {
                              if (!editingChapter) return;
                              const selectedQs = editingChapter.sampleQuestions.filter((_, idx) => selectedQuestionIndices.includes(idx));
                              const exportPayload = [{
                                id: currentBook?.id || 'book',
                                title: currentBook?.title || 'Book',
                                author: currentBook?.author || 'Author',
                                category: currentBook?.category || 'General',
                                chapters: [{ ...editingChapter, sampleQuestions: selectedQs }]
                              }];
                              exportLiteratureToPDF(exportPayload as LiteratureBook[], `Selected_Literature_Questions_${Date.now()}.pdf`);
                            }}
                          >
                            <FileText className="w-3.5 h-3.5 text-red-500" /> Export PDF
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs font-bold gap-1" onClick={handleOpenBulkDeleteQuestions}>
                            <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedQuestionIndices.length})
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedQuestionIndices([])}>
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {editingChapter.sampleQuestions?.length === 0 ? (
                        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                          No practice questions added to this chapter yet. Click "Add Question" above.
                        </div>
                      ) : isVirtualQuestionsView && (editingChapter.sampleQuestions?.length || 0) > 5 ? (
                        <VirtualList
                          items={editingChapter.sampleQuestions || []}
                          itemHeight={220}
                          containerHeight={500}
                          keyExtractor={(_, qIdx) => qIdx}
                          renderItem={(q, qIdx) => {
                            const isSelected = selectedQuestionIndices.includes(qIdx);
                            return (
                              <div className={`p-4 mb-3 rounded-xl border transition-colors space-y-3 ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-muted/30'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleSelectQuestion(qIdx)}
                                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                                    />
                                    <span className="text-xs font-bold text-primary font-mono">Q{qIdx + 1}.</span>
                                  </div>
                                  <Input
                                    value={q.question}
                                    onChange={(e) => {
                                      const updated = { ...q, question: e.target.value };
                                      handleSaveQuestion(qIdx, updated);
                                    }}
                                    className="text-xs font-bold bg-background h-8"
                                    placeholder="Enter JAMB style question..."
                                  />
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      title="Edit in Dialog"
                                      className="h-7 w-7 text-primary hover:bg-primary/10"
                                      onClick={() => handleOpenCustomQModal(q, qIdx)}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-500/10 shrink-0"
                                      onClick={() => openDeleteQuestionModal(qIdx, q.question)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Options */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                                    <div key={letter} className="flex items-center gap-1.5">
                                      <span className={`w-5 text-center text-xs font-bold ${q.correct === letter ? 'text-green-500' : 'text-muted-foreground'}`}>
                                        {letter})
                                      </span>
                                      <Input
                                        value={q.options[optIdx] || ''}
                                        onChange={(e) => {
                                          const opts = [...q.options];
                                          opts[optIdx] = e.target.value;
                                          handleSaveQuestion(qIdx, { ...q, options: opts });
                                        }}
                                        className="text-xs h-7 bg-background"
                                        placeholder={`Option ${letter}`}
                                      />
                                    </div>
                                  ))}
                                </div>

                                {/* Correct Answer & Explanation */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                                  <div className="sm:col-span-1 space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground">Correct Option</label>
                                    <select
                                      value={q.correct}
                                      onChange={(e) => handleSaveQuestion(qIdx, { ...q, correct: e.target.value })}
                                      className="w-full text-xs h-7 rounded border border-border bg-background px-2 font-bold text-green-500"
                                    >
                                      <option value="A">A</option>
                                      <option value="B">B</option>
                                      <option value="C">C</option>
                                      <option value="D">D</option>
                                    </select>
                                  </div>
                                  <div className="sm:col-span-3 space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground">Explanation / Syllabus Reference</label>
                                    <Input
                                      value={q.explanation}
                                      onChange={(e) => handleSaveQuestion(qIdx, { ...q, explanation: e.target.value })}
                                      className="text-xs h-7 bg-background"
                                      placeholder="Why this option is correct based on the novel..."
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                      ) : (
                        editingChapter.sampleQuestions?.map((q, qIdx) => {
                          const isSelected = selectedQuestionIndices.includes(qIdx);
                          return (
                            <div key={qIdx} className={`p-4 rounded-xl border transition-colors space-y-3 ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-muted/30'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectQuestion(qIdx)}
                                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                                  />
                                  <span className="text-xs font-bold text-primary font-mono">Q{qIdx + 1}.</span>
                                </div>
                                <Input
                                  value={q.question}
                                  onChange={(e) => {
                                    const updated = { ...q, question: e.target.value };
                                    handleSaveQuestion(qIdx, updated);
                                  }}
                                  className="text-xs font-bold bg-background h-8"
                                  placeholder="Enter JAMB style question..."
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-500/10 shrink-0"
                                  onClick={() => openDeleteQuestionModal(qIdx, q.question)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>

                              {/* Options */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                                  <div key={letter} className="flex items-center gap-1.5">
                                    <span className={`w-5 text-center text-xs font-bold ${q.correct === letter ? 'text-green-500' : 'text-muted-foreground'}`}>
                                      {letter})
                                    </span>
                                    <Input
                                      value={q.options[optIdx] || ''}
                                      onChange={(e) => {
                                        const opts = [...q.options];
                                        opts[optIdx] = e.target.value;
                                        handleSaveQuestion(qIdx, { ...q, options: opts });
                                      }}
                                      className="text-xs h-7 bg-background"
                                      placeholder={`Option ${letter}`}
                                    />
                                  </div>
                                ))}
                              </div>

                              {/* Correct Answer & Explanation */}
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                                <div className="sm:col-span-1 space-y-1">
                                  <label className="text-[10px] font-bold text-muted-foreground">Correct Option</label>
                                  <select
                                    value={q.correct}
                                    onChange={(e) => handleSaveQuestion(qIdx, { ...q, correct: e.target.value })}
                                    className="w-full text-xs h-7 rounded border border-border bg-background px-2 font-bold text-green-500"
                                  >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                  </select>
                                </div>
                                <div className="sm:col-span-3 space-y-1">
                                  <label className="text-[10px] font-bold text-muted-foreground">Explanation / Syllabus Reference</label>
                                  <Input
                                    value={q.explanation}
                                    onChange={(e) => handleSaveQuestion(qIdx, { ...q, explanation: e.target.value })}
                                    className="text-xs h-7 bg-background"
                                    placeholder="Why this option is correct based on the novel..."
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </CardContent>
              </Card>
            ) : (
              <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select a chapter from the list or click "Add Chapter" to edit content.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      <DeleteConfirmationDialog
        isOpen={deleteConfig.isOpen}
        onClose={() => setDeleteConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title={deleteConfig.title}
        description={deleteConfig.description}
        itemName={deleteConfig.itemName}
        isDeleting={deleteConfig.isDeleting}
      />

      {/* Mass Delete Confirmation Modal */}
      <DeleteConfirmationDialog
        isOpen={bulkDeleteDialogConfig.isOpen}
        onClose={() => setBulkDeleteDialogConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmBulkDelete}
        title={bulkDeleteDialogConfig.title}
        description={bulkDeleteDialogConfig.description}
        itemName={`${selectedQuestionIndices.length} Selected Questions`}
        isDeleting={bulkDeleteDialogConfig.isDeleting}
      />

      {/* Upload New Textbook / Novel Modal */}
      {addBookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" /> Add New Textbook / UTME Novel
              </h3>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setAddBookModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Book / Textbook Title *</label>
                <Input 
                  placeholder="e.g. UTME Senior Secondary Physics or The Life Changer" 
                  value={newBookTitle} 
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Author Name</label>
                  <Input 
                    placeholder="e.g. Khadija Abubakar Jalli" 
                    value={newBookAuthor} 
                    onChange={(e) => setNewBookAuthor(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Category / Genre</label>
                  <select 
                    value={newBookGenre}
                    onChange={(e) => setNewBookGenre(e.target.value)}
                    className="w-full text-sm h-10 rounded-md border border-input bg-background px-3 font-medium"
                  >
                    <option value="Compulsory UTME Novel">Compulsory UTME Novel</option>
                    <option value="Physics Textbook">Physics Textbook</option>
                    <option value="Chemistry Textbook">Chemistry Textbook</option>
                    <option value="Biology Textbook">Biology Textbook</option>
                    <option value="Mathematics Textbook">Mathematics Textbook</option>
                    <option value="Prose (African)">Prose (African)</option>
                    <option value="Prose (Non-African)">Prose (Non-African)</option>
                    <option value="Drama (African)">Drama (African)</option>
                    <option value="Poetry">Poetry</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Book Description / Plot Overview</label>
                <textarea 
                  rows={3} 
                  placeholder="Brief summary or description of the textbook/novel for students..."
                  value={newBookDesc}
                  onChange={(e) => setNewBookDesc(e.target.value)}
                  className="w-full text-xs rounded-md border border-input bg-background p-2.5 font-medium resize-none"
                />
              </div>

              <div className="border border-dashed border-border rounded-lg p-4 bg-muted/20 space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileUp className="w-4 h-4 text-primary" /> Attach Textbook File (PDF, ePub, or Text)
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Upload full PDF textbook or electronic document to allow students to read directly inside the portal.
                </p>
                <Input 
                  type="file" 
                  accept=".pdf,.txt,.epub" 
                  onChange={handlePdfFileChange} 
                  className="text-xs cursor-pointer"
                />
                {uploadingPdf && <p className="text-xs text-primary animate-pulse">Reading and attaching file...</p>}
                {newBookPdfUrl && <p className="text-xs font-bold text-emerald-500">File attached and ready for publish!</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setAddBookModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateBook} className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white">
                <Save className="w-4 h-4 mr-1.5" /> Publish to Library
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Textbook / Novel Details Modal */}
      {editBookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" /> Edit Textbook Details
              </h3>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditBookModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Book / Textbook Title *</label>
                <Input 
                  placeholder="e.g. UTME Senior Secondary Physics or The Life Changer" 
                  value={editBookTitle} 
                  onChange={(e) => setEditBookTitle(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Author Name</label>
                  <Input 
                    placeholder="e.g. Khadija Abubakar Jalli" 
                    value={editBookAuthor} 
                    onChange={(e) => setEditBookAuthor(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Category / Genre</label>
                  <select 
                    value={editBookGenre}
                    onChange={(e) => setEditBookGenre(e.target.value)}
                    className="w-full text-sm h-10 rounded-md border border-input bg-background px-3 font-medium"
                  >
                    <option value="Compulsory UTME Novel">Compulsory UTME Novel</option>
                    <option value="Physics Textbook">Physics Textbook</option>
                    <option value="Chemistry Textbook">Chemistry Textbook</option>
                    <option value="Biology Textbook">Biology Textbook</option>
                    <option value="Mathematics Textbook">Mathematics Textbook</option>
                    <option value="Prose (African)">Prose (African)</option>
                    <option value="Prose (Non-African)">Prose (Non-African)</option>
                    <option value="Drama (African)">Drama (African)</option>
                    <option value="Poetry">Poetry</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Book Description / Plot Overview</label>
                <textarea 
                  rows={3} 
                  placeholder="Brief summary or description of the textbook/novel for students..."
                  value={editBookDesc}
                  onChange={(e) => setEditBookDesc(e.target.value)}
                  className="w-full text-xs rounded-md border border-input bg-background p-2.5 font-medium resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Direct PDF / Textbook Document URL (Optional)</label>
                <Input 
                  placeholder="https://..." 
                  value={editBookPdfUrl} 
                  onChange={(e) => setEditBookPdfUrl(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-border">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => {
                  setEditBookModalOpen(false);
                  if (currentBook) openDeleteBookModal(currentBook);
                }}
                className="text-xs font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Book
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditBookModalOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveEditBook} disabled={saving} className="bg-primary hover:bg-primary/90 font-bold">
                  <Save className="w-4 h-4 mr-1.5" /> Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Custom Question Authoring Modal (Without AI) */}
      {customQModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-500" />
                  {editingCustomQIndex !== null ? 'Edit Question' : 'Create Custom Question (Without AI)'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Author your own personal JAMB-style question for "{currentBook?.title}".
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setCustomQModalOpen(false)} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Target Chapter / Section</label>
                <select
                  value={customQTargetChapterId}
                  onChange={(e) => setCustomQTargetChapterId(Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 font-semibold"
                >
                  {currentBook?.chapters.map(c => (
                    <option key={c.id} value={c.id}>Ch {c.chapterNumber || c.id}: {c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Reading Passage / Excerpt (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Paste excerpt or quote from the novel that students must read before answering..."
                  value={customQPassage}
                  onChange={(e) => setCustomQPassage(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2.5 font-medium resize-none"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Question Text *</label>
                <textarea
                  rows={2}
                  placeholder="e.g. What major event in Chapter 2 led to Talle's unexpected arrest in Lafayette?"
                  value={customQText}
                  onChange={(e) => setCustomQText(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2.5 font-medium resize-none font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Option A *</label>
                  <Input
                    placeholder="Enter Option A..."
                    value={customQOptionA}
                    onChange={(e) => setCustomQOptionA(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Option B *</label>
                  <Input
                    placeholder="Enter Option B..."
                    value={customQOptionB}
                    onChange={(e) => setCustomQOptionB(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Option C *</label>
                  <Input
                    placeholder="Enter Option C..."
                    value={customQOptionC}
                    onChange={(e) => setCustomQOptionC(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Option D *</label>
                  <Input
                    placeholder="Enter Option D..."
                    value={customQOptionD}
                    onChange={(e) => setCustomQOptionD(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Correct Option *</label>
                  <select
                    value={customQCorrect}
                    onChange={(e) => setCustomQCorrect(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 font-bold text-green-500"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-muted-foreground block mb-1">Pedagogical Explanation *</label>
                  <Input
                    placeholder="Why this answer is correct based on the prescribed text..."
                    value={customQExplanation}
                    onChange={(e) => setCustomQExplanation(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end items-center gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setCustomQModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveCustomManualQuestion} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save Question to Book
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Question Generation Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  Generate Questions with AI from Prescribed Text
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Synthesize authentic JAMB UTME questions using AI from "{currentBook?.title}".
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setAiModalOpen(false)} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Source Material</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAiTextSource('chapter')}
                      className={`flex-1 py-1.5 px-3 rounded-md font-bold border transition-colors ${
                        aiTextSource === 'chapter' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-muted-foreground'
                      }`}
                    >
                      Chapter Summary ({editingChapter?.title || 'Chapter'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiTextSource('custom')}
                      className={`flex-1 py-1.5 px-3 rounded-md font-bold border transition-colors ${
                        aiTextSource === 'custom' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-muted-foreground'
                      }`}
                    >
                      Upload / Paste Text
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Questions Count</label>
                    <select
                      value={aiQuestionCount}
                      onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                      className="w-full h-9 rounded-md border border-border bg-background px-3 font-semibold"
                    >
                      <option value={5}>5 Questions</option>
                      <option value={10}>10 Questions</option>
                      <option value={15}>15 Questions</option>
                      <option value={20}>20 Questions</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Question Focus</label>
                    <select
                      value={aiFocusType}
                      onChange={(e) => setAiFocusType(e.target.value)}
                      className="w-full h-9 rounded-md border border-border bg-background px-3 font-semibold"
                    >
                      <option value="comprehensive">JAMB Comprehensive Mix</option>
                      <option value="plot">Plot & Major Events</option>
                      <option value="characters">Character Analysis</option>
                      <option value="themes">Themes & Moral Lessons</option>
                      <option value="literary_devices">Literary Devices & Figures</option>
                    </select>
                  </div>
                </div>
              </div>

              {aiTextSource === 'custom' ? (
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Textbook Excerpt / Notes *</label>
                  <textarea
                    rows={4}
                    placeholder="Paste paragraphs or scenes from the textbook here for the AI to analyze..."
                    value={customAiText}
                    onChange={(e) => setCustomAiText(e.target.value)}
                    className="w-full rounded-md border border-input bg-background p-2.5 font-medium resize-none"
                  />
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="font-bold text-foreground mb-1">Current Chapter Summary Excerpt:</p>
                  <p className="text-muted-foreground italic line-clamp-3">
                    {editingChapter?.summary || 'No chapter summary recorded.'}
                  </p>
                </div>
              )}

              <Button
                onClick={handleRunAIGeneration}
                disabled={generatingAi}
                className="w-full bg-gradient-to-r from-primary to-amber-600 hover:opacity-90 text-white font-bold gap-2 h-10 shadow-sm"
              >
                {generatingAi ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Synthesizing JAMB Questions with AI...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate {aiQuestionCount} Questions</>
                )}
              </Button>

              {/* Preview Section */}
              {generatedQuestionsPreview.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Generated Questions Preview ({generatedQuestionsPreview.length})
                    </h4>
                    <Button
                      size="sm"
                      onClick={handleAddGeneratedQuestionsToBook}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" /> Save All to Book
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {generatedQuestionsPreview.map((gq, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-border bg-card space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-foreground">
                            <span className="text-primary font-mono mr-1">Q{idx + 1}.</span> {gq.question}
                          </p>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setGeneratedQuestionsPreview(prev => prev.filter((_, i) => i !== idx))}
                            className="h-6 w-6 text-red-400 hover:text-red-600 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {gq.passage && (
                          <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/40 pl-2">
                            "{gq.passage}"
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          {gq.options.map((opt, oIdx) => {
                            const letter = String.fromCharCode(65 + oIdx);
                            const isCorrect = gq.correct === letter;
                            return (
                              <div key={oIdx} className={`p-1.5 rounded border ${isCorrect ? 'border-emerald-500/50 bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-300' : 'border-border text-muted-foreground'}`}>
                                {opt}
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          <strong>Explanation:</strong> {gq.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setAiModalOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
