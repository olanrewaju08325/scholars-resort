import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, MessageSquare, CheckCircle, Send, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { sendNotification } from '@/lib/notifications';

export const SupportTab = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Student Tickets State
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');

  // ================= STUDENT TICKETS =================
  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });
    
    if (data) setTickets(data);
    setLoading(false);
  };

  const fetchReplies = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_replies')
      .select('*, profiles(full_name, role)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    
    if (data) setReplies(data);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      fetchReplies(selectedTicket.id);
    }
  }, [selectedTicket]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText || !selectedTicket) return;

    const { error } = await supabase.from('ticket_replies').insert({
      ticket_id: selectedTicket.id,
      sender_id: profile?.id,
      message: replyText
    });

    if (error) {
      toast.error("Failed to send message.");
      return;
    }

    await sendNotification(selectedTicket.user_id, "New Support Reply", `Admin has replied to your ticket: ${selectedTicket.subject}`);

    if (selectedTicket.status === 'open') {
      await updateStatus(selectedTicket.id, 'pending');
    }

    setReplyText('');
    fetchReplies(selectedTicket.id);
  };

  const updateStatus = async (ticketId: string, status: string) => {
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', ticketId);
    if (!error) {
      setTickets(tickets.map(t => t.id === ticketId ? { ...t, status } : t));
      if (selectedTicket?.id === ticketId) setSelectedTicket({ ...selectedTicket, status });
      toast.success(`Ticket marked as ${status}`);
    } else {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6 h-[700px] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">Support & Help Desk</h2>
          <p className="text-slate-400 text-xs sm:text-sm">Manage student support tickets and help inquiries.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        <Card className="md:col-span-1 bg-slate-900 border-slate-800 flex flex-col h-full overflow-hidden">
          <CardHeader className="py-4 border-b border-slate-800">
            <CardTitle className="text-lg">Student Tickets</CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No tickets found.</div>
            ) : tickets.map(ticket => (
              <div 
                key={ticket.id} 
                onClick={() => setSelectedTicket(ticket)}
                className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-slate-800 border-l-4 border-l-primary' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-sm line-clamp-1 text-slate-200">{ticket.profiles?.full_name || 'Anonymous Student'}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    ticket.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 
                    ticket.status === 'open' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium line-clamp-1 mb-1">{ticket.subject}</p>
                <span className="text-[10px] text-slate-500">{new Date(ticket.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Ticket Details Panel */}
        <Card className="md:col-span-2 bg-slate-900 border-slate-800 flex flex-col h-full overflow-hidden">
          {selectedTicket ? (
            <>
              <CardHeader className="border-b border-slate-800 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1 text-slate-400">
                    <User className="w-3 h-3" /> {selectedTicket.profiles?.full_name} ({selectedTicket.profiles?.email})
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedTicket.status !== 'resolved' && (
                    <Button variant="outline" size="sm" onClick={() => updateStatus(selectedTicket.id, 'resolved')} className="gap-2 text-green-400 border-green-900/30 hover:bg-green-950 hover:text-green-300">
                      <CheckCircle className="w-4 h-4" /> Mark Resolved
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700/50">
                  <div className="text-xs text-slate-400 font-bold mb-1 uppercase">Initial Message</div>
                  <p className="text-sm text-slate-200">{selectedTicket.message}</p>
                </div>
                <div className="space-y-3 pt-2">
                  {replies.map(reply => (
                    <div key={reply.id} className={`p-3 rounded-lg text-sm max-w-[80%] ${reply.profiles?.role === 'admin' ? 'bg-primary/20 border border-primary/30 ml-auto' : 'bg-slate-800 border border-slate-700'}`}>
                      <div className="text-[10px] text-slate-400 mb-1 flex justify-between gap-4 font-semibold">
                        <span>{reply.profiles?.full_name || (reply.profiles?.role === 'admin' ? 'Support Admin' : 'User')}</span>
                        <span>{new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-200">{reply.message}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
              {selectedTicket.status !== 'resolved' ? (
                <div className="p-4 border-t border-slate-800 bg-slate-950">
                  <form onSubmit={sendReply} className="flex gap-2">
                    <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type your reply..." className="flex-1 bg-slate-950 border-slate-800 text-slate-200" />
                    <Button type="submit" className="bg-primary hover:bg-primary/90"><Send className="w-4 h-4" /></Button>
                  </form>
                </div>
              ) : (
                <div className="p-4 border-t border-slate-800 bg-green-500/10 text-green-400 text-sm text-center font-medium">
                  This ticket is resolved.
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-500">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a ticket to view details.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
