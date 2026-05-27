import { describe, it, expect } from 'vitest';
import { hashContent, ObjectStore } from '$engine/objects';

describe('hashContent', () => {
  it('produces a 7-character hex string', () => {
    const hash = hashContent('hello world');
    expect(hash).toMatch(/^[0-9a-f]{7}$/);
  });

  it('is deterministic for the same input', () => {
    const h1 = hashContent('same content');
    const h2 = hashContent('same content');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different inputs', () => {
    const h1 = hashContent('content A');
    const h2 = hashContent('content B');
    expect(h1).not.toBe(h2);
  });
});

describe('ObjectStore - blobs', () => {
  it('writes and reads a blob', () => {
    const store = new ObjectStore();
    const hash = store.writeBlob('file content');
    expect(hash).toMatch(/^[0-9a-f]{7}$/);
    expect(store.readBlob(hash)).toBe('file content');
  });

  it('reading a missing blob throws', () => {
    const store = new ObjectStore();
    expect(() => store.readBlob('0000000')).toThrow();
  });

  it('two blobs with the same content get different hashes', () => {
    const store = new ObjectStore();
    const h1 = store.writeBlob('same');
    const h2 = store.writeBlob('same');
    expect(h1).not.toBe(h2);
  });
});

describe('ObjectStore - trees', () => {
  it('writes and reads a tree', () => {
    const store = new ObjectStore();
    const blobHash = store.writeBlob('hello');
    const entries = new Map([['README.md', blobHash]]);
    const treeHash = store.writeTree(entries);
    expect(treeHash).toMatch(/^[0-9a-f]{7}$/);
    const readEntries = store.readTree(treeHash);
    expect(readEntries.get('README.md')).toBe(blobHash);
  });

  it('reading a missing tree throws', () => {
    const store = new ObjectStore();
    expect(() => store.readTree('0000000')).toThrow();
  });

  it('two trees with the same entries get different hashes', () => {
    const store = new ObjectStore();
    const blobHash = store.writeBlob('data');
    const entries = new Map([['file.txt', blobHash]]);
    const h1 = store.writeTree(entries);
    const h2 = store.writeTree(entries);
    expect(h1).not.toBe(h2);
  });
});

describe('ObjectStore - commits', () => {
  it('writes and reads a commit', () => {
    const store = new ObjectStore();
    const blobHash = store.writeBlob('initial');
    const treeHash = store.writeTree(new Map([['file.txt', blobHash]]));
    const hash = store.writeCommit({
      tree: treeHash,
      parents: [],
      message: 'initial commit',
      timestamp: 1000,
    });
    expect(hash).toMatch(/^[0-9a-f]{7}$/);
    const commit = store.readCommit(hash);
    expect(commit.hash).toBe(hash);
    expect(commit.tree).toBe(treeHash);
    expect(commit.parents).toEqual([]);
    expect(commit.message).toBe('initial commit');
    expect(commit.timestamp).toBe(1000);
  });

  it('commit with parents stores and returns parents', () => {
    const store = new ObjectStore();
    const treeHash = store.writeTree(new Map());
    const parent1 = store.writeCommit({
      tree: treeHash,
      parents: [],
      message: 'parent1',
      timestamp: 1,
    });
    const parent2 = store.writeCommit({
      tree: treeHash,
      parents: [],
      message: 'parent2',
      timestamp: 2,
    });
    const mergeHash = store.writeCommit({
      tree: treeHash,
      parents: [parent1, parent2],
      message: 'merge commit',
      timestamp: 3,
    });
    const mergeCommit = store.readCommit(mergeHash);
    expect(mergeCommit.parents).toContain(parent1);
    expect(mergeCommit.parents).toContain(parent2);
    expect(mergeCommit.parents).toHaveLength(2);
  });

  it('reading a missing commit throws', () => {
    const store = new ObjectStore();
    expect(() => store.readCommit('0000000')).toThrow();
  });

  it('hasCommit returns true for existing commit', () => {
    const store = new ObjectStore();
    const treeHash = store.writeTree(new Map());
    const hash = store.writeCommit({ tree: treeHash, parents: [], message: 'test', timestamp: 0 });
    expect(store.hasCommit(hash)).toBe(true);
  });

  it('hasCommit returns false for missing commit', () => {
    const store = new ObjectStore();
    expect(store.hasCommit('0000000')).toBe(false);
  });

  it('readCommit returns a copy, not original reference', () => {
    const store = new ObjectStore();
    const treeHash = store.writeTree(new Map());
    const hash = store.writeCommit({ tree: treeHash, parents: [], message: 'orig', timestamp: 0 });
    const copy1 = store.readCommit(hash);
    const copy2 = store.readCommit(hash);
    expect(copy1).not.toBe(copy2);
  });

  it('allCommits returns copies of all stored commits', () => {
    const store = new ObjectStore();
    const treeHash = store.writeTree(new Map());
    const h1 = store.writeCommit({ tree: treeHash, parents: [], message: 'c1', timestamp: 1 });
    const h2 = store.writeCommit({ tree: treeHash, parents: [h1], message: 'c2', timestamp: 2 });
    const all = store.allCommits();
    expect(all).toHaveLength(2);
    const hashes = all.map((c) => c.hash);
    expect(hashes).toContain(h1);
    expect(hashes).toContain(h2);
  });
});

describe('ObjectStore - serialization helpers', () => {
  it('allBlobs returns all stored blob entries', () => {
    const store = new ObjectStore();
    const h1 = store.writeBlob('alpha');
    const h2 = store.writeBlob('beta');
    const blobs = store.allBlobs();
    expect(blobs).toHaveLength(2);
    const hashes = blobs.map(([h]) => h);
    expect(hashes).toContain(h1);
    expect(hashes).toContain(h2);
  });

  it('allTrees returns all stored tree entries', () => {
    const store = new ObjectStore();
    const blobHash = store.writeBlob('content');
    const h1 = store.writeTree(new Map([['a.txt', blobHash]]));
    const h2 = store.writeTree(new Map([['b.txt', blobHash]]));
    const trees = store.allTrees();
    expect(trees).toHaveLength(2);
    const hashes = trees.map(([h]) => h);
    expect(hashes).toContain(h1);
    expect(hashes).toContain(h2);
  });

  it('restoreBlob, restoreTree, restoreCommit can be retrieved after restore', () => {
    const store = new ObjectStore();
    store.restoreBlob('abc1234', 'restored content');
    expect(store.readBlob('abc1234')).toBe('restored content');

    const entries = new Map([['file.txt', 'abc1234']]);
    store.restoreTree('def5678', entries);
    expect(store.readTree('def5678').get('file.txt')).toBe('abc1234');

    const commit = {
      hash: '1234567',
      tree: 'def5678',
      parents: [],
      message: 'restored',
      timestamp: 99,
    };
    store.restoreCommit(commit);
    expect(store.readCommit('1234567').message).toBe('restored');
  });
});
