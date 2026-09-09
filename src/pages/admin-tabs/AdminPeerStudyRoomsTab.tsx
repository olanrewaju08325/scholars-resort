import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Video, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  Flame, 
  Radio, 
  X,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { StudyRoomMeta } from '@/types/studyRoomTypes';

export const AdminPeerStudyRoomsTab: React.FC = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<StudyRoomMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  
  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<StudyRoomMeta | null>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    title: '',
    subject: 'Use of English',
    hostName: 'Admin UTME Specialist',
    topic: '',
    durationMinutes: 45,
    isOfficial: true
  });

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/study-rooms');
      if (res.ok) {
        const json = await res.json();
        if (json.rooms) {
          setRooms(json.rooms);
        }
      }
    } catch (err) {
      console.error('Error fetching admin study rooms:', err);
      toast.error('Failed to load study rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Session title is required.');
      return;
    }

    try {
      if (editingRoom) {
        // Update existing room
        const res = await fetch(`/api/study-rooms/${editingRoom.roomId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title.trim(),
            subject: formData.subject,
            hostName: formData.hostName.trim(),
            topic: formData.topic.trim() || undefined,
            isOfficial: formData.isOfficial
          })
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Study room updated successfully!');
          setEditingRoom(null);
          setShowCreateDialog(false);
          fetchRooms();
        } else {
          toast.error(data.error || 'Failed to update study room.');
        }
      } else {
        // Create new official room
        const res = await fetch('/api/study-rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title.trim(),
            subject: formData.subject,
            hostName: formData.hostName.trim(),
            topic: formData.topic.trim() || undefined,
            durationMinutes: formData.durationMinutes,
            isOfficial: formData.isOfficial
          })
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Official study room launched successfully!');
          setShowCreateDialog(false);
          setFormData({
            title: '',
            subject: 'Use of English',
            hostName: 'Admin UTME Specialist',
            topic: '',
            durationMinutes: 45,
            isOfficial: true
          });
          fetchRooms();
        } else {
          toast.error(data.error || 'Failed to create study room.');
        }
      }
    } catch (err) {
      toast.error('Network error during operation.');
    }
  };

  const handleDeleteRoom = async (roomId: string, title: string) => {
    if (!confirm(`Are you sure you want to end and remove "${title}"?`)) return;

    try {
      const res = await fetch(`/api/study-rooms/${roomId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Room "${title}" closed successfully.`);
        fetchRooms();
      } else {
        toast.error('Failed to close room.');
      }
    } catch (err) {
      toast.error('Network error closing room.');
    }
  };

  const openEditModal = (room: StudyRoomMeta) => {
    setEditingRoom(room);
    setFormData({
      title: room.title,
      subject: room.subject,
      hostName: room.hostName,
      topic: room.topic || '',
      durationMinutes: 45,
      isOfficial: Boolean(room.isOfficial)
    });
    setShowCreateDialog(true);
  };

  // Metrics
  const totalOnlineScholars = rooms.reduce((acc, r) => acc + (r.participantCount || 0), 0);
  const totalOfficial = rooms.filter(r => r.isOfficial).length;
  const activeSprints = rooms.filter(r => r.isTimerRunning).length;

  // Filtered rooms
  const filteredRooms = rooms.filter(room => {
    const matchesSubject = selectedSubject === 'All' || room.subject.toLowerCase() === selectedSubject.toLowerCase();
    const matchesQuery = searchQuery === '' || 
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.hostName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.topic && room.topic.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSubject && matchesQuery;
  });

  const subjects = ['All', 'Use of English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'Literature in English'];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/10 via-primary/5 to-card border border-border p-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground font-bold text-xs">
              <Video className="w-3.5 h-3.5 mr-1" /> Live Collaboration Hub
            </Badge>
            <span className="text-xs text-muted-foreground font-mono font-medium">Real-Time WebSockets Engine</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground">Peer Study Rooms & Masterclasses</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Live command center for student collaborative study rooms and official tutor masterclasses. Monitor real-time participants, manage active whiteboard sessions, and schedule curriculum group sprints.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={fetchRooms} disabled={loading} className="gap-1.5 text-xs font-semibold">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button 
            onClick={() => {
              setEditingRoom(null);
              setFormData({
                title: '',
                subject: 'Use of English',
                hostName: 'Admin UTME Specialist',
                topic: '',
                durationMinutes: 45,
                isOfficial: true
              });
              setShowCreateDialog(true);
            }} 
            className="bg-primary text-primary-foreground font-bold gap-2 text-xs shadow-sm"
          >
            <Plus className="w-4 h-4" /> Launch Masterclass
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              Active Study Rooms <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-display">{rooms.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {rooms.length === 0 ? 'No rooms active right now' : `${rooms.length} room sessions hosted`}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              Online Scholars <Users className="w-3.5 h-3.5 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-display">{totalOnlineScholars}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Synchronized across all live room boards
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              Official Masterclasses <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-display">{totalOfficial}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Tutor-led UTME syllabus sessions
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              Active Sprints <Flame className="w-3.5 h-3.5 text-rose-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-display">{activeSprints}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Synchronized Pomodoro timers running
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-2xl">
          {subjects.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedSubject === sub
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search rooms or hosts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Rooms Directory */}
      <div className="space-y-3">
        {loading && rooms.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm font-medium">Synchronizing live peer rooms...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <Card className="border-dashed border-border bg-muted/20 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold font-display text-foreground">
                {rooms.length === 0 ? 'No Active Study Rooms' : 'No Rooms Match Your Filter'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {rooms.length === 0
                  ? 'There are no active peer study sessions right now. You can launch an official masterclass room above to anchor student collaboration.'
                  : 'Try selecting a different subject filter or clear your search term.'}
              </p>
            </div>
            {rooms.length === 0 && (
              <Button
                onClick={() => {
                  setEditingRoom(null);
                  setShowCreateDialog(true);
                }}
                className="bg-primary text-primary-foreground font-bold text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Launch First Official Room
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((room) => (
              <Card key={room.roomId} className="border-border shadow-sm flex flex-col justify-between hover:border-primary/40 transition-all">
                <CardHeader className="p-4 pb-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono font-medium">
                      {room.subject}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {room.isOfficial && (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                          <Sparkles className="w-2.5 h-2.5 mr-1" /> Official
                        </Badge>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        room.isTimerRunning
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {room.isTimerRunning ? 'Sprint Live' : 'Open'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-foreground line-clamp-2 leading-snug">
                      {room.title}
                    </h3>
                    {room.topic && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 line-clamp-1">
                        <BookOpen className="w-3 h-3 text-primary shrink-0" /> {room.topic}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 text-muted-foreground border-t border-border/60">
                    <span>Host: <strong className="text-foreground font-medium">{room.hostName}</strong></span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Users className="w-3 h-3 text-primary" /> {room.participantCount} online
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0 border-t border-border/40 flex items-center justify-between gap-2 bg-muted/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/study-rooms')}
                    className="h-8 text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Lobby
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEditModal(room)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Edit Room"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteRoom(room.roomId, room.title)}
                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30"
                      title="Close Room"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Masterclass Dialog */}
      <AnimatePresence>
        {showCreateDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 relative"
            >
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingRoom(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display text-foreground">
                    {editingRoom ? 'Edit Study Room' : 'Launch Official Masterclass'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {editingRoom ? 'Update room configuration and details' : 'Anchor an official syllabus room with synchronized whiteboard & timer.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Session Title *</Label>
                  <Input
                    placeholder="e.g. JAMB 2025 Novel Analysis: The Life Changer Q&A"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Subject</Label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="Use of English">Use of English</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Biology">Biology</option>
                      <option value="Economics">Economics</option>
                      <option value="Government">Government</option>
                      <option value="Literature in English">Literature in English</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Host / Instructor Name</Label>
                    <Input
                      placeholder="e.g. Admin UTME Specialist"
                      value={formData.hostName}
                      onChange={(e) => setFormData({ ...formData, hostName: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Focus Topic (Optional)</Label>
                  <Input
                    placeholder="e.g. Concord, Synonyms & Antonyms, Novel Chapters 1-4"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Duration (Minutes)</Label>
                    <Input
                      type="number"
                      min="10"
                      max="120"
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) || 25 })}
                      className="text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="isOfficialCheckbox"
                      checked={formData.isOfficial}
                      onChange={(e) => setFormData({ ...formData, isOfficial: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="isOfficialCheckbox" className="text-xs font-semibold text-foreground cursor-pointer">
                      Mark as Official Masterclass
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      setEditingRoom(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary text-primary-foreground font-bold">
                    {editingRoom ? 'Save Changes' : 'Launch Masterclass'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPeerStudyRoomsTab;
