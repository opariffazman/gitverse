import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualFileSystem } from '$engine/vfs';

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem();
  });

  // 1. Create and read a root-level file
  it('creates and reads a root-level file', () => {
    vfs.createFile('readme.md', 'Hello World');
    expect(vfs.readFile('readme.md')).toBe('Hello World');
  });

  // 2. Existence check
  it('returns true for existing file and false for missing file', () => {
    vfs.createFile('readme.md', 'Hello');
    expect(vfs.exists('readme.md')).toBe(true);
    expect(vfs.exists('nonexistent.txt')).toBe(false);
  });

  // 3. Delete a file
  it('deletes a file and throws on subsequent read', () => {
    vfs.createFile('readme.md', 'Hello');
    vfs.deleteFile('readme.md');
    expect(vfs.exists('readme.md')).toBe(false);
    expect(() => vfs.readFile('readme.md')).toThrow();
  });

  // 4. Delete throws if file not found
  it('throws when deleting a nonexistent file', () => {
    expect(() => vfs.deleteFile('ghost.txt')).toThrow();
  });

  // 5. Read throws if file not found
  it('throws when reading a nonexistent file', () => {
    expect(() => vfs.readFile('ghost.txt')).toThrow();
  });

  // 6. Create dir and list root
  it('lists root-level entries including directory markers', () => {
    vfs.createFile('readme.md', '');
    vfs.createDir('src');
    const listing = vfs.listDir();
    expect(listing).toContain('readme.md');
    expect(listing).toContain('src/');
    expect(listing).toEqual([...listing].sort());
  });

  // 7. Create file inside directory and list subdir
  it('creates file inside a directory and lists subdir contents', () => {
    vfs.createDir('src');
    vfs.createFile('src/index.ts', 'export {}');
    vfs.createFile('src/utils.ts', 'export const x = 1');
    const listing = vfs.listDir('src');
    expect(listing).toContain('index.ts');
    expect(listing).toContain('utils.ts');
    expect(listing).toEqual([...listing].sort());
  });

  // 8. Max depth enforcement - createDir with slash throws
  it('throws when createDir name contains a slash', () => {
    expect(() => vfs.createDir('src/nested')).toThrow();
  });

  // 9. createFile into nonexistent directory throws
  it('throws when creating a file in a nonexistent directory', () => {
    expect(() => vfs.createFile('src/index.ts', 'content')).toThrow();
  });

  // 10. Move file at root level
  it('moves a root-level file to a new name', () => {
    vfs.createFile('old.txt', 'content');
    vfs.moveFile('old.txt', 'new.txt');
    expect(vfs.exists('old.txt')).toBe(false);
    expect(vfs.exists('new.txt')).toBe(true);
    expect(vfs.readFile('new.txt')).toBe('content');
  });

  // 11. Move file into a directory
  it('moves a root-level file into a directory', () => {
    vfs.createFile('readme.md', 'docs');
    vfs.createDir('docs');
    vfs.moveFile('readme.md', 'docs/readme.md');
    expect(vfs.exists('readme.md')).toBe(false);
    expect(vfs.exists('docs/readme.md')).toBe(true);
    expect(vfs.readFile('docs/readme.md')).toBe('docs');
  });

  // 12. Move throws when source does not exist
  it('throws when moving a nonexistent file', () => {
    expect(() => vfs.moveFile('ghost.txt', 'new.txt')).toThrow();
  });

  // 13. allFilePaths returns only files (not dirs), sorted
  it('allFilePaths returns sorted file paths only, excluding dirs', () => {
    vfs.createDir('src');
    vfs.createFile('readme.md', '');
    vfs.createFile('src/index.ts', '');
    vfs.createFile('src/utils.ts', '');
    const paths = vfs.allFilePaths();
    expect(paths).not.toContain('src/');
    expect(paths).toContain('readme.md');
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('src/utils.ts');
    expect(paths).toEqual([...paths].sort());
  });

  // 14. snapshot round-trip
  it('snapshot captures state and restore brings it back', () => {
    vfs.createDir('src');
    vfs.createFile('readme.md', 'initial');
    vfs.createFile('src/index.ts', 'export {}');

    const snap = vfs.snapshot();

    // Mutate after snapshot
    vfs.createFile('extra.txt', 'extra');
    vfs.deleteFile('readme.md');

    expect(vfs.exists('extra.txt')).toBe(true);
    expect(vfs.exists('readme.md')).toBe(false);

    // Restore snapshot
    vfs.restore(snap);

    expect(vfs.exists('readme.md')).toBe(true);
    expect(vfs.exists('extra.txt')).toBe(false);
    expect(vfs.readFile('readme.md')).toBe('initial');
  });

  // 15. snapshot is a deep clone (mutations to snap don't affect vfs)
  it('snapshot is a deep clone independent of live state', () => {
    vfs.createFile('readme.md', 'original');
    const snap = vfs.snapshot();

    // Mutate live state
    vfs.createFile('other.txt', 'other');

    // Snap should not contain other.txt
    expect(snap.has('other.txt')).toBe(false);
  });

  // 16. listDir with no arg excludes files inside subdirectories
  it('listDir root does not include files from subdirectories', () => {
    vfs.createDir('src');
    vfs.createFile('src/index.ts', '');
    vfs.createFile('readme.md', '');
    const listing = vfs.listDir();
    expect(listing).not.toContain('src/index.ts');
    expect(listing).not.toContain('index.ts');
    expect(listing).toContain('src/');
    expect(listing).toContain('readme.md');
  });

  // 17. createFile overwrites existing file
  it('overwrites file content when createFile is called on existing path', () => {
    vfs.createFile('readme.md', 'v1');
    vfs.createFile('readme.md', 'v2');
    expect(vfs.readFile('readme.md')).toBe('v2');
  });

  // 18. listDir on nonexistent directory returns empty array
  it('listDir on a nonexistent directory returns empty array', () => {
    expect(vfs.listDir('nonexistent')).toEqual([]);
  });
});
