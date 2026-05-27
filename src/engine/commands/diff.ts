import type { CommandResult } from './types';
import type { ObjectStore } from '../objects';
import type { VirtualFileSystem } from '../vfs';
import { generateDiff } from '../diff';

/**
 * git diff [--staged | --cached]
 *
 * Without flags:  diff between working directory and index (unstaged changes).
 *                 For files not yet in the index, diffs against the committed tree.
 *
 * --staged / --cached:  diff between index and HEAD commit (staged changes).
 */
export function cmdDiff(
  _args: string[],
  opts: Map<string, string[]>,
  vfs: VirtualFileSystem,
  objects: ObjectStore,
  index: Map<string, string>,
  committedTree: Map<string, string>,
): CommandResult {
  const staged = opts.has('--staged') || opts.has('--cached');

  const parts: string[] = [];

  if (staged) {
    // Compare index → HEAD
    // Collect all paths that appear in either the index or the committed tree
    const allPaths = new Set<string>([...index.keys(), ...committedTree.keys()]);

    for (const path of [...allPaths].sort()) {
      const indexHash = index.get(path);
      const committedHash = committedTree.get(path);

      // Skip if both are the same (or both absent)
      if (indexHash === committedHash) continue;

      const oldContent = committedHash ? objects.readBlob(committedHash) : '';
      const newContent = indexHash ? objects.readBlob(indexHash) : '';

      const diff = generateDiff(path, oldContent, newContent);
      if (diff) parts.push(diff);
    }
  } else {
    // Compare working directory → index (or committed tree for unindexed files)
    // Only show diffs for tracked files (in index or committed tree)
    const trackedPaths = new Set<string>([...index.keys(), ...committedTree.keys()]);

    for (const path of [...trackedPaths].sort()) {
      if (!vfs.exists(path)) continue;

      const vfsContent = vfs.readFile(path);

      // "Old" content is what's in the index (if staged) or committed tree
      const referenceHash = index.get(path) ?? committedTree.get(path);
      if (!referenceHash) continue;
      const referenceContent = objects.readBlob(referenceHash);

      if (vfsContent === referenceContent) continue;

      const diff = generateDiff(path, referenceContent, vfsContent);
      if (diff) parts.push(diff);
    }
  }

  return { output: parts.join(''), exitCode: 0 };
}
