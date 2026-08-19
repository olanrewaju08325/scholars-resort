import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Plus, Trash2, Edit3, Save, RefreshCw, HelpCircle, Layers, Bookmark } from 'lucide-react';
import { fetchJambBooks, saveJambBooks } from '@/services/novelService';
import type { LiteratureBook, NovelChapter, NovelQuestion } from '@/data/jambNovelsData';
import { toast } from 'sonner';

export const AdminLiteratureTab = () => {
  const [books, setBooks] = useState<LiteratureBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('the-life-changer');
  const [selectedChapterId, setSelectedChapterId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State for active chapter
  const [editingChapter, setEditingChapter] = useState<NovelChapter | null>(null);
  const [newTheme, setNewTheme] = useState('');
  const [newChar, setNewChar] = useState('');
  
  // Question Form State
  const [editingQuestion, setEditingQuestion] = useState<NovelQuestion | null>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const data = await fetchJambBooks();
      setBooks(data);
      if (data.length > 0) {
        setSelectedBookId(data[0].id);
        if (data[0].chapters.length > 0) {
          setSelectedChapterId(data[0].chapters[0].id);
          setEditingChapter({ ...data[0].chapters[0] });
        }
      }
    } catch (err) {
      toast.error('Failed to load literature books');
    } finally {
      setLoading(false);
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

  const handleDeleteChapter = (chId: number) => {
    if (!currentBook) return;
    if (confirm('Are you sure you want to delete this chapter?')) {
      const updatedChapters = currentBook.chapters.filter(c => c.id !== chId);
      const updatedBooks = books.map(b => {
        if (b.id === selectedBookId) {
          return { ...b, chapters: updatedChapters };
        }
        return b;
      });
      setBooks(updatedBooks);
      if (updatedChapters.length > 0) {
        setSelectedChapterId(updatedChapters[0].id);
        setEditingChapter(updatedChapters[0]);
      } else {
        setEditingChapter(null);
      }
      toast.success('Chapter removed');
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadBooks} disabled={saving}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => handleSaveAll()} disabled={saving} className="bg-primary hover:bg-primary/90 font-bold">
            <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving to Database...' : 'Save All Changes to Live DB'}
          </Button>
        </div>
      </div>

      {/* Book Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {books.map(bk => (
          <button
            key={bk.id}
            onClick={() => handleSelectBook(bk.id)}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${
              selectedBookId === bk.id
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground border-border'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{bk.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-mono">
              {bk.chapters.length} Chs
            </span>
          </button>
        ))}
      </div>

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
                      handleDeleteChapter(ch.id);
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
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4" /> Practice Questions for this Chapter ({editingChapter.sampleQuestions?.length || 0})
                      </h4>
                      <Button size="sm" onClick={handleAddQuestion} className="h-7 text-xs font-bold gap-1 bg-primary">
                        <Plus className="w-3.5 h-3.5" /> Add Question
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {editingChapter.sampleQuestions?.map((q, qIdx) => (
                        <div key={qIdx} className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-primary font-mono">Q{qIdx + 1}.</span>
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
                              onClick={() => handleDeleteQuestion(qIdx)}
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
                      ))}
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
    </div>
  );
};
