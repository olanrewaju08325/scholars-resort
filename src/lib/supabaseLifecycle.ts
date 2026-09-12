import { useEffect } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Global registry of active realtime channels for centralized cleanup
const activeRealtimeChannels = new Set<RealtimeChannel>();

export const registerRealtimeChannel = (channel: RealtimeChannel): RealtimeChannel => {
  if (channel) {
    activeRealtimeChannels.add(channel);
  }
  return channel;
};

export const unregisterRealtimeChannel = (channel: RealtimeChannel): void => {
  if (channel) {
    activeRealtimeChannels.delete(channel);
    try {
      supabase.removeChannel(channel);
    } catch {}
  }
};

/**
 * Safely and synchronously closes all active WebSocket channels and disconnects the
 * underlying Realtime connection to eliminate "Page entered Back-Forward Cache"
 * browser warnings and subsequent 400 Bad Request handshake errors.
 */
export const teardownSupabaseRealtimeConnections = (): void => {
  try {
    // 1. Unsubscribe each tracked channel
    activeRealtimeChannels.forEach((channel) => {
      try {
        channel.unsubscribe();
      } catch {}
    });
    activeRealtimeChannels.clear();

    // 2. Clear all channels registered in Supabase client instance
    if (supabase && typeof supabase.removeAllChannels === 'function') {
      supabase.removeAllChannels();
    }

    // 3. Disconnect the underlying WebSocket client
    if (supabase && supabase.realtime && typeof supabase.realtime.disconnect === 'function') {
      supabase.realtime.disconnect();
    }
  } catch (err) {
    // Silent catch during page teardown
  }
};

/**
 * Re-establishes the Supabase Realtime WebSocket connection when the page is restored
 * from the browser Back-Forward Cache (bfcache).
 */
export const reconnectSupabaseRealtime = (): void => {
  try {
    if (supabase && supabase.realtime && typeof supabase.realtime.connect === 'function') {
      supabase.realtime.connect();
    }
  } catch {}
};

let lifecycleInitialized = false;

/**
 * Initializes the centralized Supabase connection lifecycle listeners on the window object.
 */
export const initSupabaseLifecycle = (): void => {
  if (lifecycleInitialized || typeof window === 'undefined') return;
  lifecycleInitialized = true;

  // 1. Handle pagehide - critical for Back-Forward Cache (bfcache)
  window.addEventListener('pagehide', (event: PageTransitionEvent) => {
    if (event.persisted) {
      console.log('[Supabase Lifecycle] Page entering Back-Forward Cache. Tearing down active WebSockets to prevent connection leakage.');
    }
    teardownSupabaseRealtimeConnections();
  });

  // 2. Handle pageshow - reconnect when restored from bfcache
  window.addEventListener('pageshow', (event: PageTransitionEvent) => {
    if (event.persisted) {
      console.log('[Supabase Lifecycle] Page restored from Back-Forward Cache. Re-establishing clean Realtime connection state.');
      reconnectSupabaseRealtime();
    }
  });

  // 3. Handle beforeunload
  window.addEventListener('beforeunload', () => {
    teardownSupabaseRealtimeConnections();
  });

  // 4. Handle visibilitychange
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      teardownSupabaseRealtimeConnections();
    } else if (document.visibilityState === 'visible') {
      reconnectSupabaseRealtime();
    }
  });

  // 5. Handle browser back/forward history navigation
  window.addEventListener('popstate', () => {
    // Ensure any stale channels from the previous view are safely unmounted
    try {
      if (supabase && typeof supabase.removeAllChannels === 'function') {
        supabase.removeAllChannels();
      }
    } catch {}
  });
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
