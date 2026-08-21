import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AdminErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[400px] flex items-center justify-center p-6 bg-card text-card-foreground border border-destructive/20 rounded-2xl shadow-lg my-4">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mx-auto shrink-0 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                {this.props.fallbackTitle || 'Admin Component Error'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                An unexpected error occurred while rendering this module. Your data remains safe in the database.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-muted/50 border border-border rounded-lg text-xs font-mono text-left max-h-32 overflow-y-auto text-destructive leading-tight">
                <p className="font-semibold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-muted-foreground mt-2 opacity-80 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-center">
              <Button
                variant="outline"
                onClick={this.handleReset}
                className="gap-2 font-semibold text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try Recovering Module
              </Button>
              <Button
                variant="default"
                onClick={this.handleReload}
                className="gap-2 font-bold text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
