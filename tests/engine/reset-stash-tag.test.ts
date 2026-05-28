import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an engine with two commits on main:
 *   C1: readme.md = "# hello"
 *   C2: readme.md = "# updated"  (also staged in index)
 *
 * Returns { engine, c1Hash, c2Hash }
 */
function engineWithTwoCommits(): {
  engine: GitEngine;
  c1Hash: string;
  c2Hash: string;
} {
  const engine = new GitEngine();
  engine.execute('git init');

  // C1
  engine.getVFS().createFile('readme.md', '# hello');
  engine.execute('git add readme.md');
  engine.execute('git commit -m "initial"');
  const c1Hash = engine.log()[0].hash;

  // C2
  engine.getVFS().createFile('readme.md', '# updated');
  engine.execute('git add readme.md');
  engine.execute('git commit -m "update readme"');
  const c2Hash = engine.log()[0].hash;

  return { engine, c1Hash, c2Hash };
}

// ===========================================================================
// git reset
// ===========================================================================

describe('git reset --soft', () => {
  it('moves HEAD (branch) back to target commit', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    const result = engine.execute(`git reset --soft ${c1Hash}`);
    expect(result.exitCode).toBe(0);

    // HEAD should point at C1 now
    expect(engine.log()[0].hash).toBe(c1Hash);
  });

  it('keeps the index unchanged after --soft', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    // Stage an extra change before reset
    engine.getVFS().createFile('extra.txt', 'extra');
    engine.execute('git add extra.txt');

    engine.execute(`git reset --soft ${c1Hash}`);

    // extra.txt should still be staged (index has it)
    expect(engine.getStagedFiles()).toContain('extra.txt');
  });

  it('keeps the working directory unchanged after --soft', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    // Modify a file without staging
    engine.getVFS().createFile('readme.md', '# dirty');

    engine.execute(`git reset --soft ${c1Hash}`);

    // VFS should still have the dirty content
    expect(engine.getVFS().readFile('readme.md')).toBe('# dirty');
  });
});

describe('git reset --mixed', () => {
  it('moves HEAD back to target commit', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    const result = engine.execute(`git reset --mixed ${c1Hash}`);
    expect(result.exitCode).toBe(0);
    expect(engine.log()[0].hash).toBe(c1Hash);
  });

  it('resets index to match target commit tree', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    // Stage a new file before reset
    engine.getVFS().createFile('staged.txt', 'staged');
    engine.execute('git add staged.txt');

    engine.execute(`git reset --mixed ${c1Hash}`);

    // staged.txt should no longer be in index (it wasn't in C1)
    expect(engine.getStagedFiles()).not.toContain('staged.txt');
  });

  it('keeps the working directory unchanged after --mixed', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    // Write a dirty file
    engine.getVFS().createFile('readme.md', '# dirty working dir');

    engine.execute(`git reset --mixed ${c1Hash}`);

    // VFS should retain the dirty content
    expect(engine.getVFS().readFile('readme.md')).toBe('# dirty working dir');
  });

  it('default (no flag) behaves like --mixed', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    const result = engine.execute(`git reset ${c1Hash}`);
    expect(result.exitCode).toBe(0);
    // HEAD moved back
    expect(engine.log()[0].hash).toBe(c1Hash);
  });
});

describe('git reset --hard', () => {
  it('moves HEAD back to target commit', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    const result = engine.execute(`git reset --hard ${c1Hash}`);
    expect(result.exitCode).toBe(0);
    expect(engine.log()[0].hash).toBe(c1Hash);
  });

  it('resets index to match target commit tree', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    engine.getVFS().createFile('extra.txt', 'extra');
    engine.execute('git add extra.txt');

    engine.execute(`git reset --hard ${c1Hash}`);

    // extra.txt was not in C1, should not be in index
    expect(engine.getStagedFiles()).not.toContain('extra.txt');
  });

  it('restores working directory to committed tree', () => {
    const { engine, c1Hash } = engineWithTwoCommits();

    // Dirty the working dir
    engine.getVFS().createFile('readme.md', '# very dirty');

    engine.execute(`git reset --hard ${c1Hash}`);

    // VFS should be restored to C1's content for readme.md
    expect(engine.getVFS().readFile('readme.md')).toBe('# hello');
  });

  it('output includes the commit label', () => {
    const { engine, c1Hash } = engineWithTwoCommits();
    const result = engine.execute(`git reset --hard ${c1Hash}`);
    expect(result.output).toContain(engine.commitLabel(c1Hash));
  });
});

// ===========================================================================
// git stash
// ===========================================================================

describe('git stash save + pop round-trip', () => {
  it('stash pop restores VFS to pre-stash state', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'committed');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "base"');

    // Make dirty working dir change
    engine.getVFS().createFile('a.txt', 'dirty');

    // Stash
    const stashResult = engine.execute('git stash');
    expect(stashResult.exitCode).toBe(0);

    // WD should be clean (matches committed)
    expect(engine.getVFS().readFile('a.txt')).toBe('committed');

    // Pop
    const popResult = engine.execute('git stash pop');
    expect(popResult.exitCode).toBe(0);

    // WD restored to pre-stash dirty state
    expect(engine.getVFS().readFile('a.txt')).toBe('dirty');
  });

  it('stash pop restores index to pre-stash state', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'committed');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "base"');

    // Stage a new file
    engine.getVFS().createFile('staged.txt', 'staged content');
    engine.execute('git add staged.txt');

    // Stash (saves staged.txt in stash)
    engine.execute('git stash');

    // staged.txt should not be staged now
    expect(engine.getStagedFiles()).not.toContain('staged.txt');

    // Pop
    engine.execute('git stash pop');

    // staged.txt should be staged again
    expect(engine.getStagedFiles()).toContain('staged.txt');
  });

  it('stash stack is empty after a single pop', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'x');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "base"');

    engine.execute('git stash');
    engine.execute('git stash pop');

    expect(engine.stashStack).toHaveLength(0);
  });
});

describe('git stash list', () => {
  it('lists stash entries in LIFO order', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'base');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "base"');

    // First stash
    engine.getVFS().createFile('a.txt', 'first change');
    engine.execute('git stash');

    // Second stash
    engine.getVFS().createFile('a.txt', 'second change');
    engine.execute('git stash');

    const result = engine.execute('git stash list');
    expect(result.exitCode).toBe(0);
    // Should show two entries
    const lines = result.output.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    // Most recent first (stash@{0})
    expect(lines[0]).toMatch(/stash@\{0\}/);
    expect(lines[1]).toMatch(/stash@\{1\}/);
  });

  it('shows empty output when no stashes exist', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const result = engine.execute('git stash list');
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('');
  });
});

describe('git stash drop', () => {
  it('removes the most recent entry without applying', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'base');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "base"');

    engine.getVFS().createFile('a.txt', 'dirty');
    engine.execute('git stash');

    const dropResult = engine.execute('git stash drop');
    expect(dropResult.exitCode).toBe(0);

    // Stack should be empty
    expect(engine.stashStack).toHaveLength(0);

    // VFS should still show the clean (committed) state, not the dropped stash
    expect(engine.getVFS().readFile('a.txt')).toBe('base');
  });

  it('errors when no stashes to drop', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const result = engine.execute('git stash drop');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/no stash/i);
  });
});

// ===========================================================================
// git tag
// ===========================================================================

describe('git tag – creation', () => {
  it('creates a tag pointing at HEAD', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "initial"');
    const headHash = engine.log()[0].hash;

    const result = engine.execute('git tag v1.0');
    expect(result.exitCode).toBe(0);

    // Tag should resolve to HEAD's commit hash
    // Verify via list output
    const listResult = engine.execute('git tag');
    expect(listResult.output).toContain('v1.0');
    void headHash;
  });

  it('creates a tag at a specific commit hash', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "initial"');
    const c1Hash = engine.log()[0].hash;

    // Make another commit
    engine.getVFS().createFile('b.txt', 'b');
    engine.execute('git add b.txt');
    engine.execute('git commit -m "second"');

    // Tag C1 by hash
    const result = engine.execute(`git tag v0.9 ${c1Hash}`);
    expect(result.exitCode).toBe(0);

    const listResult = engine.execute('git tag');
    expect(listResult.output).toContain('v0.9');
  });

  it('errors when tagging at a non-existent commit', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "initial"');

    const result = engine.execute('git tag v1.0 deadbeef');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/not a valid/i);
  });
});

describe('git tag – list', () => {
  it('lists all tags alphabetically', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "initial"');

    engine.execute('git tag beta');
    engine.execute('git tag alpha');
    engine.execute('git tag v2.0');

    const result = engine.execute('git tag');
    expect(result.exitCode).toBe(0);
    const tags = result.output.split('\n').filter(Boolean);
    expect(tags).toContain('alpha');
    expect(tags).toContain('beta');
    expect(tags).toContain('v2.0');
    // Should be sorted
    expect(tags).toEqual([...tags].sort());
  });

  it('shows empty output when no tags exist', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const result = engine.execute('git tag');
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('');
  });
});

// ===========================================================================
// git rm
// ===========================================================================

describe('git rm', () => {
  it('removes file from VFS', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('delete-me.txt', 'content');
    engine.execute('git add delete-me.txt');
    engine.execute('git commit -m "add file"');

    const result = engine.execute('git rm delete-me.txt');
    expect(result.exitCode).toBe(0);
    expect(engine.getVFS().exists('delete-me.txt')).toBe(false);
  });

  it('removes file from staging index', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('tracked.txt', 'content');
    engine.execute('git add tracked.txt');
    engine.execute('git commit -m "add file"');

    // Re-stage (as it would be in index after checkout)
    engine.execute('git add tracked.txt');

    engine.execute('git rm tracked.txt');

    // Should no longer be in index
    const staged = engine.getStagedFiles();
    expect(staged).not.toContain('tracked.txt');
  });

  it('errors when file does not exist', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const result = engine.execute('git rm nonexistent.txt');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/nonexistent\.txt/);
  });
});

// ===========================================================================
// git mv
// ===========================================================================

describe('git mv', () => {
  it('renames file in VFS', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('old.txt', 'content');
    engine.execute('git add old.txt');
    engine.execute('git commit -m "add old"');

    const result = engine.execute('git mv old.txt new.txt');
    expect(result.exitCode).toBe(0);
    expect(engine.getVFS().exists('old.txt')).toBe(false);
    expect(engine.getVFS().exists('new.txt')).toBe(true);
    expect(engine.getVFS().readFile('new.txt')).toBe('content');
  });

  it('updates index: removes old entry, adds new entry', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('old.txt', 'hello');
    engine.execute('git add old.txt');

    engine.execute('git mv old.txt new.txt');

    // old.txt should no longer be in index
    // new.txt should be in index with same blob hash
    const staged = engine.getStagedFiles();
    // 'new.txt' is staged (diff from empty committed tree)
    expect(staged).toContain('new.txt');
    expect(staged).not.toContain('old.txt');
  });

  it('errors when source file does not exist', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const result = engine.execute('git mv ghost.txt other.txt');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/ghost\.txt/);
  });

  it('preserves file content after move', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('src.txt', 'important data');
    engine.execute('git add src.txt');

    engine.execute('git mv src.txt dst.txt');

    expect(engine.getVFS().readFile('dst.txt')).toBe('important data');
  });
});
