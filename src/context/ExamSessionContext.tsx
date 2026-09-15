import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { examSessionLock } from '@/lib/examSessionLock';

interface ExamSessionContextType {
  isLocked: boolean;
  lockSource: string;
  isStarting: boolean;
  acquireLock: (source?: string, timeoutMs?: number) => boolean;
  releaseLock: () => void;
  runWithLock: <T>(fn: () => Promise<T>, source?: string, timeoutMs?: number) => Promise<T | null>;
  startExamWithLock: (onStart: () => Promise<void> | void, source?: string, timeoutMs?: number) => Promise<boolean>;
}

const ExamSessionContext = createContext<ExamSessionContextType | null>(null);

export const ExamSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLocked, setIsLocked] = useState<boolean>(() => examSessionLock.getIsLocked());
  const [lockSource, setLockSource] = useState<string>(() => examSessionLock.getSource());
  const [isStarting, setIsStarting] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = examSessionLock.subscribe((locked, source) => {
      setIsLocked(locked);
      setLockSource(source || '');
      if (!locked) {
        setIsStarting(false);
      }
    });
    return unsubscribe;
  }, []);

  const acquireLock = useCallback((source: string = 'exam_launcher', timeoutMs: number = 10000): boolean => {
    const acquired = examSessionLock.acquire(source, timeoutMs);
    if (acquired) {
      setIsStarting(true);
    }
    return acquired;
  }, []);

  const releaseLock = useCallback((): void => {
    examSessionLock.release();
    setIsStarting(false);
  }, []);

  const runWithLock = useCallback(async <T,>(
    fn: () => Promise<T>,
    source: string = 'exam_action',
    timeoutMs: number = 10000
  ): Promise<T | null> => {
    if (!acquireLock(source, timeoutMs)) {
      return null;
    }
    try {
      return await fn();
    } finally {
      releaseLock();
    }
  }, [acquireLock, releaseLock]);

  const startExamWithLock = useCallback(async (
    onStart: () => Promise<void> | void,
    source: string = 'start_exam_button',
    timeoutMs: number = 8000
  ): Promise<boolean> => {
    if (!acquireLock(source, timeoutMs)) {
      return false;
    }
    try {
      setIsStarting(true);
      await Promise.resolve(onStart());
      return true;
    } catch (error) {
      console.error('[ExamSessionContext] Error during startExamWithLock:', error);
      releaseLock();
      return false;
    }
  }, [acquireLock, releaseLock]);

  return (
    <ExamSessionContext.Provider
      value={{
        isLocked,
        lockSource,
        isStarting,
        acquireLock,
        releaseLock,
        runWithLock,
        startExamWithLock
      }}
    >
      {children}
    </ExamSessionContext.Provider>
  );
};

export const useExamSessionContext = (): ExamSessionContextType => {
  const context = useContext(ExamSessionContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      isLocked: examSessionLock.getIsLocked(),
      lockSource: examSessionLock.getSource(),
      isStarting: false,
      acquireLock: (source = 'fallback', timeoutMs = 10000) => examSessionLock.acquire(source, timeoutMs),
      releaseLock: () => examSessionLock.release(),
      runWithLock: (fn, source = 'fallback', timeoutMs = 10000) => examSessionLock.runWithLock(fn, source, timeoutMs),
      startExamWithLock: async (onStart) => {
        if (!examSessionLock.acquire('start_exam_fallback', 8000)) return false;
        try {
          await Promise.resolve(onStart());
          return true;
        } finally {
          examSessionLock.release();
        }
      }
    };
  }
  return context;
};

export default ExamSessionContext;
