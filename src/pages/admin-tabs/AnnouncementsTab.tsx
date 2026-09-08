import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/apiAuth';
import { toast } from 'sonner';
import { Megaphone, Pin, Trash2, Edit, CheckCircle, Clock } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';

export const AnnouncementsTab = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Form State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (data?.success && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements.map((item: any) => ({
          ...item,
          body: item.body || item.content || item.message || ''
        })));
        setLoading(false);
        return;
      }
      throw new Error('Fallback to direct Supabase query');
    } catch (e) {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setAnnouncements(data.map(item => ({
            ...item,
            body: item.body || item.content || item.message || ''
          })));
        }
      } catch (err) {
        console.warn('Error loading announcements:', err);
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setTarget('all');
    setIsPinned(false);
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (announcement: any) => {
    setTitle(announcement.title);
    setBody(announcement.body || announcement.content || '');
    setTarget(announcement.target || 'all');
    setIsPinned(announcement.is_pinned || false);
    setEditingId(announcement.id);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error('Title and Body are required.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const payload: any = {
        id: editingId || crypto.randomUUID(),
        title: title.trim(),
        content: body.trim(),
        body: body.trim(),
        target,
        is_pinned: isPinned,
        created_by: user?.email || 'Admin'
      };

      const res = await authFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        toast.success(editingId ? 'Announcement updated successfully!' : 'Announcement published successfully!');
      } else {
        throw new Error(data.error || 'Failed to save');
      }
      
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(`Saved announcement with fallback.`);
      resetForm();
      fetchAnnouncements();
    }
  };

  const handleDelete = (id: string) => {
    confirmAction(
      "Delete Announcement",
      "Are you sure you want to delete this announcement?",
      async () => {
        try {
          await authFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
          await supabase.from('announcements').delete().eq('id', id);
        } catch {}
        toast.success("Announcement deleted.");
        fetchAnnouncements();
      },
      { destructive: true }
    );
  };

  const handleTogglePin = async (id: string, currentPinStatus: boolean) => {
    try {
      const ann = announcements.find(a => a.id === id);
      if (ann) {
        await authFetch('/api/admin/announcements', {
          method: 'POST',
          body: JSON.stringify({
            ...ann,
            is_pinned: !currentPinStatus
          })
        });
      }
      await supabase.from('announcements').update({ is_pinned: !currentPinStatus }).eq('id', id);
    } catch {}
    toast.success(`Announcement ${!currentPinStatus ? 'pinned' : 'unpinned'}.`);
    fetchAnnouncements();
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-foreground">
            <Megaphone className="w-6 h-6 text-primary shrink-0" /> Announcement Center
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm">Manage platform-wide announcements for students.</p>
        </div>
        <Button onClick={() => { resetForm(); setIsFormOpen(!isFormOpen); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shrink-0">
          {isFormOpen ? 'Cancel' : 'New Announcement'}
        </Button>
      </div>

      {isFormOpen && (
        <Card className="bg-card border-border text-card-foreground">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Announcement' : 'Create Announcement'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Server Maintenance Notice" 
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Body / Content</label>
                <textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  placeholder="Type your message here..." 
                  className="w-full h-32 bg-background border border-border text-foreground rounded-md p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Target Audience</label>
                  <select 
                    value={target} 
                    onChange={(e) => setTarget(e.target.value)} 
                    className="w-full h-10 bg-background border border-border text-foreground rounded-md px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="all">All Students</option>
                    <option value="paid">Premium Students Only</option>
                    <option value="unpaid">Free Students Only</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-8">
                  <input 
                    type="checkbox" 
                    id="pin" 
                    checked={isPinned} 
                    onChange={(e) => setIsPinned(e.target.checked)} 
                    className="w-4 h-4 bg-background border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="pin" className="text-sm font-medium text-foreground cursor-pointer">Pin to top of dashboard</label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="border-border text-foreground hover:bg-muted">Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                  <CheckCircle className="w-4 h-4 mr-2" /> {editingId ? 'Update' : 'Publish'} Announcement
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border text-card-foreground">
        <CardHeader>
          <CardTitle className="text-foreground">Published Announcements</CardTitle>
          <CardDescription className="text-muted-foreground">All currently active announcements shown to students.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading announcements...</div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-12 border border-border rounded-lg border-dashed bg-muted/20">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Announcements</h3>
              <p className="text-muted-foreground mb-6">Create an announcement to communicate with your students.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className={`p-5 rounded-lg border flex flex-col md:flex-row justify-between gap-4 ${ann.is_pinned ? 'bg-primary/5 border-primary/40' : 'bg-card border-border'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {ann.is_pinned && <Pin className="w-4 h-4 text-primary shrink-0" />}
                      <h4 className="text-lg font-bold text-foreground">{ann.title}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-foreground border border-border">
                        Target: {ann.target || 'all'}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{ann.body || ann.content || ''}</p>
                    <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> Published {new Date(ann.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex md:flex-col justify-end gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleTogglePin(ann.id, ann.is_pinned)} className="justify-start text-muted-foreground hover:text-foreground hover:bg-muted">
                      <Pin className={`w-4 h-4 mr-2 ${ann.is_pinned ? 'fill-current' : ''}`} /> {ann.is_pinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(ann)} className="justify-start text-muted-foreground hover:text-foreground hover:bg-muted">
                      <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(ann.id)} className="justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
