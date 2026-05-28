import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitEngine } from '$engine/index';

describe('GitEngine – initial state', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  it('starts on the main branch (attached HEAD)', () => {
    const head = engine.getHEAD();
    expect(head.attached).toBe(true);
    expect(head.target).toBe('main');
  });

  it('has no commits after init', () => {
    expect(engine.log()).toHaveLength(0);
  });

  it('isDirty returns false with no files', () => {
    expect(engine.isDirty()).toBe(false);
  });
});

describe('GitEngine – git add & commit', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  it('stages a specific file and shows it in getStagedFiles', () => {
    engine.getVFS().createFile('hello.txt', 'hello');
    engine.execute('git add hello.txt');
    const staged = engine.getStagedFiles();
    expect(staged).toContain('hello.txt');
  });

  it('git add . stages all VFS files', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.getVFS().createFile('b.txt', 'bbb');
    engine.execute('git add .');
    const staged = engine.getStagedFiles();
    expect(staged).toContain('a.txt');
    expect(staged).toContain('b.txt');
  });

  it('git add . returns empty output', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.getVFS().createFile('b.txt', 'bbb');
    const result = engine.execute('git add .');
    expect(result.output).toBe('');
    expect(result.exitCode).toBe(0);
  });

  it('git add <file> returns empty output', () => {
    engine.getVFS().createFile('c.txt', 'ccc');
    const result = engine.execute('git add c.txt');
    expect(result.output).toBe('');
    expect(result.exitCode).toBe(0);
  });

  it('commit creates a commit and advances HEAD', () => {
    engine.getVFS().createFile('readme.md', '# hello');
    engine.execute('git add readme.md');
    const result = engine.execute('git commit -m "initial commit"');
    expect(result.exitCode).toBe(0);
    expect(engine.log()).toHaveLength(1);
    expect(engine.log()[0].message).toBe('initial commit');
  });

  it('commit with nothing staged fails', () => {
    const result = engine.execute('git commit -m "empty"');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/nothing to commit/i);
  });

  it('commit without -m flag fails', () => {
    engine.getVFS().createFile('file.txt', 'content');
    engine.execute('git add file.txt');
    const result = engine.execute('git commit');
    expect(result.exitCode).not.toBe(0);
  });

  it('getStagedFiles is empty after committing', () => {
    engine.getVFS().createFile('file.txt', 'content');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "first"');
    expect(engine.getStagedFiles()).toHaveLength(0);
  });

  it('committed file is no longer untracked', () => {
    engine.getVFS().createFile('file.txt', 'content');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "commit"');
    expect(engine.getUntrackedFiles()).not.toContain('file.txt');
  });

  it('second commit has first commit as parent', () => {
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "first"');
    engine.getVFS().createFile('b.txt', 'b');
    engine.execute('git add b.txt');
    engine.execute('git commit -m "second"');
    const commits = engine.log();
    expect(commits).toHaveLength(2);
    // newest first
    expect(commits[0].message).toBe('second');
    expect(commits[1].message).toBe('first');
    expect(commits[0].parents).toContain(commits[1].hash);
  });
});

describe('GitEngine – git status output', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  it('shows untracked files', () => {
    engine.getVFS().createFile('untracked.txt', 'hello');
    const result = engine.execute('git status');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('untracked.txt');
    expect(result.output).toMatch(/untracked/i);
  });

  it('shows staged files', () => {
    engine.getVFS().createFile('staged.txt', 'hi');
    engine.execute('git add staged.txt');
    const result = engine.execute('git status');
    expect(result.output).toContain('staged.txt');
    // Should mention staged/new file
    expect(result.output.toLowerCase()).toMatch(/staged|new file/);
  });

  it('shows modified files after commit + change', () => {
    engine.getVFS().createFile('file.txt', 'v1');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "init"');
    // Now modify the file without staging
    engine.getVFS().createFile('file.txt', 'v2');
    const result = engine.execute('git status');
    expect(result.output).toContain('file.txt');
    expect(result.output.toLowerCase()).toMatch(/modified/);
  });

  it('shows clean status after commit', () => {
    engine.getVFS().createFile('file.txt', 'content');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "clean"');
    const result = engine.execute('git status');
    expect(result.output).toMatch(/nothing to commit|working tree clean/i);
  });

  it('shows branch name in status output', () => {
    const result = engine.execute('git status');
    expect(result.output).toContain('main');
  });
});

describe('GitEngine – file state helpers', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  it('getUntrackedFiles returns files not in index', () => {
    engine.getVFS().createFile('new.txt', 'hello');
    expect(engine.getUntrackedFiles()).toContain('new.txt');
  });

  it('getModifiedFiles returns files changed after staging', () => {
    engine.getVFS().createFile('file.txt', 'v1');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "base"');
    // Modify but don't re-stage
    engine.getVFS().createFile('file.txt', 'v2');
    expect(engine.getModifiedFiles()).toContain('file.txt');
  });

  it('getCommittedTree is empty before first commit', () => {
    expect(engine.getCommittedTree().size).toBe(0);
  });

  it('getCommittedTree has entries after commit', () => {
    engine.getVFS().createFile('file.txt', 'content');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "c1"');
    const tree = engine.getCommittedTree();
    expect(tree.size).toBe(1);
    expect(tree.has('file.txt')).toBe(true);
  });

  it('isDirty returns true when untracked files exist', () => {
    engine.getVFS().createFile('dirty.txt', 'x');
    expect(engine.isDirty()).toBe(true);
  });

  it('isDirty returns false after committing all files', () => {
    engine.getVFS().createFile('file.txt', 'content');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "done"');
    expect(engine.isDirty()).toBe(false);
  });
});

describe('GitEngine – subscribe notifications', () => {
  it('fires listener on add', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    expect(listener).toHaveBeenCalled();
  });

  it('fires listener on commit', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    listener.mockClear();
    engine.execute('git commit -m "msg"');
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const listener = vi.fn();
    const unsub = engine.subscribe(listener);
    unsub();
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('GitEngine – unknown command', () => {
  it('returns non-zero exit code for unknown command', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const result = engine.execute('git foobar');
    expect(result.exitCode).not.toBe(0);
  });

  it('returns error message for unknown command', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const result = engine.execute('git foobar');
    expect(result.output).toMatch(/not a git command|unknown command/i);
  });
});
