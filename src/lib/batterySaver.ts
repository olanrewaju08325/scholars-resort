/**
 * Battery Saver Mode Utility & Hook
 * 
 * When enabled:
 * - Reduces animations & CSS transitions to save CPU/GPU cycles.
 * - Increases interval between background sync tasks to save radio/network power.
 * - Ideal for long study sessions and low-power mobile devices.
 */

import { useState, useEffect } from 'react';

const BATTERY_SAVER_STORAGE_KEY = 'scholars_battery_saver_enabled';

export function isBatterySaverActive(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BATTERY_SAVER_STORAGE_KEY) === 'true';
}

export function setBatterySaver(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BATTERY_SAVER_STORAGE_KEY, enabled ? 'true' : 'false');
  
  if (enabled) {
    document.documentElement.classList.add('battery-saver');
  } else {
    document.documentElement.classList.remove('battery-saver');
  }

  // Dispatch event so all components react immediately
  window.dispatchEvent(new CustomEvent('scholars:battery-saver-change', { detail: { enabled } }));
}

export function toggleBatterySaver(): boolean {
  const current = isBatterySaverActive();
  const next = !current;
  setBatterySaver(next);
  return next;
}

export function initBatterySaver(): void {
  if (typeof window === 'undefined') return;
  if (isBatterySaverActive()) {
    document.documentElement.classList.add('battery-saver');
  } else {
    document.documentElement.classList.remove('battery-saver');
  }
}

/**
 * React hook for consuming and toggling Battery Saver mode
 */
export function useBatterySaver() {
  const [batterySaver, setBatterySaverState] = useState<boolean>(() => isBatterySaverActive());

  useEffect(() => {
    const handleEvent = (e: any) => {
      setBatterySaverState(e.detail?.enabled ?? isBatterySaverActive());
    };

    window.addEventListener('scholars:battery-saver-change', handleEvent);
    return () => window.removeEventListener('scholars:battery-saver-change', handleEvent);
  }, []);

  const toggle = () => {
    const next = toggleBatterySaver();
    setBatterySaverState(next);
    return next;
  };

  const setEnabled = (val: boolean) => {
    setBatterySaver(val);
    setBatterySaverState(val);
  };

  return {
    isBatterySaver: batterySaver,
    toggleBatterySaver: toggle,
    setBatterySaver: setEnabled
  };
}
