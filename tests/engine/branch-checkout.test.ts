import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create engine with one commit on main so HEAD resolves to a real commit. */
function engineWithCommit(): { engine: GitEngine; commitHash: string } {
  const engine = new GitEngine();
  engine.execute('git init');
  engine.getVFS().createFile('readme.md', '# hello');
  engine.execute('git add readme.md');
  engine.execute('git commit -m "initial"');
  const commitHash = engine.log()[0].hash;
  return { engine, commitHash };
}

// ===========================================================================
// git branch
// ===========================================================================

describe('git branch – list', () => {
  it('lists branches with current marked by *', () => {
    const { engine } = engineWithCommit();
    const result = engine.execute('git branch');
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/\* main/);
  });

  it('newly created branch appears in listing', () => {
    const { engine } = engineWithCommit();
    engine.execute('git branch feature');
    const result = engine.execute('git branch');
    expect(result.output).toContain('feature');
    expect(result.output).toMatch(/\* main/);
  });

  it('listing shows all branches sorted', () => {
    const { engine } = engineWithCommit();
    engine.execute('git branch zebra');
    engine.execute('git branch apple');
    const result = engine.execute('git branch');
    const lines = result.output
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const names = lines.map((l) => l.replace(/^\*\s*/, ''));
    expect(names).toEqual([...names].sort());
  });
});

describe('git branch – create', () => {
  it('creates a branch at current HEAD', () => {
    const { engine } = engineWithCommit();
    const result = engine.execute('git branch feature');
    expect(result.exitCode).toBe(0);
    // Switching to the new branch should succeed
    const co = engine.execute('git checkout feature');
    expect(co.exitCode).toBe(0);
    expect(engine.getHEAD().target).toBe('feature');
  });

  it('cannot create a branch that already exists', () => {
    const { engine } = engineWithCommit();
    engine.execute('git branch feature');
    const result = engine.execute('git branch feature');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/already exists/i);
  });

  it('cannot create a branch without any commits', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const result = engine.execute('git branch feature');
    expect(result.exitCode).not.toBe(0);
  });
});

describe('git branch – delete', () => {
  it('deletes a branch with -d', () => {
    const { engine } = engineWithCommit();
    engine.execute('git branch old-branch');
    const result = engine.execute('git branch -d old-branch');
    expect(result.exitCode).toBe(0);
    const listing = engine.execute('git branch');
    expect(listing.output).not.toContain('old-branch');
  });

  it('deletes a branch with -D', () => {
    const { engine } = engineWithCommit();
    engine.execute('git branch temp');
    const result = engine.execute('git branch -D temp');
    expect(result.exitCode).toBe(0);
    const listing = engine.execute('git branch');
    expect(listing.output).not.toContain('temp');
  });

  it('refuses to delete the current branch', () => {
    const { engine } = engineWithCommit();
    const result = engine.execute('git branch -d main');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/cannot delete|current branch/i);
  });

  it('error when deleting non-existent branch', () => {
    const { engine } = engineWithCommit();
    const result = engine.execute('git branch -d ghost');
    expect(result.exitCode).not.toBe(0);
  });
});

// ===========================================================================
// git checkout
// ===========================================================================

describe('git checkout – switch to existing branch', () => {
  it('switches to an existing branch', () => {
    const { engine } = engineWithCommit();
    engine.execute('git branch feature');
    const result = engine.execute('git checkout feature');
    expect(result.exitCode).toBe(0);
    expect(engine.getHEAD().attached).toBe(true);
    expect(engine.getHEAD().target).toBe('feature');
  });

  it('HEAD is attached after switching to branch', () => {
    const { engine } = engineWithCommit();
    engine.execute('git branch dev');
    engine.execute('git checkout dev');
    expect(engine.getHEAD().attached).toBe(true);
  });

  it('errors when checking out a non-existent branch or commit', () => {
    const { engine } = engineWithCommit();
    const result = engine.execute('git checkout no-such-branch');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/did not match|not found|unknown/i);
  });
});

describe('git checkout -b – create and switch', () => {
  it('creates and switches to a new branch', () => {
    const { engine } = engineWithCommit();
    const result = engine.execute('git checkout -b feature');
    expect(result.exitCode).toBe(0);
    expect(engine.getHEAD().attached).toBe(true);
    expect(engine.getHEAD().target).toBe('feature');
  });

  it('new branch appears in listing after -b', () => {
    const { engine } = engineWithCommit();
    engine.execute('git checkout -b new-feature');
    const listing = engine.execute('git branch');
    expect(listing.output).toContain('new-feature');
    expect(listing.output).toMatch(/\* new-feature/);
  });

  it('fails -b if branch already exists', () => {
    const { engine } = engineWithCommit();
    engine.execute('git branch existing');
    const result = engine.execute('git checkout -b existing');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/already exists/i);
  });
});

describe('git checkout – detach HEAD at commit hash', () => {
  it('detaches HEAD at a commit hash', () => {
    const { engine, commitHash } = engineWithCommit();
    const result = engine.execute(`git checkout ${commitHash}`);
    expect(result.exitCode).toBe(0);
    expect(engine.getHEAD().attached).toBe(false);
    expect(engine.getHEAD().target).toBe(commitHash);
  });

  it('HEAD target equals the commit hash after detach', () => {
    const { engine, commitHash } = engineWithCommit();
    engine.execute(`git checkout ${commitHash}`);
    const head = engine.getHEAD();
    expect(head.target).toBe(commitHash);
  });
});

describe('git checkout – restores working directory', () => {
  it('files committed on main disappear on checkout of new empty-tree branch', () => {
    // This scenario: commit a file on main, then create a branch from an
    // earlier state that has no such file. Since we can only branch from HEAD
    // (single-parent linear history), we test that WD/index is restored to
    // the target branch's commit tree.
    const engine = new GitEngine();
    engine.execute('git init');

    // Commit A on main: only file-a.txt
    engine.getVFS().createFile('file-a.txt', 'content-a');
    engine.execute('git add file-a.txt');
    engine.execute('git commit -m "commit A"');
    engine.log()[0].hash;

    // Create branch "branchA" pointing at commit A (same as main for now)
    engine.execute('git branch branchA');

    // Commit B on main: add file-b.txt
    engine.getVFS().createFile('file-b.txt', 'content-b');
    engine.execute('git add file-b.txt');
    engine.execute('git commit -m "commit B"');

    // Now checkout branchA – file-b.txt should be gone from VFS
    const result = engine.execute('git checkout branchA');
    expect(result.exitCode).toBe(0);

    const vfsPaths = engine.getVFS().allFilePaths();
    expect(vfsPaths).toContain('file-a.txt');
    expect(vfsPaths).not.toContain('file-b.txt');
  });

  it('index is reset to match target commit tree on checkout', () => {
    const engine = new GitEngine();
    engine.execute('git init');

    engine.getVFS().createFile('file-a.txt', 'content-a');
    engine.execute('git add file-a.txt');
    engine.execute('git commit -m "commit A"');

    engine.execute('git branch branchA');

    engine.getVFS().createFile('file-b.txt', 'content-b');
    engine.execute('git add file-b.txt');
    engine.execute('git commit -m "commit B"');

    engine.execute('git checkout branchA');

    // After checkout, no staged files should exist that aren't in the target tree
    const staged = engine.getStagedFiles();
    expect(staged).toHaveLength(0);
  });

  it('files from target branch appear after checkout', () => {
    const engine = new GitEngine();
    engine.execute('git init');

    // Commit on main
    engine.getVFS().createFile('main-file.txt', 'main');
    engine.execute('git add main-file.txt');
    engine.execute('git commit -m "main commit"');

    // Create feature branch and add a file
    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('feature-file.txt', 'feature content');
    engine.execute('git add feature-file.txt');
    engine.execute('git commit -m "feature commit"');

    // Go back to main
    engine.execute('git checkout main');

    // feature-file.txt should be gone
    expect(engine.getVFS().allFilePaths()).not.toContain('feature-file.txt');
    expect(engine.getVFS().allFilePaths()).toContain('main-file.txt');

    // Go back to feature
    engine.execute('git checkout feature');
    expect(engine.getVFS().allFilePaths()).toContain('feature-file.txt');
    expect(engine.getVFS().allFilePaths()).toContain('main-file.txt');
  });
});

// ===========================================================================
// git switch – alias for git checkout
// ===========================================================================

describe('git switch', () => {
  it('switches to an existing branch', () => {
    const { engine } = engineWithCommit();
    engine.execute('git branch dev');
    const result = engine.execute('git switch dev');
    expect(result.exitCode).toBe(0);
    expect(engine.getHEAD().target).toBe('dev');
    expect(engine.getHEAD().attached).toBe(true);
  });

  it('creates and switches with -b', () => {
    const { engine } = engineWithCommit();
    const result = engine.execute('git switch -b new-branch');
    expect(result.exitCode).toBe(0);
    expect(engine.getHEAD().target).toBe('new-branch');
    expect(engine.getHEAD().attached).toBe(true);
  });

  it('errors on unknown branch', () => {
    const { engine } = engineWithCommit();
    const result = engine.execute('git switch unknown-branch');
    expect(result.exitCode).not.toBe(0);
  });
});
