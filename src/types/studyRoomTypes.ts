export interface RoomParticipant {
  id: string;
  name: string;
  avatar: string;
  isHandRaised: boolean;
  joinedAt: string;
}

export interface WhiteboardStroke {
  id: string;
  type: 'pen' | 'line' | 'rect' | 'circle' | 'eraser' | 'text' | 'question_overlay';
  color: string;
  width: number;
  points?: { x: number; y: number }[];
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  text?: string;
  questionData?: any;
}

export interface RoomTimerState {
  mode: 'pomodoro' | 'sprint' | 'break';
  durationSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  startedAt?: number;
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  type?: 'chat' | 'system' | 'question';
  questionData?: any;
}

export interface StudyRoomRecord {
  roomId: string;
  title: string;
  subject: string;
  hostName: string;
  hostId?: string;
  isOfficial?: boolean;
  topic?: string;
  status: 'active' | 'waiting' | 'concluded' | 'archived';
  participantCount: number;
  isTimerRunning: boolean;
  participants: RoomParticipant[];
  whiteboardStrokes: WhiteboardStroke[];
  timerState: RoomTimerState;
  messages: RoomChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface StudyRoomMeta {
  roomId: string;
  title: string;
  subject: string;
  hostName: string;
  hostId?: string;
  isOfficial?: boolean;
  topic?: string;
  status: 'active' | 'waiting' | 'concluded' | 'archived';
  participantCount: number;
  isTimerRunning: boolean;
  participants: Array<{ id: string; name: string; avatar: string }>;
  createdAt?: string;
  updatedAt?: string;
}
