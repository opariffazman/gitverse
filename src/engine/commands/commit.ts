import type { CommandResult, LabelFn } from './types';
import type { ObjectStore } from '../objects';
import type { RefStore } from '../refs';

/**
 * git commit -m "message"
 *
 * Fails if nothing is staged (index has no entries that differ from HEAD tree).
 * Creates a tree from the index, writes a commit, updates the current branch ref.
 */
export function cmdCommit(
  _args: string[],
  opts: Map<string, string[]>,
  objects: ObjectStore,
  refs: RefStore,
  index: Map<string, string>,
  getCommittedTree: () => Map<string, string>,
  label: LabelFn,
  untracked: string[],
): CommandResult {
  // Require -m flag
  const messageArgs = opts.get('-m');
  if (!messageArgs || messageArgs.length === 0) {
    return {
      output: "error: switch `m' requires a value",
      exitCode: 128,
    };
  }
  const message = messageArgs[0];

  // Check if there is anything new to commit
  const committedTree = getCommittedTree();
  let hasChanges = false;

  // Check for new or modified files in index vs committed tree
  for (const [path, blobHash] of index) {
    if (committedTree.get(path) !== blobHash) {
      hasChanges = true;
      break;
    }
  }

  // Check for deleted files (in committed tree but not in index)
  if (!hasChanges) {
    for (const path of committedTree.keys()) {
      if (!index.has(path)) {
        hasChanges = true;
        break;
      }
    }
  }

  if (!hasChanges) {
    const head = refs.getHEAD();
    const branchLabel = head.attached ? head.target : 'HEAD (detached)';
    if (untracked.length > 0) {
      return {
        output: `On branch ${branchLabel}\nnothing added to commit but untracked files present`,
        exitCode: 1,
        hint: "use 'git add <file>' to track new files — commit -am only re-commits already-tracked files",
      };
    }
    return {
      output: `On branch ${branchLabel}\nnothing to commit, working tree clean`,
      exitCode: 1,
    };
  }

  // Write tree from index
  const treeHash = objects.writeTree(new Map(index));

  // Determine parent
  const parentHash = refs.resolveHEAD();
  const parents: string[] = parentHash ? [parentHash] : [];

  // Write commit
  const commitHash = objects.writeCommit({
    tree: treeHash,
    parents,
    message,
    timestamp: Date.now(),
  });

  // Advance the current branch (or detached HEAD)
  const head = refs.getHEAD();
  if (head.attached) {
    refs.updateBranch(head.target, commitHash);
  } else {
    refs.detachHEAD(commitHash);
  }

  return {
    output: `[${head.attached ? head.target : 'HEAD detached'} ${label(commitHash)}] ${message}`,
    exitCode: 0,
  };
}
