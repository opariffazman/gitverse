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
  committedTree?: Map<string, string>,
): CommandResult {
  if (args.length === 0) {
    return { output: 'Nothing specified, nothing added.', exitCode: 1 };
  }

  const pathArg = args[0];

  const stageFile = (p: string) => {
    const content = vfs.readFile(p);
    const committedHash = committedTree?.get(p);
    if (committedHash) {
      let committedContent: string | undefined;
      try {
        committedContent = objects.readBlob(committedHash);
      } catch {
        /* blob missing */
      }
      if (committedContent === content && index.get(p) === committedHash) {
        return;
      }
    }
    const blobHash = objects.writeBlob(content);
    index.set(p, blobHash);
  };

  if (pathArg === '.') {
    for (const p of vfs.allFilePaths()) {
      stageFile(p);
    }
    return { output: '', exitCode: 0 };
  }

  if (!vfs.exists(pathArg)) {
    return {
      output: `error: pathspec '${pathArg}' did not match any files`,
      exitCode: 128,
    };
  }

  stageFile(pathArg);
  return { output: '', exitCode: 0 };
}
