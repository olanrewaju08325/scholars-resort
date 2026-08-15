import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

    // Log to Supabase platform_error_logs
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
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
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
