import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css';
import './index.css';
import App from './App.tsx';
import { registerSW } from 'virtual:pwa-register';
import { perfMonitor } from './lib/perfMonitor';
import { initBatterySaver } from './lib/batterySaver';

import { initSupabaseLifecycle } from './lib/supabaseLifecycle';

// Initialize dev-mode performance & API latency monitor (flags requests >2s)
perfMonitor.init();

// Initialize battery saver state
initBatterySaver();

// Initialize centralized Supabase WebSocket lifecycle hook (manages bfcache, pagehide, and navigation cleanup)
initSupabaseLifecycle();

// Handle Vite dynamic import chunk reload events gracefully
window.addEventListener('vite:preloadError', (event: any) => {
  console.warn('[Vite Preload Error] Asset chunk hash mismatch detected. Refreshing for latest deployment...', event);
  const lastReload = Number(sessionStorage.getItem('last_vite_preload_reload') || 0);
  if (Date.now() - lastReload > 10000) {
    sessionStorage.setItem('last_vite_preload_reload', String(Date.now()));
    window.location.reload();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const msg = String(reason?.message || reason || '').toLowerCase();
  if (
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    reason?.name === 'ChunkLoadError'
  ) {
    console.warn('[Chunk Load Intercepted] Reloading with fresh assets...', msg);
    const lastReload = Number(sessionStorage.getItem('last_chunk_unhandled_reload') || 0);
    if (Date.now() - lastReload > 10000) {
      sessionStorage.setItem('last_chunk_unhandled_reload', String(Date.now()));
      window.location.reload();
    }
  }
});

// Register service worker for offline caching
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

// Centralized Supabase Realtime & WebSocket Connection Lifecycle is managed via initSupabaseLifecycle()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
