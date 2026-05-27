import { writable } from 'svelte/store';

export type FocusMode = 'terminal' | 'graph';

export const focusMode = writable<FocusMode>('terminal');

export function toggleFocus(): void {
  focusMode.update((mode) => (mode === 'terminal' ? 'graph' : 'terminal'));
}

function createPersistedWritable(key: string, defaultValue: number, min: number, max: number) {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  const parsed = stored !== null ? parseFloat(stored) : NaN;
  const initial = Number.isNaN(parsed) ? defaultValue : Math.min(Math.max(parsed, min), max);
  const store = writable(initial);
  store.subscribe((value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(value));
    }
  });
  return store;
}

export const terminalOpacity = createPersistedWritable('gitverse-terminal-opacity', 0.85, 0.3, 1);
