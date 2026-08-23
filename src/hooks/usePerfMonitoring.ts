import { useEffect, useRef } from 'react';
import { perfMonitor } from '@/lib/perfMonitor';

interface PerfMonitoringOptions {
  /** Log every render regardless of duration (default: false) */
  verbose?: boolean;
  /** Threshold in milliseconds to flag slow renders (default: 30ms) */
  slowRenderThresholdMs?: number;
  /** Custom extra metadata to print on slow renders */
  metadata?: Record<string, any>;
}

/**
 * Lightweight performance monitoring hook for React components.
 * Tracks component mount time, re-render counts, and flags slow renders in dev mode.
 * 
 * @param componentName Name of the component to identify in console logs
 * @param options Configuration options
 */
export function usePerfMonitoring(
  componentName: string,
  options: PerfMonitoringOptions = {}
) {
  const isDev = import.meta.env.DEV || process.env.NODE_ENV !== 'production';
  const { verbose = false, slowRenderThresholdMs = 35, metadata } = options;

  const renderCountRef = useRef(0);
  const renderStartTimeRef = useRef(performance.now());
  const mountTimeRef = useRef<number | null>(null);

  // Mark the start time for the current render
  renderStartTimeRef.current = performance.now();
  renderCountRef.current += 1;

  useEffect(() => {
    if (!isDev) return;

    const renderDurationMs = performance.now() - renderStartTimeRef.current;

    // Track initial mount vs updates
    if (mountTimeRef.current === null) {
      mountTimeRef.current = renderDurationMs;
      if (verbose || renderDurationMs > slowRenderThresholdMs) {
        console.debug(
          `⚡ [Perf: Mount] <${componentName} /> mounted in ${renderDurationMs.toFixed(1)}ms`
        );
      }
    } else {
      if (renderDurationMs > slowRenderThresholdMs) {
        console.warn(
          `⚠️ [SLOW RENDER > ${slowRenderThresholdMs}ms] <${componentName} /> (Render #${renderCountRef.current}) took ${renderDurationMs.toFixed(1)}ms`,
          metadata || {}
        );
      } else if (verbose) {
        console.debug(
          `🔄 [Perf: Render] <${componentName} /> #${renderCountRef.current} took ${renderDurationMs.toFixed(1)}ms`
        );
      }
    }
  });

  const trackAction = async <T>(actionName: string, actionFn: () => Promise<T>): Promise<T> => {
    return perfMonitor.trackOperation(`${componentName}:${actionName}`, actionFn);
  };

  return {
    renderCount: renderCountRef.current,
    trackAction
  };
}
