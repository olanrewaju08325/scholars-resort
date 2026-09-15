import { useState, useEffect, useCallback } from 'react';
import { examSessionLock } from '@/lib/examSessionLock';

/**
 * Hook to access and manage the global exam session initialization lock
 */
export function useExamSessionLock() {
  const [isLocked, setIsLocked] = useState<boolean>(() => examSessionLock.getIsLocked());
  const [lockSource, setLockSource] = useState<string>(() => examSessionLock.getSource());

  useEffect(() => {
    const unsubscribe = examSessionLock.subscribe((locked, source) => {
      setIsLocked(locked);
      setLockSource(source || '');
    });
    return unsubscribe;
  }, []);

  const acquireLock = useCallback((source: string = 'component', timeoutMs: number = 10000): boolean => {
    return examSessionLock.acquire(source, timeoutMs);
  }, []);

  const releaseLock = useCallback((): void => {
    examSessionLock.release();
  }, []);

  const runWithLock = useCallback(async <T>(fn: () => Promise<T>, source: string = 'component', timeoutMs: number = 10000): Promise<T | null> => {
    return await examSessionLock.runWithLock(fn, source, timeoutMs);
  }, []);

  return {
    isLocked,
    lockSource,
    acquireLock,
    releaseLock,
    runWithLock
  };
}
