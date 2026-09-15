/**
 * Global Exam Session Lock Manager
 * 
 * Prevents race conditions, double-click submissions, and concurrent exam initializations
 * across all modals and CBT navigation triggers, reducing the chance of triggering 500/400 errors.
 */

type LockListener = (isLocked: boolean, source?: string) => void;

class ExamSessionLockManager {
  private isLocked: boolean = false;
  private currentSource: string = '';
  private timeoutHandle: any = null;
  private listeners: Set<LockListener> = new Set();

  /**
   * Check whether an exam initialization is currently in progress
   */
  public getIsLocked(): boolean {
    return this.isLocked;
  }

  public getSource(): string {
    return this.currentSource;
  }

  /**
   * Attempt to acquire the global initialization lock.
   * Returns true if successfully acquired, or false if already locked.
   * Auto-releases after timeoutMs (default 10,000ms) to prevent permanent UI lockouts.
   */
  public acquire(source: string = 'generic', timeoutMs: number = 10000): boolean {
    if (this.isLocked) {
      console.warn(`[ExamLock] Prevented duplicate execution from "${source}" (currently locked by "${this.currentSource}")`);
      return false;
    }

    this.isLocked = true;
    this.currentSource = source;
    this.notify();

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }

    this.timeoutHandle = setTimeout(() => {
      if (this.isLocked) {
        console.warn(`[ExamLock] Auto-released lock for "${this.currentSource}" after ${timeoutMs}ms timeout failsafe.`);
        this.release();
      }
    }, timeoutMs);

    return true;
  }

  /**
   * Release the initialization lock
   */
  public release(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.isLocked = false;
    this.currentSource = '';
    this.notify();
  }

  /**
   * Helper to run an async operation protected by the lock
   */
  public async runWithLock<T>(fn: () => Promise<T>, source: string = 'action', timeoutMs: number = 10000): Promise<T | null> {
    if (!this.acquire(source, timeoutMs)) {
      return null;
    }
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Subscribe to lock state changes
   */
  public subscribe(listener: LockListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(fn => {
      try {
        fn(this.isLocked, this.currentSource);
      } catch (e) {
        console.error('[ExamLock] Error notifying listener:', e);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scholars:exam-lock-changed', {
        detail: { isLocked: this.isLocked, source: this.currentSource }
      }));
    }
  }
}

export const examSessionLock = new ExamSessionLockManager();
