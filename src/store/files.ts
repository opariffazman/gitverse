import { derived } from 'svelte/store';
import type { GitEngine } from '$engine/index';
import { engine, engineVersion } from './engine';

export type FileStatus = 'untracked' | 'modified' | 'staged' | 'deleted' | 'clean';

export type TreeEntry = {
  path: string; // full VFS path, e.g. "src/app.js"
  name: string; // display name, e.g. "app.js"
  dir: string | null; // parent dir, or null for root (VFS is flat + 1 level)
  status: FileStatus;
};

export type FileTreeModel = {
  dirs: Array<{ name: string; files: TreeEntry[] }>;
  rootFiles: TreeEntry[];
};

/**
 * Pure derivation of the explorer model from engine state.
 * One badge per file; precedence: deleted > modified > staged > untracked.
 * Deleted-but-tracked files stay visible (struck through in the UI) until
 * the deletion is committed. `.git` is never shown.
 */
export function buildFileTree(eng: GitEngine): FileTreeModel {
  const vfs = eng.getVFS();
  const deleted = new Set(eng.getDeletedFiles());
  const modified = new Set(eng.getModifiedFiles());
  const staged = new Set(eng.getStagedFiles());
  const untracked = new Set(eng.getUntrackedFiles());

  const statusOf = (path: string): FileStatus => {
    if (deleted.has(path)) return 'deleted';
    if (modified.has(path)) return 'modified';
    if (staged.has(path)) return 'staged';
    if (untracked.has(path)) return 'untracked';
    return 'clean';
  };

  const toEntry = (path: string): TreeEntry => {
    const slash = path.indexOf('/');
    return {
      path,
      name: slash === -1 ? path : path.slice(slash + 1),
      dir: slash === -1 ? null : path.slice(0, slash),
      status: statusOf(path),
    };
  };

  // Live files plus tracked-but-deleted paths; the two sets are disjoint.
  const entries = [...vfs.allFilePaths(), ...deleted]
    .filter((p) => p !== '.git' && !p.startsWith('.git/'))
    .map(toEntry);

  // Dirs come from the VFS root listing; a deleted file may reference a dir
  // the VFS no longer has, so union in parents from the entries as well.
  const dirNames = new Set(
    vfs
      .listDir()
      .filter((e) => e.endsWith('/') && !e.startsWith('.'))
      .map((e) => e.slice(0, -1)),
  );
  for (const e of entries) {
    if (e.dir !== null) dirNames.add(e.dir);
  }

  const byName = (a: TreeEntry, b: TreeEntry) => a.name.localeCompare(b.name);
  return {
    dirs: [...dirNames].sort().map((name) => ({
      name,
      files: entries.filter((e) => e.dir === name).sort(byName),
    })),
    rootFiles: entries.filter((e) => e.dir === null).sort(byName),
  };
}

/** Live explorer model — recomputed after every executed command. */
export const fileTree = derived([engine, engineVersion], ([$engine]) => buildFileTree($engine));
