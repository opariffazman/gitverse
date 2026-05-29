import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

function repoWithCommit(): GitEngine {
  const eng = new GitEngine();
  eng.execute('git init');
  eng.getVFS().createFile('a.txt', 'a');
  eng.execute('git add a.txt');
  eng.execute('git commit -m "base"');
  return eng;
}

describe('git add -A / -u / .', () => {
  it('add -A stages a deletion of a tracked file', () => {
    const eng = repoWithCommit();
    eng.getVFS().deleteFile('a.txt');
    eng.execute('git add -A');
    // Staged deletion: path is gone from index but still in committed tree
    expect(eng.getStagedFiles()).not.toContain('a.txt');
    expect(eng.getCommittedTree().has('a.txt')).toBe(true);
    eng.execute('git commit -m "remove a"');
    expect([...eng.getCommittedTree().keys()]).not.toContain('a.txt');
  });

  it('add -u stages a tracked modification but not a new untracked file', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('a.txt', 'a-modified'); // modify tracked
    eng.getVFS().createFile('new.txt', 'new'); // untracked
    eng.execute('git add -u');
    expect(eng.getStagedFiles()).toContain('a.txt');
    expect(eng.getStagedFiles()).not.toContain('new.txt');
  });

  it('add -A stages a new untracked file', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('new.txt', 'new');
    eng.execute('git add -A');
    expect(eng.getStagedFiles()).toContain('new.txt');
  });

  it('add . stages a deletion (aligned with -A)', () => {
    const eng = repoWithCommit();
    eng.getVFS().deleteFile('a.txt');
    eng.execute('git add .');
    eng.execute('git commit -m "remove via dot"');
    expect([...eng.getCommittedTree().keys()]).not.toContain('a.txt');
  });

  it('add -A on a clean working tree stages nothing (no churn)', () => {
    const eng = repoWithCommit(); // a.txt committed, tree clean
    eng.execute('git add -A');
    // No spurious modifications: committing finds nothing to commit.
    const res = eng.execute('git commit -m "should be empty"');
    expect(res.output).toContain('nothing to commit');
    expect(res.exitCode).not.toBe(0);
  });

  it('add . on a clean working tree stages nothing', () => {
    const eng = repoWithCommit();
    eng.execute('git add .');
    const res = eng.execute('git commit -m "empty"');
    expect(res.output).toContain('nothing to commit');
  });
});
