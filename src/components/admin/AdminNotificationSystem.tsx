import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, CheckCircle, MessageSquare, CreditCard, AlertCircle, AlertTriangle,
  ExternalLink, Trash2, CheckCheck, RefreshCw, Volume2, VolumeX, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface AdminAlert {
  id: string;
  type: 'issue' | 'payment' | 'system';
  title: string;
  description: string;
  created_at: string;
  is_read: boolean;
  raw_id: string;
  metadata?: Record<string, any>;
}

interface AdminNotificationSystemProps {
  onNavigate?: (module: string) => void;
  compact?: boolean;
}

export function AdminNotificationSystem({ onNavigate, compact = false }: AdminNotificationSystemProps) {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filter, setFilter] = useState<'all' | 'issue' | 'payment' | 'system'>('all');

  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio context play blocked or unsupported
    }
  }, [soundEnabled]);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch open support tickets (student reported issues)
      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(15);

      // 2. Fetch pending manual payments (student payment proofs)
      const { data: payments } = await supabase
        .from('manual_payments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(15);

      // 3. Fetch system health capacity warnings
      const { data: sysLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'SYSTEM_CAPACITY_ALERT')
        .order('created_at', { ascending: false })
        .limit(10);

      const ticketAlerts: AdminAlert[] = (tickets || []).map(t => ({
        id: `ticket_${t.id}`,
        type: 'issue',
        title: `Issue Reported: ${t.subject || t.title || 'Student Support Ticket'}`,
        description: t.message || t.description || 'A student submitted a new support report.',
        created_at: t.created_at,
        is_read: false,
        raw_id: t.id,
        metadata: t
      }));

      const paymentAlerts: AdminAlert[] = (payments || []).map(p => ({
        id: `payment_${p.id}`,
        type: 'payment',
        title: `Payment Proof: ₦${Number(p.amount || 0).toLocaleString()}`,
        description: `Plan: ${p.plan || 'Subscription'} | Ref: ${p.reference || p.bank_name || 'Bank Transfer'}`,
        created_at: p.created_at,
        is_read: false,
        raw_id: p.id,
        metadata: p
      }));

      const systemAlerts: AdminAlert[] = (sysLogs || []).map(s => ({
        id: `system_${s.id}`,
        type: 'system',
        title: `System Capacity Alert`,
        description: s.details || 'Database, storage or SMTP usage exceeded the safety threshold.',
        created_at: s.created_at,
        is_read: false,
        raw_id: s.id,
        metadata: s
      }));

      const merged = [...ticketAlerts, ...paymentAlerts, ...systemAlerts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setAlerts(merged);
    } catch (e) {
      console.warn('Admin notification fetch warning:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    // Setup Realtime Channels for instant alerts
    let ticketsChannel: any = null;
    let paymentsChannel: any = null;

    try {
      const chanSuffix = Math.random().toString(36).substring(2, 7);
      
      ticketsChannel = supabase
        .channel(`admin_tickets_${chanSuffix}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'support_tickets' },
          (payload) => {
            const newTicket = payload.new;
            playChime();
            toast.info(`New Student Issue Reported!`, {
              description: newTicket.subject || 'A student submitted a support request.',
              action: {
                label: 'View Support',
                onClick: () => onNavigate?.('support')
              }
            });
            fetchAlerts();
          }
        )
        .subscribe();

      paymentsChannel = supabase
        .channel(`admin_payments_${chanSuffix}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'manual_payments' },
          (payload) => {
            const newPayment = payload.new;
            playChime();
            toast.warning(`New Payment Proof Submitted!`, {
              description: `Amount: ₦${Number(newPayment.amount || 0).toLocaleString()}`,
              action: {
                label: 'Verify Payment',
                onClick: () => onNavigate?.('payments')
              }
            });
            fetchAlerts();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Admin realtime subscription warning:', err);
    }

    return () => {
      if (ticketsChannel) supabase.removeChannel(ticketsChannel);
      if (paymentsChannel) supabase.removeChannel(paymentsChannel);
    };
  }, [fetchAlerts, playChime, onNavigate]);

  const unreadCount = alerts.filter(a => !a.is_read).length;

  const markAsRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  };

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    toast.success('All notifications marked as read.');
  };

  const handleAlertAction = (alertItem: AdminAlert) => {
    markAsRead(alertItem.id);
    if (alertItem.type === 'issue') {
      if (onNavigate) onNavigate('support');
    } else if (alertItem.type === 'payment') {
      if (onNavigate) onNavigate('payments');
    } else if (alertItem.type === 'system') {
      if (onNavigate) onNavigate('system_health');
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'issue') return a.type === 'issue';
    if (filter === 'payment') return a.type === 'payment';
    if (filter === 'system') return a.type === 'system';
    return true;
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative h-10 w-10 rounded-full bg-card hover:bg-muted border-border transition-all shadow-sm"
          title="Admin Alerts & Notifications"
        >
          <Bell className="w-5 h-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full animate-bounce shadow-md">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent 
        className="w-96 p-0 border border-border shadow-2xl rounded-2xl overflow-hidden bg-card text-card-foreground z-[100]" 
        align="end" 
        sideOffset={8}
      >
        {/* Header */}
        <div className="bg-slate-900 text-slate-100 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-sm">Admin Dispatch Alerts</h4>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-bold">
                {unreadCount} New
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title={soundEnabled ? "Mute audio chime" : "Enable audio chime"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              onClick={fetchAlerts}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Refresh alerts"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-2 bg-muted/30 border-b border-border text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`py-1 px-2 rounded-md transition-colors text-center shrink-0 ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('issue')}
            className={`py-1 px-2 rounded-md transition-colors text-center flex items-center justify-center gap-1 shrink-0 ${filter === 'issue' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <MessageSquare className="w-3 h-3" /> Issues ({alerts.filter(a => a.type === 'issue').length})
          </button>
          <button
            onClick={() => setFilter('payment')}
            className={`py-1 px-2 rounded-md transition-colors text-center flex items-center justify-center gap-1 shrink-0 ${filter === 'payment' ? 'bg-amber-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <CreditCard className="w-3 h-3" /> Payments ({alerts.filter(a => a.type === 'payment').length})
          </button>
          <button
            onClick={() => setFilter('system')}
            className={`py-1 px-2 rounded-md transition-colors text-center flex items-center justify-center gap-1 shrink-0 ${filter === 'system' ? 'bg-red-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <AlertTriangle className="w-3 h-3" /> Quotas ({alerts.filter(a => a.type === 'system').length})
          </button>
        </div>

        {/* Alert Items List */}
        <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              Scanning for active alerts...
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <CheckCircle className="w-8 h-8 text-emerald-500/50" />
              <p className="text-sm font-medium">No pending dispatch alerts</p>
              <p className="text-xs text-muted-foreground">All support issues, payments & system health are optimal.</p>
            </div>
          ) : (
            filteredAlerts.map((alertItem) => (
              <div 
                key={alertItem.id}
                className={`p-3.5 transition-colors flex items-start gap-3 hover:bg-muted/40 ${!alertItem.is_read ? 'bg-primary/5' : ''}`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  alertItem.type === 'issue' 
                    ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                    : alertItem.type === 'payment'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                }`}>
                  {alertItem.type === 'issue' ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : alertItem.type === 'payment' ? (
                    <CreditCard className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className={`text-xs ${!alertItem.is_read ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'} truncate`}>
                      {alertItem.title}
                    </h5>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {new Date(alertItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {alertItem.description}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleAlertAction(alertItem)}
                      className="h-6 px-2 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1"
                    >
                      {alertItem.type === 'issue' ? 'Respond in Support' : alertItem.type === 'payment' ? 'Review Financials' : 'Manage System Health'}
                      <ExternalLink className="w-3 h-3" />
                    </Button>

                    {!alertItem.is_read && (
                      <button 
                        onClick={() => markAsRead(alertItem.id)}
                        className="text-[10px] text-muted-foreground hover:text-foreground font-medium underline"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
          </span>
          {unreadCount > 0 && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={markAllAsRead}
              className="h-7 text-xs font-semibold gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
              Mark All Read
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
