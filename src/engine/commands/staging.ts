import type { VirtualFileSystem } from '../vfs';
import type { ObjectStore } from '../objects';

/**
 * Stage working-tree changes into the index.
 * - Always stages deletions: tracked paths no longer present in the VFS are
 *   removed from the index.
 * - includeUntracked=true  → stage every VFS file (adds + modifications).
 * - includeUntracked=false → stage only tracked files (in committedTree or
 *   already in index): modifications, never brand-new untracked files.
 *
 * `committedTree` is treated as read-only; this function never mutates it.
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
    const content = vfs.readFile(p);
    const committedHash = committedTree.get(p);
    if (committedHash !== undefined) {
      let committedContent: string | undefined;
      try {
        committedContent = objects.readBlob(committedHash);
      } catch {
        /* committed blob missing — fall through and re-stage */
      }
      if (committedContent === content && index.get(p) === committedHash) {
        continue; // unchanged and already staged — don't churn a new blob
      }
    }
    index.set(p, objects.writeBlob(content));
  }

  for (const p of [...index.keys()]) {
    if (!vfs.exists(p)) index.delete(p);
  }
}
