import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css';
import './index.css';
import App from './App.tsx';
import { registerSW } from 'virtual:pwa-register';
import { perfMonitor } from './lib/perfMonitor';
import { initBatterySaver } from './lib/batterySaver';

// Initialize dev-mode performance & API latency monitor (flags requests >2s)
perfMonitor.init();

// Initialize battery saver state
initBatterySaver();

// Register service worker for offline caching
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
