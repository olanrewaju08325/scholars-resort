import { useEffect } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { supabaseConnectionManager, type ConnectionState } from './supabaseConnectionManager';

export { supabaseConnectionManager, type ConnectionState };

// Internal bfcache state tracking
let isBfCacheRestorationPending = false;
let lifecycleInitialized = false;

/**
 * Returns true if the page was restored from bfcache and is awaiting an active tab connection check
 */
export const isBfCacheState = (): boolean => {
  return isBfCacheRestorationPending || supabaseConnectionManager.isRestoredFromBfCachePending();
};

/**
 * Forces a fresh, clean connection check, purging any stale socket references.
 * Only executes when the tab is actively visible.
 */
export const forceFreshConnectionCheck = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  
  // Guard: strictly execute only when tab is actively visible
  if (document.visibilityState !== 'visible' || document.hidden) {
    return;
  }

  // Clear bfcache restoration flag as fresh check is underway
  isBfCacheRestorationPending = false;

  // Delegate to the connection manager's fresh verification pipeline
  await supabaseConnectionManager.forceFreshConnectionCheck();
};

/**
 * Register an active Realtime channel for global tracking and automatic cleanup.
 */
export const registerRealtimeChannel = (channel: RealtimeChannel): RealtimeChannel => {
  return supabaseConnectionManager.registerChannel(channel);
};

/**
 * Unregister a channel cleanly on component unmount.
 */
export const unregisterRealtimeChannel = (channel: RealtimeChannel | string): void => {
  supabaseConnectionManager.unregisterChannel(channel);
};

/**
 * Safely and synchronously closes all active WebSocket channels and disconnects the
 * underlying Realtime connection to eliminate "Page entered Back-Forward Cache"
 * browser warnings and subsequent 400 Bad Request handshake errors.
 */
export const teardownSupabaseRealtimeConnections = (): void => {
  supabaseConnectionManager.clearAll();
};

/**
 * Re-establishes the Supabase Realtime WebSocket connection when the page is restored
 * from the browser Back-Forward Cache (bfcache).
 */
export const reconnectSupabaseRealtime = (): void => {
  supabaseConnectionManager.scheduleReconnection(100);
};

/**
 * Initializes the centralized Supabase connection lifecycle listeners on the window object.
 * 
 * Specifically detects 'bfcache' state via the 'pageshow' event (event.persisted === true).
 * Ensures that on restoration, it does NOT attempt to resume stale WebSocket connections,
 * but forces a fresh connection check ONLY when the tab becomes active.
 */
export const initSupabaseLifecycle = (): void => {
  if (lifecycleInitialized || typeof window === 'undefined') return;
  lifecycleInitialized = true;

  // Initialize lower-level connection manager lifecycle
  supabaseConnectionManager.initLifecycle();

  // 1. Detect 'bfcache' state via 'pageshow' event
  const handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      // Detected restoration from Back-Forward Cache (bfcache)
      isBfCacheRestorationPending = true;

      // CRITICAL: Ensure that on restoration, we do NOT attempt to resume stale
      // WebSocket connections. Stale connections trigger "WebSocket is closed" and
      // 400 Bad Request handshake failures.
      try {
        if (supabase && supabase.realtime) {
          supabase.realtime.disconnect();
        }
      } catch {}

      // Do NOT call reconnect or scheduleReconnection here!
      // We wait strictly until the tab becomes active.
      return;
    }

    // Normal page load (not restored from bfcache)
    isBfCacheRestorationPending = false;
    if (document.visibilityState === 'visible' && !document.hidden) {
      forceFreshConnectionCheck();
    }
  };

  // 2. Tab Visibility & Focus: Force a fresh connection check ONLY when the tab becomes active
  const handleTabBecameActive = () => {
    if (typeof document === 'undefined') return;

    if (document.visibilityState === 'visible' && !document.hidden) {
      if (isBfCacheRestorationPending || supabaseConnectionManager.isRestoredFromBfCachePending()) {
        // Tab is actively visible and focused after bfcache restoration.
        // Now force a fresh connection check!
        forceFreshConnectionCheck();
      }
    }
  };

  // 3. Clean teardown on pagehide & freeze before entering bfcache
  const handlePageHide = () => {
    try {
      if (supabase && supabase.realtime) {
        supabase.realtime.disconnect();
      }
    } catch {}
  };

  window.addEventListener('pageshow', handlePageShow);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('freeze', handlePageHide);
  document.addEventListener('visibilitychange', handleTabBecameActive);
  window.addEventListener('focus', handleTabBecameActive);
};

/**
 * React hook for components needing to register and clean up Supabase Realtime channels
 * synchronized with component mount and navigation lifecycles.
 */
export const useSupabaseRealtimeLifecycle = (channelFactory?: () => RealtimeChannel | null | undefined, deps: any[] = []) => {
  useEffect(() => {
    if (!channelFactory) return;
    const channel = channelFactory();
    if (channel) {
      registerRealtimeChannel(channel);
    }

    return () => {
      if (channel) {
        unregisterRealtimeChannel(channel);
      }
    };
  }, deps);
};

