import type { CommandResult } from './types';
import type { VirtualFileSystem } from '../vfs';

/**
 * git mv <old> <new>
 *
 * Moves a file in the VFS and updates the staging index:
 * - removes the old path entry from the index
 * - adds the new path with the same blob hash
 */
export function cmdMv(
  args: string[],
  _opts: Map<string, string[]>,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
): CommandResult {
  if (args.length < 2) {
    return {
      output: 'error: git mv requires two path arguments',
      exitCode: 1,
    };
  }

  const src = args[0];
  const dst = args[1];

  if (!vfs.exists(src)) {
    return {
      output: `error: source '${src}' does not exist`,
      exitCode: 128,
    };
  }

  // Preserve the blob hash from the index (if staged)
  const blobHash = index.get(src);

  try {
    vfs.moveFile(src, dst);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: `error: ${msg}`, exitCode: 1 };
  }

  // Update index: remove old entry, add new entry (with same blob hash if available)
  if (blobHash !== undefined) {
    index.delete(src);
    index.set(dst, blobHash);
  } else {
    // File wasn't in the index — just remove any stale src entry
    index.delete(src);
  }

  return {
    output: '',
    exitCode: 0,
  };
}
