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

describe('git commit -a / -am', () => {
  it('-am stages tracked modifications and commits with the message', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('a.txt', 'a-modified');
    const before = eng.log().length;
    const res = eng.execute('git commit -am "update a"');
    expect(res.exitCode).toBe(0);
    expect(eng.log().length).toBe(before + 1);
    expect(eng.log()[0].message).toBe('update a');
  });

  it('-a does not sweep in a brand-new untracked file', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('a.txt', 'a-modified'); // tracked, modified
    eng.getVFS().createFile('new.txt', 'new'); // untracked
    eng.execute('git commit -am "only tracked"');
    expect(eng.getUntrackedFiles()).toContain('new.txt');
  });

  it('-a -m (separate flags) behaves the same as -am', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('a.txt', 'a2');
    const res = eng.execute('git commit -a -m "sep"');
    expect(res.exitCode).toBe(0);
    expect(eng.log()[0].message).toBe('sep');
  });

  it('-a on a clean tree commits nothing', () => {
    const eng = repoWithCommit();
    const before = eng.log().length;
    const res = eng.execute('git commit -am "nothing changed"');
    expect(res.output).toContain('nothing to commit');
    expect(res.exitCode).not.toBe(0);
    expect(eng.log().length).toBe(before);
  });

  it('-a without -m returns the missing-message error and does not commit', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('a.txt', 'changed');
    const before = eng.log().length;
    const res = eng.execute('git commit -a');
    expect(res.exitCode).toBe(128);
    expect(res.output).toContain("switch `m'");
    expect(eng.log().length).toBe(before); // no commit created
  });
});
