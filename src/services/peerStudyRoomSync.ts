import { supabase } from '@/lib/supabase';
import { type StudyRoomMeta, type StudyRoomRecord, type RoomParticipant } from '@/types/studyRoomTypes';

const LOBBY_CHANNEL_NAME = 'study_rooms_global_lobby';
const LOCAL_STORAGE_KEY = 'scholars_resort_study_rooms_cache';
const BROADCAST_CHANNEL_NAME = 'scholars_peer_study_rooms_sync';

// Obsolete mock room IDs that must never reappear
const OBSOLETE_MOCK_ROOM_IDS = new Set([
  'room_utme_english_mastery',
  'room_utme_physics_mechanics',
  'room_utme_math_calculus'
]);

class PeerStudyRoomSyncService {
  private lobbyChannel: any = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<(rooms: StudyRoomMeta[]) => void> = new Set();
  private knownRoomsMap: Map<string, StudyRoomMeta> = new Map();
  private isInitialized = false;
  private activeRoomBeingTracked: StudyRoomMeta | null = null;

  constructor() {
    this.loadFromLocalStorage();
    this.initLocalBroadcast();
  }

  private loadFromLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach((r: StudyRoomMeta) => {
              if (r && r.roomId && !OBSOLETE_MOCK_ROOM_IDS.has(r.roomId)) {
                this.knownRoomsMap.set(r.roomId, r);
              }
            });
          }
        }
        // Save cleaned list immediately
        this.saveToLocalStorage();
      }
    } catch (_) {}
  }

  private saveToLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const list = Array.from(this.knownRoomsMap.values());
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      }
    } catch (_) {}
  }

  private initLocalBroadcast() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.localBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.localBroadcastChannel.onmessage = (event) => {
          const { type, room, roomId, rooms } = event.data || {};
          if (type === 'ROOM_CREATED' || type === 'ROOM_UPDATED') {
            if (room?.roomId) {
              this.knownRoomsMap.set(room.roomId, room);
              this.saveToLocalStorage();
              this.notifyListeners();
            }
          } else if (type === 'ROOM_DELETED') {
            if (roomId) {
              this.knownRoomsMap.delete(roomId);
              this.saveToLocalStorage();
              this.notifyListeners();
            }
          } else if (type === 'ROOMS_SYNC') {
            if (Array.isArray(rooms)) {
              rooms.forEach((r: StudyRoomMeta) => this.knownRoomsMap.set(r.roomId, r));
              this.saveToLocalStorage();
              this.notifyListeners();
            }
          }
        };
      } catch (_) {}
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
              parsed.forEach((r: StudyRoomMeta) => this.knownRoomsMap.set(r.roomId, r));
              this.notifyListeners();
            }
          } catch (_) {}
        }
      });
    }
  }

  public initGlobalLobby() {
    if (this.isInitialized && this.lobbyChannel) return;
    this.isInitialized = true;

    try {
      this.lobbyChannel = supabase.channel(LOBBY_CHANNEL_NAME, {
        config: {
          broadcast: { self: true },
          presence: { key: 'lobby_peer' }
        }
      });

      this.lobbyChannel
        .on('broadcast', { event: 'room_created' }, ({ payload }: any) => {
          if (payload?.room?.roomId) {
            this.knownRoomsMap.set(payload.room.roomId, payload.room);
            this.saveToLocalStorage();
            this.notifyListeners();
          }
        })
        .on('broadcast', { event: 'room_updated' }, ({ payload }: any) => {
          if (payload?.room?.roomId) {
            this.knownRoomsMap.set(payload.room.roomId, payload.room);
            this.saveToLocalStorage();
            this.notifyListeners();
          }
        })
        .on('broadcast', { event: 'room_deleted' }, ({ payload }: any) => {
          if (payload?.roomId) {
            this.knownRoomsMap.delete(payload.roomId);
            this.saveToLocalStorage();
            this.notifyListeners();
          }
        })
        .on('broadcast', { event: 'request_lobby_sync' }, () => {
          if (this.activeRoomBeingTracked) {
            this.broadcastRoom(this.activeRoomBeingTracked, 'room_updated');
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const presenceState = this.lobbyChannel.presenceState();
          let hasChanges = false;

          Object.keys(presenceState).forEach((key) => {
            const presences = presenceState[key] as any[];
            presences.forEach((p) => {
              if (p?.activeRoom?.roomId) {
                const existing = this.knownRoomsMap.get(p.activeRoom.roomId);
                const updated = {
                  ...(existing || {}),
                  ...p.activeRoom,
                  participantCount: Math.max(p.activeRoom.participantCount || 1, existing?.participantCount || 1)
                };
                this.knownRoomsMap.set(p.activeRoom.roomId, updated);
                hasChanges = true;
              }
            });
          });

          if (hasChanges) {
            this.saveToLocalStorage();
            this.notifyListeners();
          }
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            // Request active rooms from any online hosts
            this.lobbyChannel.send({
              type: 'broadcast',
              event: 'request_lobby_sync',
              payload: {}
            });

            if (this.activeRoomBeingTracked) {
              await this.lobbyChannel.track({
                activeRoom: this.activeRoomBeingTracked,
                onlineAt: new Date().toISOString()
              });
            }
          }
        });
    } catch (err) {
      console.warn('[PeerStudyRoomSync] Realtime lobby connection error:', err);
    }

    // Also trigger background REST API fetch
    this.fetchRoomsFromApi();
  }

  public async fetchRoomsFromApi(): Promise<StudyRoomMeta[]> {
    try {
      const res = await fetch('/api/study-rooms', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.rooms && Array.isArray(json.rooms)) {
          json.rooms.forEach((r: StudyRoomMeta) => {
            if (r && r.roomId) {
              this.knownRoomsMap.set(r.roomId, r);
            }
          });
          this.saveToLocalStorage();
          this.notifyListeners();
        }
      }
    } catch (_) {}

    return this.getRoomsList();
  }

  public getRoomsList(): StudyRoomMeta[] {
    return Array.from(this.knownRoomsMap.values()).filter(r => r.status !== 'archived');
  }

  public subscribe(callback: (rooms: StudyRoomMeta[]) => void): () => void {
    this.initGlobalLobby();
    this.listeners.add(callback);
    // Send immediate snapshot
    callback(this.getRoomsList());

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    const list = this.getRoomsList();
    this.listeners.forEach(cb => {
      try {
        cb(list);
      } catch (_) {}
    });
  }

  public broadcastRoom(room: StudyRoomMeta, eventType: 'room_created' | 'room_updated' = 'room_created') {
    this.knownRoomsMap.set(room.roomId, room);
    this.saveToLocalStorage();
    this.notifyListeners();

    // 1. Broadcast via local BroadcastChannel
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage({
          type: eventType === 'room_created' ? 'ROOM_CREATED' : 'ROOM_UPDATED',
          room
        });
      } catch (_) {}
    }

    // 2. Broadcast via Supabase Realtime
    if (this.lobbyChannel) {
      try {
        this.lobbyChannel.send({
          type: 'broadcast',
          event: eventType,
          payload: { room }
        });
      } catch (_) {}
    }
  }

  public async deleteRoom(roomId: string): Promise<boolean> {
    this.broadcastRoomDeletion(roomId);
    try {
      const res = await fetch(`/api/study-rooms/${encodeURIComponent(roomId)}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public broadcastRoomDeletion(roomId: string) {
    this.knownRoomsMap.delete(roomId);
    this.saveToLocalStorage();
    this.notifyListeners();

    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage({
          type: 'ROOM_DELETED',
          roomId
        });
      } catch (_) {}
    }

    if (this.lobbyChannel) {
      try {
        this.lobbyChannel.send({
          type: 'broadcast',
          event: 'room_deleted',
          payload: { roomId }
        });
      } catch (_) {}
    }
  }

  public async trackActiveRoom(room: StudyRoomMeta | null) {
    this.activeRoomBeingTracked = room;
    if (!this.lobbyChannel) return;

    try {
      if (room) {
        await this.lobbyChannel.track({
          activeRoom: room,
          onlineAt: new Date().toISOString()
        });
        this.broadcastRoom(room, 'room_updated');
      } else {
        await this.lobbyChannel.untrack();
      }
    } catch (_) {}
  }

  public async createRoom(params: {
    title: string;
    subject: string;
    hostName: string;
    hostId?: string;
    isOfficial?: boolean;
    topic?: string;
    durationMinutes?: number;
  }): Promise<StudyRoomMeta> {
    const localId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRoom: StudyRoomMeta = {
      roomId: localId,
      title: params.title.trim(),
      subject: params.subject || 'General',
      hostName: params.hostName || 'Scholar Student',
      hostId: params.hostId,
      isOfficial: Boolean(params.isOfficial),
      topic: params.topic,
      status: 'active',
      participantCount: 1,
      isTimerRunning: false,
      participants: [{
        id: params.hostId || `user_${Date.now()}`,
        name: params.hostName || 'Scholar Student',
        avatar: (params.hostName || 'ST').substring(0, 2).toUpperCase()
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Broadcast immediately so all connected peers see it instantly
    this.broadcastRoom(newRoom, 'room_created');
    this.trackActiveRoom(newRoom);

    // Call REST API in background to persist
    try {
      const res = await fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          const apiRoom: StudyRoomMeta = {
            roomId: data.room.roomId,
            title: data.room.title,
            subject: data.room.subject,
            hostName: data.room.hostName,
            hostId: data.room.hostId,
            isOfficial: data.room.isOfficial,
            topic: data.room.topic,
            status: data.room.status,
            participantCount: Math.max(data.room.participantCount || 1, 1),
            isTimerRunning: Boolean(data.room.timerState?.isRunning),
            participants: data.room.participants || newRoom.participants,
            createdAt: data.room.createdAt,
            updatedAt: data.room.updatedAt
          };
          this.broadcastRoom(apiRoom, 'room_created');
          this.trackActiveRoom(apiRoom);
          return apiRoom;
        }
      }
    } catch (_) {}

    return newRoom;
  }
}

export const peerStudyRoomSync = new PeerStudyRoomSyncService();
