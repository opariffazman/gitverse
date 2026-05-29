import type { CommandResult } from './types';
import type { VirtualFileSystem } from '../vfs';
import type { ObjectStore } from '../objects';
import { stageWorkingTree } from './staging';

/**
 * git add <path>  — stage a specific file
 * git add .       — stage all files in VFS (including deletions)
 * git add -A      — stage all changes (adds, modifications, deletions)
 * git add -u      — stage tracked changes only (no new untracked files)
 *
 * Writes a blob for each file and maps path→blobHash in the index.
 */
export function cmdAdd(
  args: string[],
  opts: Map<string, string[]>,
  vfs: VirtualFileSystem,
  objects: ObjectStore,
  index: Map<string, string>,
  committedTree?: Map<string, string>,
): CommandResult {
  const tree = committedTree ?? new Map<string, string>();

  if (opts.has('-A')) {
    stageWorkingTree(vfs, objects, index, tree, { includeUntracked: true });
    return { output: '', exitCode: 0 };
  }
  if (opts.has('-u')) {
    stageWorkingTree(vfs, objects, index, tree, { includeUntracked: false });
    return { output: '', exitCode: 0 };
  }

  if (args.length === 0) {
    return { output: 'Nothing specified, nothing added.', exitCode: 1 };
  }

  const pathArg = args[0];

  if (pathArg === '.') {
    stageWorkingTree(vfs, objects, index, tree, { includeUntracked: true });
    return { output: '', exitCode: 0 };
  }

  const stageFile = (p: string) => {
    const content = vfs.readFile(p);
    const committedHash = tree.get(p);
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

  if (!vfs.exists(pathArg)) {
    return {
      output: `error: pathspec '${pathArg}' did not match any files`,
      exitCode: 128,
    };
  }

  stageFile(pathArg);
  return { output: '', exitCode: 0 };
}
