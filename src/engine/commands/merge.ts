import type { CommandResult, ExpandFn, LabelFn } from './types';
import type { RefStore } from '../refs';
import type { ObjectStore } from '../objects';
import type { VirtualFileSystem } from '../vfs';

// ---------------------------------------------------------------------------
// Ancestor detection (BFS)
// ---------------------------------------------------------------------------

/**
 * Returns true if `candidateAncestor` is reachable from `descendant` by
 * following parent links (i.e. `candidateAncestor` is an ancestor of, or
 * equal to, `descendant`).
 */
function isAncestor(candidateAncestor: string, descendant: string, objects: ObjectStore): boolean {
  if (candidateAncestor === descendant) return true;

  const visited = new Set<string>();
  const queue: string[] = [descendant];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === candidateAncestor) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    if (!objects.hasCommit(current)) continue;
    const commit = objects.readCommit(current);
    for (const parent of commit.parents) {
      if (!visited.has(parent)) {
        queue.push(parent);
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Restore working directory + index to match a commit's tree
// (mirrors the same helper in checkout.ts)
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
// cmdMerge
// ---------------------------------------------------------------------------

/**
 * git merge <branch>
 *
 * Fast-forward: when HEAD is an ancestor of the target, advance the branch
 *   pointer and restore the working directory to the target commit.
 *
 * Three-way merge: when branches have diverged, create a merge commit whose
 *   tree is the union of HEAD's tree and target's tree (HEAD entries take
 *   precedence for any conflicts).
 *
 * Already up to date: when target is an ancestor of HEAD (or same commit).
 */
export function cmdMerge(
  args: string[],
  _opts: Map<string, string[]>,
  refs: RefStore,
  objects: ObjectStore,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
  expand: ExpandFn,
  label: LabelFn,
): CommandResult {
  // Require exactly one positional argument
  if (args.length === 0) {
    return {
      output: 'error: you must specify a branch to merge',
      exitCode: 1,
    };
  }

  const targetName = expand(args[0]);

  // Resolve target branch
  if (!refs.hasBranch(targetName)) {
    return {
      output: `merge: ${targetName} - not something we can merge`,
      exitCode: 1,
    };
  }

  const targetHash = refs.resolveBranch(targetName);
  const headHash = refs.resolveHEAD();

  // Safety: HEAD must resolve (there must be at least one commit)
  if (!headHash || !objects.hasCommit(headHash)) {
    return {
      output: 'fatal: not a valid HEAD',
      exitCode: 128,
    };
  }

  // -------------------------------------------------------------------------
  // Already up to date: target is an ancestor of HEAD (or equal)
  // -------------------------------------------------------------------------
  if (isAncestor(targetHash, headHash, objects)) {
    return {
      output: 'Already up to date.',
      exitCode: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Fast-forward: HEAD is an ancestor of target
  // -------------------------------------------------------------------------
  if (isAncestor(headHash, targetHash, objects)) {
    // Advance the current branch pointer to targetHash
    const head = refs.getHEAD();
    if (head.attached) {
      refs.updateBranch(head.target, targetHash);
    } else {
      refs.detachHEAD(targetHash);
    }

    // Restore WD + index to the target commit
    restoreWorkingDirectory(targetHash, objects, vfs, index);

    return {
      output: `Updating ${label(headHash)}..${label(targetHash)}\nFast-forward\n Merged branch '${targetName}'`,
      exitCode: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Three-way merge: both branches have diverged
  // -------------------------------------------------------------------------

  // Build merged tree: start from HEAD tree, add entries from target that
  // are not already present in HEAD (HEAD wins on collision).
  const headCommit = objects.readCommit(headHash);
  const headTree = objects.readTree(headCommit.tree);

  const targetCommit = objects.readCommit(targetHash);
  const targetTree = objects.readTree(targetCommit.tree);

  const mergedEntries = new Map<string, string>(headTree);
  for (const [path, blobHash] of targetTree) {
    if (!mergedEntries.has(path)) {
      mergedEntries.set(path, blobHash);
    }
  }

  const mergedTreeHash = objects.writeTree(mergedEntries);

  const mergeCommitHash = objects.writeCommit({
    tree: mergedTreeHash,
    parents: [headHash, targetHash],
    message: `Merge branch '${targetName}'`,
    timestamp: Date.now(),
  });

  // Advance the current branch pointer
  const head = refs.getHEAD();
  if (head.attached) {
    refs.updateBranch(head.target, mergeCommitHash);
  } else {
    refs.detachHEAD(mergeCommitHash);
  }

  // Restore VFS and index to the merged tree
  restoreWorkingDirectory(mergeCommitHash, objects, vfs, index);

  return {
    output: `Merge made by the 'ort' strategy.\nMerge branch '${targetName}'`,
    exitCode: 0,
  };
}
