import { describe, it, expect, beforeEach } from 'vitest';
import { RefStore } from '$engine/refs';

describe('RefStore', () => {
  let store: RefStore;

  beforeEach(() => {
    store = new RefStore();
  });

  // --- HEAD ---

  it('starts with HEAD detached and empty target', () => {
    const head = store.getHEAD();
    expect(head.attached).toBe(false);
    expect(head.target).toBe('');
  });

  it('getHEAD returns a copy, not the internal reference', () => {
    const head = store.getHEAD();
    head.attached = true;
    head.target = 'tampered';
    const head2 = store.getHEAD();
    expect(head2.attached).toBe(false);
    expect(head2.target).toBe('');
  });

  it('resolveHEAD follows attached branch to its commit hash', () => {
    store.createBranch('main', 'abc123');
    store.attachHEAD('main');
    expect(store.resolveHEAD()).toBe('abc123');
  });

  it('resolveHEAD returns commit hash directly when detached', () => {
    store.detachHEAD('deadbeef');
    expect(store.resolveHEAD()).toBe('deadbeef');
  });

  it('attachHEAD sets HEAD to attached mode with branch name', () => {
    store.detachHEAD('deadbeef');
    store.attachHEAD('main');
    const head = store.getHEAD();
    expect(head.attached).toBe(true);
    expect(head.target).toBe('main');
  });

  it('detachHEAD sets HEAD to detached mode with commit hash', () => {
    store.detachHEAD('cafebabe');
    const head = store.getHEAD();
    expect(head.attached).toBe(false);
    expect(head.target).toBe('cafebabe');
  });

  // --- Branches ---

  it('createBranch and resolveBranch work correctly', () => {
    store.createBranch('feature', 'aaa111');
    expect(store.resolveBranch('feature')).toBe('aaa111');
  });

  it('hasBranch returns true for existing branch', () => {
    store.createBranch('dev', 'bbb222');
    expect(store.hasBranch('dev')).toBe(true);
  });

  it('hasBranch returns false for non-existing branch', () => {
    expect(store.hasBranch('nonexistent')).toBe(false);
  });

  it('listBranches returns sorted branch names', () => {
    store.createBranch('zebra', 'zzz');
    store.createBranch('alpha', 'aaa');
    store.createBranch('beta', 'bbb');
    const branches = store.listBranches();
    expect(branches).toEqual(['alpha', 'beta', 'zebra']);
  });

  it('updateBranch changes the target commit', () => {
    store.createBranch('feature', 'old111');
    store.updateBranch('feature', 'new999');
    expect(store.resolveBranch('feature')).toBe('new999');
  });

  it('updateBranch throws if branch not found', () => {
    expect(() => store.updateBranch('missing', 'abc')).toThrow();
  });

  it('deleteBranch removes a branch', () => {
    store.createBranch('temp', 'ttt999');
    store.deleteBranch('temp');
    expect(store.hasBranch('temp')).toBe(false);
  });

  it('deleteBranch throws when deleting current attached branch', () => {
    store.createBranch('main', 'abc');
    store.attachHEAD('main');
    expect(() => store.deleteBranch('main')).toThrow();
  });

  it('createBranch throws if branch already exists', () => {
    store.createBranch('dup', 'aaa');
    expect(() => store.createBranch('dup', 'bbb')).toThrow();
  });

  it('resolveBranch throws if branch not found', () => {
    expect(() => store.resolveBranch('ghost')).toThrow();
  });

  // --- Tags ---

  it('createTag and resolveTag work correctly', () => {
    store.createTag('v1.0', 'commitABC');
    expect(store.resolveTag('v1.0')).toBe('commitABC');
  });

  it('hasTag returns true for existing tag', () => {
    store.createTag('v2.0', 'commitXYZ');
    expect(store.hasTag('v2.0')).toBe(true);
  });

  it('hasTag returns false for missing tag', () => {
    expect(store.hasTag('nope')).toBe(false);
  });

  it('listTags returns sorted tag names', () => {
    store.createTag('v3', 'c3');
    store.createTag('v1', 'c1');
    store.createTag('v2', 'c2');
    expect(store.listTags()).toEqual(['v1', 'v2', 'v3']);
  });

  it('deleteTag removes a tag', () => {
    store.createTag('v1.0', 'abc');
    store.deleteTag('v1.0');
    expect(store.hasTag('v1.0')).toBe(false);
  });

  it('createTag throws if tag already exists', () => {
    store.createTag('v1.0', 'hash1');
    expect(() => store.createTag('v1.0', 'hash2')).toThrow();
  });

  it('resolveTag throws if tag not found', () => {
    expect(() => store.resolveTag('missing-tag')).toThrow();
  });

  // --- resolveRef ---

  it('resolveRef returns commit hash for a branch', () => {
    store.createBranch('feature', 'f1f1f1');
    expect(store.resolveRef('feature')).toBe('f1f1f1');
  });

  it('resolveRef returns commit hash for a tag', () => {
    store.createTag('v0.1', 't0t0t0');
    expect(store.resolveRef('v0.1')).toBe('t0t0t0');
  });

  it('resolveRef checks branches before tags', () => {
    store.createBranch('overlap', 'branch-hash');
    store.createTag('overlap', 'tag-hash');
    expect(store.resolveRef('overlap')).toBe('branch-hash');
  });

  it('resolveRef returns null for unknown name', () => {
    expect(store.resolveRef('unknown')).toBeNull();
  });
});
