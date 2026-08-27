import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Mail, Send, Users, History, Loader2, CheckCircle } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { sendEmailMessage } from '@/services/emailService';

export const BulkEmailTab = () => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [sending, setSending] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setLogs(data);
      } else {
        // Fallback to activity_logs if communication_logs is empty
        const { data: actData } = await supabase
          .from('activity_logs')
          .select('*')
          .ilike('action', '%broadcast%')
          .order('created_at', { ascending: false });
        
        if (actData) {
          setLogs(actData.map(a => ({
            id: a.id,
            subject: a.action,
            message: a.details || 'Broadcast notification',
            target: 'All Students',
            recipient_count: 1,
            created_at: a.created_at
          })));
        }
      }
    } catch (e) {
      console.warn('Error fetching logs:', e);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and Body are required.');
      return;
    }

    confirmAction(
      "Send Bulk Email",
      `Are you sure you want to send this email broadcast to target group: ${target}? This will reach registered students.`,
      async () => {
        setSending(true);
        try {
          const result = await sendEmailMessage({
            to: target,
            subject,
            body,
            target
          });
          
          toast.success(result.message);
          setSubject('');
          setBody('');
          setTarget('all');
          fetchLogs();
        } catch (err: any) {
          toast.error(`Broadcast failed: ${err.message}`);
        }
        setSending(false);
      }
    );
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary shrink-0" /> Bulk Email & Broadcast Center
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">Dispatch mass emails and notifications to students.</p>
        </div>
        <div className="flex gap-2 bg-slate-900 border border-slate-800 p-1 rounded-md shrink-0">
          <Button 
            variant={activeTab === 'compose' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('compose')}
            size="sm"
          >
            Compose
          </Button>
          <Button 
            variant={activeTab === 'history' ? 'default' : 'ghost'} 
            onClick={() => { setActiveTab('history'); fetchLogs(); }}
            size="sm"
          >
            History
          </Button>
        </div>
      </div>

      {activeTab === 'compose' ? (
        <Card className="bg-card text-card-foreground border-border min-w-0 w-full overflow-hidden">
          <CardHeader>
            <CardTitle>Compose Email</CardTitle>
            <CardDescription className="text-muted-foreground">Emails will be dispatched via SMTP and published to student dashboards.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4 min-w-0 w-full">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Audience</label>
                <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 border border-border rounded-md p-1 w-fit max-w-full">
                   <Users className="w-4 h-4 ml-2 shrink-0" />
                   <select 
                      value={target} 
                      onChange={(e) => setTarget(e.target.value)} 
                      className="bg-transparent border-none text-sm focus:ring-0 outline-none pr-4 text-foreground cursor-pointer"
                    >
                      <option value="all" className="bg-popover text-popover-foreground">All Registered Students</option>
                      <option value="paid" className="bg-popover text-popover-foreground">Premium Students Only (Paid)</option>
                      <option value="unpaid" className="bg-popover text-popover-foreground">Free Students Only (Unpaid)</option>
                    </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject Line</label>
                <Input 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  placeholder="e.g. New Mock Exams Now Available!" 
                  className="bg-muted/30 border-border"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Body (HTML supported)</label>
                <textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  placeholder="Dear Student,&#10;&#10;We are excited to announce our new UTME JAMB mock exams..." 
                  className="w-full h-64 bg-muted/30 border border-border rounded-md p-3 text-sm focus:ring-1 focus:ring-primary outline-none text-foreground"
                  required
                />
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={sending} className="bg-primary hover:bg-primary/90 w-full md:w-auto font-bold">
                  {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {sending ? 'Dispatching Broadcast...' : 'Send Bulk Broadcast'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card text-card-foreground border-border min-w-0 w-full overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Dispatch History</CardTitle>
            <CardDescription className="text-muted-foreground">Log of all previously sent bulk communications.</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
               <div className="text-center py-8 text-muted-foreground">No email history found.</div>
            ) : (
              <div className="space-y-3 min-w-0 w-full">
                {logs.map(log => (
                  <div key={log.id} className="p-4 bg-muted/30 border border-border rounded-lg flex flex-col md:flex-row justify-between gap-4 min-w-0 w-full">
                     <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="font-bold text-foreground truncate">{log.subject}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded uppercase font-medium">Target: {log.target}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{log.message}</p>
                     </div>
                     <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-primary">{log.recipient_count || 1} Recipients</div>
                        <div className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</div>
                     </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
