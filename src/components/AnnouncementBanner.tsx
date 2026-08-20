import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Pin, X, ChevronRight, Bell, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export interface Announcement {
  id: string;
  title: string;
  body?: string;
  content?: string;
  target?: string;
  is_pinned?: boolean;
  priority?: string;
  created_at: string;
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('scholars_dismissed_announcements');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setAnnouncements(data.map(a => ({
          ...a,
          body: a.body || a.content || ''
        })));
      }
    } catch (e) {
      console.warn('Error fetching active announcements:', e);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();

    // Setup realtime subscription for new announcements
    let sub: any = null;
    try {
      sub = supabase
        .channel('public_announcements_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
          fetchAnnouncements();
        })
        .subscribe();
    } catch (err) {
      console.warn('Announcement realtime error:', err);
    }

    return () => {
      if (sub) {
        try {
          supabase.removeChannel(sub);
        } catch {}
      }
    };
  }, [fetchAnnouncements]);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem('scholars_dismissed_announcements', JSON.stringify(updated));
    } catch {}
  };

  const visibleAnnouncements = announcements.filter(a => !dismissedIds.includes(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <AnimatePresence>
        {visibleAnnouncements.slice(0, 3).map((ann) => (
          <motion.div
            key={ann.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={`relative overflow-hidden border-2 transition-all ${
              ann.is_pinned 
                ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 text-amber-100 shadow-lg shadow-amber-500/5' 
                : 'bg-card/90 backdrop-blur-sm border-primary/20 text-card-foreground hover:border-primary/40'
            }`}>
              <CardContent className="p-4 flex items-start gap-3 justify-between">
                <div className="flex items-start gap-3 flex-1 cursor-pointer" onClick={() => setSelectedAnnouncement(ann)}>
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    ann.is_pinned ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/10 text-primary'
                  }`}>
                    {ann.is_pinned ? <Pin className="w-5 h-5 animate-pulse" /> : <Megaphone className="w-5 h-5" />}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm sm:text-base leading-snug">{ann.title}</span>
                      {ann.is_pinned && (
                        <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] uppercase font-bold tracking-wider">
                          Official Announcement
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {new Date(ann.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {ann.body}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                    onClick={(e) => handleDismiss(ann.id, e)}
                    title="Dismiss Announcement"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Modal Dialog for full announcement text */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedAnnouncement(null)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full text-slate-100 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-6 h-6 text-primary" />
                <div>
                  <h3 className="font-bold text-lg text-white">{selectedAnnouncement.title}</h3>
                  <p className="text-xs text-slate-400">
                    Published on {new Date(selectedAnnouncement.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAnnouncement(null)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </Button>
            </div>

            <div className="py-2 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
              {selectedAnnouncement.body}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <Button onClick={() => setSelectedAnnouncement(null)} className="bg-primary hover:bg-primary/90 text-white">
                Close Announcement
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
