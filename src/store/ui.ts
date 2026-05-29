import { writable } from 'svelte/store';

// Command text the graph wants placed into the terminal input (not executed).
// Terminal consumes it, sets the input, focuses, then resets this to null.
export const pendingInput = writable<string | null>(null);

export function prefillTerminal(cmd: string): void {
  pendingInput.set(cmd);
}
