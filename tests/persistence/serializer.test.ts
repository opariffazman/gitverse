import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';
import { serialize, deserialize } from '$persistence/serializer';

describe('serialize', () => {
  it('produces valid JSON', () => {
    const engine = new GitEngine();
    const json = serialize(engine);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('serialized JSON has expected top-level keys', () => {
    const engine = new GitEngine();
    const parsed = JSON.parse(serialize(engine));
    expect(parsed).toHaveProperty('vfs');
    expect(parsed).toHaveProperty('objects');
    expect(parsed).toHaveProperty('refs');
    expect(parsed).toHaveProperty('index');
  });
});

describe('round-trip: simple repo', () => {
  it('preserves commits and branches after round-trip', () => {
    const engine = new GitEngine();
    engine.getVFS().createFile('README.md', 'hello');
    engine.execute('git add README.md');
    engine.execute('git commit -m "initial commit"');
    engine.execute('git branch feature');

    const json = serialize(engine);
    const restored = deserialize(json);

    // All commits preserved
    const origCommits = engine.allCommits();
    const restoredCommits = restored.allCommits();
    expect(restoredCommits).toHaveLength(origCommits.length);
    expect(restoredCommits[0].hash).toBe(origCommits[0].hash);
    expect(restoredCommits[0].message).toBe('initial commit');

    // Branches preserved
    const origBranches = engine.allBranches();
    const restoredBranches = restored.allBranches();
    for (const [name, hash] of origBranches) {
      expect(restoredBranches.get(name)).toBe(hash);
    }

    // HEAD preserved
    const origHead = engine.getHEAD();
    const restoredHead = restored.getHEAD();
    expect(restoredHead.attached).toBe(origHead.attached);
    expect(restoredHead.target).toBe(origHead.target);
  });

  it('preserves multiple commits and parent links', () => {
    const engine = new GitEngine();
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "first"');

    engine.getVFS().createFile('b.txt', 'bbb');
    engine.execute('git add b.txt');
    engine.execute('git commit -m "second"');

    const json = serialize(engine);
    const restored = deserialize(json);

    const origCommits = engine.allCommits();
    const restoredCommits = restored.allCommits();
    expect(restoredCommits).toHaveLength(2);

    // Find "second" commit in both and verify parent match
    const origSecond = origCommits.find((c) => c.message === 'second')!;
    const restoredSecond = restoredCommits.find((c) => c.message === 'second')!;
    expect(restoredSecond).toBeDefined();
    expect(restoredSecond.parents).toEqual(origSecond.parents);
  });

  it('preserves tags', () => {
    const engine = new GitEngine();
    engine.getVFS().createFile('f.txt', 'content');
    engine.execute('git add f.txt');
    engine.execute('git commit -m "tagged commit"');
    engine.execute('git tag v1.0');

    const json = serialize(engine);
    const restored = deserialize(json);

    const origTags = engine.allTags();
    const restoredTags = restored.allTags();
    expect(restoredTags.get('v1.0')).toBe(origTags.get('v1.0'));
  });

  it('preserves VFS files', () => {
    const engine = new GitEngine();
    engine.getVFS().createFile('hello.txt', 'world');
    engine.getVFS().createFile('foo.ts', 'export {}');

    const json = serialize(engine);
    const restored = deserialize(json);

    expect(restored.getVFS().readFile('hello.txt')).toBe('world');
    expect(restored.getVFS().readFile('foo.ts')).toBe('export {}');
  });
});

describe('round-trip: staged files', () => {
  it('preserves index (staged files) after round-trip', () => {
    const engine = new GitEngine();
    engine.getVFS().createFile('staged.txt', 'staged content');
    engine.execute('git add staged.txt');
    // No commit — staged.txt is in the index but not committed

    const json = serialize(engine);
    const restored = deserialize(json);

    // Staged files should still appear as staged
    const staged = restored.getStagedFiles();
    expect(staged).toContain('staged.txt');
  });

  it('preserves staged content after round-trip', () => {
    const engine = new GitEngine();
    engine.getVFS().createFile('README.md', 'initial');
    engine.execute('git add README.md');
    engine.execute('git commit -m "init"');

    // Modify and stage
    engine.getVFS().createFile('README.md', 'updated');
    engine.execute('git add README.md');

    const json = serialize(engine);
    const restored = deserialize(json);

    // Should still show as staged (content differs from commit)
    const staged = restored.getStagedFiles();
    expect(staged).toContain('README.md');
  });
});

describe('round-trip: detached HEAD', () => {
  it('preserves detached HEAD state', () => {
    const engine = new GitEngine();
    engine.getVFS().createFile('x.txt', 'x');
    engine.execute('git add x.txt');
    engine.execute('git commit -m "c1"');
    const headHash = engine.allCommits()[0].hash;
    engine.execute(`git checkout ${headHash}`);

    const json = serialize(engine);
    const restored = deserialize(json);

    const head = restored.getHEAD();
    expect(head.attached).toBe(false);
    expect(head.target).toBe(headHash);
  });
});
