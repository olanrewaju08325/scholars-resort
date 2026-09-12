import React, { Component, ErrorInfo, ReactNode } from 'react';
import { 
  ShieldAlert, 
  RotateCcw, 
  RefreshCw, 
  Database, 
  Trash2, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from './ui/button';
import { aiCircuitBreaker } from '@/services/aiService';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  moduleKey?: string;
  onStateReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
  resetting: boolean;
  statusMessage: string | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false,
    resetting: false,
    statusMessage: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
      showDetails: false,
      resetting: false,
      statusMessage: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[AdminErrorBoundary] Caught error in ${this.props.moduleKey || 'Admin Module'}:`, error, errorInfo);
    this.setState({ error, errorInfo });
  }

  /**
   * Soft reset: resets the error state and attempts re-rendering the component tree.
   */
  private handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      statusMessage: null 
    });
  };

  /**
   * Granular state reset: Clears local UI cache, clears stale syllabus & subject state,
   * resets AI Circuit Breakers, and re-triggers data fetches for Subjects and Academy Taxonomy.
   */
  private handleResetDashboardState = async () => {
    this.setState({ resetting: true, statusMessage: 'Clearing local cache and resetting module state...' });

    try {
      // 1. Reset AI Circuit Breakers
      if (typeof aiCircuitBreaker?.reset === 'function') {
        aiCircuitBreaker.reset();
      }

      // 2. Clear relevant local cache items for Subjects, Syllabus & Taxonomy
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('scholar_syllabus_') ||
          key.startsWith('scholar_subject') ||
          key.startsWith('scholar_taxonomy_') ||
          key.startsWith('admin_cache_') ||
          key.startsWith('qb_filter_') ||
          key.startsWith('ai_breaker_') ||
          key.includes('topics') ||
          key.includes('syllabus')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // 3. Clear session storage keys entirely
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.clear();
        }
      } catch {}

      // 4. Invalidate cached query keys & dispatch force-refresh to dashboard core data modules
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('scholar:reset-admin-state', {
          detail: { module: this.props.moduleKey || 'all', timestamp: Date.now() }
        }));
        window.dispatchEvent(new CustomEvent('scholar:refresh-taxonomy', {
          detail: { timestamp: Date.now() }
        }));
        window.dispatchEvent(new CustomEvent('scholar:invalidate-queries', {
          detail: { scope: 'all', timestamp: Date.now() }
        }));
      }

      // 5. Call optional onStateReset callback
      if (this.props.onStateReset) {
        this.props.onStateReset();
      }

      this.setState({ 
        statusMessage: 'Cache cleared & state reset. Recovering module...',
        resetting: false 
      });

      // Small delay for smooth state transition
      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          statusMessage: null
        });
      }, 400);

    } catch (err: any) {
      console.warn('[AdminErrorBoundary] State reset error:', err);
      this.setState({ 
        resetting: false, 
        statusMessage: `Reset completed with warnings: ${err.message || 'Unknown'}` 
      });
      setTimeout(() => {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }, 500);
    }
  };

  /**
   * Hard reload the application window.
   */
  private handleReload = () => {
    window.location.reload();
  };

  /**
   * Copy diagnostic details for swift troubleshooting.
   */
  private handleCopyDiagnostics = () => {
    const errorDetails = `[Admin Error Report]
Module: ${this.props.moduleKey || 'General'}
Title: ${this.props.fallbackTitle || 'Admin Module'}
Timestamp: ${new Date().toISOString()}
Error Name: ${this.state.error?.name || 'Unknown'}
Error Message: ${this.state.error?.message || 'No message'}
Stack:
${this.state.error?.stack || 'No stack'}
Component Stack:
${this.state.errorInfo?.componentStack || 'No component stack'}
`;
    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  public render() {
    if (this.state.hasError) {
      const isStateOrFnError = 
        this.state.error?.message?.includes('getState') ||
        this.state.error?.message?.includes('undefined') ||
        this.state.error?.message?.includes('null') ||
        this.state.error?.message?.includes('not a function');

      return (
        <div className="w-full min-h-[420px] flex items-center justify-center p-6 bg-card text-card-foreground border border-destructive/25 rounded-2xl shadow-xl my-4">
          <div className="max-w-xl w-full text-center space-y-5">
            {/* Pulsing Alert Icon */}
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mx-auto shrink-0 shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>

            {/* Header Text */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold uppercase tracking-wider">
                Module Protection Boundary
              </div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                {this.props.fallbackTitle || 'Admin Module Encountered an Issue'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
                An unexpected state or runtime exception occurred in this module. All database records remain securely preserved in Supabase.
              </p>
            </div>

            {/* Status notification banner if resetting */}
            {this.state.statusMessage && (
              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary flex items-center justify-center gap-2 animate-fadeIn">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {this.state.statusMessage}
              </div>
            )}

            {/* Error & Diagnostic Panel */}
            {this.state.error && (
              <div className="rounded-xl border border-border bg-muted/40 text-left overflow-hidden text-xs">
                <div className="p-3.5 bg-destructive/5 border-b border-border flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-destructive truncate">
                    {this.state.error.name}: {this.state.error.message}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={this.handleCopyDiagnostics}
                      className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {this.state.copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Details
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                      className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {this.state.showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>

                {this.state.showDetails && (
                  <div className="p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-muted-foreground space-y-2 bg-background/80">
                    {this.state.error.stack && (
                      <div>
                        <div className="font-bold text-foreground mb-1">Stack Trace:</div>
                        <pre className="whitespace-pre-wrap opacity-85 leading-relaxed">{this.state.error.stack}</pre>
                      </div>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div className="pt-2 border-t border-border/50">
                        <div className="font-bold text-foreground mb-1">Component Hierarchy:</div>
                        <pre className="whitespace-pre-wrap opacity-75 text-[10px] leading-relaxed">{this.state.errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Contextual guidance for state/cache errors */}
            {isStateOrFnError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left text-xs text-amber-500">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Tip:</strong> This error often stems from stale client-side cache or circuit-breaker state. Click <strong>Reset Dashboard State</strong> below to clear local UI cache and re-fetch clean taxonomy data.
                </span>
              </div>
            )}

            {/* Granular Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={this.handleReset}
                disabled={this.state.resetting}
                className="gap-2 font-semibold text-xs h-9 px-4"
                title="Attempt to re-render without modifying stored data"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try Recovering
              </Button>

              <Button
                variant="secondary"
                onClick={this.handleResetDashboardState}
                disabled={this.state.resetting}
                className="gap-2 font-semibold text-xs h-9 px-4 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                title="Clears local UI cache, circuit breakers, and re-triggers taxonomy fetch"
              >
                <Database className="w-3.5 h-3.5" />
                {this.state.resetting ? 'Resetting State...' : 'Reset Dashboard State'}
              </Button>

              <Button
                variant="default"
                onClick={this.handleReload}
                disabled={this.state.resetting}
                className="gap-2 font-bold text-xs h-9 px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                title="Hard reload the page"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
