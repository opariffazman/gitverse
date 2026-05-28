import type { CommandResult, ExpandFn, LabelFn } from './types';
import type { RefStore } from '../refs';
import type { ObjectStore } from '../objects';
import type { VirtualFileSystem, FileEntry } from '../vfs';

/**
 * git reset [--soft | --mixed | --hard] <hash>
 *
 * --soft  — move HEAD only (keep index + working dir)
 * --mixed — move HEAD + reset index to match commit tree (keep working dir). Default.
 * --hard  — move HEAD + reset index + restore working dir from commit tree
 */
export function cmdReset(
  args: string[],
  opts: Map<string, string[]>,
  refs: RefStore,
  objects: ObjectStore,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
  expand: ExpandFn,
  label: LabelFn,
): CommandResult {
  // Determine mode
  const isSoft = opts.has('--soft');
  const isHard = opts.has('--hard');
  // --mixed is the default if no flag is given; also explicit --mixed
  const isMixed = opts.has('--mixed') || (!isSoft && !isHard);

  // Collect target from args or from option values
  // parseGitCommand puts flag values as the option's value array
  let target: string | undefined = args[0];

  // Flags might have consumed the target if it was right after the flag
  if (!target) {
    if (isSoft && opts.has('--soft')) {
      target = opts.get('--soft')?.[0];
    } else if (isHard && opts.has('--hard')) {
      target = opts.get('--hard')?.[0];
    } else if (opts.has('--mixed')) {
      target = opts.get('--mixed')?.[0];
    }
  }

  if (!target) {
    return {
      output: 'error: git reset requires a commit target',
      exitCode: 1,
    };
  }

  // Accept a C-label at the commit-ish position.
  target = expand(target);

  // Resolve the target commit hash
  let commitHash: string;
  if (objects.hasCommit(target)) {
    commitHash = target;
  } else {
    // Try as a branch ref or tag
    const resolved = refs.resolveRef(target);
    if (resolved && objects.hasCommit(resolved)) {
      commitHash = resolved;
    } else if (target === 'HEAD') {
      const h = refs.resolveHEAD();
      if (!h || !objects.hasCommit(h)) {
        return {
          output: `fatal: ambiguous argument 'HEAD': unknown revision`,
          exitCode: 128,
        };
      }
      commitHash = h;
    } else {
      return {
        output: `fatal: ambiguous argument '${target}': unknown revision or path not in the working tree`,
        exitCode: 128,
      };
    }
  }

  const commit = objects.readCommit(commitHash);
  const tree = objects.readTree(commit.tree);

  // Move HEAD (and current branch if attached)
  const head = refs.getHEAD();
  if (head.attached) {
    refs.updateBranch(head.target, commitHash);
  } else {
    refs.detachHEAD(commitHash);
  }

  if (isSoft) {
    // Soft: only move HEAD, leave index and working dir as-is
    return {
      output: '',
      exitCode: 0,
    };
  }

  // Mixed and Hard: reset index to match the commit tree
  index.clear();
  for (const [path, blobHash] of tree) {
    index.set(path, blobHash);
  }

  if (isMixed && !isHard) {
    return {
      output: '',
      exitCode: 0,
    };
  }

  // Hard: also restore working directory
  // Build a VFS snapshot matching the commit tree
  const snap = new Map<string, FileEntry>();

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

  return {
    output: `HEAD is now at ${label(commitHash)}`,
    exitCode: 0,
  };
}
