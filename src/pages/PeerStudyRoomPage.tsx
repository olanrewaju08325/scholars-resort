import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { 
  Users, 
  Plus, 
  MessageSquare, 
  Timer, 
  Sparkles, 
  Video, 
  ArrowLeft, 
  Play, 
  Flame, 
  ShieldCheck, 
  X,
  Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WhiteboardCanvas } from '@/components/studyroom/WhiteboardCanvas';
import { GroupTimer } from '@/components/studyroom/GroupTimer';
import { RoomChat } from '@/components/studyroom/RoomChat';
import { RoomQuestionLauncher } from '@/components/studyroom/RoomQuestionLauncher';
import type { 
  WhiteboardStroke, 
  RoomTimerState, 
  RoomParticipant 
} from '@/types/studyRoomTypes';
import { toast } from 'sonner';

interface RoomMeta {
  roomId: string;
  title: string;
  subject: string;
  hostName: string;
  participantCount: number;
  isTimerRunning: boolean;
  participants: Array<{ id: string; name: string; avatar: string }>;
}

export const PeerStudyRoomPage: React.FC = () => {
  const { profile, user } = useAuth();
  const [activeRooms, setActiveRooms] = useState<RoomMeta[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomSubject, setNewRoomSubject] = useState('Physics');

  // Active Session State
  const [roomTitle, setRoomTitle] = useState('');
  const [roomSubject, setRoomSubject] = useState('Physics');
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<WhiteboardStroke[]>([]);
  const [timerState, setTimerState] = useState<RoomTimerState>({
    mode: 'sprint',
    durationSeconds: 1500,
    remainingSeconds: 1500,
    isRunning: false
  });
  const [messages, setMessages] = useState<Array<any>>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showQuestionLauncher, setShowQuestionLauncher] = useState(false);

  // WebSocket Reference
  const wsRef = useRef<WebSocket | null>(null);

  const currentUserId = user?.id || `anon_${Math.random().toString(36).substring(2, 7)}`;
  const currentUserName = profile?.full_name || 'Scholar Student';

  // Fetch Public Rooms list from REST API
  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/study-rooms');
      if (res.ok) {
        const json = await res.json();
        if (json.rooms) {
          setActiveRooms(json.rooms);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  // Connect to WebSocket when entering a room
  useEffect(() => {
    if (!selectedRoomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/study-room`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('[PeerStudyRoom] Connected to WebSocket room:', selectedRoomId);
      socket.send(JSON.stringify({
        type: 'join_room',
        roomId: selectedRoomId,
        roomTitle: roomTitle || 'UTME Study Session',
        subject: roomSubject,
        userId: currentUserId,
        userName: currentUserName,
        avatar: currentUserName.substring(0, 2).toUpperCase()
      }));
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type } = payload;

        if (type === 'room_init_state') {
          setRoomTitle(payload.title);
          setRoomSubject(payload.subject);
          setParticipants(payload.participants || []);
          setWhiteboardStrokes(payload.whiteboardStrokes || []);
          if (payload.timerState) setTimerState(payload.timerState);
          setMessages(payload.messages || []);
        } else if (type === 'participant_joined' || type === 'participant_left') {
          if (payload.participants) setParticipants(payload.participants);
          if (payload.systemMessage) {
            toast.info(payload.systemMessage);
          }
        } else if (type === 'draw_stroke_broadcast') {
          if (payload.stroke) {
            setWhiteboardStrokes((prev) => [...prev, payload.stroke]);
          }
        } else if (type === 'clear_whiteboard_broadcast') {
          setWhiteboardStrokes([]);
          toast.info(`Whiteboard cleared by ${payload.clearedBy || 'peer'}.`);
        } else if (type === 'chat_message_broadcast') {
          if (payload.message) {
            setMessages((prev) => [...prev, payload.message]);
          }
        } else if (type === 'question_shared_broadcast') {
          if (payload.stroke) {
            setWhiteboardStrokes((prev) => [...prev, payload.stroke]);
          }
          if (payload.message) {
            setMessages((prev) => [...prev, payload.message]);
          }
          toast.success('New UTME question posted to whiteboard!');
        } else if (type === 'timer_updated_broadcast') {
          if (payload.timerState) setTimerState(payload.timerState);
        } else if (type === 'participant_hand_toggled') {
          if (payload.participants) setParticipants(payload.participants);
        } else if (type === 'reaction_emoji_broadcast') {
          toast(`${payload.userName}: ${payload.emoji}`, { duration: 1500 });
        }
      } catch (err) {
        console.warn('Error handling study room socket message:', err);
      }
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      wsRef.current = null;
    };
  }, [selectedRoomId]);

  const handleCreateRoom = () => {
    if (!newRoomTitle.trim()) {
      toast.error('Please enter a room title');
      return;
    }

    const roomId = `room_${Date.now()}`;
    setRoomTitle(newRoomTitle.trim());
    setRoomSubject(newRoomSubject);
    setSelectedRoomId(roomId);
    setShowCreateModal(false);
    setNewRoomTitle('');
    toast.success('Peer Study Room created! Welcome!');
  };

  const handleAddStroke = (stroke: WhiteboardStroke) => {
    setWhiteboardStrokes((prev) => [...prev, stroke]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'draw_stroke',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName,
        data: { stroke }
      }));
    }
  };

  const handleClearBoard = () => {
    setWhiteboardStrokes([]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'clear_whiteboard',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName
      }));
    }
  };

  const handleSendMessage = (text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName,
        data: { text }
      }));
    } else {
      // Local fallback
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          senderId: currentUserId,
          senderName: currentUserName,
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'chat'
        }
      ]);
    }
  };

  const handleUpdateTimer = (action: 'start' | 'pause' | 'reset' | 'tick', duration?: number, remainingSeconds?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_timer',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName,
        data: { timerAction: action, duration, remainingSeconds }
      }));
    } else {
      // Local fallback
      setTimerState((prev) => {
        if (action === 'start') return { ...prev, isRunning: true };
        if (action === 'pause') return { ...prev, isRunning: false };
        if (action === 'reset') return { ...prev, isRunning: false, remainingSeconds: duration || prev.durationSeconds };
        if (action === 'tick' && typeof remainingSeconds === 'number') return { ...prev, remainingSeconds };
        return prev;
      });
    }
  };

  const handleToggleRaiseHand = () => {
    setIsHandRaised(!isHandRaised);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'toggle_raise_hand',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName
      }));
    }
  };

  const handleSendReaction = (emoji: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reaction_emoji',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName,
        data: { emoji }
      }));
    } else {
      toast(`${currentUserName}: ${emoji}`);
    }
  };

  const handleShareQuestionToBoard = (question: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'share_question_to_board',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName,
        data: { question }
      }));
    } else {
      const stroke: WhiteboardStroke = {
        id: `q_${Date.now()}`,
        type: 'question_overlay',
        color: '#3b82f6',
        width: 2,
        questionData: question
      };
      setWhiteboardStrokes((prev) => [...prev, stroke]);
    }
  };

  // ROOM SESSION ACTIVE VIEW
  if (selectedRoomId) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-4 min-h-[90vh] flex flex-col">
        {/* Session Top Header Bar */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRoomId(null)}
              className="border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Exit Room
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-white font-mono text-[10px] uppercase">
                  {roomSubject}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Live Session
                </span>
              </div>
              <h2 className="text-lg font-bold font-display text-white mt-0.5">
                {roomTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-slate-900 border-slate-800 text-slate-200 text-xs px-3 py-1 font-mono font-bold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-400" /> {participants.length} Scholars Active
            </Badge>
          </div>
        </div>

        {/* Main Collaborative Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-[600px]">
          {/* Left Column: Whiteboard & Group Timer (2 Spans) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <GroupTimer
              timerState={timerState}
              onUpdateTimer={handleUpdateTimer}
              isHost={true}
            />
            <div className="flex-1 min-h-[480px]">
              <WhiteboardCanvas
                strokes={whiteboardStrokes}
                onAddStroke={handleAddStroke}
                onClearBoard={handleClearBoard}
                userName={currentUserName}
              />
            </div>
          </div>

          {/* Right Column: Room Chat & Participants */}
          <div className="lg:col-span-1 h-[650px] lg:h-auto">
            <RoomChat
              participants={participants}
              messages={messages}
              onSendMessage={handleSendMessage}
              onToggleRaiseHand={handleToggleRaiseHand}
              onSendReactionEmoji={handleSendReaction}
              currentUserId={currentUserId}
              isHandRaised={isHandRaised}
              onOpenQuestionLauncher={() => setShowQuestionLauncher(true)}
            />
          </div>
        </div>

        {/* Question Launcher Modal */}
        <RoomQuestionLauncher
          isOpen={showQuestionLauncher}
          onClose={() => setShowQuestionLauncher(false)}
          onShareQuestion={handleShareQuestionToBoard}
          roomSubject={roomSubject}
        />
      </div>
    );
  }

  // ROOM BROWSER & LIST VIEW
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900/20 via-primary/5 to-card border border-blue-500/30 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-600 text-white border-none font-bold">
              <Video className="w-3.5 h-3.5 mr-1" /> Peer Collaboration
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">Real-Time WebSockets</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            Peer Study Rooms
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Join virtual study sessions for specific UTME subjects. Collaborate on a shared whiteboard, solve practice problems step-by-step, and stay on track with synchronized group timers.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary text-primary-foreground font-bold flex items-center gap-2 shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Create Study Room
        </Button>
      </div>

      {/* Active Rooms Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Active Study Rooms ({activeRooms.length})
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchRooms} className="text-xs font-bold">
            Refresh List
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeRooms.map((room) => (
            <motion.div
              key={room.roomId}
              whileHover={{ y: -2 }}
              className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant="outline" className="text-[10px] font-mono mb-1">
                    {room.subject}
                  </Badge>
                  <h3 className="text-base font-bold font-display text-foreground leading-snug">
                    {room.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Host: <span className="font-medium text-foreground">{room.hostName}</span>
                  </p>
                </div>

                <Badge className={`text-xs border-none font-mono font-bold ${
                  room.isTimerRunning ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                }`}>
                  {room.isTimerRunning ? 'Sprint Active' : 'Waiting'}
                </Badge>
              </div>

              {/* Participants Previews */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-bold text-foreground">{room.participantCount}</span> Scholars In Room
                </div>

                <Button
                  onClick={() => {
                    setRoomTitle(room.title);
                    setRoomSubject(room.subject);
                    setSelectedRoomId(room.roomId);
                  }}
                  className="bg-primary text-primary-foreground font-bold size-sm flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Join Session
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Create Room Modal Dialog */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 relative"
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display text-foreground">
                    Create Peer Study Room
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Host a collaborative study session with a shared whiteboard and timer.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">
                    Session Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTME Physics Calculus & Vectors Sprint"
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">
                    Subject
                  </label>
                  <select
                    value={newRoomSubject}
                    onChange={(e) => setNewRoomSubject(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Use of English">Use of English</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRoom} className="bg-primary text-primary-foreground font-bold">
                  Create Room
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PeerStudyRoomPage;
