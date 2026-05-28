import { describe, it, expect, vi, beforeEach } from 'vitest';

const delMock = vi.fn();
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: (key: string) => delMock(key),
  keys: vi.fn(),
}));

import { clearAutoSave, clearHistory } from '$persistence/storage';

describe('storage clears', () => {
  beforeEach(() => {
    delMock.mockReset();
  });

  it('clearAutoSave deletes the autosave key', async () => {
    await clearAutoSave();
    expect(delMock).toHaveBeenCalledWith('gitverse:autosave');
  });

  it('clearHistory deletes the history key', async () => {
    await clearHistory();
    expect(delMock).toHaveBeenCalledWith('gitverse:history');
  });

  it('swallows storage errors', async () => {
    delMock.mockRejectedValueOnce(new Error('boom'));
    await expect(clearAutoSave()).resolves.toBeUndefined();
  });
});
