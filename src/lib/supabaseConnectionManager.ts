import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'SUSPENDED_BFCACHE' | 'ERROR';

type StateListener = (state: ConnectionState) => void;

interface ChannelRegistration {
  channel: RealtimeChannel;
  channelName: string;
  topic?: string;
  createdAt: number;
}

class SupabaseConnectionManager {
  private static instance: SupabaseConnectionManager;
  private state: ConnectionState = 'DISCONNECTED';
  private stateListeners: Set<StateListener> = new Set();
  private registeredChannels: Map<string, ChannelRegistration> = new Map();
  private isBfCached = false;
  private needsFreshCheckAfterBfCache = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private initialized = false;

  private constructor() {
    // Singleton
  }

  public static getInstance(): SupabaseConnectionManager {
    if (!SupabaseConnectionManager.instance) {
      SupabaseConnectionManager.instance = new SupabaseConnectionManager();
    }
    return SupabaseConnectionManager.instance;
  }

  public isRestoredFromBfCachePending(): boolean {
    return this.needsFreshCheckAfterBfCache;
  }

  /**
   * Current global connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Subscribe to connection state changes
   */
  public onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private setState(newState: ConnectionState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.stateListeners.forEach((listener) => {
      try {
        listener(newState);
      } catch (err) {
        console.warn('[Supabase Connection Manager] State listener error:', err);
      }
    });
  }

  /**
   * Register an active Realtime channel for global lifecycle tracking
   */
  public registerChannel(channel: RealtimeChannel): RealtimeChannel {
    if (!channel) return channel;
    const name = channel.topic || `ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.registeredChannels.set(name, {
      channel,
      channelName: name,
      topic: channel.topic,
      createdAt: Date.now()
    });
    return channel;
  }

  /**
   * Unregister a channel on component unmount
   */
  public unregisterChannel(channel: RealtimeChannel | string): void {
    if (!channel) return;
    const name = typeof channel === 'string' ? channel : (channel.topic || '');
    if (name && this.registeredChannels.has(name)) {
      const reg = this.registeredChannels.get(name);
      if (reg) {
        try {
          reg.channel.unsubscribe();
          supabase.removeChannel(reg.channel);
        } catch {}
      }
      this.registeredChannels.delete(name);
    } else if (typeof channel !== 'string') {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    }
  }

  /**
   * Initialize browser lifecycle listeners (PageHide, PageShow, Visibility, Online/Offline)
   */
  public initLifecycle(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Explicit cleanup on pagehide / freeze to eliminate bfcache connection errors
    const handlePageHide = (event: PageTransitionEvent) => {
      this.isBfCached = Boolean(event.persisted);
      this.setState('SUSPENDED_BFCACHE');
      this.teardownSocketGracefully();
    };

    // 2. Detect bfcache via pageshow. On restoration, DO NOT attempt to resume stale WebSocket connections!
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from the browser Back-Forward Cache (bfcache)
        this.isBfCached = false;
        this.needsFreshCheckAfterBfCache = true;
        this.setState('SUSPENDED_BFCACHE');

        // Immediately teardown any stale socket handles so no bad frames/handshakes occur
        this.teardownSocketGracefully();

        // Strictly defer connection check until the tab becomes active and focused
        return;
      }

      // Standard page load / reload (not bfcache)
      this.isBfCached = false;
      this.needsFreshCheckAfterBfCache = false;
      if (document.visibilityState === 'visible' && !document.hidden) {
        this.scheduleReconnection(150);
      }
    };

    // 3. Tab Visibility & Focus Change gating: Force fresh connection check ONLY when tab becomes active
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'hidden') {
        this.setState('SUSPENDED_BFCACHE');
        this.teardownSocketGracefully();
      } else if (document.visibilityState === 'visible' && !document.hidden) {
        if (this.needsFreshCheckAfterBfCache) {
          // Tab became active after bfcache restoration -> perform fresh connection check
          this.needsFreshCheckAfterBfCache = false;
          this.isBfCached = false;
          this.forceFreshConnectionCheck();
        } else {
          this.isBfCached = false;
          this.scheduleReconnection(200);
        }
      }
    };

    // 4. Network status changes
    const handleOnline = () => {
      if (document.visibilityState === 'visible' && !document.hidden) {
        this.forceFreshConnectionCheck();
      }
    };

    const handleOffline = () => {
      this.setState('DISCONNECTED');
      this.teardownSocketGracefully();
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('freeze', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial connection state setup
    if (document.visibilityState === 'visible' && navigator.onLine !== false) {
      this.scheduleReconnection(100);
    }
  }

  /**
   * Force a fresh, clean connection check, purging any stale socket references
   */
  public async forceFreshConnectionCheck(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (document.visibilityState !== 'visible' || document.hidden) return;

    if (navigator.onLine === false) {
      this.setState('DISCONNECTED');
      return;
    }

    this.teardownSocketGracefully();
    this.scheduleReconnection(80);
  }

  /**
   * Teardown socket cleanly without throwing errors or leaking connection handles
   */
  private teardownSocketGracefully(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isConnecting = false;

    try {
      if (supabase && supabase.realtime) {
        supabase.realtime.disconnect();
      }
    } catch {}
  }

  /**
   * Schedule reconnection with debounce and visibility check
   */
  public scheduleReconnection(delayMs = 300): void {
    if (typeof window === 'undefined') return;
    if (document.visibilityState !== 'visible' || this.isBfCached) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectRealtimeClient();
    }, delayMs);
  }

  /**
   * Cleanly connect or reconnect the Realtime client
   */
  public async reconnectRealtimeClient(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (document.visibilityState !== 'visible' || this.isBfCached || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.setState('CONNECTING');

    try {
      if (supabase && supabase.realtime) {
        // Ensure clean prior state before connecting
        try {
          supabase.realtime.disconnect();
        } catch {}

        supabase.realtime.connect();
        this.setState('CONNECTED');
      }
    } catch (err) {
      console.warn('[Supabase Connection Manager] Reconnection notice:', err);
      this.setState('ERROR');
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Clear all channels on logout or complete app reset
   */
  public clearAll(): void {
    this.teardownSocketGracefully();
    this.registeredChannels.forEach((reg) => {
      try {
        reg.channel.unsubscribe();
        supabase.removeChannel(reg.channel);
      } catch {}
    });
    this.registeredChannels.clear();
    try {
      supabase.removeAllChannels();
    } catch {}
    this.setState('DISCONNECTED');
  }
}

export const supabaseConnectionManager = SupabaseConnectionManager.getInstance();
