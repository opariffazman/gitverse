import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { pendingInput, prefillTerminal } from '$store/ui';

describe('ui store — prefillTerminal', () => {
  beforeEach(() => pendingInput.set(null));

  it('sets the pending command', () => {
    prefillTerminal('git checkout main');
    expect(get(pendingInput)).toBe('git checkout main');
  });

  it('overwrites on a second call (latest wins; not queued)', () => {
    prefillTerminal('git checkout a');
    prefillTerminal('git checkout b');
    expect(get(pendingInput)).toBe('git checkout b');
  });

  it('starts null', () => {
    expect(get(pendingInput)).toBeNull();
  });
});
