// CBT Engine Session Snapshot Service for Admin Diagnostics & Issue Reproduction
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/utils';
import { cbtPerformanceMonitor } from './cbtPerformanceMonitorService';

export interface CbtSessionSnapshot {
  id: string;
  createdAt: string;
  sessionTitle: string;
  examMode: string;
  subjectName?: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  timeRemainingSeconds: number;
  timeSpentSeconds: number;
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
  };
  questions: Array<{
    id: string;
    subject: string;
    topic?: string;
    year?: string | number;
    questionText: string;
    options: {
      a?: string;
      b?: string;
      c?: string;
      d?: string;
      [key: string]: any;
    };
    correctOption?: string;
    explanation?: string;
    image_url?: string;
  }>;
  answers: Record<string, string>;
  flaggedIndices: number[];
  visitedIndices?: number[];
  deviceTelemetry: {
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    isTouchDevice: boolean;
    onlineStatus: boolean;
    memoryHeapMB?: number;
    networkLatencyMs?: number;
    url: string;
  };
  reportedIssue?: string;
  tags?: string[];
}

const LOCAL_STORAGE_KEY = 'scholars_cbt_session_snapshots_v1';

export class CbtSnapshotService {
  /**
   * Captures the full live state of a CBT session
   */
  public static async captureSnapshot(params: {
    sessionTitle?: string;
    examMode: string;
    subjectName?: string;
    questions: any[];
    answers: Record<string, string>;
    flagged: Record<number, boolean> | number[];
    currentQuestionIdx: number;
    timeLeft: number;
    totalTime?: number;
    userProfile?: any;
    reportedIssue?: string;
  }): Promise<CbtSessionSnapshot> {
    const memoryMetrics = cbtPerformanceMonitor.getMemoryUsage();
    const netLatency = await cbtPerformanceMonitor.measureLatency();

    // Normalize flagged indices
    let flaggedIndices: number[] = [];
    if (Array.isArray(params.flagged)) {
      flaggedIndices = params.flagged;
    } else if (params.flagged && typeof params.flagged === 'object') {
      flaggedIndices = Object.entries(params.flagged)
        .filter(([_, isFlagged]) => Boolean(isFlagged))
        .map(([idx]) => parseInt(idx, 10));
    }

    const totalTime = params.totalTime || 120 * 60;
    const timeSpent = Math.max(0, totalTime - params.timeLeft);

    const snapshotId = `SNAP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const snapshot: CbtSessionSnapshot = {
      id: snapshotId,
      createdAt: new Date().toISOString(),
      sessionTitle: params.sessionTitle || `${String(params.examMode || 'CBT').toUpperCase()} Diagnostic Snapshot`,
      examMode: params.examMode,
      subjectName: params.subjectName || (params.questions[0]?.subject || 'UTME CBT'),
      totalQuestions: params.questions.length,
      currentQuestionIndex: params.currentQuestionIdx,
      timeRemainingSeconds: params.timeLeft,
      timeSpentSeconds: timeSpent,
      user: {
        id: params.userProfile?.id || 'anonymous_user',
        email: params.userProfile?.email || 'student@scholarsresort.com',
        name: params.userProfile?.full_name || params.userProfile?.email || 'Exam Candidate',
        role: params.userProfile?.role || 'student'
      },
      questions: params.questions.map(q => ({
        id: q.id,
        subject: q.subject || q.subject_name || 'General',
        topic: q.topic || q.topic_name,
        year: q.year,
        questionText: q.question || q.question_text || q.text || '',
        options: q.options || {
          a: q.option_a,
          b: q.option_b,
          c: q.option_c,
          d: q.option_d
        },
        correctOption: q.correct_option || q.correct_answer || q.answer,
        explanation: q.explanation,
        image_url: q.image_url || q.image
      })),
      answers: params.answers,
      flaggedIndices,
      deviceTelemetry: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1280,
        screenHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        isTouchDevice: typeof window !== 'undefined' ? ('ontouchstart' in window || navigator.maxTouchPoints > 0) : false,
        onlineStatus: typeof navigator !== 'undefined' ? navigator.onLine : true,
        memoryHeapMB: memoryMetrics.usedJSHeapMB,
        networkLatencyMs: netLatency.latency,
        url: typeof window !== 'undefined' ? window.location.href : ''
      },
      reportedIssue: params.reportedIssue,
      tags: [params.examMode, `${params.questions.length}Q`, `${Math.round(memoryMetrics.usedJSHeapMB)}MB-Heap`]
    };

    // 1. Save to Local Storage
    this.saveToLocalStorage(snapshot);

    // 2. Persist to server / Supabase audit & snapshots
    try {
      try {
        await fetch(getApiUrl('/api/cbt-snapshots'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot)
        });
      } catch {}

      // Also log activity entry
      try {
        await supabase.from('activity_logs').insert({
          user_id: params.userProfile?.id || null,
          activity_type: 'cbt_snapshot',
          action: `CBT Session Snapshot Captured: ${snapshot.id}`,
          metadata: {
            examMode: params.examMode,
            totalQ: params.questions.length,
            answeredQ: Object.keys(params.answers).length
          }
        });
      } catch {}
    } catch (persistErr) {
      console.warn('[CbtSnapshotService] Non-blocking cloud persistence notice:', persistErr);
    }

    return snapshot;
  }

  public static saveToLocalStorage(snapshot: CbtSessionSnapshot) {
    try {
      const existing = this.getAllFromLocalStorage();
      const updated = [snapshot, ...existing.filter(s => s.id !== snapshot.id)].slice(0, 50); // Keep last 50
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[CbtSnapshotService] LocalStorage save error:', e);
    }
  }

  public static getAllFromLocalStorage(): CbtSessionSnapshot[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static async fetchAllSnapshots(): Promise<CbtSessionSnapshot[]> {
    const local = this.getAllFromLocalStorage();
    try {
      const res = await fetch(getApiUrl('/api/cbt-snapshots'));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.snapshots)) {
          // Merge by ID
          const map = new Map<string, CbtSessionSnapshot>();
          local.forEach(s => map.set(s.id, s));
          json.snapshots.forEach((s: CbtSessionSnapshot) => map.set(s.id, s));
          return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      }
    } catch {
      // Return local
    }
    return local;
  }

  public static exportAsJSON(snapshot: CbtSessionSnapshot) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `CBT_Snapshot_${snapshot.id}_${snapshot.examMode}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  public static deleteSnapshot(id: string) {
    const existing = this.getAllFromLocalStorage();
    const updated = existing.filter(s => s.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  }
}
