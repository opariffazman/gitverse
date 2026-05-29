import type { VirtualFileSystem } from '../vfs';
import type { ObjectStore } from '../objects';

/**
 * Stage working-tree changes into the index.
 * - Always stages deletions: tracked paths no longer present in the VFS are
 *   removed from the index.
 * - includeUntracked=true  → stage every VFS file (adds + modifications).
 * - includeUntracked=false → stage only tracked files (in committedTree or
 *   already in index): modifications, never brand-new untracked files.
 */
export function stageWorkingTree(
  vfs: VirtualFileSystem,
  objects: ObjectStore,
  index: Map<string, string>,
  committedTree: Map<string, string>,
  opts: { includeUntracked: boolean },
): void {
  const isTracked = (p: string) => committedTree.has(p) || index.has(p);

  for (const p of vfs.allFilePaths()) {
    if (!opts.includeUntracked && !isTracked(p)) continue;
    index.set(p, objects.writeBlob(vfs.readFile(p)));
  }

  for (const p of [...index.keys()]) {
    if (!vfs.exists(p)) index.delete(p);
  }
}
