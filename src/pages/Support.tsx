import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Plus, Home, Send, CheckCircle, Paperclip } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function Support() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (profile) fetchTickets();
  }, [profile]);

  useEffect(() => {
    if (selectedTicket) {
      fetchReplies(selectedTicket.id);

      // Set up realtime subscription for this ticket
      const channel = supabase
        .channel(`ticket_${selectedTicket.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ticket_replies',
            filter: `ticket_id=eq.${selectedTicket.id}`
          },
          (payload) => {
            // Only add if not from ourselves (since we optimistically append or refetch on send)
            if (payload.new.sender_id !== profile?.id) {
              fetchReplies(selectedTicket.id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedTicket, profile]);

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', profile?.id)
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

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return;
    
    const { data: ticket, error } = await supabase.from('support_tickets').insert({
      user_id: profile?.id,
      subject
    }).select().single();

    if (error) {
      toast.error("Failed to create ticket.");
      return;
    }

    await supabase.from('ticket_replies').insert({
      ticket_id: ticket.id,
      sender_id: profile?.id,
      message
    });

    toast.success("Support ticket submitted!");
    setIsCreating(false);
    setSubject('');
    setMessage('');
    fetchTickets();
    setSelectedTicket(ticket);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("File must be less than 5MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText && !selectedFile) || !selectedTicket) return;
    
    setUploadingFile(true);
    let attachmentUrl = null;

    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${profile?.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('support-attachments')
        .upload(filePath, selectedFile);
        
      if (uploadError) {
        toast.error("Failed to upload attachment");
        setUploadingFile(false);
        return;
      }
      
      const { data } = supabase.storage.from('support-attachments').getPublicUrl(filePath);
      attachmentUrl = data.publicUrl;
    }

    const { error } = await supabase.from('ticket_replies').insert({
      ticket_id: selectedTicket.id,
      sender_id: profile?.id,
      message: replyText || 'Sent an attachment',
      attachment_url: attachmentUrl
    });

    if (error) {
      toast.error("Failed to send message.");
      setUploadingFile(false);
      return;
    }

    setReplyText('');
    setSelectedFile(null);
    setUploadingFile(false);
    fetchReplies(selectedTicket.id);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-6 md:p-10">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-primary" />
              Help & Support
            </h1>
            <p className="text-muted-foreground mt-2">
              Get direct assistance from the Scholars Resort team via support tickets or email at{' '}
              <a href="mailto:admitwise2@gmail.com" className="text-primary font-bold hover:underline">
                admitwise2@gmail.com
              </a>.
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" className="gap-2">
              <Home className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ticket List */}
          <Card className="md:col-span-1 border-border">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Your Tickets</CardTitle>
              <Button size="icon" variant="ghost" onClick={() => { setIsCreating(true); setSelectedTicket(null); }}>
                <Plus className="w-5 h-5" />
              </Button>
            </CardHeader>
            <div className="divide-y divide-border border-t border-border">
              {loading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : tickets.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No tickets found.</div>
              ) : (
                tickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => { setSelectedTicket(ticket); setIsCreating(false); }}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                  >
                    <h3 className="font-semibold text-sm line-clamp-1">{ticket.subject}</h3>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {ticket.status}
                      </span>
                      <span className="text-muted-foreground">{new Date(ticket.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Ticket View or Create Form */}
          <Card className="md:col-span-2 border-border h-[600px] flex flex-col">
            {isCreating ? (
              <>
                <CardHeader>
                  <CardTitle>Create New Ticket</CardTitle>
                  <CardDescription>We usually reply within 24 hours.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={createTicket} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <Input value={subject} onChange={e => setSubject(e.target.value)} required placeholder="Brief description of the issue" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Message</label>
                      <Textarea value={message} onChange={e => setMessage(e.target.value)} required rows={8} placeholder="Please provide details..." />
                    </div>
                    <Button type="submit" className="w-full gap-2">
                      <Send className="w-4 h-4" /> Submit Ticket
                    </Button>
                  </form>
                </CardContent>
              </>
            ) : selectedTicket ? (
              <>
                <CardHeader className="border-b border-border py-4 bg-muted/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{selectedTicket.subject}</CardTitle>
                      <CardDescription>Ticket ID: {selectedTicket.id.split('-')[0]}</CardDescription>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedTicket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {String(selectedTicket.status || 'OPEN').toUpperCase()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {replies.map(reply => {
                    const isAdmin = reply.profiles?.role === 'admin';
                    return (
                      <div key={reply.id} className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}>
                        <span className="text-xs text-muted-foreground mb-1">{isAdmin ? 'Support Team' : 'You'} - {new Date(reply.created_at).toLocaleTimeString()}</span>
                        <div className={`p-3 rounded-lg max-w-[80%] ${isAdmin ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                          <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                          {reply.attachment_url && (
                            <div className="mt-2">
                              {reply.attachment_url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                                <img src={reply.attachment_url} alt="Attachment" className="max-w-full h-auto rounded-md max-h-48 object-cover" />
                              ) : (
                                <a href={reply.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1">
                                  <Paperclip className="w-3.5 h-3.5" /> View Attachment
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
                {selectedTicket.status !== 'resolved' ? (
                  <div className="p-4 border-t border-border">
                    <form onSubmit={sendReply} className="flex gap-2">
                    <Input 
                      value={replyText} 
                      onChange={e => setReplyText(e.target.value)} 
                      placeholder="Type a message..." 
                      className="flex-1"
                      disabled={selectedTicket.status === 'resolved' || uploadingFile}
                    />
                    <div className="relative flex items-center">
                      <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        onChange={handleFileChange}
                        disabled={selectedTicket.status === 'resolved' || uploadingFile}
                        accept="image/*,.pdf,.doc,.docx"
                      />
                      <label 
                        htmlFor="file-upload" 
                        className={`p-2 rounded-md cursor-pointer hover:bg-muted ${selectedFile ? 'text-primary' : 'text-muted-foreground'}`}
                      >
                        <Paperclip className="w-5 h-5" />
                      </label>
                    </div>
                    <Button type="submit" disabled={selectedTicket.status === 'resolved' || uploadingFile || (!replyText && !selectedFile)} className="gap-2">
                      {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send
                    </Button>
                  </form>
                  {selectedFile && (
                    <div className="text-xs text-muted-foreground mt-1 flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Attached: {selectedFile.name}</span>
                      <button type="button" onClick={() => setSelectedFile(null)} className="text-red-500 hover:underline">Remove</button>
                    </div>
                  )}
                  </div>
                ) : (
                  <div className="p-4 border-t border-border bg-green-50 text-green-700 text-sm text-center flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> This ticket has been marked as resolved.
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a ticket or create a new one.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
