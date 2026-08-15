import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ArrowLeft, ArrowRight, RotateCw, PlusCircle, Save, Trash2, Library, User as UserIcon, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { callGroqAPI } from '@/services/aiService';

interface Flashcard {
  id: string;
  front_text: string;
  back_text: string;
  user_id: string | null;
}

const Flashcards = () => {
  const { profile } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const { confirmAction, ConfirmElement } = useConfirm();
  
  const [isBuildingDeck, setIsBuildingDeck] = useState(false);
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  const [saving, setSaving] = useState(false);

  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [generatingAI, setGeneratingAI] = useState(false);

  const [deckFilter, setDeckFilter] = useState<'all' | 'global' | 'personal'>('all');

  const fetchCards = async () => {
    setLoading(true);
    let query = supabase.from('flashcards').select('*');
    
    if (deckFilter === 'global') {
      query = query.is('user_id', null);
    } else if (deckFilter === 'personal' && profile?.id) {
      query = query.eq('user_id', profile.id);
    }

    const { data, error } = await query;
    if (data && !error) {
      setCards(data);
    }
    setLoading(false);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  useEffect(() => {
    fetchCards();
  }, [deckFilter, profile]);

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 150);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleSaveCard = async () => {
    if (!newCardFront || !newCardBack || !profile?.id) return;
    setSaving(true);
    
    const { error } = await supabase.from('flashcards').insert({
      user_id: profile.id,
      front_text: newCardFront,
      back_text: newCardBack
    });
    
    if (!error) {
      setNewCardFront('');
      setNewCardBack('');
      setIsBuildingDeck(false);
      fetchCards();
      toast.success("Flashcard saved successfully!");
    } else {
      toast.error("Failed to save flashcard. Please run the SQL migration.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    confirmAction(
      "Delete Flashcard",
      "Delete this flashcard?",
      async () => {
        await supabase.from('flashcards').delete().eq('id', id);
        fetchCards();
        toast.success("Flashcard deleted");
      },
      { destructive: true }
    );
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim() || !profile) return;
    setGeneratingAI(true);
    toast.info(`Generating ${aiCount} flashcards for "${aiTopic}"...`);
    try {
      const prompt = `Generate exactly ${aiCount} high-yield JAMB UTME flashcard pairs for the topic: "${aiTopic}".
Return ONLY a valid JSON array matching this exact format:
[
  {"front": "Question or key term", "back": "Clear, direct definition or explanation"}
]
Do not wrap in markdown or backticks, just raw valid JSON.`;

      const text = await callGroqAPI([{ role: 'user', content: prompt }]);
      // Extract JSON from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI returned unexpected format');

      const generated: { front: string; back: string }[] = JSON.parse(jsonMatch[0]);

      // Save all generated cards to the database
      const inserts = generated.map(card => ({
        user_id: profile.id,
        front_text: card.front,
        back_text: card.back,
      }));

      const { error: insertError } = await supabase.from('flashcards').insert(inserts);
      if (insertError) throw insertError;

      toast.success(`${generated.length} AI flashcards generated and saved!`);
      setAiTopic('');
      setIsBuildingDeck(false);
      fetchCards();
    } catch (err: any) {
      toast.error('AI generation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setGeneratingAI(false);
    }
  };

  if (loading && cards.length === 0) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {ConfirmElement}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
        <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold font-display">
          <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-6 w-6 rounded-sm object-cover" />
          <span>Scholars Resort</span>
        </Link>
        <Button variant="ghost" asChild>
          <Link to="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-6 w-full max-w-4xl mx-auto">
        <div className="mb-8 text-center flex flex-col items-center w-full">
          <h1 className="text-3xl font-display font-bold flex items-center justify-center gap-2">
            <Layers className="text-primary h-8 w-8" /> Flashcards
          </h1>
          <p className="text-muted-foreground mt-2 mb-4">Master topics through spaced repetition.</p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 w-full">
             <div className="bg-muted p-1 rounded-lg flex items-center">
               <button 
                 className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${deckFilter === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                 onClick={() => setDeckFilter('all')}
               >
                 All Decks
               </button>
               <button 
                 className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${deckFilter === 'global' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                 onClick={() => setDeckFilter('global')}
               >
                 <Library className="w-4 h-4" /> Global
               </button>
               <button 
                 className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${deckFilter === 'personal' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                 onClick={() => setDeckFilter('personal')}
               >
                 <UserIcon className="w-4 h-4" /> Personal
               </button>
             </div>
             
             <Button onClick={() => setIsBuildingDeck(!isBuildingDeck)} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
               <PlusCircle className="w-4 h-4" /> {isBuildingDeck ? 'Cancel Builder' : 'Create Flashcard'}
             </Button>
          </div>
        </div>

        {isBuildingDeck ? (
          <div className="w-full max-w-lg bg-card border border-border p-6 rounded-xl space-y-4 shadow-sm">
            <div className="flex gap-2 bg-muted p-1 rounded-lg mb-4">
              <button
                id="tab-manual"
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${!aiTopic && !generatingAI ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setAiTopic('')}
              >Manual</button>
              <button
                id="tab-ai"
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1 ${aiTopic || generatingAI ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setAiTopic(' ')}
              ><Sparkles className="w-4 h-4 text-purple-400" /> AI Generate</button>
            </div>

            {(aiTopic !== '' && aiTopic !== undefined) ? (
              /* AI Generation Form */
              <div className="space-y-4">
                <h3 className="font-bold text-lg">AI Flashcard Generator</h3>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Topic or Subject</label>
                  <input
                    value={aiTopic.trim()}
                    onChange={(e) => setAiTopic(e.target.value)}
                    className="w-full bg-background border border-border rounded-md p-3 mt-1"
                    placeholder="e.g. Photosynthesis, Newton's Laws, Stoichiometry"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Number of Cards</label>
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-md p-3 mt-1"
                  >
                    {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} Cards</option>)}
                  </select>
                </div>
                <Button onClick={handleAIGenerate} disabled={generatingAI || !aiTopic.trim()} className="w-full gap-2">
                  {generatingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Generate Flashcards
                    </>
                  )}
                </Button>
              </div>
            ) : (
              /* Manual Form */
              <>
                <h3 className="font-bold text-lg mb-2">Create Personal Flashcard</h3>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Front (Question/Term)</label>
                  <textarea
                    value={newCardFront}
                    onChange={(e) => setNewCardFront(e.target.value)}
                    className="w-full h-20 bg-background border border-border rounded-md p-3 mt-1 resize-none"
                    placeholder="e.g. What is mitochondria?"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Back (Answer/Definition)</label>
                  <textarea
                    value={newCardBack}
                    onChange={(e) => setNewCardBack(e.target.value)}
                    className="w-full h-24 bg-background border border-border rounded-md p-3 mt-1 resize-none"
                    placeholder="e.g. The powerhouse of the cell."
                  />
                </div>
                <Button onClick={handleSaveCard} disabled={saving} className="w-full gap-2 bg-primary">
                  {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save to Deck</>}
                </Button>
              </>
            )}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-border rounded-lg text-muted-foreground w-full max-w-2xl mt-10">
            No flashcards found in this deck. 
            <br/><br/>
            {deckFilter === 'personal' ? "Click 'Create Flashcard' to add your own!" : "Check back later for new global cards."}
          </div>
        ) : (
          <div className="w-full max-w-2xl mt-4">
            {/* Flashcard Container */}
            <div 
              className="relative w-full h-[300px] perspective-1000 cursor-pointer"
              onClick={handleFlip}
            >
              <div 
                className={`absolute inset-0 w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Front */}
                <div 
                  className="absolute inset-0 w-full h-full bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-md backface-hidden"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                     <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${cards[currentIndex]?.user_id ? 'bg-purple-500/10 text-purple-500' : 'bg-primary/10 text-primary'}`}>
                       {cards[currentIndex]?.user_id ? 'Personal' : 'Global'}
                     </span>
                  </div>
                  {cards[currentIndex]?.user_id === profile?.id && (
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="absolute top-4 right-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
                       onClick={(e) => { e.stopPropagation(); handleDelete(cards[currentIndex].id); }}
                     >
                       <Trash2 className="w-4 h-4" />
                     </Button>
                  )}
                  <h2 className="text-2xl font-medium">{cards[currentIndex]?.front_text}</h2>
                  <div className="absolute bottom-4 right-4 text-primary/50">
                    <RotateCw className="h-5 w-5" />
                  </div>
                </div>

                {/* Back */}
                <div 
                  className="absolute inset-0 w-full h-full bg-primary text-primary-foreground rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-md backface-hidden rotate-y-180"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <span className="absolute top-4 left-4 text-xs font-bold text-primary-foreground/70 uppercase tracking-wider">Answer</span>
                  <p className="text-xl">{cards[currentIndex]?.back_text}</p>
                  <div className="absolute bottom-4 right-4 text-primary-foreground/50">
                    <RotateCw className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-8">
              <Button variant="outline" onClick={handlePrev} disabled={cards.length <= 1}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <span className="text-muted-foreground font-medium">
                {currentIndex + 1} / {cards.length}
              </span>
              <Button variant="outline" onClick={handleNext} disabled={cards.length <= 1}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Flashcards;
