import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { GitEngine } from '$engine/index';
import { serialize } from '$persistence/serializer';

// Control what the persistence layer returns without touching IndexedDB.
const autoLoadMock = vi.fn();
const loadHistoryMock = vi.fn();
const saveHistoryMock = vi.fn();
vi.mock('$persistence/storage', () => ({
  autoLoad: () => autoLoadMock(),
  autoSave: vi.fn(),
  loadHistory: () => loadHistoryMock(),
  saveHistory: (entries: string[]) => saveHistoryMock(entries),
}));

import { engine, history, hydrate, executeCommand } from '$store/engine';

describe('store hydrate', () => {
  beforeEach(() => {
    autoLoadMock.mockReset();
    loadHistoryMock.mockReset();
    loadHistoryMock.mockResolvedValue([]);
    saveHistoryMock.mockReset();
  });

  it('restores persisted engine state on boot', async () => {
    const saved = new GitEngine();
    saved.execute('git init');
    saved.getVFS().createFile('README.md', 'hello');
    saved.execute('git add README.md');
    saved.execute('git commit -m "persisted commit"');
    autoLoadMock.mockResolvedValue(serialize(saved));

    await hydrate();

    const live = get(engine);
    const commits = live.allCommits();
    expect(commits).toHaveLength(1);
    expect(commits[0].message).toBe('persisted commit');
    expect(live.isInitialized()).toBe(true);
  });

  it('leaves the live engine untouched when no autosave exists', async () => {
    const before = get(engine);
    autoLoadMock.mockResolvedValue(null);

    await hydrate();

    expect(get(engine)).toBe(before);
  });

  it('ignores a corrupt autosave without throwing', async () => {
    const before = get(engine);
    autoLoadMock.mockResolvedValue('{ not valid json');

    await expect(hydrate()).resolves.toBeUndefined();
    expect(get(engine)).toBe(before);
  });

  it('restores command history on boot', async () => {
    autoLoadMock.mockResolvedValue(null);
    loadHistoryMock.mockResolvedValue(['git init', 'git status']);

    await hydrate();

    expect(get(history).getEntries()).toEqual(['git init', 'git status']);
  });

  it('persists command history after each command', () => {
    executeCommand('git status');

    expect(saveHistoryMock).toHaveBeenCalled();
    const lastSaved = saveHistoryMock.mock.calls.at(-1)![0] as string[];
    expect(lastSaved).toContain('git status');
  });
});
