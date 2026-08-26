/**
 * CBT Performance Audit Service
 * 
 * Logs UI render times and API latency for the CBT Engine.
 * Categorizes latency by subject/question category and flags categories causing delays (>800ms API or >150ms render).
 * Integrates with Admin Dashboard for live audit inspection.
 */

export interface PerformanceMetricLog {
  id: string;
  timestamp: string;
  category: string; // Subject or Question Category (e.g. Mathematics, Use of English)
  mode: string; // Full Mock, Practice, Speed Test, etc.
  apiLatencyMs: number;
  uiRenderTimeMs: number;
  totalTimeMs: number;
  questionCount: number;
  isSlow: boolean; // Flagged if total latency > threshold
  slowReason?: string;
  deviceType: string;
}

export interface CategoryPerformanceSummary {
  category: string;
  totalLogs: number;
  avgApiLatencyMs: number;
  avgUiRenderMs: number;
  avgTotalTimeMs: number;
  slowRequestCount: number;
  slowPercentage: number;
  status: 'Optimal' | 'Acceptable' | 'High Delay / Action Needed';
}

const PERFORMANCE_LOGS_KEY = 'scholars_cbt_perf_audit_logs';

export class CBTPerformanceAuditService {
  private static logsMemory: PerformanceMetricLog[] = [];

  /**
   * Initialize logs from localStorage
   */
  private static getStoredLogs(): PerformanceMetricLog[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(PERFORMANCE_LOGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [];
  }

  private static saveLogs(logs: PerformanceMetricLog[]): void {
    if (typeof window === 'undefined') return;
    try {
      // Keep max 200 logs locally
      const trimmed = logs.slice(0, 200);
      localStorage.setItem(PERFORMANCE_LOGS_KEY, JSON.stringify(trimmed));
      this.logsMemory = trimmed;
    } catch {}
  }

  /**
   * Record a performance metric log for question fetching / rendering
   */
  public static recordMetric(data: {
    category: string;
    mode: string;
    apiLatencyMs: number;
    uiRenderTimeMs: number;
    questionCount?: number;
  }): PerformanceMetricLog {
    const totalTimeMs = data.apiLatencyMs + data.uiRenderTimeMs;
    const isSlow = data.apiLatencyMs > 800 || data.uiRenderTimeMs > 150 || totalTimeMs > 1000;
    
    let slowReason = undefined;
    if (isSlow) {
      if (data.apiLatencyMs > 800) slowReason = 'High API Query Latency (>800ms)';
      else if (data.uiRenderTimeMs > 150) slowReason = 'Slow React DOM Render (>150ms)';
      else slowReason = 'Combined Fetch + Render Latency Exceeded 1000ms';
    }

    const log: PerformanceMetricLog = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      category: data.category || 'General CBT',
      mode: data.mode || 'subject_practice',
      apiLatencyMs: Math.round(data.apiLatencyMs),
      uiRenderTimeMs: Math.round(data.uiRenderTimeMs),
      totalTimeMs: Math.round(totalTimeMs),
      questionCount: data.questionCount || 1,
      isSlow,
      slowReason,
      deviceType: typeof window !== 'undefined' && window.innerWidth < 768 ? 'Mobile Device' : 'Desktop Browser'
    };

    const currentLogs = this.getStoredLogs();
    currentLogs.unshift(log);
    this.saveLogs(currentLogs);

    // Dispatch custom event for admin live listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scholars:cbt-perf-update', { detail: log }));
    }

    return log;
  }

  /**
   * Get all metric logs
   */
  public static getLogs(): PerformanceMetricLog[] {
    return this.getStoredLogs();
  }

  /**
   * Get category-wise performance summary (grouping logs by subject/category)
   */
  public static getCategorySummaries(): CategoryPerformanceSummary[] {
    const logs = this.getStoredLogs();
    const map = new Map<string, {
      totalLogs: number;
      sumApi: number;
      sumUi: number;
      sumTotal: number;
      slowCount: number;
    }>();

    logs.forEach(log => {
      const cat = log.category || 'General CBT';
      const existing = map.get(cat) || { totalLogs: 0, sumApi: 0, sumUi: 0, sumTotal: 0, slowCount: 0 };
      existing.totalLogs += 1;
      existing.sumApi += log.apiLatencyMs;
      existing.sumUi += log.uiRenderTimeMs;
      existing.sumTotal += log.totalTimeMs;
      if (log.isSlow) existing.slowCount += 1;
      map.set(cat, existing);
    });

    const summaries: CategoryPerformanceSummary[] = [];
    map.forEach((val, cat) => {
      const avgApi = Math.round(val.sumApi / val.totalLogs);
      const avgUi = Math.round(val.sumUi / val.totalLogs);
      const avgTotal = Math.round(val.sumTotal / val.totalLogs);
      const slowPct = Math.round((val.slowCount / val.totalLogs) * 100);

      let status: CategoryPerformanceSummary['status'] = 'Optimal';
      if (avgTotal > 900 || slowPct > 35) {
        status = 'High Delay / Action Needed';
      } else if (avgTotal > 400 || slowPct > 15) {
        status = 'Acceptable';
      }

      summaries.push({
        category: cat,
        totalLogs: val.totalLogs,
        avgApiLatencyMs: avgApi,
        avgUiRenderMs: avgUi,
        avgTotalTimeMs: avgTotal,
        slowRequestCount: val.slowCount,
        slowPercentage: slowPct,
        status
      });
    });

    return summaries.sort((a, b) => b.avgTotalTimeMs - a.avgTotalTimeMs);
  }

  /**
   * Clear performance audit logs
   */
  public static clearLogs(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PERFORMANCE_LOGS_KEY);
      window.dispatchEvent(new CustomEvent('scholars:cbt-perf-update'));
    }
  }
}
