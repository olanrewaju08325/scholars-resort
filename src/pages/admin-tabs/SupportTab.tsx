import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, MessageSquare, CheckCircle, Send, Clock, User, Mail, Users, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { sendNotification } from '@/lib/notifications';

export const SupportTab = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'student' | 'guardian'>('student');
  
  // Student Tickets State
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');

  // Guardian Inquiries State
  const [guardianMessages, setGuardianMessages] = useState<any[]>([]);
  const [selectedGuardianMsg, setSelectedGuardianMsg] = useState<any>(null);
  const [guardianReply, setGuardianReply] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

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

  const fetchGuardianMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('guardian_messages')
      .select('*, guardian_student_relationships(student_id, profiles!student_id(full_name))')
      .order('created_at', { ascending: false });

    if (data) setGuardianMessages(data);
    setLoading(false);
  };

  useEffect(() => {
    if (activeView === 'student') {
      fetchTickets();
    } else {
      fetchGuardianMessages();
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView === 'student' && selectedTicket) {
      fetchReplies(selectedTicket.id);
    }
  }, [selectedTicket, activeView]);

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

  // ================= GUARDIAN INQUIRIES =================

  const resolveGuardianMsg = async (id: string, status: string) => {
    const { error } = await supabase.from('guardian_messages').update({ status }).eq('id', id);
    if (!error) {
      setGuardianMessages(guardianMessages.map(m => m.id === id ? { ...m, status } : m));
      if (selectedGuardianMsg?.id === id) setSelectedGuardianMsg({ ...selectedGuardianMsg, status });
      toast.success(`Inquiry marked as ${status}`);
    }
  };

  const sendGuardianEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianReply || !selectedGuardianMsg) return;
    
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke('communication-center', {
        body: {
          type: 'guardian_reply',
          email: selectedGuardianMsg.guardian_email,
          subject: `Re: ${selectedGuardianMsg.subject}`,
          message: guardianReply
        }
      });
      
      if (error) throw error;
      
      // Auto-resolve since we replied
      await resolveGuardianMsg(selectedGuardianMsg.id, 'resolved');
      toast.success("Email sent successfully");
      setGuardianReply('');
    } catch (err: any) {
      toast.error(`Failed to send email: ${err.message}`);
    }
    setSendingEmail(false);
  };

  const saveInternalNote = () => {
    if (!internalNote || !selectedGuardianMsg) return;
    toast.success("Internal note saved (mock DB).");
    setInternalNote('');
  };

  return (
    <div className="space-y-6 h-[700px] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">Support & Help Desk</h2>
          <p className="text-slate-400 text-xs sm:text-sm">Manage student tickets and guardian communications.</p>
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button 
            onClick={() => { setActiveView('student'); setSelectedTicket(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeView === 'student' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Student Tickets</div>
          </button>
          <button 
            onClick={() => { setActiveView('guardian'); setSelectedGuardianMsg(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeView === 'guardian' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Guardian Inquiries</div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        <Card className="md:col-span-1 bg-slate-900 border-slate-800 flex flex-col h-full overflow-hidden">
          <CardHeader className="py-4 border-b border-slate-800">
            <CardTitle className="text-lg">Inbox</CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : activeView === 'student' ? (
              tickets.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No tickets found.</div>
              ) : tickets.map(ticket => (
                <div 
                  key={ticket.id} 
                  onClick={() => setSelectedTicket(ticket)}
                  className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-slate-800 border-l-4 border-l-primary' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-sm line-clamp-1 text-slate-200">{ticket.profiles?.full_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      ticket.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 
                      ticket.status === 'open' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">{ticket.subject}</p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" /> {new Date(ticket.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              guardianMessages.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No guardian inquiries.</div>
              ) : guardianMessages.map(msg => (
                <div 
                  key={msg.id} 
                  onClick={() => setSelectedGuardianMsg(msg)}
                  className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-colors ${selectedGuardianMsg?.id === msg.id ? 'bg-slate-800 border-l-4 border-l-primary' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-sm line-clamp-1 text-slate-200">{msg.guardian_email}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      msg.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {msg.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">{msg.subject}</p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                    <User className="w-3 h-3" /> ref: {msg.profiles?.full_name || 'Unknown Student'}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="md:col-span-2 bg-slate-900 border-slate-800 flex flex-col h-full overflow-hidden text-slate-100">
          {activeView === 'student' && selectedTicket ? (
            <>
              <CardHeader className="border-b border-slate-800 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1 text-slate-400">
                    <User className="w-3 h-3" /> {selectedTicket.profiles?.full_name} ({selectedTicket.profiles?.email})
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedTicket.category === 'device_reset' && selectedTicket.status !== 'resolved' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={async () => {
                        try {
                          await supabase.from('profiles').update({ device_uuid: null }).eq('id', selectedTicket.user_id);
                          await updateStatus(selectedTicket.id, 'resolved');
                          await sendNotification(selectedTicket.user_id, "Device Reset Approved", "Your device pairing has been reset by an administrator. You may now log in on your new device.");
                          toast.success("Student device reset approved!");
                        } catch {
                          toast.error("Failed to reset student device.");
                        }
                      }} 
                      className="gap-2 text-amber-400 border-amber-900/30 hover:bg-amber-950 hover:text-amber-300"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve & Reset Device
                    </Button>
                  )}
                  {selectedTicket.status !== 'resolved' && (
                    <Button variant="outline" size="sm" onClick={() => updateStatus(selectedTicket.id, 'resolved')} className="gap-2 text-green-400 border-green-900/30 hover:bg-green-950 hover:text-green-300">
                      <CheckCircle className="w-4 h-4" /> Mark Resolved
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {replies.map(reply => {
                  const isAdmin = reply.profiles?.role === 'admin';
                  return (
                    <div key={reply.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                      <span className="text-xs text-slate-500 mb-1">{isAdmin ? 'You (Admin)' : selectedTicket.profiles?.full_name} - {new Date(reply.created_at).toLocaleTimeString()}</span>
                      <div className={`p-3 rounded-lg max-w-[80%] ${isAdmin ? 'bg-primary text-white' : 'bg-slate-800 text-slate-200'}`}>
                        <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
              {selectedTicket.status !== 'resolved' ? (
                <div className="p-4 border-t border-slate-800">
                  <form onSubmit={sendReply} className="flex gap-2">
                    <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type your reply..." className="flex-1 bg-slate-950 border-slate-800" />
                    <Button type="submit" className="bg-primary hover:bg-primary/90"><Send className="w-4 h-4" /></Button>
                  </form>
                </div>
              ) : (
                <div className="p-4 border-t border-slate-800 bg-green-500/10 text-green-400 text-sm text-center">
                  This ticket is resolved.
                </div>
              )}
            </>
          ) : activeView === 'guardian' && selectedGuardianMsg ? (
            <>
              <CardHeader className="border-b border-slate-800 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{selectedGuardianMsg.subject}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1 text-slate-400">
                    <Mail className="w-3 h-3" /> {selectedGuardianMsg.guardian_email} 
                    {selectedGuardianMsg.guardian_phone && ` • ${selectedGuardianMsg.guardian_phone}`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedGuardianMsg.status !== 'resolved' && (
                    <Button variant="outline" size="sm" onClick={() => resolveGuardianMsg(selectedGuardianMsg.id, 'resolved')} className="gap-2 text-green-400 border-green-900/30 hover:bg-green-950 hover:text-green-300">
                      <CheckCircle className="w-4 h-4" /> Mark Resolved
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="p-4 bg-slate-800 rounded-lg text-slate-200">
                  <div className="text-xs text-slate-400 mb-2 font-bold uppercase">Original Inquiry</div>
                  <p className="text-sm whitespace-pre-wrap">{selectedGuardianMsg.message}</p>
                </div>
                
                <div className="p-4 border border-dashed border-slate-700 rounded-lg bg-slate-950">
                  <div className="text-xs text-slate-500 mb-2 font-bold uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> Internal Notes</div>
                  <div className="flex gap-2">
                    <Input value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Add private note about this inquiry..." className="bg-slate-900 border-slate-800 h-8 text-sm" />
                    <Button onClick={saveInternalNote} size="sm" variant="outline" className="border-slate-700 hover:bg-slate-800">Save</Button>
                  </div>
                </div>
              </CardContent>
              {selectedGuardianMsg.status !== 'resolved' ? (
                <div className="p-4 border-t border-slate-800 bg-slate-950">
                   <div className="text-xs text-slate-400 mb-2 font-bold uppercase flex items-center gap-1"><Mail className="w-3 h-3" /> Reply via Email</div>
                  <form onSubmit={sendGuardianEmail} className="flex gap-2 flex-col">
                    <textarea 
                      value={guardianReply} 
                      onChange={e => setGuardianReply(e.target.value)} 
                      placeholder="Compose email reply to guardian..." 
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-md p-3 text-sm h-24 outline-none focus:ring-1 focus:ring-primary text-slate-200"
                    />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={sendingEmail} className="bg-blue-600 hover:bg-blue-700">
                        {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        Send Email Reply
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-4 border-t border-slate-800 bg-green-500/10 text-green-400 text-sm text-center">
                  This inquiry has been resolved.
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-500">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a {activeView === 'student' ? 'ticket' : 'message'} to view details.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
