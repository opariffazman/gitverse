import type { CommandResult, ExpandFn, LabelFn } from './types';
import type { RefStore } from '../refs';
import type { ObjectStore } from '../objects';
import type { VirtualFileSystem } from '../vfs';

// ---------------------------------------------------------------------------
// Restore working directory + index to match a commit's tree
// ---------------------------------------------------------------------------

function restoreWorkingDirectory(
  commitHash: string,
  objects: ObjectStore,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
): void {
  const commit = objects.readCommit(commitHash);
  const tree = objects.readTree(commit.tree);

  const snap = new Map<string, import('../vfs').FileEntry>();

  // Directory entries
  for (const path of tree.keys()) {
    const slashIdx = path.indexOf('/');
    if (slashIdx !== -1) {
      const dir = path.substring(0, slashIdx);
      const dirKey = dir + '/';
      if (!snap.has(dirKey)) {
        snap.set(dirKey, { content: '', type: 'dir' });
      }
    }
  }

  // File entries
  for (const [path, blobHash] of tree) {
    const content = objects.readBlob(blobHash);
    snap.set(path, { content, type: 'file' });
  }

  vfs.restore(snap);

  index.clear();
  for (const [path, blobHash] of tree) {
    index.set(path, blobHash);
  }
}

// ---------------------------------------------------------------------------
// cmdCherryPick
// ---------------------------------------------------------------------------

/**
 * git cherry-pick <commit-hash>
 *
 * Takes a single commit and applies it onto HEAD:
 *  - Merges the target commit's tree with HEAD's tree (target entries override).
 *  - Creates a new commit with HEAD as parent and the same message.
 *  - Restores VFS/index.
 */
export function cmdCherryPick(
  args: string[],
  _opts: Map<string, string[]>,
  refs: RefStore,
  objects: ObjectStore,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
  expand: ExpandFn,
  label: LabelFn,
): CommandResult {
  if (args.length === 0) {
    return {
      output: 'error: usage: git cherry-pick <commit>',
      exitCode: 1,
    };
  }

  const targetHash = expand(args[0]);

  if (!objects.hasCommit(targetHash)) {
    return {
      output: `error: bad object ${targetHash}: not found`,
      exitCode: 128,
    };
  }

  const headHash = refs.resolveHEAD();
  if (!headHash || !objects.hasCommit(headHash)) {
    return {
      output: 'fatal: not a valid HEAD',
      exitCode: 128,
    };
  }

  const headCommit = objects.readCommit(headHash);
  const headTree = objects.readTree(headCommit.tree);

  const targetCommit = objects.readCommit(targetHash);
  const targetTree = objects.readTree(targetCommit.tree);

  // Build merged tree: start with HEAD entries, then apply target entries
  // (target entries override HEAD on collision — cherry-pick applies target diff)
  const newTree = new Map<string, string>(headTree);
  for (const [path, blobHash] of targetTree) {
    newTree.set(path, blobHash);
  }

  const newTreeHash = objects.writeTree(newTree);
  const newCommitHash = objects.writeCommit({
    tree: newTreeHash,
    parents: [headHash],
    message: targetCommit.message,
    timestamp: Date.now(),
  });

  // Advance the current branch pointer
  const head = refs.getHEAD();
  if (head.attached) {
    refs.updateBranch(head.target, newCommitHash);
  } else {
    refs.detachHEAD(newCommitHash);
  }

  // Restore VFS/index
  restoreWorkingDirectory(newCommitHash, objects, vfs, index);

  return {
    output: `[${head.attached ? head.target : 'HEAD detached'} ${label(newCommitHash)}] ${targetCommit.message}`,
    exitCode: 0,
  };
}
