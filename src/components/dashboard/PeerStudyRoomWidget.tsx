import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, ArrowRight, Sparkles, Flame, Radio, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface RoomMeta {
  roomId: string;
  title: string;
  subject: string;
  hostName: string;
  participantCount: number;
  isTimerRunning: boolean;
  participants: Array<{ id: string; name: string; avatar: string }>;
}

export const PeerStudyRoomWidget: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<RoomMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/study-rooms');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.rooms) {
            setRooms(data.rooms);
          }
        }
      } catch (_) {
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const totalActivePeers = rooms.reduce((acc, r) => acc + (r.participantCount || 0), 0);

  return (
    <Card className="border-border shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                Peer Study Rooms
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-500" /> Live
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Collaborate in real-time with fellow UTME candidates
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/study-rooms')}
            className="h-8 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Create / Join
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5 border border-border/60">
          <span className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <strong className="text-foreground">{totalActivePeers}</strong> peers studying right now
          </span>
          <span className="text-[11px] font-medium">
            {rooms.length} active room{rooms.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="space-y-2 py-2">
            <div className="h-12 bg-muted/40 animate-pulse rounded-lg" />
            <div className="h-12 bg-muted/40 animate-pulse rounded-lg" />
          </div>
        ) : rooms.length > 0 ? (
          <div className="space-y-2">
            {rooms.slice(0, 3).map((room) => (
              <div
                key={room.roomId}
                onClick={() => navigate('/study-rooms')}
                className="group flex items-center justify-between p-3 rounded-xl border border-border/80 bg-background/80 hover:bg-muted/40 hover:border-primary/40 transition-all cursor-pointer"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                      {room.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-primary/5 text-primary border-primary/20 shrink-0">
                      {room.subject}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>Host: {room.hostName}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Users className="w-3 h-3" /> {room.participantCount} online
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-5 px-3 rounded-xl border border-dashed border-border bg-muted/20">
            <Sparkles className="w-6 h-6 text-primary/60 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-foreground">No active public rooms right now</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
              Start a shared study session for English, Physics, Biology, or Maths!
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/study-rooms')}
              className="h-7 text-xs font-semibold"
            >
              Start First Room
            </Button>
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => navigate('/study-rooms')}
          className="w-full text-xs font-semibold h-8 border-border hover:bg-muted/60"
        >
          Open Peer Study Hub <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
};
