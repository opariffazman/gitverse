import type { CommandResult } from './types';
import type { RefStore } from '../refs';
import type { ObjectStore } from '../objects';
import type { VirtualFileSystem } from '../vfs';

// ---------------------------------------------------------------------------
// Ancestor detection (BFS)
// ---------------------------------------------------------------------------

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
// Collect commits on currentBranch that are NOT ancestors of targetHash
// Returns them in replay order (oldest first).
// ---------------------------------------------------------------------------

function collectCommitsToReplay(
  headHash: string,
  targetHash: string,
  objects: ObjectStore,
): import('../objects').Commit[] {
  // Walk from headHash towards root, collecting commits until we hit
  // an ancestor of targetHash (i.e. the merge base).
  const toReplay: import('../objects').Commit[] = [];
  const visited = new Set<string>();
  const stack: string[] = [headHash];

  while (stack.length > 0) {
    const hash = stack.pop()!;
    if (visited.has(hash)) continue;
    visited.add(hash);

    if (!objects.hasCommit(hash)) continue;

    // If this commit is an ancestor of target, stop — don't include it
    if (isAncestor(hash, targetHash, objects)) continue;

    const commit = objects.readCommit(hash);
    toReplay.push(commit);

    for (const parent of commit.parents) {
      if (!visited.has(parent)) {
        stack.push(parent);
      }
    }
  }

  // Reverse so we replay oldest first (topological order)
  // Sort by timestamp ascending, use array index as stable tiebreaker
  toReplay.reverse();

  return toReplay;
}

// ---------------------------------------------------------------------------
// cmdRebase
// ---------------------------------------------------------------------------

/**
 * git rebase <target>
 *
 * Finds commits on current branch that are not ancestors of <target>,
 * then replays them one-by-one onto <target>, producing new commits with
 * new hashes but the same messages.  Advances the current branch pointer
 * to the new tip and restores VFS/index.
 *
 * Already up to date: when HEAD is an ancestor of target (or same commit).
 */
export function cmdRebase(
  args: string[],
  _opts: Map<string, string[]>,
  refs: RefStore,
  objects: ObjectStore,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
): CommandResult {
  if (args.length === 0) {
    return {
      output: 'error: usage: git rebase <target>',
      exitCode: 1,
    };
  }

  const targetName = args[0];

  // Resolve target — accept branch name or direct commit hash
  let targetHash: string;
  if (refs.hasBranch(targetName)) {
    targetHash = refs.resolveBranch(targetName);
  } else if (refs.hasTag(targetName)) {
    targetHash = refs.resolveTag(targetName);
  } else if (objects.hasCommit(targetName)) {
    targetHash = targetName;
  } else {
    return {
      output: `error: invalid upstream '${targetName}' - not found`,
      exitCode: 1,
    };
  }

  const headHash = refs.resolveHEAD();
  if (!headHash || !objects.hasCommit(headHash)) {
    return {
      output: 'fatal: not a valid HEAD',
      exitCode: 128,
    };
  }

  // Already up to date: HEAD is an ancestor of (or equal to) target
  if (isAncestor(headHash, targetHash, objects)) {
    return {
      output: 'Current branch is already up to date.',
      exitCode: 0,
    };
  }

  // Collect commits that need to be replayed (oldest first)
  const toReplay = collectCommitsToReplay(headHash, targetHash, objects);

  if (toReplay.length === 0) {
    return {
      output: 'Current branch is already up to date.',
      exitCode: 0,
    };
  }

  // Replay commits onto target
  let currentParent = targetHash;

  for (const commit of toReplay) {
    const parentCommit = objects.readCommit(currentParent);
    const parentTree = objects.readTree(parentCommit.tree);

    // Apply this commit's tree on top of the current parent tree.
    // Entries from the commit's own tree override the parent tree.
    const commitTree = objects.readTree(commit.tree);
    const newTree = new Map<string, string>(parentTree);
    for (const [path, blobHash] of commitTree) {
      newTree.set(path, blobHash);
    }

    const newTreeHash = objects.writeTree(newTree);
    const newCommitHash = objects.writeCommit({
      tree: newTreeHash,
      parents: [currentParent],
      message: commit.message,
      timestamp: Date.now(),
      rewriteOf: commit.hash,
    });

    currentParent = newCommitHash;
  }

  // Advance the current branch pointer to the new tip
  const head = refs.getHEAD();
  if (head.attached) {
    refs.updateBranch(head.target, currentParent);
  } else {
    refs.detachHEAD(currentParent);
  }

  // Restore VFS/index to the new tip
  restoreWorkingDirectory(currentParent, objects, vfs, index);

  return {
    output: `Successfully rebased and updated ${head.attached ? `refs/heads/${head.target}` : 'detached HEAD'}.`,
    exitCode: 0,
  };
}
