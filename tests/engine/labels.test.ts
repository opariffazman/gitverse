import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';

function setup(): GitEngine {
  const eng = new GitEngine();
  eng.execute('git init');
  return eng;
}

function commit(eng: GitEngine, file: string, msg: string): string {
  eng.getVFS().createFile(file, msg);
  eng.execute(`git add ${file}`);
  eng.execute(`git commit -m "${msg}"`);
  return eng.getHEAD().attached
    ? eng.allBranches().get(eng.getHEAD().target)!
    : eng.getHEAD().target;
}

describe('GitEngine commit labels', () => {
  let eng: GitEngine;
  let c1: string;
  let c2: string;
  let c3: string;

  beforeEach(() => {
    eng = setup();
    c1 = commit(eng, 'a.txt', 'first');
    c2 = commit(eng, 'b.txt', 'second');
    c3 = commit(eng, 'c.txt', 'third');
  });

  it('labels commits C1, C2, C3 in creation order', () => {
    expect(eng.commitLabel(c1)).toBe('C1');
    expect(eng.commitLabel(c2)).toBe('C2');
    expect(eng.commitLabel(c3)).toBe('C3');
  });

  it('falls back to short hash for an unknown commit', () => {
    expect(eng.commitLabel('deadbee')).toBe('deadbee');
  });

  it('resolveCommitLabel round-trips with commitLabel', () => {
    expect(eng.resolveCommitLabel('C1')).toBe(c1);
    expect(eng.resolveCommitLabel('C3')).toBe(c3);
  });

  it('resolveCommitLabel is case-insensitive', () => {
    expect(eng.resolveCommitLabel('c2')).toBe(c2);
  });

  it('resolveCommitLabel returns null for unknown or malformed labels', () => {
    expect(eng.resolveCommitLabel('C99')).toBeNull();
    expect(eng.resolveCommitLabel('C0')).toBeNull();
    expect(eng.resolveCommitLabel('main')).toBeNull();
    expect(eng.resolveCommitLabel('abc1234')).toBeNull();
  });

  it('expandCommitish resolves labels to hashes', () => {
    expect(eng.expandCommitish('C2')).toBe(c2);
  });

  it('expandCommitish leaves non-label tokens unchanged', () => {
    expect(eng.expandCommitish('main')).toBe('main');
    expect(eng.expandCommitish(c1)).toBe(c1);
  });

  it('expandCommitish does not shadow a real branch named like a label', () => {
    eng.execute('git branch C2');
    // A branch literally named "C2" wins over the C2 commit label.
    expect(eng.expandCommitish('C2')).toBe('C2');
  });
});

describe('C-labels as command arguments', () => {
  let eng: GitEngine;
  let c1: string;

  beforeEach(() => {
    eng = setup();
    c1 = commit(eng, 'a.txt', 'first');
    commit(eng, 'b.txt', 'second');
    commit(eng, 'c.txt', 'third');
  });

  it('git checkout C2 detaches HEAD at the right commit', () => {
    const result = eng.execute('git checkout C2');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('C2');
    const head = eng.getHEAD();
    expect(head.attached).toBe(false);
    expect(head.target).toBe(eng.resolveCommitLabel('C2'));
  });

  it('git reset C1 moves the branch to that commit', () => {
    const result = eng.execute('git reset --hard C1');
    expect(result.exitCode).toBe(0);
    expect(eng.allBranches().get('main')).toBe(c1);
  });

  it('git branch C3 creates a branch literally named C3 (not label-expanded)', () => {
    const result = eng.execute('git branch C3');
    expect(result.exitCode).toBe(0);
    expect(eng.allBranches().has('C3')).toBe(true);
    // The C3 branch points at HEAD (the third commit), not at the C3 commit
    // resolved via label — proving the name was not expanded.
    expect(eng.allBranches().get('C3')).toBe(eng.allBranches().get('main'));
  });

  it('git tag at a C-label targets the right commit', () => {
    const result = eng.execute('git tag v-c1 C1');
    expect(result.exitCode).toBe(0);
    expect(eng.allTags().get('v-c1')).toBe(c1);
  });
});
