import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { buildFileTree } from '$store/files';

let engine: GitEngine;

beforeEach(() => {
  engine = new GitEngine();
  engine.execute('git init');
});

function flat(engine: GitEngine) {
  const t = buildFileTree(engine);
  return [...t.dirs.flatMap((d) => d.files), ...t.rootFiles];
}

describe('buildFileTree', () => {
  it('returns an empty model for an empty VFS (hides .git)', () => {
    const t = buildFileTree(engine);
    expect(t.rootFiles).toEqual([]);
    expect(t.dirs).toEqual([]);
  });

  it('marks a new file untracked', () => {
    engine.getVFS().createFile('a.txt', 'hi');
    expect(flat(engine)).toEqual([
      { path: 'a.txt', name: 'a.txt', dir: null, status: 'untracked' },
    ]);
  });

  it('marks an added file staged', () => {
    engine.getVFS().createFile('a.txt', 'hi');
    engine.execute('git add a.txt');
    expect(flat(engine)[0].status).toBe('staged');
  });

  it('marks a committed file clean, then modified after an edit', () => {
    engine.getVFS().createFile('a.txt', 'hi');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "add"');
    expect(flat(engine)[0].status).toBe('clean');

    engine.getVFS().createFile('a.txt', 'hi\nedited');
    expect(flat(engine)[0].status).toBe('modified');
  });

  it('modified wins over staged when a staged file is re-edited', () => {
    engine.getVFS().createFile('a.txt', 'v1');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "v1"');
    engine.getVFS().createFile('a.txt', 'v2');
    engine.execute('git add a.txt'); // staged
    engine.getVFS().createFile('a.txt', 'v3'); // re-edited after staging
    expect(flat(engine)[0].status).toBe('modified');
  });

  it('keeps a deleted tracked file visible with status deleted', () => {
    engine.getVFS().createFile('a.txt', 'hi');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "add"');
    engine.getVFS().deleteFile('a.txt');
    expect(flat(engine)).toEqual([{ path: 'a.txt', name: 'a.txt', dir: null, status: 'deleted' }]);
  });

  it('groups directory files under dirs, root files under rootFiles', () => {
    engine.getVFS().createDir('src');
    engine.getVFS().createFile('src/app.js', 'x');
    engine.getVFS().createFile('README.md', 'x');
    const t = buildFileTree(engine);
    expect(t.dirs).toEqual([
      {
        name: 'src',
        files: [{ path: 'src/app.js', name: 'app.js', dir: 'src', status: 'untracked' }],
      },
    ]);
    expect(t.rootFiles.map((f) => f.path)).toEqual(['README.md']);
  });

  it('lists an empty directory with zero files', () => {
    engine.getVFS().createDir('empty');
    const t = buildFileTree(engine);
    expect(t.dirs).toEqual([{ name: 'empty', files: [] }]);
  });

  it('still shows the parent dir of a deleted file even if the dir was removed', () => {
    engine.getVFS().createDir('src');
    engine.getVFS().createFile('src/app.js', 'x');
    engine.execute('git add src/app.js');
    engine.execute('git commit -m "add"');
    engine.getVFS().deleteFile('src/app.js');
    engine.getVFS().deleteFile('src/'); // dir entry removed too
    const t = buildFileTree(engine);
    expect(t.dirs).toEqual([
      {
        name: 'src',
        files: [{ path: 'src/app.js', name: 'app.js', dir: 'src', status: 'deleted' }],
      },
    ]);
  });

  it('sorts dirs and files alphabetically', () => {
    engine.getVFS().createDir('zeta');
    engine.getVFS().createDir('alpha');
    engine.getVFS().createFile('b.txt', 'x');
    engine.getVFS().createFile('a.txt', 'x');
    const t = buildFileTree(engine);
    expect(t.dirs.map((d) => d.name)).toEqual(['alpha', 'zeta']);
    expect(t.rootFiles.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
  });

  it('shows dot-directories other than .git', () => {
    engine.getVFS().createDir('.config');
    const t = buildFileTree(engine);
    expect(t.dirs).toContainEqual({ name: '.config', files: [] });
    expect(t.dirs.map((d) => d.name)).not.toContain('.git');
  });

  it('works before git init (all files untracked)', () => {
    const fresh = new GitEngine();
    fresh.getVFS().createFile('a.txt', 'hi');
    expect(flat(fresh)[0].status).toBe('untracked');
  });
});
