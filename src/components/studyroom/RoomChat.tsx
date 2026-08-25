import React, { useState } from 'react';
import { 
  Send, 
  Users, 
  Hand, 
  Sparkles, 
  MessageSquare, 
  Shield, 
  Smile,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { RoomParticipant } from '@/types/studyRoomTypes';

interface RoomChatProps {
  participants: RoomParticipant[];
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: string;
    type?: 'chat' | 'system' | 'question';
  }>;
  onSendMessage: (text: string) => void;
  onToggleRaiseHand: () => void;
  onSendReactionEmoji: (emoji: string) => void;
  currentUserId?: string;
  isHandRaised: boolean;
  onOpenQuestionLauncher: () => void;
}

export const RoomChat: React.FC<RoomChatProps> = ({
  participants,
  messages,
  onSendMessage,
  onToggleRaiseHand,
  onSendReactionEmoji,
  currentUserId,
  isHandRaised,
  onOpenQuestionLauncher
}) => {
  const [textVal, setTextVal] = useState('');
  const reactions = ['🔥', '👏', '💡', '❓', '🎯', '🚀', '💯'];

  const handleSend = () => {
    if (!textVal.trim()) return;
    onSendMessage(textVal.trim());
    setTextVal('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full text-white overflow-hidden shadow-xl">
      {/* Header Tabs / Participant Counter */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold font-display uppercase tracking-wider text-slate-200">
            Room Chat & Peers
          </span>
        </div>

        <Badge variant="outline" className="bg-slate-900 text-blue-400 border-slate-800 text-xs font-mono font-bold flex items-center gap-1">
          <Users className="w-3 h-3" /> {participants.length} Active
        </Badge>
      </div>

      {/* Participants Horizontal Avatar Strip */}
      <div className="p-3 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto flex items-center gap-2 scrollbar-none">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-xl shrink-0 text-xs"
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] uppercase shadow-sm">
              {p.avatar || p.name.substring(0, 2)}
            </div>
            <span className="font-medium text-slate-200 max-w-[80px] truncate">{p.name}</span>
            {p.isHandRaised && (
              <span className="text-amber-400 animate-bounce" title="Hand Raised">🖐️</span>
            )}
          </div>
        ))}
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans text-xs">
        {messages.map((msg) => {
          const isSystem = msg.type === 'system';
          const isQuestion = msg.type === 'question';
          const isMe = msg.senderId === currentUserId;

          if (isSystem) {
            return (
              <div key={msg.id} className="p-2 bg-blue-950/40 border border-blue-800/40 rounded-xl text-blue-300 text-center text-[11px] italic">
                {msg.text}
              </div>
            );
          }

          if (isQuestion) {
            return (
              <div key={msg.id} className="p-2.5 bg-amber-950/30 border border-amber-800/50 rounded-xl text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-400 text-[11px]">
                  <Sparkles className="w-3 h-3" /> Shared Question to Whiteboard
                </div>
                <p className="text-[11px] text-slate-200">{msg.text}</p>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                <span className="font-bold text-slate-300">{msg.senderName}</span>
                <span>• {msg.timestamp}</span>
              </div>
              <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reaction Bar & Quick Actions */}
      <div className="p-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {reactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReactionEmoji(emoji)}
              className="p-1 hover:bg-slate-800 rounded-lg text-sm transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleRaiseHand}
            className={`text-xs font-bold px-2 py-1 h-8 ${
              isHandRaised ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Hand className="w-3.5 h-3.5 mr-1" /> {isHandRaised ? 'Lower' : 'Raise'}
          </Button>

          <Button
            size="sm"
            onClick={onOpenQuestionLauncher}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-2.5 py-1 h-8"
            title="Pick a question to share to whiteboard"
          >
            <HelpCircle className="w-3.5 h-3.5 mr-1" /> Post Q
          </Button>
        </div>
      </div>

      {/* Message Input Bar */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          placeholder="Type message to room..."
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <Button
          size="sm"
          onClick={handleSend}
          className="bg-blue-600 hover:bg-blue-500 text-white shrink-0 font-bold"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
