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
// cmdRevert
// ---------------------------------------------------------------------------

/**
 * git revert <commit-hash>
 *
 * Creates an inverse commit that undoes the specified commit:
 *  - Compares the target commit's tree with its parent's tree.
 *  - Files added in target: removed from HEAD's tree.
 *  - Files changed in target: restored to the parent's version.
 *  - The revert is applied on top of the current HEAD.
 *  - Message: `Revert "<original message>"`.
 *  - Requires the target commit to have a parent (cannot revert root).
 */
export function cmdRevert(
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
      output: 'error: usage: git revert <commit>',
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

  const targetCommit = objects.readCommit(targetHash);

  // Cannot revert a root commit (no parent to diff against)
  if (targetCommit.parents.length === 0) {
    return {
      output: `error: cannot revert a root commit (no parent to diff against)`,
      exitCode: 1,
    };
  }

  const parentHash = targetCommit.parents[0];
  const parentCommit = objects.readCommit(parentHash);
  const parentTree = objects.readTree(parentCommit.tree);
  const targetTree = objects.readTree(targetCommit.tree);

  // Resolve current HEAD to build the revert on top of it
  const headHash = refs.resolveHEAD();
  if (!headHash || !objects.hasCommit(headHash)) {
    return {
      output: 'fatal: not a valid HEAD',
      exitCode: 128,
    };
  }

  const headCommit = objects.readCommit(headHash);
  const headTree = objects.readTree(headCommit.tree);

  // Build the reverted tree:
  // Start from HEAD's tree, then apply the inverse of the target commit's diff.
  //
  //  For each path in targetTree:
  //    - If path existed in parentTree with the same hash → no change (already undo-ed effectively)
  //    - If path existed in parentTree with a different hash → restore to parent's version
  //    - If path did NOT exist in parentTree → was added by target: remove it
  //
  //  Files in parentTree that are NOT in targetTree were not affected by the target commit,
  //  so we don't need to add them back (they may or may not exist in headTree already).

  const newTree = new Map<string, string>(headTree);

  // Process all paths touched by the target commit
  for (const [path, targetBlobHash] of targetTree) {
    const parentBlobHash = parentTree.get(path);

    if (parentBlobHash === undefined) {
      // File was added by the target commit → remove it
      newTree.delete(path);
    } else if (parentBlobHash !== targetBlobHash) {
      // File was modified by the target commit → restore parent's version
      newTree.set(path, parentBlobHash);
    }
    // else: file was unchanged in the target commit (shouldn't normally happen) → no action
  }

  // Also handle files that existed in parentTree but not in targetTree:
  // These were deleted by the target commit → restore them
  for (const [path, parentBlobHash] of parentTree) {
    if (!targetTree.has(path)) {
      // Was deleted in target commit → restore
      newTree.set(path, parentBlobHash);
    }
  }

  const newTreeHash = objects.writeTree(newTree);
  const revertMessage = `Revert "${targetCommit.message}"`;
  const revertCommitHash = objects.writeCommit({
    tree: newTreeHash,
    parents: [headHash],
    message: revertMessage,
    timestamp: Date.now(),
  });

  // Advance the current branch pointer
  const head = refs.getHEAD();
  if (head.attached) {
    refs.updateBranch(head.target, revertCommitHash);
  } else {
    refs.detachHEAD(revertCommitHash);
  }

  // Restore VFS/index
  restoreWorkingDirectory(revertCommitHash, objects, vfs, index);

  return {
    output: `[${head.attached ? head.target : 'HEAD detached'} ${label(revertCommitHash)}] ${revertMessage}`,
    exitCode: 0,
  };
}
