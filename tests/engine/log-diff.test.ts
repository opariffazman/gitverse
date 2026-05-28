import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { generateDiff } from '$engine/diff';

// ---------------------------------------------------------------------------
// git log tests
// ---------------------------------------------------------------------------

describe('git log – empty repository', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  it('returns a message when there are no commits', () => {
    const result = engine.execute('git log');
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/no commits yet|has no commits yet/i);
  });

  it('--oneline on empty repo also returns an empty message', () => {
    const result = engine.execute('git log --oneline');
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/no commits yet|has no commits yet/i);
  });
});

describe('git log – full format (default)', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'alpha');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "first commit"');

    engine.getVFS().createFile('b.txt', 'beta');
    engine.execute('git add b.txt');
    engine.execute('git commit -m "second commit"');
  });

  it('shows commits newest first', () => {
    const result = engine.execute('git log');
    expect(result.exitCode).toBe(0);
    const idx1 = result.output.indexOf('second commit');
    const idx2 = result.output.indexOf('first commit');
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThanOrEqual(0);
    expect(idx1).toBeLessThan(idx2);
  });

  it('includes full commit hash in output', () => {
    const result = engine.execute('git log');
    const commits = engine.log();
    // Full hash (7+ chars) should appear
    expect(result.output).toContain(commits[0].hash);
  });

  it('includes commit message in output', () => {
    const result = engine.execute('git log');
    expect(result.output).toContain('second commit');
    expect(result.output).toContain('first commit');
  });

  it('shows HEAD branch decoration on current commit', () => {
    const result = engine.execute('git log');
    expect(result.output).toMatch(/HEAD.*main|main.*HEAD/);
  });
});

describe('git log – --oneline format', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'alpha');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "first commit"');

    engine.getVFS().createFile('b.txt', 'beta');
    engine.execute('git add b.txt');
    engine.execute('git commit -m "second commit"');
  });

  it('shows one line per commit', () => {
    const result = engine.execute('git log --oneline');
    expect(result.exitCode).toBe(0);
    const lines = result.output.split('\n').filter((l) => l.trim() !== '');
    expect(lines).toHaveLength(2);
  });

  it('shows 7-char short hash', () => {
    const result = engine.execute('git log --oneline');
    const commits = engine.log();
    const shortHash = commits[0].hash.slice(0, 7);
    expect(result.output).toContain(shortHash);
  });

  it('shows commit message on same line as hash', () => {
    const result = engine.execute('git log --oneline');
    const lines = result.output.split('\n').filter((l) => l.trim() !== '');
    // Each line should contain hash + message
    for (const line of lines) {
      expect(line).toMatch(/\w{7}.*commit/);
    }
  });

  it('shows newest commit first', () => {
    const result = engine.execute('git log --oneline');
    const idx1 = result.output.indexOf('second commit');
    const idx2 = result.output.indexOf('first commit');
    expect(idx1).toBeLessThan(idx2);
  });
});

describe('git log – branch decorations', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'alpha');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "initial"');
  });

  it('shows (HEAD -> main) decoration on current branch commit', () => {
    const result = engine.execute('git log');
    expect(result.output).toContain('HEAD');
    expect(result.output).toContain('main');
  });

  it('shows (HEAD -> main) in oneline format', () => {
    const result = engine.execute('git log --oneline');
    expect(result.output).toContain('HEAD');
    expect(result.output).toContain('main');
  });
});

// ---------------------------------------------------------------------------
// generateDiff utility tests
// ---------------------------------------------------------------------------

describe('generateDiff utility', () => {
  it('returns empty string when content is identical', () => {
    const diff = generateDiff('file.txt', 'same\n', 'same\n');
    expect(diff).toBe('');
  });

  it('produces diff --git header', () => {
    const diff = generateDiff('file.txt', 'old\n', 'new\n');
    expect(diff).toContain('diff --git a/file.txt b/file.txt');
  });

  it('produces --- and +++ headers', () => {
    const diff = generateDiff('file.txt', 'old\n', 'new\n');
    expect(diff).toContain('--- a/file.txt');
    expect(diff).toContain('+++ b/file.txt');
  });

  it('produces @@ hunk header', () => {
    const diff = generateDiff('file.txt', 'old\n', 'new\n');
    expect(diff).toContain('@@');
  });

  it('shows removed lines with - prefix', () => {
    const diff = generateDiff('file.txt', 'removed line\n', 'new line\n');
    expect(diff).toContain('-removed line');
  });

  it('shows added lines with + prefix', () => {
    const diff = generateDiff('file.txt', 'old line\n', 'added line\n');
    expect(diff).toContain('+added line');
  });

  it('handles empty old content (new file)', () => {
    const diff = generateDiff('new.txt', '', 'hello\nworld\n');
    expect(diff).toContain('+hello');
    expect(diff).toContain('+world');
  });

  it('handles empty new content (deleted file)', () => {
    const diff = generateDiff('del.txt', 'hello\nworld\n', '');
    expect(diff).toContain('-hello');
    expect(diff).toContain('-world');
  });

  it('shows context lines without prefix', () => {
    const old = 'line1\nline2\nchanged\nline4\nline5\n';
    const newContent = 'line1\nline2\nnewcontent\nline4\nline5\n';
    const diff = generateDiff('file.txt', old, newContent);
    // context lines appear without + or - prefix
    expect(diff).toMatch(/ line1| line2| line4| line5/);
  });
});

// ---------------------------------------------------------------------------
// git diff tests
// ---------------------------------------------------------------------------

describe('git diff – working directory vs index/committed', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  it('shows nothing when working tree is clean', () => {
    engine.getVFS().createFile('file.txt', 'content\n');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "init"');
    const result = engine.execute('git diff');
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('');
  });

  it('shows diff for modified (unstaged) file', () => {
    engine.getVFS().createFile('file.txt', 'original\n');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "init"');
    engine.getVFS().createFile('file.txt', 'modified\n');
    const result = engine.execute('git diff');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('-original');
    expect(result.output).toContain('+modified');
  });

  it('shows nothing when file is only staged (not yet modified after staging)', () => {
    engine.getVFS().createFile('file.txt', 'content\n');
    engine.execute('git add file.txt');
    // File is staged but not committed and matches what's in the index
    const result = engine.execute('git diff');
    expect(result.exitCode).toBe(0);
    // Nothing to diff since working dir matches index
    expect(result.output).toBe('');
  });
});

describe('git diff --staged / --cached', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  it('shows nothing when nothing is staged', () => {
    const result = engine.execute('git diff --staged');
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('');
  });

  it('shows staged new file vs HEAD (empty)', () => {
    engine.getVFS().createFile('new.txt', 'hello\n');
    engine.execute('git add new.txt');
    const result = engine.execute('git diff --staged');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('+hello');
  });

  it('shows staged modification vs HEAD commit', () => {
    engine.getVFS().createFile('file.txt', 'v1\n');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "init"');
    engine.getVFS().createFile('file.txt', 'v2\n');
    engine.execute('git add file.txt');
    const result = engine.execute('git diff --staged');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('-v1');
    expect(result.output).toContain('+v2');
  });

  it('--cached is an alias for --staged', () => {
    engine.getVFS().createFile('file.txt', 'content\n');
    engine.execute('git add file.txt');
    const staged = engine.execute('git diff --staged');
    const cached = engine.execute('git diff --cached');
    expect(staged.output).toBe(cached.output);
    expect(staged.exitCode).toBe(cached.exitCode);
  });

  it('shows nothing after commit (staged matches HEAD)', () => {
    engine.getVFS().createFile('file.txt', 'content\n');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "done"');
    const result = engine.execute('git diff --staged');
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('');
  });
});
