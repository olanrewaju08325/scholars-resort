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
}
