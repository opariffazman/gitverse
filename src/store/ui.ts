import { writable } from 'svelte/store';

export type FocusMode = 'terminal' | 'graph';

export const focusMode = writable<FocusMode>('terminal');

export function toggleFocus(): void {
  focusMode.update((mode) => (mode === 'terminal' ? 'graph' : 'terminal'));
}
