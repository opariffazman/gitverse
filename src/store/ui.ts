import { writable } from 'svelte/store';

export type FocusMode = 'terminal' | 'graph';

export const focusMode = writable<FocusMode>('terminal');

export function toggleFocus(): void {
  focusMode.update((mode) => (mode === 'terminal' ? 'graph' : 'terminal'));
}

function createPersistedWritable(key: string, defaultValue: number) {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  const initial = stored !== null ? parseFloat(stored) : defaultValue;
  const store = writable(initial);
  store.subscribe((value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(value));
    }
  });
  return store;
}

export const terminalOpacity = createPersistedWritable('gitverse-terminal-opacity', 0.85);
