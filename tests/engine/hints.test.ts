import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

describe('contextual hints', () => {
  it('git command before init suggests git init', () => {
    const eng = new GitEngine();
    const res = eng.execute('git status');
    expect(res.output).toContain('not a git repository');
    expect(res.hint).toContain('git init');
  });

  it('nothing staged WITH untracked files → untracked message + git add hint', () => {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a'); // untracked, never added
    const res = eng.execute('git commit -m "x"');
    expect(res.output).toContain('nothing added to commit but untracked files present');
    expect(res.hint).toContain('git add');
  });

  it('nothing staged with a truly clean tree → clean message, no hint', () => {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a');
    eng.execute('git add a.txt');
    eng.execute('git commit -m "base"');
    const res = eng.execute('git commit -m "again"'); // clean, no untracked
    expect(res.output).toContain('nothing to commit, working tree clean');
    expect(res.hint).toBeUndefined();
  });

  it('nothing-to-commit names the actual branch when not on main', () => {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a');
    eng.execute('git add a.txt');
    eng.execute('git commit -m "base"');
    eng.execute('git checkout -b feature');
    const res = eng.execute('git commit -m "again"'); // nothing staged
    expect(res.output).toContain('On branch feature');
    expect(res.output).toContain('nothing to commit');
  });
});
