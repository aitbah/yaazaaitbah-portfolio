import { useSyncExternalStore } from 'react';

/**
 * What the App Router gives `useSearchParams`, for a jsdom that has no router.
 *
 * Backed by the real `window.location` and jsdom's own session history, so a
 * test can press Back and Forward and have the component under test hear it -
 * rather than re-rendering it with a different fixture and calling that a
 * history test.
 *
 * Patching the native history API is what Next itself does, and for the same
 * reason: `pushState` fires no event, so nothing else can notice it.
 */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

let patched = false;

function patchHistory() {
  if (patched) {
    return;
  }

  patched = true;

  for (const name of ['pushState', 'replaceState'] as const) {
    const original = window.history[name].bind(window.history);

    window.history[name] = (...args: Parameters<History['pushState']>) => {
      original(...args);
      notify();
    };
  }
}

function subscribe(onStoreChange: () => void): () => void {
  patchHistory();
  listeners.add(onStoreChange);
  window.addEventListener('popstate', onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('popstate', onStoreChange);
  };
}

/**
 * Rebuilt only when the query string actually changes: `useSyncExternalStore`
 * compares snapshots by identity, and a fresh object every call is an infinite
 * render loop rather than a subscription.
 */
let search: string | null = null;
let params = new URLSearchParams();

function snapshot(): URLSearchParams {
  if (window.location.search !== search) {
    search = window.location.search;
    params = new URLSearchParams(search);
  }

  return params;
}

const EMPTY = new URLSearchParams();

export function useTestSearchParams(): URLSearchParams {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
