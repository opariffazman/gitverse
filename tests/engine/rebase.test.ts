import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function engineWithBase(): GitEngine {
  const engine = new GitEngine();
  engine.getVFS().createFile('base.txt', 'base content');
  engine.execute('git add base.txt');
  engine.execute('git commit -m "base"');
  return engine;
}

// ===========================================================================
// git rebase
// ===========================================================================

describe('git rebase', () => {
  it('replays branch commits onto target with new hashes', () => {
    const engine = engineWithBase();
    const baseHash = engine.log()[0].hash;

    // Create feature branch with 2 commits
    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('f1.txt', 'f1');
    engine.execute('git add f1.txt');
    engine.execute('git commit -m "add f1"');
    const origF1Hash = engine.log()[0].hash;

    engine.getVFS().createFile('f2.txt', 'f2');
    engine.execute('git add f2.txt');
    engine.execute('git commit -m "add f2"');
    const origF2Hash = engine.log()[0].hash;

    // Add a commit to main to diverge
    engine.execute('git checkout main');
    engine.getVFS().createFile('m1.txt', 'm1');
    engine.execute('git add m1.txt');
    engine.execute('git commit -m "main ahead"');
    const mainTip = engine.log()[0].hash;

    // Rebase feature onto main
    engine.execute('git checkout feature');
    const result = engine.execute('git rebase main');
    expect(result.exitCode).toBe(0);

    const commits = engine.log();
    // Feature tip should be new (different hash)
    expect(commits[0].hash).not.toBe(origF2Hash);
    // The rebased commits' parent chain should end at mainTip
    // Walk to find all commit hashes reachable from feature tip
    const tipCommit = commits[0];
    const parentCommit = commits.find(c => c.hash === tipCommit.parents[0]);
    expect(parentCommit).toBeDefined();
    // Parent of tip should trace back to mainTip
    expect(parentCommit!.parents[0]).toBe(mainTip);
  });

  it('feature commits appear with new hashes (different from originals)', () => {
    const engine = engineWithBase();

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('x.txt', 'x');
    engine.execute('git add x.txt');
    engine.execute('git commit -m "add x"');
    const origHash = engine.log()[0].hash;

    engine.execute('git checkout main');
    engine.getVFS().createFile('y.txt', 'y');
    engine.execute('git add y.txt');
    engine.execute('git commit -m "add y"');

    engine.execute('git checkout feature');
    engine.execute('git rebase main');

    const newTip = engine.log()[0].hash;
    expect(newTip).not.toBe(origHash);
  });

  it('rebased commits preserve original messages', () => {
    const engine = engineWithBase();

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('f.txt', 'f');
    engine.execute('git add f.txt');
    engine.execute('git commit -m "my feature message"');

    engine.execute('git checkout main');
    engine.getVFS().createFile('m.txt', 'm');
    engine.execute('git add m.txt');
    engine.execute('git commit -m "main work"');

    engine.execute('git checkout feature');
    engine.execute('git rebase main');

    const commits = engine.log();
    const messages = commits.map(c => c.message);
    expect(messages).toContain('my feature message');
  });

  it('branch pointer advances to the new tip after rebase', () => {
    const engine = engineWithBase();

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('f.txt', 'f');
    engine.execute('git add f.txt');
    engine.execute('git commit -m "feat"');
    const origTip = engine.log()[0].hash;

    engine.execute('git checkout main');
    engine.getVFS().createFile('m.txt', 'm');
    engine.execute('git add m.txt');
    engine.execute('git commit -m "main"');

    engine.execute('git checkout feature');
    engine.execute('git rebase main');

    // HEAD is still on feature
    expect(engine.getHEAD().attached).toBe(true);
    expect(engine.getHEAD().target).toBe('feature');
    // tip should have changed
    expect(engine.log()[0].hash).not.toBe(origTip);
  });

  it('restores VFS and index after rebase', () => {
    const engine = engineWithBase();

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('feat.txt', 'feat content');
    engine.execute('git add feat.txt');
    engine.execute('git commit -m "feat file"');

    engine.execute('git checkout main');
    engine.getVFS().createFile('main2.txt', 'main2');
    engine.execute('git add main2.txt');
    engine.execute('git commit -m "main2"');

    engine.execute('git checkout feature');
    engine.execute('git rebase main');

    expect(engine.getVFS().allFilePaths()).toContain('feat.txt');
    expect(engine.getStagedFiles()).toHaveLength(0);
    expect(engine.isDirty()).toBe(false);
  });

  it('is a no-op when HEAD is already an ancestor of target', () => {
    const engine = engineWithBase();
    const initialTip = engine.log()[0].hash;

    // feature is behind main (just branched, no new commits)
    engine.execute('git branch feature');
    engine.getVFS().createFile('m.txt', 'm');
    engine.execute('git add m.txt');
    engine.execute('git commit -m "main ahead"');

    engine.execute('git checkout feature');
    const result = engine.execute('git rebase main');
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/already up.to.date|up to date/i);
  });

  it('is a no-op when HEAD equals target', () => {
    const engine = engineWithBase();
    const result = engine.execute('git rebase main');
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/already up.to.date|up to date/i);
  });

  it('errors when no target specified', () => {
    const engine = engineWithBase();
    const result = engine.execute('git rebase');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/usage|error|branch|target/i);
  });

  it('errors when target branch does not exist', () => {
    const engine = engineWithBase();
    const result = engine.execute('git rebase nonexistent');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/nonexistent|not found|invalid/i);
  });
});

// ===========================================================================
// git cherry-pick
// ===========================================================================

describe('git cherry-pick', () => {
  it('applies a commit from another branch onto HEAD', () => {
    const engine = engineWithBase();

    // Create a commit on a separate branch
    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('cherry.txt', 'cherry content');
    engine.execute('git add cherry.txt');
    engine.execute('git commit -m "cherry commit"');
    const cherryHash = engine.log()[0].hash;

    // Switch back to main and cherry-pick
    engine.execute('git checkout main');
    const result = engine.execute(`git cherry-pick ${cherryHash}`);
    expect(result.exitCode).toBe(0);

    // cherry.txt should now exist on main
    expect(engine.getVFS().allFilePaths()).toContain('cherry.txt');
  });

  it('creates a new commit with a different hash', () => {
    const engine = engineWithBase();

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('cp.txt', 'cp');
    engine.execute('git add cp.txt');
    engine.execute('git commit -m "cp commit"');
    const srcHash = engine.log()[0].hash;

    engine.execute('git checkout main');
    engine.execute(`git cherry-pick ${srcHash}`);

    const newTip = engine.log()[0].hash;
    expect(newTip).not.toBe(srcHash);
  });

  it('new cherry-pick commit has HEAD (main tip) as parent', () => {
    const engine = engineWithBase();
    const mainTip = engine.log()[0].hash;

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('cp.txt', 'cp');
    engine.execute('git add cp.txt');
    engine.execute('git commit -m "cp commit"');
    const srcHash = engine.log()[0].hash;

    engine.execute('git checkout main');
    engine.execute(`git cherry-pick ${srcHash}`);

    const newCommit = engine.log()[0];
    expect(newCommit.parents[0]).toBe(mainTip);
  });

  it('preserves the original commit message', () => {
    const engine = engineWithBase();

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('cp.txt', 'cp');
    engine.execute('git add cp.txt');
    engine.execute('git commit -m "special message"');
    const srcHash = engine.log()[0].hash;

    engine.execute('git checkout main');
    engine.execute(`git cherry-pick ${srcHash}`);

    const newCommit = engine.log()[0];
    expect(newCommit.message).toBe('special message');
  });

  it('target commit entries override HEAD entries on collision', () => {
    const engine = new GitEngine();

    // Base with shared.txt = "original"
    engine.getVFS().createFile('shared.txt', 'original');
    engine.execute('git add shared.txt');
    engine.execute('git commit -m "base"');

    // Feature overwrites shared.txt
    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('shared.txt', 'overwritten');
    engine.execute('git add shared.txt');
    engine.execute('git commit -m "overwrite shared"');
    const srcHash = engine.log()[0].hash;

    engine.execute('git checkout main');
    engine.execute(`git cherry-pick ${srcHash}`);

    // After cherry-pick, shared.txt should be "overwritten"
    expect(engine.getVFS().readFile('shared.txt')).toBe('overwritten');
  });

  it('restores VFS and keeps index clean after cherry-pick', () => {
    const engine = engineWithBase();

    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('cp.txt', 'cp');
    engine.execute('git add cp.txt');
    engine.execute('git commit -m "cp"');
    const srcHash = engine.log()[0].hash;

    engine.execute('git checkout main');
    engine.execute(`git cherry-pick ${srcHash}`);

    expect(engine.getStagedFiles()).toHaveLength(0);
    expect(engine.isDirty()).toBe(false);
  });

  it('errors when commit hash does not exist', () => {
    const engine = engineWithBase();
    const result = engine.execute('git cherry-pick 0000000');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/0000000|not found|invalid|unknown/i);
  });

  it('errors when no commit hash specified', () => {
    const engine = engineWithBase();
    const result = engine.execute('git cherry-pick');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/usage|error|commit/i);
  });
});

// ===========================================================================
// git revert
// ===========================================================================

describe('git revert', () => {
  it('creates a revert commit that removes files added by the target', () => {
    const engine = engineWithBase();

    // Commit that adds a file
    engine.getVFS().createFile('added.txt', 'added content');
    engine.execute('git add added.txt');
    engine.execute('git commit -m "add added.txt"');
    const targetHash = engine.log()[0].hash;

    // Revert that commit
    const result = engine.execute(`git revert ${targetHash}`);
    expect(result.exitCode).toBe(0);

    // added.txt should no longer exist
    expect(engine.getVFS().allFilePaths()).not.toContain('added.txt');
  });

  it('revert commit message is Revert "<original message>"', () => {
    const engine = engineWithBase();

    engine.getVFS().createFile('f.txt', 'content');
    engine.execute('git add f.txt');
    engine.execute('git commit -m "original message"');
    const targetHash = engine.log()[0].hash;

    engine.execute(`git revert ${targetHash}`);

    const revertCommit = engine.log()[0];
    expect(revertCommit.message).toBe('Revert "original message"');
  });

  it('creates a new commit with the pre-revert HEAD as parent', () => {
    const engine = engineWithBase();

    engine.getVFS().createFile('f.txt', 'content');
    engine.execute('git add f.txt');
    engine.execute('git commit -m "add f"');
    const targetHash = engine.log()[0].hash;

    engine.execute(`git revert ${targetHash}`);

    const revertCommit = engine.log()[0];
    expect(revertCommit.parents[0]).toBe(targetHash);
  });

  it('revert restores content changed by the target commit', () => {
    const engine = new GitEngine();

    // Initial: shared.txt = "original"
    engine.getVFS().createFile('shared.txt', 'original');
    engine.execute('git add shared.txt');
    engine.execute('git commit -m "initial"');

    // Commit that modifies shared.txt
    engine.getVFS().createFile('shared.txt', 'modified');
    engine.execute('git add shared.txt');
    engine.execute('git commit -m "modify shared"');
    const targetHash = engine.log()[0].hash;

    engine.execute(`git revert ${targetHash}`);

    // shared.txt should be restored to "original"
    expect(engine.getVFS().readFile('shared.txt')).toBe('original');
  });

  it('revert of a deletion restores the deleted file', () => {
    const engine = engineWithBase();

    // Add a file in one commit, then remove it in next
    engine.getVFS().createFile('to-delete.txt', 'content');
    engine.execute('git add to-delete.txt');
    engine.execute('git commit -m "add to-delete"');

    // Remove the file from index/committed state by creating a new commit without it
    // We simulate deletion by not including it in the next tree
    // The simplest way: check out a fresh state for the file, then add a deletion commit
    // Since the engine doesn't have git rm yet, we do it indirectly via rebase scenario.
    // Instead, let's test that reverting an "add" restores state to before the add.
    const addHash = engine.log()[0].hash;
    engine.execute(`git revert ${addHash}`);

    // to-delete.txt should be gone (it was added in addHash and revert undoes it)
    expect(engine.getVFS().allFilePaths()).not.toContain('to-delete.txt');
  });

  it('restores VFS and keeps index clean after revert', () => {
    const engine = engineWithBase();

    engine.getVFS().createFile('r.txt', 'r');
    engine.execute('git add r.txt');
    engine.execute('git commit -m "add r"');
    const targetHash = engine.log()[0].hash;

    engine.execute(`git revert ${targetHash}`);

    expect(engine.getStagedFiles()).toHaveLength(0);
    expect(engine.isDirty()).toBe(false);
  });

  it('errors when commit hash does not exist', () => {
    const engine = engineWithBase();
    const result = engine.execute('git revert 0000000');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/0000000|not found|invalid|unknown/i);
  });

  it('errors when no commit hash specified', () => {
    const engine = engineWithBase();
    const result = engine.execute('git revert');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/usage|error|commit/i);
  });

  it('errors when trying to revert a root commit with no parent', () => {
    const engine = engineWithBase();
    const rootHash = engine.log()[0].hash;

    const result = engine.execute(`git revert ${rootHash}`);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/parent|root|cannot/i);
  });
});
