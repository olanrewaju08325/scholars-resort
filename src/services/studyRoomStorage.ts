import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { StudyRoomRecord, StudyRoomMeta, RoomParticipant, WhiteboardStroke, RoomTimerState, RoomChatMessage } from '../types/studyRoomTypes';

const LOCAL_ROOMS_FILE = path.join(process.cwd(), '.data_study_rooms.json');

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

// In-memory runtime cache
let memoryRoomsCache: Map<string, StudyRoomRecord> | null = null;

function readFromDisk(): StudyRoomRecord[] {
  try {
    if (fs.existsSync(LOCAL_ROOMS_FILE)) {
      const content = fs.readFileSync(LOCAL_ROOMS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[StudyRoomStorage] Warning reading from local disk:', err);
  }
  return [];
}

function writeToDisk(rooms: StudyRoomRecord[]): void {
  try {
    fs.writeFileSync(LOCAL_ROOMS_FILE, JSON.stringify(rooms, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[StudyRoomStorage] Warning writing to local disk:', err);
  }
}

async function syncWithSupabase(rooms: StudyRoomRecord[]): Promise<void> {
  try {
    const serialized = rooms.map(r => ({
      roomId: r.roomId,
      title: r.title,
      subject: r.subject,
      hostName: r.hostName,
      hostId: r.hostId,
      isOfficial: r.isOfficial,
      topic: r.topic,
      status: r.status,
      participantCount: r.participantCount,
      isTimerRunning: r.isTimerRunning,
      participants: r.participants,
      whiteboardStrokes: r.whiteboardStrokes?.slice(-50) || [],
      timerState: r.timerState,
      messages: r.messages?.slice(-30) || [],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    await supabase
      .from('admin_settings')
      .upsert({
        setting_key: 'peer_study_rooms',
        setting_value: serialized,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
  } catch (err) {
    console.warn('[StudyRoomStorage] Background Supabase sync warning:', err);
  }
}

async function fetchFromSupabase(): Promise<StudyRoomRecord[]> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'peer_study_rooms')
      .maybeSingle();

    if (!error && data?.setting_value && Array.isArray(data.setting_value)) {
      return data.setting_value;
    }
  } catch (err) {
    console.warn('[StudyRoomStorage] Supabase fetch fallback warning:', err);
  }
  return [];
}

export function loadAllRooms(): StudyRoomRecord[] {
  if (memoryRoomsCache !== null) {
    return Array.from(memoryRoomsCache.values());
  }

  // 1. First priority: local disk
  let diskRooms = readFromDisk();

  // If local disk was empty, check if we need to hydrate async from supabase
  if (diskRooms.length === 0) {
    fetchFromSupabase().then((dbRooms) => {
      if (dbRooms.length > 0 && memoryRoomsCache && memoryRoomsCache.size === 0) {
        dbRooms.forEach(r => memoryRoomsCache!.set(r.roomId, r));
        writeToDisk(dbRooms);
      }
    }).catch(() => {});
  }

  memoryRoomsCache = new Map();
  diskRooms.forEach(r => memoryRoomsCache!.set(r.roomId, r));
  return Array.from(memoryRoomsCache.values());
}

export function getStoredStudyRooms(filter?: { subject?: string; status?: string }): StudyRoomRecord[] {
  const all = loadAllRooms();
  let result = all.filter(r => r.status !== 'archived');
  if (filter?.subject && filter.subject !== 'All') {
    result = result.filter(r => r.subject.toLowerCase() === filter.subject!.toLowerCase());
  }
  if (filter?.status) {
    result = result.filter(r => r.status === filter.status);
  }
  return result;
}

export function getStudyRoomsMetaList(filter?: { subject?: string; status?: string }): StudyRoomMeta[] {
  return getStoredStudyRooms(filter).map(r => ({
    roomId: r.roomId,
    title: r.title,
    subject: r.subject,
    hostName: r.hostName,
    hostId: r.hostId,
    isOfficial: r.isOfficial,
    topic: r.topic,
    status: r.status,
    participantCount: r.participants?.length || 0,
    isTimerRunning: Boolean(r.timerState?.isRunning),
    participants: (r.participants || []).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar
    })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }));
}

export function getStudyRoomById(roomId: string): StudyRoomRecord | null {
  loadAllRooms();
  return memoryRoomsCache?.get(roomId) || null;
}

export function saveStoredStudyRooms(rooms: StudyRoomRecord[]): void {
  if (!memoryRoomsCache) memoryRoomsCache = new Map();
  memoryRoomsCache.clear();
  rooms.forEach(r => memoryRoomsCache!.set(r.roomId, r));

  writeToDisk(rooms);
  syncWithSupabase(rooms).catch(() => {});
}

export function createStudyRoom(params: {
  title: string;
  subject: string;
  hostName?: string;
  hostId?: string;
  isOfficial?: boolean;
  topic?: string;
  durationMinutes?: number;
}): StudyRoomRecord {
  loadAllRooms();

  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const durationSec = (params.durationMinutes || 25) * 60;

  const newRoom: StudyRoomRecord = {
    roomId,
    title: params.title.trim(),
    subject: params.subject || 'General',
    hostName: params.hostName?.trim() || 'Scholar Student',
    hostId: params.hostId,
    isOfficial: Boolean(params.isOfficial),
    topic: params.topic?.trim() || undefined,
    status: 'waiting',
    participantCount: 0,
    isTimerRunning: false,
    participants: [],
    whiteboardStrokes: [],
    timerState: {
      mode: 'sprint',
      durationSeconds: durationSec,
      remainingSeconds: durationSec,
      isRunning: false
    },
    messages: [
      {
        id: `msg_welcome_${Date.now()}`,
        senderId: 'system',
        senderName: 'System Bot',
        text: `Welcome to ${params.title}! ${params.isOfficial ? 'This is an official masterclass study room.' : 'Collaborate on the shared whiteboard, pin past questions, and stay focused.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'system'
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  memoryRoomsCache!.set(roomId, newRoom);
  const allRooms = Array.from(memoryRoomsCache!.values());
  writeToDisk(allRooms);
  syncWithSupabase(allRooms).catch(() => {});

  return newRoom;
}

export function updateStudyRoom(roomId: string, updates: Partial<StudyRoomRecord>): StudyRoomRecord | null {
  loadAllRooms();
  const existing = memoryRoomsCache?.get(roomId);
  if (!existing) return null;

  const updated: StudyRoomRecord = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (updates.participants) {
    updated.participantCount = updates.participants.length;
  }

  memoryRoomsCache!.set(roomId, updated);
  const allRooms = Array.from(memoryRoomsCache!.values());
  writeToDisk(allRooms);
  syncWithSupabase(allRooms).catch(() => {});

  return updated;
}

export function deleteStudyRoom(roomId: string): boolean {
  loadAllRooms();
  if (!memoryRoomsCache?.has(roomId)) return false;

  memoryRoomsCache.delete(roomId);
  const allRooms = Array.from(memoryRoomsCache.values());
  writeToDisk(allRooms);
  syncWithSupabase(allRooms).catch(() => {});
  return true;
}

export function joinRoomParticipant(
  roomId: string,
  participant: { id: string; name: string; avatar?: string }
): StudyRoomRecord | null {
  loadAllRooms();
  let room = memoryRoomsCache?.get(roomId);
  if (!room) return null;

  const existingIdx = room.participants.findIndex(p => p.id === participant.id);
  const pRecord: RoomParticipant = {
    id: participant.id,
    name: participant.name || 'Anonymous Scholar',
    avatar: participant.avatar || participant.name?.substring(0, 2).toUpperCase() || 'SC',
    isHandRaised: false,
    joinedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    room.participants[existingIdx] = pRecord;
  } else {
    room.participants.push(pRecord);
  }

  room.participantCount = room.participants.length;
  room.status = 'active';
  room.updatedAt = new Date().toISOString();

  memoryRoomsCache!.set(roomId, room);
  writeToDisk(Array.from(memoryRoomsCache!.values()));
  return room;
}

export function leaveRoomParticipant(
  roomId: string,
  participantId: string
): StudyRoomRecord | null {
  loadAllRooms();
  let room = memoryRoomsCache?.get(roomId);
  if (!room) return null;

  room.participants = room.participants.filter(p => p.id !== participantId);
  room.participantCount = room.participants.length;
  if (room.participantCount === 0 && !room.isOfficial) {
    room.status = 'waiting';
  }
  room.updatedAt = new Date().toISOString();

  memoryRoomsCache!.set(roomId, room);
  writeToDisk(Array.from(memoryRoomsCache!.values()));
  return room;
}

export function saveRoomStroke(roomId: string, stroke: WhiteboardStroke): void {
  loadAllRooms();
  const room = memoryRoomsCache?.get(roomId);
  if (!room) return;

  room.whiteboardStrokes.push(stroke);
  if (room.whiteboardStrokes.length > 300) {
    room.whiteboardStrokes = room.whiteboardStrokes.slice(-300);
  }
  room.updatedAt = new Date().toISOString();
  writeToDisk(Array.from(memoryRoomsCache!.values()));
}

export function clearRoomWhiteboard(roomId: string): void {
  loadAllRooms();
  const room = memoryRoomsCache?.get(roomId);
  if (!room) return;

  room.whiteboardStrokes = [];
  room.updatedAt = new Date().toISOString();
  writeToDisk(Array.from(memoryRoomsCache!.values()));
}

export function saveRoomMessage(roomId: string, message: RoomChatMessage): void {
  loadAllRooms();
  const room = memoryRoomsCache?.get(roomId);
  if (!room) return;

  room.messages.push(message);
  if (room.messages.length > 100) {
    room.messages = room.messages.slice(-100);
  }
  room.updatedAt = new Date().toISOString();
  writeToDisk(Array.from(memoryRoomsCache!.values()));
}

export function updateRoomTimer(roomId: string, timerState: RoomTimerState): void {
  loadAllRooms();
  const room = memoryRoomsCache?.get(roomId);
  if (!room) return;

  room.timerState = timerState;
  room.isTimerRunning = timerState.isRunning;
  room.updatedAt = new Date().toISOString();
  writeToDisk(Array.from(memoryRoomsCache!.values()));
}
