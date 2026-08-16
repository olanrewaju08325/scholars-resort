import { supabase } from './supabase';

export interface SystemErrorLog {
  id: string;
  type: 'runtime_error' | 'unhandled_rejection' | 'database_error' | 'ai_error';
  message: string;
  stack?: string;
  component?: string;
  metadata?: any;
  timestamp: string;
}

class ErrorTracker {
  private logs: SystemErrorLog[] = [];
  private listeners: ((logs: SystemErrorLog[]) => void)[] = [];

  constructor() {
    this.initGlobalHandlers();
  }

  private initGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // Window Error Handler
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'runtime_error',
        message: event.message || 'Unknown Runtime Error',
        stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
        component: event.filename
      });
    });

    // Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.logError({
        type: 'unhandled_rejection',
        message: typeof reason === 'string' ? reason : reason?.message || JSON.stringify(reason),
        stack: reason?.stack
      });
    });
  }

  private isBenignError(message: string): boolean {
    if (!message) return true;
    const lower = message.toLowerCase();
    return (
      lower.includes('failed to connect to websocket') ||
      lower.includes('placeholder.supabase.co') ||
      lower.includes('err_name_not_resolved') ||
      lower.includes('vite') ||
      lower.includes('resizeobserver') ||
      lower.includes('chrome-extension') ||
      lower.includes('moz-extension') ||
      lower.includes('canceled') ||
      lower.includes('aborted')
    );
  }

  public logError(errorData: {
    type: 'runtime_error' | 'unhandled_rejection' | 'database_error' | 'ai_error';
    message: string;
    stack?: string;
    component?: string;
    metadata?: any;
  }) {
    if (this.isBenignError(errorData.message)) {
      return;
    }

    const newLog: SystemErrorLog = {
      id: Math.random().toString(36).substring(2, 9),
      ...errorData,
      timestamp: new Date().toISOString()
    };

    this.logs.unshift(newLog);
    if (this.logs.length > 100) this.logs.pop();

    // Persist to Supabase platform_error_logs table asynchronously
    try {
      supabase.from('platform_error_logs').insert({
        error_type: errorData.type,
        error_message: errorData.message,
        error_context: {
          stack: errorData.stack,
          component: errorData.component,
          ...errorData.metadata
        },
        created_at: newLog.timestamp
      }).then(() => {}, () => {});
    } catch {
      // Ignore background logging errors
    }

    this.notify();
  }

  public getLogs(): SystemErrorLog[] {
    return this.logs;
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
  }

  public subscribe(callback: (logs: SystemErrorLog[]) => void) {
    this.listeners.push(callback);
    callback(this.logs);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.logs));
  }
}

export const errorTracker = new ErrorTracker();
