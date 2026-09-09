import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RoomParticipant, WhiteboardStroke, RoomTimerState, RoomChatMessage, StudyRoomRecord } from '../types/studyRoomTypes';
import {
  getStudyRoomById,
  createStudyRoom as storageCreateRoom,
  joinRoomParticipant,
  leaveRoomParticipant,
  saveRoomStroke,
  clearRoomWhiteboard,
  saveRoomMessage,
  updateRoomTimer,
  getStudyRoomsMetaList
} from './studyRoomStorage';

export type { RoomParticipant, WhiteboardStroke, RoomTimerState, RoomChatMessage };

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

        // Ensure room exists in persistent storage
        let room = getStudyRoomById(roomId);
        if (!room) {
          room = storageCreateRoom({
            title: payload.roomTitle || `UTME ${payload.subject || 'General'} Study Room`,
            subject: payload.subject || 'General',
            hostName: userName || 'Scholar Peer'
          });
        }

        switch (type) {
          case 'join_room': {
            clientSockets.set(ws, { roomId, userId, userName });

            // Record participant in persistent storage
            const updatedRoom = joinRoomParticipant(roomId, {
              id: userId,
              name: userName || 'Anonymous Scholar',
              avatar: avatar || userName?.substring(0, 2).toUpperCase() || 'SC'
            }) || room;

            // Send current full state to newly joined participant
            ws.send(JSON.stringify({
              type: 'room_init_state',
              roomId,
              title: updatedRoom.title,
              subject: updatedRoom.subject,
              participants: updatedRoom.participants,
              whiteboardStrokes: updatedRoom.whiteboardStrokes,
              timerState: updatedRoom.timerState,
              messages: updatedRoom.messages
            }));

            // Broadcast user joined to other clients in room
            broadcastToRoom(wss, clientSockets, roomId, {
              type: 'participant_joined',
              participant: updatedRoom.participants.find(p => p.id === userId),
              participants: updatedRoom.participants,
              systemMessage: `${userName || 'A scholar'} joined the study room.`
            }, ws);
            break;
          }

          case 'draw_stroke': {
            if (data?.stroke) {
              saveRoomStroke(roomId, data.stroke);
              broadcastToRoom(wss, clientSockets, roomId, {
                type: 'draw_stroke_broadcast',
                stroke: data.stroke,
                senderId: userId
              }, ws);
            }
            break;
          }

          case 'clear_whiteboard': {
            clearRoomWhiteboard(roomId);
            broadcastToRoom(wss, clientSockets, roomId, {
              type: 'clear_whiteboard_broadcast',
              clearedBy: userName
            });
            break;
          }

          case 'chat_message': {
            if (data?.text) {
              const msg: RoomChatMessage = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                senderId: userId,
                senderName: userName,
                text: data.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'chat'
              };
              saveRoomMessage(roomId, msg);

              broadcastToRoom(wss, clientSockets, roomId, {
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
              saveRoomStroke(roomId, stroke);

              const sysMsg: RoomChatMessage = {
                id: `msg_q_${Date.now()}`,
                senderId: userId,
                senderName: userName,
                text: `Shared UTME Question: "${data.question.question_text?.substring(0, 80)}..." onto whiteboard!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'question',
                questionData: data.question
              };
              saveRoomMessage(roomId, sysMsg);

              broadcastToRoom(wss, clientSockets, roomId, {
                type: 'question_shared_broadcast',
                stroke,
                message: sysMsg
              });
            }
            break;
          }

          case 'update_timer': {
            if (data?.timerAction) {
              const currentRoom = getStudyRoomById(roomId);
              const timer = currentRoom?.timerState || {
                mode: 'sprint',
                durationSeconds: 1500,
                remainingSeconds: 1500,
                isRunning: false
              };

              const { action, duration } = data;
              if (action === 'start') {
                timer.isRunning = true;
              } else if (action === 'pause') {
                timer.isRunning = false;
              } else if (action === 'reset') {
                timer.isRunning = false;
                timer.remainingSeconds = duration || timer.durationSeconds;
              } else if (action === 'tick' && typeof data.remainingSeconds === 'number') {
                timer.remainingSeconds = data.remainingSeconds;
              }

              updateRoomTimer(roomId, timer);

              broadcastToRoom(wss, clientSockets, roomId, {
                type: 'timer_updated_broadcast',
                timerState: timer,
                action,
                updatedBy: userName
              });
            }
            break;
          }

          case 'toggle_raise_hand': {
            const currentRoom = getStudyRoomById(roomId);
            if (currentRoom) {
              const p = currentRoom.participants.find(part => part.id === userId);
              if (p) {
                p.isHandRaised = !p.isHandRaised;
                broadcastToRoom(wss, clientSockets, roomId, {
                  type: 'participant_hand_toggled',
                  userId,
                  isHandRaised: p.isHandRaised,
                  participants: currentRoom.participants
                });
              }
            }
            break;
          }

          case 'reaction_emoji': {
            if (data?.emoji) {
              broadcastToRoom(wss, clientSockets, roomId, {
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
        const updatedRoom = leaveRoomParticipant(roomId, userId);
        broadcastToRoom(wss, clientSockets, roomId, {
          type: 'participant_left',
          userId,
          userName,
          participants: updatedRoom?.participants || []
        });
        clientSockets.delete(ws);
      }
    });
  });

  console.log('[StudyRoom WebSocket Server] Initialized on path /ws/study-room');
}

function broadcastToRoom(
  wss: WebSocketServer,
  clientSockets: Map<WebSocket, { roomId: string; userId: string; userName: string }>,
  roomId: string,
  payload: any,
  skipSocket?: WebSocket
) {
  const json = JSON.stringify(payload);
  clientSockets.forEach((clientInfo, clientWs) => {
    if (clientInfo.roomId === roomId && clientWs.readyState === WebSocket.OPEN && clientWs !== skipSocket) {
      clientWs.send(json);
    }
  });
}

// REST API helper to list public rooms for frontend room browser
export function getActiveStudyRoomsList() {
  return getStudyRoomsMetaList();
}

export function createStudyRoom(params: { title: string; subject: string; hostName?: string; isOfficial?: boolean; topic?: string }) {
  return storageCreateRoom(params);
}
