import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export function NotificationsMenu() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
      
      // Subscribe to real-time notifications
      const sub = supabase
        .channel('notifications_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => {
          fetchNotifications();
        })
        .subscribe();

      return () => { supabase.removeChannel(sub); };
    }
  }, [profile, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile?.id).eq('is_read', false);
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-10 w-10 rounded-full bg-card hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-in zoom-in">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mr-4 mt-2 border-border shadow-2xl rounded-xl overflow-hidden" align="end">
        <div className="bg-muted/50 p-4 border-b border-border flex items-center justify-between">
          <h4 className="font-bold">Notifications</h4>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
              <Bell className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`p-4 cursor-pointer transition-colors hover:bg-muted/30 ${!n.is_read ? 'bg-primary/5' : ''}`}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h5 className={`text-sm ${!n.is_read ? 'font-bold' : 'font-medium'}`}>{n.title}</h5>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1"></span>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
