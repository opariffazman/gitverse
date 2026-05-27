import type { CommandResult } from './types';
import type { VirtualFileSystem, FileEntry } from '../vfs';

/** A single stash entry. */
export type StashEntry = {
  message: string;
  vfsSnapshot: Map<string, FileEntry>;
  indexSnapshot: Map<string, string>;
};

/**
 * git stash / git stash push  — save current VFS + index snapshot, restore WD to committed tree
 * git stash pop               — restore most recent stash entry, remove from stack
 * git stash list              — list stash entries
 * git stash drop              — remove most recent entry without applying
 *
 * @param stashStack  LIFO array stored on GitEngine (index 0 = most recent)
 * @param getCommittedTree  returns the committed tree (path → blobHash)
 * @param readBlob  reads blob content by hash
 */
export function cmdStash(
  args: string[],
  _opts: Map<string, string[]>,
  vfs: VirtualFileSystem,
  index: Map<string, string>,
  stashStack: StashEntry[],
  getCommittedTree: () => Map<string, string>,
  readBlob: (hash: string) => string,
): CommandResult {
  const sub = args[0] ?? 'push';

  switch (sub) {
    case 'push':
    case 'save': {
      // Save current VFS snapshot and index snapshot
      const vfsSnapshot = vfs.snapshot();
      const indexSnapshot = new Map(index);

      const message = `WIP on stash (stash@{${stashStack.length}})`;

      // Push to front (LIFO)
      stashStack.unshift({ message, vfsSnapshot, indexSnapshot });

      // Restore working directory to committed tree state
      const committedTree = getCommittedTree();
      const snap = new Map<string, FileEntry>();

      // Add directory entries for nested paths
      for (const path of committedTree.keys()) {
        const slashIdx = path.indexOf('/');
        if (slashIdx !== -1) {
          const dir = path.substring(0, slashIdx);
          const dirKey = dir + '/';
          if (!snap.has(dirKey)) {
            snap.set(dirKey, { content: '', type: 'dir' });
          }
        }
      }

      // Add file entries
      for (const [path, blobHash] of committedTree) {
        const content = readBlob(blobHash);
        snap.set(path, { content, type: 'file' });
      }

      vfs.restore(snap);

      // Reset index to match committed tree
      index.clear();
      for (const [path, blobHash] of committedTree) {
        index.set(path, blobHash);
      }

      return {
        output: `Saved working directory and index state ${message}`,
        exitCode: 0,
      };
    }

    case 'pop': {
      if (stashStack.length === 0) {
        return {
          output: 'error: No stash entries found.',
          exitCode: 1,
        };
      }

      const entry = stashStack.shift()!;

      // Restore VFS and index from stash
      vfs.restore(entry.vfsSnapshot);
      index.clear();
      for (const [path, blobHash] of entry.indexSnapshot) {
        index.set(path, blobHash);
      }

      return {
        output: `Restored ${entry.message}`,
        exitCode: 0,
      };
    }

    case 'list': {
      if (stashStack.length === 0) {
        return { output: '', exitCode: 0 };
      }

      const lines = stashStack.map(
        (entry, i) => `stash@{${i}}: ${entry.message}`,
      );
      return {
        output: lines.join('\n'),
        exitCode: 0,
      };
    }

    case 'drop': {
      if (stashStack.length === 0) {
        return {
          output: 'error: No stash entries found.',
          exitCode: 1,
        };
      }

      const dropped = stashStack.shift()!;
      return {
        output: `Dropped ${dropped.message}`,
        exitCode: 0,
      };
    }

    default:
      return {
        output: `error: unknown stash subcommand '${sub}'`,
        exitCode: 1,
      };
  }
}
