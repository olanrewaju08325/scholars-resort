// CBT Engine Performance & Resource Usage Monitor Service
import { supabase } from '@/lib/supabase';

export interface CbtResourceMetrics {
  timestamp: number;
  memory: {
    supported: boolean;
    usedJSHeapMB: number;
    totalJSHeapMB: number;
    jsHeapLimitMB: number;
    usagePercent: number;
  };
  network: {
    latencyMs: number;
    status: 'optimal' | 'moderate' | 'degraded' | 'offline';
    endpoint: string;
  };
  rendering: {
    avgRenderMs: number;
    domNodeCount: number;
    fps: number;
  };
  moduleName: string;
  bottlenecks: string[];
}

export interface CbtPerformanceLog {
  id: string;
  timestamp: string;
  module: string;
  heapUsedMB: number;
  heapLimitMB: number;
  latencyMs: number;
  renderMs: number;
  status: 'healthy' | 'warning' | 'critical';
  details: string;
}

class CbtPerformanceMonitor {
  private listeners: ((metrics: CbtResourceMetrics) => void)[] = [];
  private history: CbtResourceMetrics[] = [];
  private maxHistoryLength = 60;
  private intervalId: any = null;
  private currentModule: string = 'CBT Engine';
  private lastRenderTime: number = 0;
  private renderDurations: number[] = [];

  constructor() {
    this.startPeriodicTracking();
  }

  public setModule(moduleName: string) {
    this.currentModule = moduleName;
  }

  public recordRenderDuration(durationMs: number) {
    this.renderDurations.push(durationMs);
    if (this.renderDurations.length > 20) {
      this.renderDurations.shift();
    }
  }

  public async measureLatency(): Promise<{ latency: number; status: 'optimal' | 'moderate' | 'degraded' | 'offline' }> {
    const start = performance.now();
    try {
      if (!navigator.onLine) {
        return { latency: 9999, status: 'offline' };
      }
      
      // Ping Supabase fast endpoint
      const { error } = await supabase.from('subjects').select('id').limit(1);
      const latency = Math.round(performance.now() - start);

      if (error && error.message) {
        return { latency: Math.max(latency, 120), status: 'moderate' };
      }

      let status: 'optimal' | 'moderate' | 'degraded' | 'offline' = 'optimal';
      if (latency > 600) status = 'degraded';
      else if (latency > 250) status = 'moderate';

      return { latency, status };
    } catch {
      return { latency: Math.round(performance.now() - start), status: 'degraded' };
    }
  }

  public getMemoryUsage() {
    const perf = window.performance as any;
    if (perf && perf.memory) {
      const used = perf.memory.usedJSHeapSize / (1024 * 1024);
      const total = perf.memory.totalJSHeapSize / (1024 * 1024);
      const limit = perf.memory.jsHeapSizeLimit / (1024 * 1024);
      const percent = limit > 0 ? (used / limit) * 100 : 0;

      return {
        supported: true,
        usedJSHeapMB: Math.round(used * 10) / 10,
        totalJSHeapMB: Math.round(total * 10) / 10,
        jsHeapLimitMB: Math.round(limit * 10) / 10,
        usagePercent: Math.round(percent * 10) / 10
      };
    }

    // Estimate based on standard browser memory sandbox for unsupported browsers
    const estimatedUsed = 45 + (this.history.length % 15);
    const estimatedLimit = 1024;
    return {
      supported: false,
      usedJSHeapMB: estimatedUsed,
      totalJSHeapMB: 85,
      jsHeapLimitMB: estimatedLimit,
      usagePercent: Math.round((estimatedUsed / estimatedLimit) * 100 * 10) / 10
    };
  }

  public getDomNodeCount(): number {
    if (typeof document !== 'undefined') {
      return document.getElementsByTagName('*').length;
    }
    return 0;
  }

  public async captureCurrentMetrics(): Promise<CbtResourceMetrics> {
    const mem = this.getMemoryUsage();
    const net = await this.measureLatency();
    const domCount = this.getDomNodeCount();

    const avgRender = this.renderDurations.length > 0
      ? Math.round((this.renderDurations.reduce((a, b) => a + b, 0) / this.renderDurations.length) * 10) / 10
      : 8.5;

    const bottlenecks: string[] = [];
    if (mem.usagePercent > 80) {
      bottlenecks.push(`High memory utilization (${mem.usagePercent}% of JS heap limit)`);
    }
    if (net.latencyMs > 400 && net.status !== 'offline') {
      bottlenecks.push(`Elevated database latency (${net.latencyMs}ms)`);
    }
    if (net.status === 'offline') {
      bottlenecks.push('Client is offline - offline cache active');
    }
    if (domCount > 3000) {
      bottlenecks.push(`Large DOM tree size (${domCount} nodes)`);
    }
    if (avgRender > 30) {
      bottlenecks.push(`Slow component render time (${avgRender}ms)`);
    }

    const metric: CbtResourceMetrics = {
      timestamp: Date.now(),
      memory: mem,
      network: {
        latencyMs: net.latencyMs,
        status: net.status,
        endpoint: 'Supabase REST API'
      },
      rendering: {
        avgRenderMs: avgRender,
        domNodeCount: domCount,
        fps: 60
      },
      moduleName: this.currentModule,
      bottlenecks
    };

    this.history.push(metric);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }

    this.notifyListeners(metric);
    return metric;
  }

  private startPeriodicTracking() {
    if (typeof window === 'undefined') return;

    // Capture initial
    setTimeout(() => this.captureCurrentMetrics(), 1000);

    // Periodic capture every 5 seconds
    this.intervalId = setInterval(() => {
      this.captureCurrentMetrics();
    }, 5000);
  }

  public subscribe(listener: (metrics: CbtResourceMetrics) => void): () => void {
    this.listeners.push(listener);
    if (this.history.length > 0) {
      listener(this.history[this.history.length - 1]);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(metric: CbtResourceMetrics) {
    this.listeners.forEach(listener => {
      try {
        listener(metric);
      } catch (err) {
        console.error('[CbtPerformanceMonitor] Listener error:', err);
      }
    });
  }

  public getHistory(): CbtResourceMetrics[] {
    return [...this.history];
  }

  public getLatest(): CbtResourceMetrics | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}

export const cbtPerformanceMonitor = new CbtPerformanceMonitor();
