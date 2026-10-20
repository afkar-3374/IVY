import { registerSW } from 'virtual:pwa-register';
import { useCallStore } from '../store/useCallStore';

// Check for a new version this often while the app is open
const UPDATE_CHECK_MS = 30 * 60_000;
// Right after opening, a new version can switch in straight away
const FRESH_START_MS = 10_000;
const RELOADED_KEY = 'ivy_chunk_reload';

const startedAt = Date.now();

/**
 * Keeps the installed app up to date: a new version downloads in the background and
 * takes over when it's safe — just after opening, or when Ivy goes to the background —
 * never in the middle of a call.
 */
export function setupPwaUpdates(): void {
  if (!('serviceWorker' in navigator)) return;

  let waiting = false;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true;
      tryApply();
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => void reg.update(), UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update();
      });
    },
  });

  const tryApply = () => {
    if (!waiting || useCallStore.getState().currentCall) return;
    if (document.visibilityState === 'hidden' || Date.now() - startedAt < FRESH_START_MS) {
      waiting = false;
      void updateSW(true);
    }
  };

  document.addEventListener('visibilitychange', tryApply);
  useCallStore.subscribe((s) => {
    if (!s.currentCall) tryApply();
  });

  // A page from an old version asking for files that no longer exist: reload once
  window.addEventListener('vite:preloadError', (event) => {
    try {
      if (sessionStorage.getItem(RELOADED_KEY)) return;
      sessionStorage.setItem(RELOADED_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    event.preventDefault();
    window.location.reload();
  });
  window.addEventListener('load', () => {
    try {
      setTimeout(() => sessionStorage.removeItem(RELOADED_KEY), FRESH_START_MS);
    } catch {
      /* storage unavailable */
    }
  });
}
