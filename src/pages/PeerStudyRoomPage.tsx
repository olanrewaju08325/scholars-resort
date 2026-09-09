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
  Volume2,
  BookOpen,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WhiteboardCanvas } from '@/components/studyroom/WhiteboardCanvas';
import { GroupTimer } from '@/components/studyroom/GroupTimer';
import { RoomChat } from '@/components/studyroom/RoomChat';
import { RoomQuestionLauncher } from '@/components/studyroom/RoomQuestionLauncher';
import { type WhiteboardStroke, type RoomTimerState, type RoomParticipant, type StudyRoomMeta } from '@/types/studyRoomTypes';
import { supabase } from '@/lib/supabase';
import { peerStudyRoomSync } from '@/services/peerStudyRoomSync';
import { toast } from 'sonner';

export const PeerStudyRoomPage: React.FC = () => {
  const { profile, user } = useAuth();
  const [activeRooms, setActiveRooms] = useState<StudyRoomMeta[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomSubject, setNewRoomSubject] = useState('Use of English');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active Session State
  const [roomTitle, setRoomTitle] = useState('');
  const [roomSubject, setRoomSubject] = useState('Use of English');
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

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const whiteboardStrokesRef = useRef<WhiteboardStroke[]>([]);
  const timerStateRef = useRef<RoomTimerState>(timerState);
  const messagesRef = useRef<Array<any>>([]);

  useEffect(() => {
    whiteboardStrokesRef.current = whiteboardStrokes;
  }, [whiteboardStrokes]);
  useEffect(() => {
    timerStateRef.current = timerState;
  }, [timerState]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const currentUserId = user?.id || `anon_${Math.random().toString(36).substring(2, 7)}`;
  const currentUserName = profile?.full_name || 'Scholar Student';

  // Real-time synchronization across all accounts & devices
  useEffect(() => {
    const unsubscribe = peerStudyRoomSync.subscribe((rooms) => {
      setActiveRooms(rooms);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await peerStudyRoomSync.fetchRoomsFromApi();
      toast.success('Study rooms refreshed!');
    } catch (_) {
      toast.error('Could not refresh rooms');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Connect to In-Room Supabase Channel and WebSocket when entering a room
  useEffect(() => {
    if (!selectedRoomId) {
      peerStudyRoomSync.trackActiveRoom(null);
      return;
    }

    const currentRoomMeta: StudyRoomMeta = {
      roomId: selectedRoomId,
      title: roomTitle || 'UTME Study Session',
      subject: roomSubject || 'Use of English',
      hostName: currentUserName,
      hostId: currentUserId,
      status: 'active',
      participantCount: Math.max(participants.length, 1),
      isTimerRunning: timerState.isRunning,
      participants: [{
        id: currentUserId,
        name: currentUserName,
        avatar: currentUserName.substring(0, 2).toUpperCase()
      }],
      updatedAt: new Date().toISOString()
    };

    // Announce active room on global lobby presence so all other scholars see it live
    peerStudyRoomSync.trackActiveRoom(currentRoomMeta);

    // 1. Initialize Supabase Realtime Channel for direct real-time broadcast & presence sync
    const channelName = `study_room_${selectedRoomId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });
    supabaseChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        if (payload?.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.message.id)) return prev;
            return [...prev, payload.message];
          });
        }
      })
      .on('broadcast', { event: 'draw_stroke' }, ({ payload }) => {
        if (payload?.stroke) {
          setWhiteboardStrokes((prev) => {
            if (prev.some((s) => s.id === payload.stroke.id)) return prev;
            return [...prev, payload.stroke];
          });
        }
      })
      .on('broadcast', { event: 'clear_whiteboard' }, ({ payload }) => {
        setWhiteboardStrokes([]);
        if (payload?.clearedBy) {
          toast.info(`Whiteboard cleared by ${payload.clearedBy}.`);
        }
      })
      .on('broadcast', { event: 'timer_updated' }, ({ payload }) => {
        if (payload?.timerState) setTimerState(payload.timerState);
      })
      .on('broadcast', { event: 'toggle_raise_hand' }, ({ payload }) => {
        if (payload?.userId) {
          setParticipants((prev) =>
            prev.map((p) => (p.id === payload.userId ? { ...p, isHandRaised: !p.isHandRaised } : p))
          );
        }
      })
      .on('broadcast', { event: 'reaction_emoji' }, ({ payload }) => {
        if (payload?.emoji && payload?.userName) {
          toast(`${payload.userName}: ${payload.emoji}`, { duration: 1500 });
        }
      })
      .on('broadcast', { event: 'question_shared' }, ({ payload }) => {
        if (payload?.stroke) {
          setWhiteboardStrokes((prev) => [...prev, payload.stroke]);
        }
        if (payload?.message) {
          setMessages((prev) => [...prev, payload.message]);
        }
        toast.success('New UTME question posted to whiteboard!');
      })
      .on('broadcast', { event: 'request_room_state' }, () => {
        if (whiteboardStrokesRef.current.length > 0 || messagesRef.current.length > 0) {
          channel.send({
            type: 'broadcast',
            event: 'room_state_response',
            payload: {
              strokes: whiteboardStrokesRef.current,
              timerState: timerStateRef.current,
              messages: messagesRef.current
            }
          });
        }
      })
      .on('broadcast', { event: 'room_state_response' }, ({ payload }) => {
        if (payload?.strokes && payload.strokes.length > 0) {
          setWhiteboardStrokes((prev) => {
            const ids = new Set(prev.map(s => s.id));
            const newStrokes = payload.strokes.filter((s: any) => !ids.has(s.id));
            return [...prev, ...newStrokes];
          });
        }
        if (payload?.timerState) {
          setTimerState(payload.timerState);
        }
        if (payload?.messages && payload.messages.length > 0) {
          setMessages((prev) => {
            const ids = new Set(prev.map(m => m.id));
            const newMsgs = payload.messages.filter((m: any) => !ids.has(m.id));
            return [...prev, ...newMsgs];
          });
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const activeParticipants: RoomParticipant[] = [];
        Object.keys(presenceState).forEach((key) => {
          const presences = presenceState[key] as any[];
          presences.forEach((p) => {
            if (p.userId && !activeParticipants.some((ap) => ap.id === p.userId)) {
              activeParticipants.push({
                id: p.userId,
                name: p.userName || 'Scholar Student',
                avatar: p.avatar || (p.userName || 'ST').substring(0, 2).toUpperCase(),
                isHandRaised: Boolean(p.isHandRaised),
                joinedAt: p.joinedAt || new Date().toISOString()
              });
            }
          });
        });
        if (activeParticipants.length > 0) {
          setParticipants(activeParticipants);
          peerStudyRoomSync.trackActiveRoom({
            ...currentRoomMeta,
            participantCount: activeParticipants.length
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUserId,
            userName: currentUserName,
            avatar: currentUserName.substring(0, 2).toUpperCase(),
            joinedAt: new Date().toISOString(),
            isHandRaised: false
          });

          channel.send({
            type: 'broadcast',
            event: 'request_room_state',
            payload: { userId: currentUserId }
          });
        }
      });

    // 2. Initialize WebSocket server connection fallback
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/study-room`;

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
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
              setWhiteboardStrokes((prev) => {
                if (prev.some((s) => s.id === payload.stroke.id)) return prev;
                return [...prev, payload.stroke];
              });
            }
          } else if (type === 'clear_whiteboard_broadcast') {
            setWhiteboardStrokes([]);
            toast.info(`Whiteboard cleared by ${payload.clearedBy || 'peer'}.`);
          } else if (type === 'chat_message_broadcast') {
            if (payload.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === payload.message.id)) return prev;
                return [...prev, payload.message];
              });
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
    } catch (_) {}

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
      supabase.removeChannel(channel);
      supabaseChannelRef.current = null;
      peerStudyRoomSync.trackActiveRoom(null);
    };
  }, [selectedRoomId]);

  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim()) {
      toast.error('Please enter a room title');
      return;
    }

    try {
      const createdRoom = await peerStudyRoomSync.createRoom({
        title: newRoomTitle.trim(),
        subject: newRoomSubject,
        hostName: currentUserName,
        hostId: currentUserId
      });

      setRoomTitle(createdRoom.title);
      setRoomSubject(createdRoom.subject);
      setSelectedRoomId(createdRoom.roomId);
      setShowCreateModal(false);
      setNewRoomTitle('');
      toast.success(`Study Room "${createdRoom.title}" is now LIVE! Broadcasted to all scholars.`);
    } catch (err: any) {
      toast.error('Could not create room: ' + (err.message || 'Error'));
    }
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
    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'draw_stroke',
        payload: { stroke, userId: currentUserId }
      });
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
    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'clear_whiteboard',
        payload: { clearedBy: currentUserName }
      });
    }
  };

  const handleSendMessage = (text: string) => {
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: currentUserId,
      senderName: currentUserName,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'chat' as const
    };

    setMessages((prev) => [...prev, msg]);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName,
        data: { text }
      }));
    }

    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: { message: msg }
      });
    }
  };

  const handleUpdateTimer = (action: 'start' | 'pause' | 'reset' | 'tick', duration?: number, remainingSeconds?: number) => {
    let newTimerState = { ...timerState };
    if (action === 'start') newTimerState.isRunning = true;
    if (action === 'pause') newTimerState.isRunning = false;
    if (action === 'reset') {
      newTimerState.isRunning = false;
      newTimerState.remainingSeconds = duration || newTimerState.durationSeconds;
    }
    if (action === 'tick' && typeof remainingSeconds === 'number') {
      newTimerState.remainingSeconds = remainingSeconds;
    }
    setTimerState(newTimerState);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_timer',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName,
        data: { timerAction: action, duration, remainingSeconds }
      }));
    }

    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'timer_updated',
        payload: { timerState: newTimerState, action }
      });
    }
  };

  const handleToggleRaiseHand = () => {
    const nextHandState = !isHandRaised;
    setIsHandRaised(nextHandState);
    setParticipants((prev) =>
      prev.map((p) => (p.id === currentUserId ? { ...p, isHandRaised: nextHandState } : p))
    );

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'toggle_raise_hand',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName
      }));
    }

    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'toggle_raise_hand',
        payload: { userId: currentUserId, isHandRaised: nextHandState }
      });
    }
  };

  const handleSendReaction = (emoji: string) => {
    toast(`${currentUserName}: ${emoji}`);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reaction_emoji',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName,
        data: { emoji }
      }));
    }
    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'reaction_emoji',
        payload: { emoji, userName: currentUserName, userId: currentUserId }
      });
    }
  };

  const handleShareQuestionToBoard = (question: any) => {
    const stroke: WhiteboardStroke = {
      id: `q_${Date.now()}`,
      type: 'question_overlay',
      color: '#3b82f6',
      width: 2,
      questionData: question
    };
    const sysMsg = {
      id: `msg_q_${Date.now()}`,
      senderId: currentUserId,
      senderName: currentUserName,
      text: `Shared UTME Question: "${question.question_text?.substring(0, 80)}..." onto whiteboard!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'question' as const,
      questionData: question
    };

    setWhiteboardStrokes((prev) => [...prev, stroke]);
    setMessages((prev) => [...prev, sysMsg]);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'share_question_to_board',
        roomId: selectedRoomId,
        userId: currentUserId,
        userName: currentUserName,
        data: { question }
      }));
    }

    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'question_shared',
        payload: { stroke, message: sysMsg }
      });
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

      {/* Active Rooms Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Active Study Rooms ({activeRooms.length})
            </h2>
            <p className="text-xs text-muted-foreground">Join any active session or start your own collaborative group.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="text-xs font-bold self-start sm:self-auto gap-1.5 border-border hover:border-primary/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
            {isRefreshing ? 'Syncing...' : 'Refresh List'}
          </Button>
        </div>

        {/* Subject Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['All', 'Use of English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics'].map((sub) => (
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

        {activeRooms.filter(r => selectedSubject === 'All' || r.subject.toLowerCase() === selectedSubject.toLowerCase()).length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-8 sm:p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
              <Users className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-lg font-bold font-display text-foreground">
                {activeRooms.length === 0 ? 'No Active Study Rooms Right Now' : `No Active Rooms for ${selectedSubject}`}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {activeRooms.length === 0
                  ? 'Be the first scholar to launch a study session! Pick your UTME subject, collaborate on the shared whiteboard, and solve practice problems with peers.'
                  : `There are currently no active study rooms for ${selectedSubject}. You can be the first to launch one or switch to "All" subjects.`}
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary text-primary-foreground font-bold text-sm shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Start First Study Room
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRooms
              .filter(r => selectedSubject === 'All' || r.subject.toLowerCase() === selectedSubject.toLowerCase())
              .map((room) => (
                <motion.div
                  key={room.roomId}
                  whileHover={{ y: -2 }}
                  className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {room.subject}
                          </Badge>
                          {room.isOfficial && (
                            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                              <Sparkles className="w-2.5 h-2.5 mr-1" /> Official Masterclass
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-base font-bold font-display text-foreground leading-snug">
                          {room.title}
                        </h3>
                        {room.topic && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-primary shrink-0" /> {room.topic}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Host: <span className="font-medium text-foreground">{room.hostName}</span>
                        </p>
                      </div>

                      <Badge className={`text-xs border-none font-mono font-bold shrink-0 ${
                        room.isTimerRunning ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        {room.isTimerRunning ? 'Sprint Active' : 'Waiting'}
                      </Badge>
                    </div>
                  </div>

                  {/* Participants Previews */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
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
                      className="bg-primary text-primary-foreground font-bold size-sm flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Join Session
                    </Button>
                  </div>
                </motion.div>
              ))}
          </div>
        )}
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
