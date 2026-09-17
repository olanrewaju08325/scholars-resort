/**
 * Tournament Scheduling, UTC Timestamp Validation & Force-Unlock Engine
 * Ensures start_time validation strictly against client's current UTC timestamp,
 * bypassing potential cached session flags or stale lock statuses.
 */

export interface TournamentUnlockValidation {
  isStarted: boolean;
  isUnlocked: boolean;
  isLive: boolean;
  timeDiffMs: number;
  startTimeMs: number;
  nowUtcMs: number;
  forceUnlocked: boolean;
  formattedCountdown: string;
}

let clientServerOffsetMs = 0;
let lastSyncTimeMs = 0;

/**
 * Synchronizes client clock with server time by querying server header/API.
 */
export async function syncClientWithServerTime(): Promise<{ offsetMs: number; serverNowMs: number }> {
  try {
    const fetchStart = Date.now();
    const res = await fetch('/api/health');
    const fetchEnd = Date.now();
    const latency = (fetchEnd - fetchStart) / 2;

    if (res.ok) {
      const data = await res.json();
      const serverDateHeader = res.headers.get('date');
      let serverTimeMs = data?.timestamp ? new Date(data.timestamp).getTime() : 0;
      if (!serverTimeMs && serverDateHeader) {
        serverTimeMs = new Date(serverDateHeader).getTime();
      }

      if (serverTimeMs) {
        clientServerOffsetMs = (serverTimeMs + latency) - Date.now();
        lastSyncTimeMs = Date.now();
      }
    }
  } catch (err) {
    console.warn('[ClientTimeSync] Clock sync notice:', err);
  }

  return {
    offsetMs: clientServerOffsetMs,
    serverNowMs: Date.now() + clientServerOffsetMs
  };
}

/**
 * Returns the current synced timestamp in milliseconds (client clock + server offset).
 */
export function getSyncedNowMs(): number {
  return Date.now() + clientServerOffsetMs;
}

/**
 * Returns the current client UTC timestamp in milliseconds.
 */
export function getCurrentUtcTimestamp(): number {
  return getSyncedNowMs();
}

/**
 * Safely parses tournament start_time into a UTC millisecond timestamp.
 */
export function parseTournamentStartTimeUtc(startTime?: string | number | null): number {
  if (!startTime) return 0;
  if (typeof startTime === 'number') return startTime;
  
  const parsed = new Date(startTime).getTime();
  if (isNaN(parsed)) {
    // Try trimming or appending Z if not formatted with timezone
    const normalized = String(startTime).trim().replace(' ', 'T');
    const retry = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`).getTime();
    return isNaN(retry) ? 0 : retry;
  }
  return parsed;
}

/**
 * Validates start_time against the current client UTC timestamp.
 */
export function validateStartTimeAgainstUtc(
  startTime?: string | number | null,
  customNowUtc?: number
): { isStarted: boolean; timeDiffMs: number; startTimeMs: number; nowUtc: number } {
  const nowUtc = typeof customNowUtc === 'number' ? customNowUtc : getCurrentUtcTimestamp();
  const startTimeMs = parseTournamentStartTimeUtc(startTime);

  if (!startTimeMs) {
    return { isStarted: false, timeDiffMs: 0, startTimeMs: 0, nowUtc };
  }

  const timeDiffMs = startTimeMs - nowUtc;
  const isStarted = timeDiffMs <= 0;

  return { isStarted, timeDiffMs, startTimeMs, nowUtc };
}

/**
 * Validates tournament start_time against client current UTC timestamp
 * and forces an unlock state if the condition (currentTimeUtc >= startTimeUtc) is met,
 * completely bypassing potential cached session flags or stale 'locked' database fields.
 */
export function forceCheckTournamentUnlock<T extends Record<string, any>>(
  tournament: T | null | undefined,
  customNowUtc?: number
): { tournament: T; validation: TournamentUnlockValidation } {
  if (!tournament) {
    const emptyValidation: TournamentUnlockValidation = {
      isStarted: false,
      isUnlocked: false,
      isLive: false,
      timeDiffMs: 0,
      startTimeMs: 0,
      nowUtcMs: getCurrentUtcTimestamp(),
      forceUnlocked: false,
      formattedCountdown: 'Starting Soon'
    };
    return { tournament: tournament as T, validation: emptyValidation };
  }

  const nowUtc = typeof customNowUtc === 'number' ? customNowUtc : getCurrentUtcTimestamp();
  const startTimeMs = parseTournamentStartTimeUtc(tournament.start_time || tournament.startTime);
  const timeDiffMs = startTimeMs > 0 ? startTimeMs - nowUtc : 1000;
  const isTimeReached = startTimeMs > 0 ? timeDiffMs <= 0 : false;
  
  // If completed or cancelled, preserve terminal status
  const isCompleted = tournament.status === 'completed' || tournament.status === 'cancelled';

  // If time is reached, we FORCE UNLOCK: bypassing cached session flags or stale 'locked' status
  const shouldForceUnlock = isTimeReached && !isCompleted;
  const isExplicitlyActive = tournament.status === 'active' && !isCompleted;
  const isUnlocked = shouldForceUnlock || isExplicitlyActive;

  // Clear any stale local cache keys for this tournament
  if (shouldForceUnlock && typeof window !== 'undefined') {
    try {
      const tid = tournament.id || tournament.legacy_id;
      if (tid) {
        localStorage.removeItem(`tournament_locked_${tid}`);
        sessionStorage.removeItem(`tournament_locked_${tid}`);
        localStorage.removeItem(`tournament_cache_${tid}`);
      }
    } catch (_) {}
  }

  const updatedStatus = isCompleted 
    ? tournament.status 
    : isUnlocked 
    ? 'active' 
    : (tournament.status || 'upcoming');

  const validation: TournamentUnlockValidation = {
    isStarted: isTimeReached,
    isUnlocked,
    isLive: isUnlocked,
    timeDiffMs,
    startTimeMs,
    nowUtcMs: nowUtc,
    forceUnlocked: shouldForceUnlock && tournament.status === 'locked',
    formattedCountdown: formatTournamentCountdown(timeDiffMs)
  };

  const unlockedTournament: T = {
    ...tournament,
    status: updatedStatus,
    is_locked: isCompleted ? true : !isUnlocked,
    is_unlocked: isUnlocked,
    isLive: isUnlocked,
    force_unlocked: validation.forceUnlocked
  };

  return { tournament: unlockedTournament, validation };
}

/**
 * Formats countdown milliseconds into human-readable duration
 */
export function formatTournamentCountdown(diffMs: number): string {
  if (diffMs <= 0) return 'Starting Now';
  
  const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diffMs / 1000 / 60) % 60);
  const s = Math.floor((diffMs / 1000) % 60);

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}
