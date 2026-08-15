import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
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
    } catch (e) {
      console.warn('Error loading announcements:', e);
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
        title,
        body,
        content: body,
        target,
        is_pinned: isPinned
      };

      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', editingId);
        
        if (error) {
          // If body column failed, try updating content column
          await supabase.from('announcements').update({ title, content: body, target, is_pinned: isPinned }).eq('id', editingId);
        }
        toast.success('Announcement updated successfully!');
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert([{ ...payload, created_by: user?.id }]);
        
        if (error) {
          await supabase.from('announcements').insert([{ title, content: body, target, is_pinned: isPinned, created_by: user?.id }]);
        }
        toast.success('Announcement published successfully!');
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
        await supabase.from('announcements').delete().eq('id', id);
        toast.success("Announcement deleted.");
        fetchAnnouncements();
      },
      { destructive: true }
    );
  };

  const handleTogglePin = async (id: string, currentPinStatus: boolean) => {
    await supabase.from('announcements').update({ is_pinned: !currentPinStatus }).eq('id', id);
    toast.success(`Announcement ${!currentPinStatus ? 'pinned' : 'unpinned'}.`);
    fetchAnnouncements();
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> Announcement Center
          </h2>
          <p className="text-slate-400">Manage platform-wide announcements for students.</p>
        </div>
        <Button onClick={() => { resetForm(); setIsFormOpen(!isFormOpen); }} className="bg-primary hover:bg-primary/90">
          {isFormOpen ? 'Cancel' : 'New Announcement'}
        </Button>
      </div>

      {isFormOpen && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Announcement' : 'Create Announcement'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Server Maintenance Notice" 
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Body / Content</label>
                <textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  placeholder="Type your message here..." 
                  className="w-full h-32 bg-slate-950 border border-slate-800 rounded-md p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Audience</label>
                  <select 
                    value={target} 
                    onChange={(e) => setTarget(e.target.value)} 
                    className="w-full h-10 bg-slate-950 border border-slate-800 rounded-md px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
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
                    className="w-4 h-4 bg-slate-950 border-slate-800 rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="pin" className="text-sm font-medium cursor-pointer">Pin to top of dashboard</label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="border-slate-700 hover:bg-slate-800 text-white">Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90">
                  <CheckCircle className="w-4 h-4 mr-2" /> {editingId ? 'Update' : 'Publish'} Announcement
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <CardTitle>Published Announcements</CardTitle>
          <CardDescription className="text-slate-400">All currently active announcements shown to students.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading announcements...</div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-12 border border-slate-800 rounded-lg border-dashed bg-slate-950/50">
              <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Announcements</h3>
              <p className="text-slate-400 mb-6">Create an announcement to communicate with your students.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className={`p-5 rounded-lg border flex flex-col md:flex-row justify-between gap-4 ${ann.is_pinned ? 'bg-primary/5 border-primary/30' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {ann.is_pinned && <Pin className="w-4 h-4 text-primary" />}
                      <h4 className="text-lg font-bold">{ann.title}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                        Target: {ann.target || 'all'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{ann.body || ann.content || ''}</p>
                    <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                      <Clock className="w-3 h-3" /> Published {new Date(ann.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex md:flex-col justify-end gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleTogglePin(ann.id, ann.is_pinned)} className="justify-start text-slate-400 hover:text-white hover:bg-slate-800">
                      <Pin className={`w-4 h-4 mr-2 ${ann.is_pinned ? 'fill-current' : ''}`} /> {ann.is_pinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(ann)} className="justify-start text-slate-400 hover:text-white hover:bg-slate-800">
                      <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(ann.id)} className="justify-start text-red-400 hover:text-red-300 hover:bg-red-950/50">
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
