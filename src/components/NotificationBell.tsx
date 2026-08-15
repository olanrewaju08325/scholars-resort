import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Sparkles, Trophy, Zap, BookOpen, TrendingUp, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  action: string;
  metadata: {
    message?: string;
    score?: number;
    xp_earned?: number;
    coins_earned?: number;
    weak_topics?: string;
    recommendations?: Array<{ type: string; label: string }>;
  };
  created_at: string;
  read?: boolean;
}

const ICON_MAP: Record<string, any> = {
  ai_review_completed: Sparkles,
  badge_earned: Trophy,
  xp_awarded: Zap,
  study_plan_updated: BookOpen,
  exam_submitted: TrendingUp,
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase.channel(`notif_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev].slice(0, 20));
        setUnreadCount(c => c + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15);
    setNotifications(data || []);
    setUnreadCount((data || []).filter((n: any) => !n.read).length);
  };

  const markAllRead = async () => {
    setUnreadCount(0);
    // In a real implementation this would update a `read` column
  };

  const timeAgo = (iso: string) => {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        className="relative w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center hover:bg-muted/70 transition-all group"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-16 sm:fixed sm:left-auto sm:right-6 sm:top-16 sm:w-80 md:absolute md:right-0 md:left-auto md:top-12 md:w-96 bg-card text-card-foreground border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
            <div>
              <h3 className="font-bold text-sm">Notifications</h3>
              {unreadCount > 0 && <p className="text-xs text-muted-foreground">{unreadCount} unread</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n, i) => {
                const Icon = ICON_MAP[n.action] || Bell;
                const meta = n.metadata || {};
                return (
                  <div
                    key={n.id || i}
                    className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug text-foreground">
                          {meta.message || `New ${n.action?.replace(/_/g, ' ')}`}
                        </p>
                        {(meta.xp_earned || meta.coins_earned) && (
                          <div className="flex items-center gap-3 mt-1">
                            {meta.xp_earned && (
                              <span className="text-xs font-bold text-yellow-500 flex items-center gap-1">
                                <Zap className="w-3 h-3" /> +{meta.xp_earned} XP
                              </span>
                            )}
                            {meta.coins_earned && (
                              <span className="text-xs font-bold text-amber-500">
                                🪙 +{meta.coins_earned} coins
                              </span>
                            )}
                          </div>
                        )}
                        {meta.recommendations && meta.recommendations.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {meta.recommendations.slice(0, 2).map((r, ri) => (
                              <span key={ri} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                {r.label}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1.5">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
