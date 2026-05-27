import type { CommandResult } from './types';
import type { RefStore } from '../refs';
import type { ObjectStore } from '../objects';
import type { VirtualFileSystem } from '../vfs';

/**
 * Restore the VFS and index to match a commit's tree.
 *
 * Steps:
 * 1. Read tree entries from the target commit.
 * 2. Rebuild the VFS snapshot:
 *    - Add dir entries for any path that contains '/'.
 *    - Add file entries for all tree paths (reading blob content from objects).
 * 3. Replace VFS via restore().
 * 4. Reset index to match tree (path → blobHash).
 */
function restoreWorkingDirectory(
  commitHash: string,
  objects: ObjectStore,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
): void {
  const commit = objects.readCommit(commitHash);
  const tree = objects.readTree(commit.tree);

  // Build new VFS snapshot
  const snap = new Map<string, import('../vfs').FileEntry>();

  // First pass: add directory entries for nested paths
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

  // Second pass: add file entries
  for (const [path, blobHash] of tree) {
    const content = objects.readBlob(blobHash);
    snap.set(path, { content, type: 'file' });
  }

  vfs.restore(snap);

  // Reset index to match tree exactly
  index.clear();
  for (const [path, blobHash] of tree) {
    index.set(path, blobHash);
  }
}

/**
 * git checkout <branch>         — switch to branch, restore WD
 * git checkout -b <name>        — create and switch to new branch
 * git checkout <commit-hash>    — detach HEAD at commit
 *
 * git switch is an alias for git checkout (same implementation).
 */
export function cmdCheckout(
  args: string[],
  opts: Map<string, string[]>,
  refs: RefStore,
  objects: ObjectStore,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
): CommandResult {
  const createAndSwitch = opts.has('-b');

  if (args.length === 0 && !createAndSwitch) {
    return {
      output: 'error: you must specify a branch or commit to checkout',
      exitCode: 1,
    };
  }

  // Determine target name
  const bFlag = opts.get('-b');
  const targetName = createAndSwitch
    ? (bFlag && bFlag.length > 0 ? bFlag[0] : args[0])
    : args[0];

  if (!targetName) {
    return {
      output: 'error: you must specify a branch name after -b',
      exitCode: 1,
    };
  }

  // --- Create and switch (-b) ---
  if (createAndSwitch) {
    // Resolve current HEAD to get branch point
    const headHash = refs.resolveHEAD();
    if (!headHash) {
      return {
        output: `fatal: Not a valid object name: '${refs.getHEAD().target}'`,
        exitCode: 128,
      };
    }

    // Create the branch
    try {
      refs.createBranch(targetName, headHash);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('already exists')) {
        return {
          output: `fatal: A branch named '${targetName}' already exists.`,
          exitCode: 128,
        };
      }
      return { output: `fatal: ${msg}`, exitCode: 128 };
    }

    // Switch to it (WD matches current HEAD already since same commit)
    refs.attachHEAD(targetName);

    return {
      output: `Switched to a new branch '${targetName}'`,
      exitCode: 0,
    };
  }

  // --- Switch to branch ---
  if (refs.hasBranch(targetName)) {
    const branchCommitHash = refs.resolveBranch(targetName);

    // Restore WD to target branch's commit (if branch has a commit)
    if (branchCommitHash && objects.hasCommit(branchCommitHash)) {
      restoreWorkingDirectory(branchCommitHash, objects, vfs, index);
    }

    refs.attachHEAD(targetName);

    return {
      output: `Switched to branch '${targetName}'`,
      exitCode: 0,
    };
  }

  // --- Detach HEAD at commit hash ---
  if (objects.hasCommit(targetName)) {
    restoreWorkingDirectory(targetName, objects, vfs, index);
    refs.detachHEAD(targetName);

    return {
      output: `HEAD is now at ${targetName.slice(0, 7)} (detached HEAD)`,
      exitCode: 0,
    };
  }

  // --- Not found ---
  return {
    output: `error: pathspec '${targetName}' did not match any file(s) known to git`,
    exitCode: 1,
  };
}
