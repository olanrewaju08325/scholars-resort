import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Book, FileText, Bookmark, X, Users, Trophy, HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ type: string, id: string, title: string, subtitle?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (query.length > 2) {
      const search = async () => {
        setLoading(true);
        const searchQuery = `%${query}%`;
        const tempResults: any[] = [];

        try {
          // Search Subjects
          const { data: subjects } = await supabase.from('subjects').select('id, name').ilike('name', searchQuery).limit(3);
          if (subjects) subjects.forEach(s => tempResults.push({ type: 'subject', id: s.id, title: s.name, subtitle: 'Subject' }));

          // Search Topics
          const { data: topics } = await supabase.from('topics').select('id, name, subjects(name)').ilike('name', searchQuery).limit(3);
          if (topics) topics.forEach((t: any) => tempResults.push({ type: 'topic', id: t.id, title: t.name, subtitle: `Topic in ${t.subjects?.name}` }));

          // Search Library
          const { data: library } = await supabase.from('library_materials').select('id, title, type').ilike('title', searchQuery).limit(3);
          if (library) library.forEach((l: any) => tempResults.push({ type: 'library', id: l.id, title: l.title, subtitle: `Library ${l.type}` }));

          // Search Profiles (Users)
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').ilike('full_name', searchQuery).limit(3);
          if (profiles) profiles.forEach((p: any) => tempResults.push({ type: 'user', id: p.id, title: p.full_name, subtitle: `User (${p.role})` }));

          // Search Tournaments
          const { data: tournaments } = await supabase.from('tournaments').select('id, title, status').ilike('title', searchQuery).limit(3);
          if (tournaments) tournaments.forEach((t: any) => tempResults.push({ type: 'tournament', id: t.id, title: t.title, subtitle: `Tournament (${t.status})` }));

          // Search Questions
          const { data: questions } = await supabase.from('questions').select('id, question_text, subjects(name)').ilike('question_text', searchQuery).limit(3);
          if (questions) questions.forEach((q: any) => tempResults.push({ type: 'question', id: q.id, title: q.question_text.substring(0, 50) + '...', subtitle: `Question in ${q.subjects?.name || 'Unknown'}` }));

          setResults(tempResults);
        } catch (e) {
          console.error(e);
        }
        setLoading(false);
      };
      
      const debounce = setTimeout(search, 300);
      return () => clearTimeout(debounce);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleSelect = (result: any) => {
    setIsOpen(false);
    setQuery('');
    if (result.type === 'library') navigate('/library');
    else if (result.type === 'subject') navigate('/practice');
    else if (result.type === 'topic') navigate('/practice');
    else if (result.type === 'tournament') navigate('/tournaments');
    else if (result.type === 'user') navigate('/admin');
    else if (result.type === 'question') navigate('/admin');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      <div className="bg-card w-full max-w-xl border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input 
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for subjects, topics, or materials..." 
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-lg p-0 h-auto shadow-none"
          />
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-muted rounded-md text-muted-foreground">
             <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>}
          
          {!loading && query.length > 2 && results.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No results found for "{query}".
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="p-2 space-y-1">
              {results.map((r, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center justify-between p-3 rounded-md hover:bg-primary/10 hover:text-primary transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    {r.type === 'subject' && <Book className="w-4 h-4 text-muted-foreground group-hover:text-primary" />}
                    {r.type === 'topic' && <Bookmark className="w-4 h-4 text-muted-foreground group-hover:text-primary" />}
                    {r.type === 'library' && <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary" />}
                    {r.type === 'user' && <Users className="w-4 h-4 text-muted-foreground group-hover:text-primary" />}
                    {r.type === 'tournament' && <Trophy className="w-4 h-4 text-muted-foreground group-hover:text-primary" />}
                    {r.type === 'question' && <HelpCircle className="w-4 h-4 text-muted-foreground group-hover:text-primary" />}
                    
                    <div>
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="text-[10px] text-muted-foreground group-hover:text-primary/70">{r.subtitle}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {!query && (
            <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 border-t border-border">
              Tip: Press <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border">Esc</kbd> to close
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
