import { useState, useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, PlayCircle, Trophy, Home, Calculator, Target, BookMarked, ArrowRight, Timer, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);
  const navigate = useNavigate();

  // Fetch materials for quick search
  useEffect(() => {
    const fetchMaterials = async () => {
      const { data } = await supabase
        .from('library_materials')
        .select('id, title, file_url, subjects(name)')
        .eq('is_active', true)
        .limit(10);
      if (data) setMaterials(data);
    };
    fetchMaterials();
  }, []);

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] sm:pt-[20vh]">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={() => setOpen(false)}
      />
      <Command 
        className="relative z-[101] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 mx-4"
        shouldFilter={false}
      >
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
          <Command.Input 
            autoFocus
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:ring-0 text-lg border-none"
            placeholder="Type a command or search..." 
            value={search}
            onValueChange={setSearch}
          />
          <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground ml-2">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-[300px] overflow-y-auto p-2 scroll-smooth">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          <Command.Group heading="Quick Navigation" className="px-2 text-xs font-medium text-muted-foreground mb-2">
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/dashboard'))}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground cursor-pointer hover:bg-muted aria-selected:bg-muted"
            >
              <Home className="h-4 w-4" />
              <span>Dashboard</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/practice'))}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground cursor-pointer hover:bg-muted aria-selected:bg-muted"
            >
              <PlayCircle className="h-4 w-4" />
              <span>Practice Area</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/library'))}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground cursor-pointer hover:bg-muted aria-selected:bg-muted"
            >
              <BookOpen className="h-4 w-4" />
              <span>Digital Library</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/leaderboard'))}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground cursor-pointer hover:bg-muted aria-selected:bg-muted"
            >
              <Trophy className="h-4 w-4" />
              <span>Leaderboard</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/cbt'))}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground cursor-pointer hover:bg-muted aria-selected:bg-muted"
            >
              <Timer className="h-4 w-4" />
              <span>CBT Testing Center</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/plan'))}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground cursor-pointer hover:bg-muted aria-selected:bg-muted"
            >
              <CalendarDays className="h-4 w-4" />
              <span>Study Plan</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Quick Actions" className="px-2 text-xs font-medium text-muted-foreground mt-4 mb-2">
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/cbt'))}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground cursor-pointer hover:bg-muted aria-selected:bg-muted"
            >
              <Target className="h-4 w-4 text-orange-500" />
              <span>Start Mock Exam</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/weakness'))}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground cursor-pointer hover:bg-muted aria-selected:bg-muted"
            >
              <Calculator className="h-4 w-4 text-blue-500" />
              <span>Start Weakness Drill</span>
            </Command.Item>
          </Command.Group>

          {materials.length > 0 && (
            <Command.Group heading="Library Materials (Recent)" className="px-2 text-xs font-medium text-muted-foreground mt-4 mb-2">
              {materials.filter(m => m.title.toLowerCase().includes(search.toLowerCase())).map(mat => (
                <Command.Item 
                  key={mat.id}
                  onSelect={() => runCommand(() => window.open(mat.file_url, '_blank'))}
                  className="flex items-center justify-between rounded-lg px-3 py-3 text-sm text-foreground cursor-pointer hover:bg-muted aria-selected:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <BookMarked className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span>{mat.title}</span>
                      <span className="text-[10px] text-muted-foreground">{mat.subjects?.name}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
};
