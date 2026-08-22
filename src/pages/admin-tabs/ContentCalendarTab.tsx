import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, Plus, Clock, Trash2, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';

export const ContentCalendarTab = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState('exam');
  const [scheduledAt, setScheduledAt] = useState('');

  // View State (simple month view simulation)
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const fetchEvents = async () => {
    setLoading(true);
    // Fetch mock exams that have a start_time
    const { data: exams, error: examsError } = await supabase
      .from('mock_exams')
      .select('id, title, start_time');

    // Fetch announcements
    const { data: anns, error: annsError } = await supabase
      .from('announcements')
      .select('id, title, created_at');

    let combined: any[] = [];
    
    if (exams && !examsError) {
      combined = [...combined, ...exams
        .filter(e => e.start_time)
        .map(e => ({ id: e.id, title: e.title, date: new Date(e.start_time), type: 'exam', original: e }))
      ];
    }
    
    if (anns && !annsError) {
      combined = [...combined, ...anns
        .filter(a => a.created_at)
        .map(a => ({ id: a.id, title: a.title, date: new Date(a.created_at), type: 'announcement', original: a }))
      ];
    }

    combined.sort((a, b) => a.date.getTime() - b.date.getTime());
    setEvents(combined);
    setLoading(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) return;

    try {
      if (type === 'exam') {
        const { error } = await supabase.from('mock_exams').insert({
          title,
          start_time: new Date(scheduledAt).toISOString(),
          is_active: false // Needs manual activation or cron to activate
        });
        if (error) throw error;
      } else if (type === 'announcement') {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('announcements').insert({
          title,
          body: 'Scheduled Announcement',
          target: 'all',
          publish_at: new Date(scheduledAt).toISOString(),
          created_by: user?.id
        });
        if (error) throw error;
      }
      
      toast.success('Event scheduled successfully!');
      setTitle('');
      setScheduledAt('');
      setIsFormOpen(false);
      fetchEvents();
    } catch (err: any) {
      toast.error(`Error scheduling event: ${err.message}`);
    }
  };

  const handleDelete = (id: string, eventType: string) => {
    confirmAction(
      "Delete Event",
      "Are you sure you want to cancel this scheduled event?",
      async () => {
        try {
          if (eventType === 'exam') {
            await supabase.from('mock_exams').delete().eq('id', id);
          } else {
            await supabase.from('announcements').delete().eq('id', id);
          }
          toast.success("Event cancelled.");
          fetchEvents();
        } catch (err: any) {
          toast.error("Failed to cancel event.");
        }
      },
      { destructive: true }
    );
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" /> Content Calendar
          </h2>
          <p className="text-slate-400">Schedule mock exams, tournaments, and platform announcements.</p>
        </div>
        <Button onClick={() => setIsFormOpen(!isFormOpen)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Schedule Event
        </Button>
      </div>

      {isFormOpen && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle>Schedule New Event</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Event Title</label>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Weekly National Mock" 
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value)} 
                  className="w-full h-10 bg-slate-950 border border-slate-800 rounded-md px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="exam">Mock Exam</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date & Time</label>
                <Input 
                  type="datetime-local"
                  value={scheduledAt} 
                  onChange={(e) => setScheduledAt(e.target.value)} 
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
              <div className="col-span-full flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="border-slate-700 hover:bg-slate-800 text-white">Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90">Schedule</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900 border-slate-800 text-slate-100 min-h-[500px]">
        <CardHeader className="flex flex-row justify-between items-center border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="hover:bg-slate-800"><ChevronLeft className="w-5 h-5"/></Button>
            <CardTitle className="text-xl">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="hover:bg-slate-800"><ChevronRight className="w-5 h-5"/></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-slate-400 uppercase">{day}</div>
            ))}
          </div>
          
          <div className="divide-y divide-slate-800/50">
            {loading ? (
              <div className="p-12 text-center text-slate-500">Loading calendar...</div>
            ) : events.filter(e => e.date.getMonth() === currentDate.getMonth() && e.date.getFullYear() === currentDate.getFullYear()).length === 0 ? (
              <div className="p-12 text-center text-slate-500 italic">No events scheduled for this month.</div>
            ) : (
              <div className="p-4 space-y-4">
                {events
                  .filter(e => e.date.getMonth() === currentDate.getMonth() && e.date.getFullYear() === currentDate.getFullYear())
                  .map(event => (
                  <div key={event.id} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center bg-slate-900 rounded-md w-14 h-14 border border-slate-800">
                        <span className="text-xs text-slate-400 font-bold uppercase">{event.date.toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-xl font-bold text-white">{event.date.getDate()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${event.type === 'exam' ? 'bg-blue-500' : 'bg-purple-500'}`}></span>
                          <h4 className="font-bold text-slate-200">{event.title}</h4>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          <span className="uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{event.type}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-950/50" onClick={() => handleDelete(event.id, event.type)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
