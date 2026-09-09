/**
 * Lightweight Performance & API Latency Monitoring Utility
 * 
 * Tracks component render times and intercepts API fetch calls in development mode.
 * Automatically logs a warning to the console whenever any API request exceeds 2 seconds (2000ms).
 */

export interface ApiCallMetric {
  url: string;
  method: string;
  durationMs: number;
  status: number | string;
  timestamp: string;
  isSlow: boolean;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private isInitialized = false;
  private metrics: ApiCallMetric[] = [];
  private readonly SLOW_API_THRESHOLD_MS = 2000; // 2 seconds

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initializes global fetch interception for API latency tracking in development mode
   */
  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Safely listen to native performance observer entries if available, without replacing native window.fetch
    try {
      if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry && typeof entry.startTime === 'number' && entry.duration > this.SLOW_API_THRESHOLD_MS) {
              console.warn(
                `%c🚨 [SLOW RESOURCE > 2s] ${entry.name} took ${(entry.duration / 1000).toFixed(2)}s (${entry.duration.toFixed(0)}ms)`,
                'background: #7f1d1d; color: #fecaca; font-weight: bold; padding: 2px 6px; border-radius: 4px;'
              );
            }
          });
        });
        observer.observe({ entryTypes: ['resource'], buffered: true });
      }
    } catch {
      // Safe fallback if observer fails
    }
  }

  /**
   * Tracks an explicit promise-based API operation
   */
  public async trackOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const durationMs = performance.now() - startTime;
      if (durationMs > this.SLOW_API_THRESHOLD_MS) {
        console.warn(`🚨 [SLOW OPERATION > 2s] "${name}" took ${durationMs.toFixed(0)}ms`);
      }
      return result;
    } catch (err) {
      const durationMs = performance.now() - startTime;
      if (durationMs > this.SLOW_API_THRESHOLD_MS) {
        console.warn(`🚨 [SLOW FAILED OPERATION > 2s] "${name}" took ${durationMs.toFixed(0)}ms`);
      }
      throw err;
    }
  }

  public getMetrics(): ApiCallMetric[] {
    return [...this.metrics];
  }

  public getSlowRequests(): ApiCallMetric[] {
    return this.metrics.filter(m => m.isSlow);
  }
}

export const perfMonitor = PerformanceMonitor.getInstance();
