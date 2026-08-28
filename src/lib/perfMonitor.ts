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
    
    // Only run in development or non-production environment
    const isDev = import.meta.env.DEV || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
    if (!isDev) return;

    this.isInitialized = true;
    
    try {
      const originalFetch = window.fetch ? window.fetch.bind(window) : globalThis.fetch?.bind(globalThis);
      if (!originalFetch) return;
      
      const self = this;

      const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const startTime = performance.now();
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request)?.url || 'unknown-url';
        const method = init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET');

        try {
          const response = await originalFetch(input, init);
          const durationMs = performance.now() - startTime;
          const isSlow = durationMs > self.SLOW_API_THRESHOLD_MS;

          const metric: ApiCallMetric = {
            url,
            method,
            durationMs,
            status: response.status,
            timestamp: new Date().toISOString(),
            isSlow
          };

          self.metrics.push(metric);
          if (self.metrics.length > 200) self.metrics.shift(); // keep memory lean

          if (isSlow) {
            console.warn(
              `%c🚨 [SLOW API LATENCY > 2s] ${method.toUpperCase()} ${url} took ${(durationMs / 1000).toFixed(2)}s (${durationMs.toFixed(0)}ms) [Status: ${response.status}]`,
              'background: #7f1d1d; color: #fecaca; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
              {
                url,
                durationMs: Math.round(durationMs),
                status: response.status,
                threshold: `${self.SLOW_API_THRESHOLD_MS}ms`,
                timestamp: metric.timestamp
              }
            );
          } else if (durationMs > 500) {
            // Moderate latency log for dev visibility
            console.debug(`⏱️ [API Latency] ${method.toUpperCase()} ${url.split('?')[0]} - ${durationMs.toFixed(0)}ms`);
          }

          return response;
        } catch (error: any) {
          const durationMs = performance.now() - startTime;
          const isSlow = durationMs > self.SLOW_API_THRESHOLD_MS;

          self.metrics.push({
            url,
            method,
            durationMs,
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            isSlow
          });

          if (isSlow) {
            console.warn(
              `%c🚨 [SLOW FAILED API > 2s] ${method.toUpperCase()} ${url} failed after ${(durationMs / 1000).toFixed(2)}s: ${error?.message || error}`,
              'background: #7f1d1d; color: #fecaca; font-weight: bold; padding: 2px 6px; border-radius: 4px;'
            );
          }
          throw error;
        }
      };

      // Safely apply customFetch without breaking getter-only window properties
      const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');
      if (descriptor && !descriptor.writable && !descriptor.set) {
        Object.defineProperty(window, 'fetch', {
          value: customFetch,
          writable: true,
          configurable: true
        });
      } else {
        (window as any).fetch = customFetch;
      }

      console.info(
        '%c⚡ [PerfMonitor] API latency interceptor active in DEV mode (Alerts on requests > 2000ms)',
        'color: #10b981; font-weight: bold;'
      );
    } catch (interceptErr) {
      console.debug('[PerfMonitor] Note: window.fetch could not be monkey-patched in this environment (likely read-only). Using explicit trackOperation.', interceptErr);
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
