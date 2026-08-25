import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RoomParticipant, WhiteboardStroke, RoomTimerState, RoomChatMessage } from '../types/studyRoomTypes';

export type { RoomParticipant, WhiteboardStroke, RoomTimerState, RoomChatMessage };

export interface StudyRoomState {
  roomId: string;
  title: string;
  subject: string;
  hostName: string;
  participants: Map<string, RoomParticipant>;
  whiteboardStrokes: WhiteboardStroke[];
  timerState: RoomTimerState;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: string;
    type?: 'chat' | 'system' | 'question';
    questionData?: any;
  }>;
}

const activeRooms = new Map<string, StudyRoomState>();

// Seed default active study rooms for students to join right away
function initializeDefaultRooms() {
  const defaults = [
    { roomId: 'room_physics_01', title: 'UTME Physics Mechanics & Optics Sprint', subject: 'Physics', hostName: 'Dr. Adebayo' },
    { roomId: 'room_english_01', title: 'Use of English Concord & Lexis Circle', subject: 'Use of English', hostName: 'Scholar Chinedu' },
    { roomId: 'room_math_01', title: 'Calculus & Quadratics Problem Solving', subject: 'Mathematics', hostName: 'Engineer Fatima' },
    { roomId: 'room_chem_01', title: 'Organic Chemistry & Stoichiometry Group', subject: 'Chemistry', hostName: 'Tutor Kingsley' },
  ];

  defaults.forEach(d => {
    if (!activeRooms.has(d.roomId)) {
      activeRooms.set(d.roomId, {
        roomId: d.roomId,
        title: d.title,
        subject: d.subject,
        hostName: d.hostName,
        participants: new Map(),
        whiteboardStrokes: [],
        timerState: {
          mode: 'sprint',
          durationSeconds: 1500, // 25 min
          remainingSeconds: 1500,
          isRunning: false
        },
        messages: [
          {
            id: 'msg_welcome',
            senderId: 'system',
            senderName: 'System Bot',
            text: `Welcome to ${d.title}! Collaborate on the shared whiteboard and solve UTME questions together.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'system'
          }
        ]
      });
    }
  });
}

initializeDefaultRooms();

export function setupStudyRoomWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/study-room' });

  // Map client connection to user & room identity
  const clientSockets = new Map<WebSocket, { roomId: string; userId: string; userName: string }>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('[StudyRoom WebSocket] New peer client connected.');

    ws.on('message', (rawMessage: string) => {
      try {
        const payload = JSON.parse(rawMessage.toString());
        const { type, roomId, userId, userName, avatar, data } = payload;

        if (!roomId) return;

        // Ensure room exists or create dynamically
        if (!activeRooms.has(roomId)) {
          activeRooms.set(roomId, {
            roomId,
            title: payload.roomTitle || `UTME ${payload.subject || 'General'} Study Room`,
            subject: payload.subject || 'General',
            hostName: userName || 'Scholar Peer',
            participants: new Map(),
            whiteboardStrokes: [],
            timerState: {
              mode: 'pomodoro',
              durationSeconds: 1500,
              remainingSeconds: 1500,
              isRunning: false
            },
            messages: []
          });
        }

        const room = activeRooms.get(roomId)!;

        switch (type) {
          case 'join_room': {
            clientSockets.set(ws, { roomId, userId, userName });
            
            // Add or update participant
            room.participants.set(userId, {
              id: userId,
              name: userName || 'Anonymous Scholar',
              avatar: avatar || userName?.substring(0, 2).toUpperCase() || 'SC',
              isHandRaised: false,
              joinedAt: new Date().toISOString()
            });

            // Send current full state to newly joined participant
            const participantList = Array.from(room.participants.values());
            ws.send(JSON.stringify({
              type: 'room_init_state',
              roomId,
              title: room.title,
              subject: room.subject,
              participants: participantList,
              whiteboardStrokes: room.whiteboardStrokes,
              timerState: room.timerState,
              messages: room.messages
            }));

            // Broadcast user joined to other clients in room
            broadcastToRoom(wss, roomId, {
              type: 'participant_joined',
              participant: room.participants.get(userId),
              participants: participantList,
              systemMessage: `${userName} joined the study room.`
            }, ws);
            break;
          }

          case 'draw_stroke': {
            if (data?.stroke) {
              room.whiteboardStrokes.push(data.stroke);
              // Cap history to 300 strokes for performance
              if (room.whiteboardStrokes.length > 300) {
                room.whiteboardStrokes = room.whiteboardStrokes.slice(-300);
              }
              broadcastToRoom(wss, roomId, {
                type: 'draw_stroke_broadcast',
                stroke: data.stroke,
                senderId: userId
              }, ws);
            }
            break;
          }

          case 'clear_whiteboard': {
            room.whiteboardStrokes = [];
            broadcastToRoom(wss, roomId, {
              type: 'clear_whiteboard_broadcast',
              clearedBy: userName
            });
            break;
          }

          case 'chat_message': {
            if (data?.text) {
              const msg = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                senderId: userId,
                senderName: userName,
                text: data.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'chat' as const
              };
              room.messages.push(msg);
              if (room.messages.length > 100) room.messages = room.messages.slice(-100);

              broadcastToRoom(wss, roomId, {
                type: 'chat_message_broadcast',
                message: msg
              });
            }
            break;
          }

          case 'share_question_to_board': {
            if (data?.question) {
              const stroke: WhiteboardStroke = {
                id: `q_overlay_${Date.now()}`,
                type: 'question_overlay',
                color: '#3b82f6',
                width: 2,
                questionData: data.question
              };
              room.whiteboardStrokes.push(stroke);

              const sysMsg = {
                id: `msg_q_${Date.now()}`,
                senderId: userId,
                senderName: userName,
                text: `Shared UTME Question: "${data.question.question_text?.substring(0, 80)}..." onto whiteboard!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'question' as const,
                questionData: data.question
              };
              room.messages.push(sysMsg);

              broadcastToRoom(wss, roomId, {
                type: 'question_shared_broadcast',
                stroke,
                message: sysMsg
              });
            }
            break;
          }

          case 'update_timer': {
            if (data?.timerAction) {
              const { action, duration } = data;
              if (action === 'start') {
                room.timerState.isRunning = true;
              } else if (action === 'pause') {
                room.timerState.isRunning = false;
              } else if (action === 'reset') {
                room.timerState.isRunning = false;
                room.timerState.remainingSeconds = duration || room.timerState.durationSeconds;
              } else if (action === 'tick' && typeof data.remainingSeconds === 'number') {
                room.timerState.remainingSeconds = data.remainingSeconds;
              }

              broadcastToRoom(wss, roomId, {
                type: 'timer_updated_broadcast',
                timerState: room.timerState,
                action,
                updatedBy: userName
              });
            }
            break;
          }

          case 'toggle_raise_hand': {
            const p = room.participants.get(userId);
            if (p) {
              p.isHandRaised = !p.isHandRaised;
              broadcastToRoom(wss, roomId, {
                type: 'participant_hand_toggled',
                userId,
                isHandRaised: p.isHandRaised,
                participants: Array.from(room.participants.values())
              });
            }
            break;
          }

          case 'reaction_emoji': {
            if (data?.emoji) {
              broadcastToRoom(wss, roomId, {
                type: 'reaction_emoji_broadcast',
                userId,
                userName,
                emoji: data.emoji
              });
            }
            break;
          }
        }
      } catch (err) {
        console.warn('[StudyRoom WebSocket Error processing message]', err);
      }
    });

    ws.on('close', () => {
      const clientInfo = clientSockets.get(ws);
      if (clientInfo) {
        const { roomId, userId, userName } = clientInfo;
        const room = activeRooms.get(roomId);
        if (room) {
          room.participants.delete(userId);
          broadcastToRoom(wss, roomId, {
            type: 'participant_left',
            userId,
            userName,
            participants: Array.from(room.participants.values())
          });
        }
        clientSockets.delete(ws);
      }
    });
  });

  console.log('[StudyRoom WebSocket Server] Initialized on path /ws/study-room');
}

function broadcastToRoom(wss: WebSocketServer, roomId: string, payload: any, skipSocket?: WebSocket) {
  const json = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== skipSocket) {
      client.send(json);
    }
  });
}

// REST API helper to list public rooms for frontend room browser
export function getActiveStudyRoomsList() {
  initializeDefaultRooms();
  return Array.from(activeRooms.values()).map(r => ({
    roomId: r.roomId,
    title: r.title,
    subject: r.subject,
    hostName: r.hostName,
    participantCount: r.participants.size,
    isTimerRunning: r.timerState.isRunning,
    participants: Array.from(r.participants.values()).map(p => ({ id: p.id, name: p.name, avatar: p.avatar }))
  }));
}
