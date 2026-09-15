import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, WifiOff, Database, HardDrive, RotateCcw, ShieldAlert } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  isComponentLevel?: boolean;
  onReset?: () => void;
  resetLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  /**
   * Clears invalid or corrupted exam state from localStorage and sessionStorage,
   * allowing the user to recover immediately without needing a full page refresh.
   */
  handleResetSession = () => {
    try {
      const knownKeys = [
        'jamb_active_exam_session',
        'scholars_cbt_session',
        'interrupted_exam_session',
        'cbt_active_session',
        'cbt_exam_backup',
        'cbt_exam_snapshot',
        'cbt_progress_cache',
        'jamb_mistake_bank',
        'jamb_practice_history',
        'cbt_last_active_subject',
        'eb_last_chunk_reload'
      ];

      knownKeys.forEach(k => {
        try {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        } catch (_) {}
      });

      // Clear dynamic keys with cbt_ or exam_ prefixes
      try {
        const toDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('cbt_') || key.startsWith('exam_') || key.startsWith('jamb_session_') || key.includes('exam_backup'))) {
            toDelete.push(key);
          }
        }
        toDelete.forEach(k => localStorage.removeItem(k));
      } catch (_) {}

      try {
        sessionStorage.clear();
      } catch (_) {}
    } catch (cleanErr) {
      console.warn('[ErrorBoundary] Notice cleaning session state:', cleanErr);
    }

    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (_) {}
    }

    // Recover without a full page refresh
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    this.setState({ errorInfo: info, errorId });
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);

    // Auto-heal dynamic chunk loading errors (new deployment or network glitch)
    const errorMsg = (error?.message || '').toLowerCase();
    const isChunkLoadError =
      errorMsg.includes('dynamically imported module') ||
      errorMsg.includes('failed to fetch dynamically imported module') ||
      errorMsg.includes('loading chunk') ||
      errorMsg.includes('mime type') ||
      error?.name === 'ChunkLoadError';

    if (isChunkLoadError) {
      const lastAutoReload = Number(sessionStorage.getItem('eb_last_chunk_reload') || 0);
      if (Date.now() - lastAutoReload > 15000) {
        sessionStorage.setItem('eb_last_chunk_reload', String(Date.now()));
        console.warn('[ErrorBoundary] Dynamic chunk load error detected. Performing automated refresh...');
        setTimeout(() => {
          window.location.reload();
        }, 300);
        return;
      }
    }

    // Try logging to Supabase platform_error_logs safely
    try {
      Promise.resolve(
        supabase.from('platform_error_logs').insert({
          error_type: 'react_boundary',
          error_message: error.message,
          error_context: {
            error_id: errorId,
            stack: error.stack?.substring(0, 500),
            component_stack: info.componentStack?.substring(0, 500),
            url: window.location.pathname,
            user_agent: navigator.userAgent,
          }
        })
      ).then(({ error: dbErr }: any) => {
        if (dbErr) console.warn('Error log DB write failed:', dbErr);
      }).catch(() => {});
    } catch {
      // Ignore DB write error during connectivity failure
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMsg = this.state.error?.message?.toLowerCase() || '';
      const isChunkLoadError =
        errorMsg.includes('dynamically imported module') ||
        errorMsg.includes('failed to fetch dynamically imported module') ||
        errorMsg.includes('loading chunk') ||
        errorMsg.includes('mime type') ||
        this.state.error?.name === 'ChunkLoadError';

      const isConnectivityError = 
        !navigator.onLine || 
        !isSupabaseConfigured ||
        errorMsg.includes('fetch') || 
        errorMsg.includes('network') || 
        errorMsg.includes('supabase') || 
        errorMsg.includes('offline');

      if (isChunkLoadError) {
        return (
          <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-2xl">
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <RefreshCw className="w-10 h-10 text-primary animate-spin" style={{ animationDuration: '4s' }} />
                </div>
              </div>

              <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/30 mb-3 uppercase tracking-wider">
                Application Update Available
              </span>

              <h1 className="text-2xl font-display font-bold mb-3">Updating Scholars Resort</h1>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                A fresh version of this page is ready. Refresh to sync the latest modules and features smoothly.
              </p>

              {this.state.error && (
                <div className="bg-muted/50 border border-border rounded-xl p-3 mb-6 text-left">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
                    if ('caches' in window) {
                      caches.keys().then((names) => {
                        names.forEach((name) => caches.delete(name));
                      }).catch(() => {});
                    }
                    window.location.reload();
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh & Update Now
                </button>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl font-semibold hover:bg-muted transition-colors"
                >
                  <Home className="w-4 h-4" /> Home
                </a>
              </div>
            </div>
          </div>
        );
      }

      if (isConnectivityError) {
        return (
          <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-8 shadow-2xl">
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <WifiOff className="w-10 h-10 text-amber-500" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                  <Database className="w-4 h-4 text-amber-500" />
                </div>
              </div>

              <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-3 uppercase tracking-wider">
                Database Connectivity Notice
              </span>

              <h1 className="text-2xl font-display font-bold mb-3">Connection Interrupted</h1>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                {!isSupabaseConfigured 
                  ? 'Supabase environment variables (VITE_SUPABASE_URL) are not configured yet. Please configure them in your server environment.'
                  : 'Unable to connect to the Scholars Resort cloud database. You can continue practicing completely offline using your downloaded question packs.'}
              </p>

              {this.state.error && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-6 text-left">
                  <p className="text-xs font-mono text-amber-400/90 break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
                    window.location.reload();
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors shadow-lg"
                >
                  <RefreshCw className="w-4 h-4" /> Retry Connection
                </button>
                <a
                  href="/offline-packs"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-lg"
                >
                  <HardDrive className="w-4 h-4" /> Offline Question Packs
                </a>
                <a
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl font-bold text-sm hover:bg-muted transition-colors"
                >
                  <Home className="w-4 h-4" /> Home
                </a>
              </div>
            </div>
          </div>
        );
      }

      // Detect data-rendering and React #31 crashes
      const isDataRenderError =
        errorMsg.includes('minified react error #31') ||
        errorMsg.includes('objects are not valid as a react child') ||
        errorMsg.includes('object with keys') ||
        errorMsg.includes('cannot read properties') ||
        errorMsg.includes('reading \'map\'') ||
        errorMsg.includes('cbt') ||
        errorMsg.includes('exam');

      // Component-level crash rendering (e.g. inside a widget, drawer, or specific section)
      if (this.props.isComponentLevel) {
        return (
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-card-foreground my-2 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Section Display Interrupted</h4>
                <p className="text-xs text-muted-foreground">
                  A data structure could not be displayed properly in this section.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleResetSession}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-destructive-foreground text-xs font-semibold rounded-lg hover:bg-destructive/90 transition-colors shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" /> {this.props.resetLabel || 'Reset Session'}
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null, errorId: null })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card text-foreground text-xs font-semibold rounded-lg hover:bg-muted transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </button>
            </div>
          </div>
        );
      }

      // Dedicated Data Rendering & Exam Recovery View
      if (isDataRenderError) {
        return (
          <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-2xl">
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <ShieldAlert className="w-10 h-10 text-amber-500" />
                </div>
              </div>

              <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-3 uppercase tracking-wider">
                Exam State Recovered
              </span>

              <h1 className="text-2xl font-display font-bold mb-3">Session Data Conflict Detected</h1>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                An invalid data structure (such as a non-serializable question format) was caught. You can reset the cached exam session below to recover immediately without refreshing your browser.
              </p>

              {this.state.error && (
                <div className="bg-muted/50 border border-border rounded-xl p-3 mb-6 text-left">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={this.handleResetSession}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg"
                >
                  <RotateCcw className="w-4 h-4" /> Reset Session
                </button>
                <a
                  href="/cbt"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border rounded-xl font-semibold hover:bg-muted transition-colors text-sm"
                >
                  <Home className="w-4 h-4" /> CBT Hub
                </a>
                <button
                  type="button"
                  onClick={() => this.setState({ hasError: false, error: null, errorInfo: null, errorId: null })}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl font-semibold hover:bg-muted transition-colors text-sm text-muted-foreground"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full">
            {/* Animated Error Icon */}
            <div className="relative inline-flex mb-8">
              <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-12 h-12 text-destructive" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                <Bug className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <h1 className="text-3xl font-display font-bold mb-3">Something went wrong</h1>
            <p className="text-muted-foreground mb-2 text-sm leading-relaxed">
              An unexpected error occurred. Our engineering team has been automatically notified and this issue has been logged.
            </p>

            {this.state.errorId && (
              <div 
                className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2 rounded-lg mb-6 cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(this.state.errorId || '').then(() => {});
                }}
                title="Click to copy error ID"
              >
                <Copy className="w-3 h-3" />
                Error ID: {this.state.errorId}
              </div>
            )}

            {this.state.error && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-8 text-left">
                <p className="text-xs font-mono text-destructive/80 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleResetSession}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-destructive text-destructive-foreground font-semibold rounded-xl hover:bg-destructive/90 transition-colors shadow-lg text-sm"
              >
                <RotateCcw className="w-4 h-4" /> Reset Session
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg text-sm"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl font-semibold hover:bg-muted transition-colors text-sm"
              >
                <Home className="w-4 h-4" /> Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

