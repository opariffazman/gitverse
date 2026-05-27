import type { CommandResult } from './types';
import type { VirtualFileSystem } from '../vfs';
import type { ObjectStore } from '../objects';

/**
 * git add <path>  — stage a specific file
 * git add .       — stage all files in VFS
 *
 * Writes a blob for each file and maps path→blobHash in the index.
 */
export function cmdAdd(
  args: string[],
  _opts: Map<string, string[]>,
  vfs: VirtualFileSystem,
  objects: ObjectStore,
  index: Map<string, string>,
): CommandResult {
  if (args.length === 0) {
    return { output: 'Nothing specified, nothing added.', exitCode: 1 };
  }

  const pathArg = args[0];

  if (pathArg === '.') {
    // Stage all files in the VFS
    const allPaths = vfs.allFilePaths();
    for (const p of allPaths) {
      const content = vfs.readFile(p);
      const blobHash = objects.writeBlob(content);
      index.set(p, blobHash);
    }
    return { output: '', exitCode: 0 };
  }

  // Stage a specific file
  if (!vfs.exists(pathArg)) {
    return {
      output: `error: pathspec '${pathArg}' did not match any files`,
      exitCode: 128,
    };
  }

  const content = vfs.readFile(pathArg);
  const blobHash = objects.writeBlob(content);
  index.set(pathArg, blobHash);

  return { output: '', exitCode: 0 };
}
