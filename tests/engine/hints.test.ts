import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

describe('contextual hints', () => {
  it('git command before init suggests git init', () => {
    const eng = new GitEngine();
    const res = eng.execute('git status');
    expect(res.output).toContain('not a git repository');
    expect(res.hint).toContain('git init');
  });

  it('nothing-to-commit suggests touch + git add', () => {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a');
    eng.execute('git add a.txt');
    eng.execute('git commit -m "base"');
    const res = eng.execute('git commit -m "again"'); // nothing staged
    expect(res.output).toContain('nothing to commit');
    expect(res.hint).toContain('touch');
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
