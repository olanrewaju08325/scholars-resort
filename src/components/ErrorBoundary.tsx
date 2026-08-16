import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, WifiOff, Database, HardDrive } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    this.setState({ errorInfo: info, errorId });
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);

    // Try logging to Supabase platform_error_logs safely
    try {
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
      }).then(({ error: dbErr }) => {
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
      const isConnectivityError = 
        !navigator.onLine || 
        !isSupabaseConfigured ||
        errorMsg.includes('fetch') || 
        errorMsg.includes('network') || 
        errorMsg.includes('supabase') || 
        errorMsg.includes('offline');

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

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-2.5 border border-border rounded-xl font-semibold hover:bg-muted transition-colors"
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

