import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create engine with one commit on main containing readme.md.
 */
function engineWithCommit(): GitEngine {
  const engine = new GitEngine();
  engine.execute('git init');
  engine.getVFS().createFile('readme.md', '# hello');
  engine.execute('git add readme.md');
  engine.execute('git commit -m "initial"');
  return engine;
}

// ===========================================================================
// Fast-forward merge
// ===========================================================================

describe('git merge – fast-forward', () => {
  it('advances main pointer to feature tip', () => {
    const engine = engineWithCommit();

    // Create feature branch and add a commit ahead of main
    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('feature.txt', 'feature content');
    engine.execute('git add feature.txt');
    engine.execute('git commit -m "feature work"');
    const featureHash = engine.log()[0].hash;

    // Switch back to main and merge
    engine.execute('git checkout main');
    const result = engine.execute('git merge feature');
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/fast.forward/i);

    // main should now point at the same commit as feature
    const headHash = engine.log()[0].hash;
    expect(headHash).toBe(featureHash);
  });

  it('restores VFS after fast-forward to include feature files', () => {
    const engine = engineWithCommit();

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('new-file.txt', 'new content');
    engine.execute('git add new-file.txt');
    engine.execute('git commit -m "add new-file"');

    engine.execute('git checkout main');
    engine.execute('git merge feature');

    // VFS should now contain new-file.txt
    expect(engine.getVFS().allFilePaths()).toContain('new-file.txt');
  });

  it('index matches merged tree after fast-forward', () => {
    const engine = engineWithCommit();

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('extra.txt', 'extra');
    engine.execute('git add extra.txt');
    engine.execute('git commit -m "extra"');

    engine.execute('git checkout main');
    engine.execute('git merge feature');

    // No staged files after merge (index = tree)
    expect(engine.getStagedFiles()).toHaveLength(0);
    // And working tree is clean
    expect(engine.isDirty()).toBe(false);
  });

  it('merge output includes branch name', () => {
    const engine = engineWithCommit();
    engine.execute('git checkout -b feat');
    engine.getVFS().createFile('f.txt', 'x');
    engine.execute('git add f.txt');
    engine.execute('git commit -m "feat"');
    engine.execute('git checkout main');
    const result = engine.execute('git merge feat');
    expect(result.output).toContain('feat');
  });
});

// ===========================================================================
// Three-way merge
// ===========================================================================

describe('git merge – three-way', () => {
  it('creates a merge commit with two parents', () => {
    const engine = new GitEngine();
    engine.execute('git init');

    // Commit A: base
    engine.getVFS().createFile('base.txt', 'base content');
    engine.execute('git add base.txt');
    engine.execute('git commit -m "base commit"');

    // Branch feature from base
    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('feature.txt', 'feature content');
    engine.execute('git add feature.txt');
    engine.execute('git commit -m "feature commit"');
    const featureHash = engine.log()[0].hash;

    // Go back to main and add a diverging commit
    engine.execute('git checkout main');
    engine.getVFS().createFile('main-extra.txt', 'main extra');
    engine.execute('git add main-extra.txt');
    engine.execute('git commit -m "main extra commit"');
    const mainTipHash = engine.log()[0].hash;

    // Merge feature into main
    const result = engine.execute('git merge feature');
    expect(result.exitCode).toBe(0);

    // Should have created a merge commit
    const commits = engine.log();
    const mergeCommit = commits[0];
    expect(mergeCommit.parents).toHaveLength(2);
    expect(mergeCommit.parents).toContain(mainTipHash);
    expect(mergeCommit.parents).toContain(featureHash);
  });

  it('merge commit message mentions the merged branch', () => {
    const engine = new GitEngine();
    engine.execute('git init');

    engine.getVFS().createFile('base.txt', 'base');
    engine.execute('git add base.txt');
    engine.execute('git commit -m "base"');

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('feature.txt', 'feature');
    engine.execute('git add feature.txt');
    engine.execute('git commit -m "feature"');

    engine.execute('git checkout main');
    engine.getVFS().createFile('main2.txt', 'main2');
    engine.execute('git add main2.txt');
    engine.execute('git commit -m "main2"');

    const result = engine.execute('git merge feature');
    expect(result.exitCode).toBe(0);
    expect(result.output.toLowerCase()).toMatch(/merge/);

    const mergeCommit = engine.log()[0];
    expect(mergeCommit.message.toLowerCase()).toMatch(/merge.*feature|feature.*merge/);
  });

  it('merged tree includes files from both branches', () => {
    const engine = new GitEngine();
    engine.execute('git init');

    engine.getVFS().createFile('shared.txt', 'shared');
    engine.execute('git add shared.txt');
    engine.execute('git commit -m "base"');

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('from-feature.txt', 'from feature');
    engine.execute('git add from-feature.txt');
    engine.execute('git commit -m "feature file"');

    engine.execute('git checkout main');
    engine.getVFS().createFile('from-main.txt', 'from main');
    engine.execute('git add from-main.txt');
    engine.execute('git commit -m "main file"');

    engine.execute('git merge feature');

    const vfsPaths = engine.getVFS().allFilePaths();
    expect(vfsPaths).toContain('shared.txt');
    expect(vfsPaths).toContain('from-main.txt');
    expect(vfsPaths).toContain('from-feature.txt');
  });

  it('HEAD advances to merge commit after three-way merge', () => {
    const engine = new GitEngine();
    engine.execute('git init');

    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "a"');

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('b.txt', 'b');
    engine.execute('git add b.txt');
    engine.execute('git commit -m "b"');

    engine.execute('git checkout main');
    engine.getVFS().createFile('c.txt', 'c');
    engine.execute('git add c.txt');
    engine.execute('git commit -m "c"');

    engine.execute('git merge feature');

    // HEAD should be attached to main
    expect(engine.getHEAD().attached).toBe(true);
    expect(engine.getHEAD().target).toBe('main');

    // And the merge commit should be the tip
    const mergeCommit = engine.log()[0];
    expect(mergeCommit.parents).toHaveLength(2);
  });

  it('index and VFS are clean after three-way merge', () => {
    const engine = new GitEngine();
    engine.execute('git init');

    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "a"');

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('b.txt', 'b');
    engine.execute('git add b.txt');
    engine.execute('git commit -m "b"');

    engine.execute('git checkout main');
    engine.getVFS().createFile('c.txt', 'c');
    engine.execute('git add c.txt');
    engine.execute('git commit -m "c"');

    engine.execute('git merge feature');

    expect(engine.getStagedFiles()).toHaveLength(0);
    expect(engine.isDirty()).toBe(false);
  });
});

// ===========================================================================
// Already up to date
// ===========================================================================

describe('git merge – already up to date', () => {
  it('is a no-op when target is an ancestor of HEAD', () => {
    const engine = engineWithCommit();
    const initialHash = engine.log()[0].hash;

    // Create feature from main, then switch back — feature is behind main
    engine.execute('git branch behind-branch');

    // Add another commit on main
    engine.getVFS().createFile('new.txt', 'new');
    engine.execute('git add new.txt');
    engine.execute('git commit -m "ahead"');

    // Merging behind-branch should be a no-op
    const result = engine.execute('git merge behind-branch');
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/already up.to.date/i);

    // HEAD should NOT have moved
    expect(engine.log()[0].hash).not.toBe(initialHash);
    // But no new merge commit — still just 2 commits
    expect(engine.log()).toHaveLength(2);
  });

  it('is a no-op when merging the same branch', () => {
    const engine = engineWithCommit();
    const result = engine.execute('git merge main');
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/already up.to.date/i);
  });
});

// ===========================================================================
// Error cases
// ===========================================================================

describe('git merge – errors', () => {
  it('errors when branch does not exist', () => {
    const engine = engineWithCommit();
    const result = engine.execute('git merge nope');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/not found|does not exist|nope/i);
  });

  it('errors when no branch name given', () => {
    const engine = engineWithCommit();
    const result = engine.execute('git merge');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/branch|argument/i);
  });
});
