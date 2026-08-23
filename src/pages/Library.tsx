import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Search, Download, Lock, ChevronLeft, FileText, FileVideo, Globe, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { recordStudyAction } from '@/lib/streakService';
import { motion, AnimatePresence } from 'framer-motion';
import { LibrarySkeleton } from '@/components/library/LibrarySkeleton';
import { usePerfMonitoring } from '@/hooks/usePerfMonitoring';

const getFileIcon = (url: string) => {
  if (!url) return <FileText className="w-8 h-8 text-blue-500" />;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.pdf')) return <FileText className="w-8 h-8 text-red-500" />;
  if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm')) return <FileVideo className="w-8 h-8 text-purple-500" />;
  return <Globe className="w-8 h-8 text-blue-500" />;
};

const Library = () => {
  usePerfMonitoring('Library');
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubject, setActiveSubject] = useState<string>('All');
  const [subjects, setSubjects] = useState<string[]>(['All']);

  useEffect(() => {
    const fetchMaterials = async () => {
      setLoading(true);
      
      let libData: any[] = [];
      let matData: any[] = [];
      let jambNovels: any[] = [];

      try {
        const { data } = await supabase
          .from('library_materials')
          .select('*, subjects(name)')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (data) libData = data;
      } catch {}

      try {
        const { data } = await supabase
          .from('materials')
          .select('*, subjects(name)')
          .eq('visibility', true)
          .order('created_at', { ascending: false });
        if (data) matData = data;
      } catch {}

      let localMaterials: any[] = [];
      try {
        const localRaw = localStorage.getItem('scholar_local_materials');
        if (localRaw) localMaterials = JSON.parse(localRaw);
      } catch {}

      const combined: any[] = [];
      const seenTitles = new Set<string>();

      // Filter out known fake seed URLs like example.com
      const isValidMaterial = (item: any) => {
        const url = (item.file_url || item.file_path || '').trim();
        if (!url || url === 'https://example.com/math.pdf' || url === 'https://example.com/physics.pdf') return false;
        return true;
      };

      localMaterials.forEach(item => {
        if (item.title && isValidMaterial(item) && !seenTitles.has(item.title.toLowerCase().trim())) {
          seenTitles.add(item.title.toLowerCase().trim());
          combined.push({
            id: item.id,
            title: item.title,
            description: item.description,
            file_url: item.file_url || item.file_path,
            is_premium: item.is_premium,
            subjects: item.subjects || { name: 'General' },
            created_at: item.created_at || new Date().toISOString()
          });
        }
      });

      libData.forEach(item => {
        if (item.title && isValidMaterial(item) && !seenTitles.has(item.title.toLowerCase().trim())) {
          seenTitles.add(item.title.toLowerCase().trim());
          combined.push({
            id: item.id,
            title: item.title,
            description: item.description,
            file_url: item.file_url || item.file_path,
            is_premium: item.is_premium,
            subjects: item.subjects,
            created_at: item.created_at
          });
        }
      });

      matData.forEach(item => {
        if (item.title && isValidMaterial(item) && !seenTitles.has(item.title.toLowerCase().trim())) {
          seenTitles.add(item.title.toLowerCase().trim());
          const publicUrl = item.file_path?.startsWith('http')
            ? item.file_path
            : supabase.storage.from('materials').getPublicUrl(item.file_path || '').data.publicUrl;

          combined.push({
            id: item.id,
            title: item.title,
            description: item.description,
            file_url: publicUrl,
            is_premium: item.is_premium,
            subjects: item.subjects,
            created_at: item.created_at
          });
        }
      });

      setMaterials(combined);
      const uniqueSubjects = Array.from(new Set(combined.map(m => m.subjects?.name).filter(Boolean))) as string[];
      setSubjects(['All', ...uniqueSubjects]);
      setLoading(false);
    };

    fetchMaterials();

    const handleUpdated = (e?: any) => {
      console.log('[Library Sync] Mandatory Cache Invalidation & Refetch Triggered:', e?.detail || e || 'event');
      toast.info("Library content updated — loading fresh materials...", { duration: 1500 });
      fetchMaterials();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'library_last_updated') {
        console.log('[Library Storage Sync] Cross-tab update detected');
        handleUpdated();
      }
    };

    window.addEventListener('library_materials_updated', handleUpdated);
    window.addEventListener('supabase_library_revalidate', handleUpdated);
    window.addEventListener('storage', handleStorageChange);

    // Cross-tab BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('library_cache_invalidation');
        bc.onmessage = (msg) => {
          if (msg.data?.type === 'REFRESH_LIBRARY') {
            console.log('[Library BroadcastChannel Sync] Admin upload message received:', msg.data);
            handleUpdated(msg.data);
          }
        };
      } catch (bcErr) {
        console.warn('BroadcastChannel error:', bcErr);
      }
    }

    // Supabase Realtime listener for immediate cache refresh upon admin upload
    const channel = supabase
      .channel('public-library-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'library_materials' }, () => {
        console.log('[Supabase Realtime] library_materials updated');
        fetchMaterials();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'materials' }, () => {
        console.log('[Supabase Realtime] materials updated');
        fetchMaterials();
      })
      .subscribe();

    return () => {
      window.removeEventListener('library_materials_updated', handleUpdated);
      window.removeEventListener('supabase_library_revalidate', handleUpdated);
      window.removeEventListener('storage', handleStorageChange);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDownload = async (mat: any) => {
    if (mat.is_premium && !profile?.has_paid) {
      toast.error("Premium Resource", {
        description: "This material requires an active subscription.",
        action: { label: "Upgrade", onClick: () => navigate('/pricing') }
      });
      return;
    }

    try {
      toast.loading("Preparing secure link...", { id: `dl-${mat.id}` });
      
      if (mat.file_url.startsWith('http')) {
        window.open(mat.file_url, '_blank');
      } else {
        const { data, error } = await supabase.storage
          .from('library')
          .createSignedUrl(mat.file_url, 60 * 5); // 5 mins
          
        if (error || !data) throw error || new Error("Failed to generate link");
        window.open(data.signedUrl, '_blank');
      }
      
      toast.dismiss(`dl-${mat.id}`);
      toast.success("Resource opened!");

      // Log study action
      if (profile) {
        await recordStudyAction(profile.id, 'library');
      }
    } catch (err: any) {
      toast.dismiss(`dl-${mat.id}`);
      toast.error("Failed to access material. It might be missing from storage.");
    }
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.subjects?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = activeSubject === 'All' || m.subjects?.name === activeSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] -z-10" />

      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-6 sticky top-0 z-30 gap-4">
        <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold font-display flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" /> Digital Library
        </h1>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full z-10">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-display font-bold mb-2">Study Materials</h2>
            <p className="text-muted-foreground">Access premium textbooks, past questions, and lecture notes.</p>
          </div>
          <div className="relative w-full md:w-[400px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search resources, topics, or subjects (Cmd+K)" 
              className="pl-11 h-12 rounded-2xl bg-card border-border shadow-sm text-base"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-muted rounded p-1">
              <Filter className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Subject Filter Tabs */}
        {!loading && materials.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
            {subjects.map(subject => (
              <button
                key={subject}
                onClick={() => setActiveSubject(subject)}
                className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeSubject === subject 
                    ? 'bg-primary text-primary-foreground shadow-premium shadow-primary/20' 
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
        )}

        {/* Content Grid */}
        {loading ? (
           <LibrarySkeleton />
        ) : filteredMaterials.length === 0 ? (
           <div className="text-center py-20 bg-card/30 border border-dashed border-border rounded-3xl backdrop-blur-sm">
             <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
               <BookOpen className="w-10 h-10 text-muted-foreground opacity-50" />
             </div>
             <h3 className="text-2xl font-bold font-display mb-3">No resources found</h3>
             <p className="text-muted-foreground max-w-sm mx-auto">
               We couldn't find any materials matching your search criteria. Try a different keyword or subject.
             </p>
             <Button variant="outline" className="mt-6 rounded-xl" onClick={() => { setSearchTerm(''); setActiveSubject('All'); }}>
               Clear Filters
             </Button>
           </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredMaterials.map((mat) => (
                <motion.div
                  key={mat.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <Card className="group h-full bg-card/80 backdrop-blur-md border-border hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-premium hover:shadow-primary/10 overflow-hidden rounded-2xl flex flex-col">
                    <CardContent className="p-6 flex flex-col h-full relative">
                      {/* Premium Badge */}
                      {mat.is_premium && (
                        <div className="absolute top-4 right-4 bg-orange-500/10 text-orange-500 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 uppercase tracking-wider">
                          <Lock className="w-3 h-3" /> Premium
                        </div>
                      )}

                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center shrink-0 border border-border group-hover:scale-105 transition-transform duration-300">
                          {getFileIcon(mat.file_url)}
                        </div>
                        <div className="flex-1 mt-1">
                          <span className="text-xs font-semibold text-primary uppercase tracking-wider mb-1 block">
                            {mat.subjects?.name || 'General Resource'}
                          </span>
                          <h3 className="font-bold text-lg leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                            {mat.title}
                          </h3>
                        </div>
                      </div>

                      {mat.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">
                          {mat.description}
                        </p>
                      )}

                      <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Added {new Date(mat.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </span>
                        <Button 
                          onClick={() => handleDownload(mat)} 
                          variant={mat.is_premium && !profile?.has_paid ? "secondary" : "default"}
                          size="sm"
                          className="rounded-xl font-semibold px-4 shadow-none group-hover:shadow-premium transition-all"
                        >
                          {mat.is_premium && !profile?.has_paid ? (
                            <>Unlock <Lock className="w-3 h-3 ml-2" /></>
                          ) : (
                            <>Open <Download className="w-3 h-3 ml-2" /></>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Library;
