import type { CommandResult } from './types';
import type { VirtualFileSystem } from '../vfs';

/**
 * git rm <path>
 *
 * Removes the file from the VFS and from the staging index.
 * Errors if the file does not exist in the VFS.
 */
export function cmdRm(
  args: string[],
  _opts: Map<string, string[]>,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
): CommandResult {
  if (args.length === 0) {
    return {
      output: 'error: No path specified for git rm',
      exitCode: 1,
    };
  }

  const path = args[0];

  if (!vfs.exists(path)) {
    return {
      output: `error: pathspec '${path}' did not match any files`,
      exitCode: 128,
    };
  }

  try {
    vfs.deleteFile(path);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: `error: ${msg}`, exitCode: 1 };
  }

  // Remove from index if present
  index.delete(path);

  return {
    output: `rm '${path}'`,
    exitCode: 0,
  };
}
