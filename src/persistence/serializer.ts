/**
 * Serialization / deserialization for GitEngine state.
 *
 * Format:
 * {
 *   "vfs": [[path, {content, type}], ...],
 *   "objects": {
 *     "blobs": [[hash, content], ...],
 *     "trees": [[hash, [[filename, blobHash], ...]], ...],
 *     "commits": [{hash, tree, parents, message, timestamp}, ...]
 *   },
 *   "refs": {
 *     "branches": [[name, targetHash], ...],
 *     "tags": [[name, targetHash], ...],
 *     "head": {attached, target}
 *   },
 *   "index": [[path, blobHash], ...]
 * }
 */

import { GitEngine } from '$engine/index';
import type { Commit } from '$engine/objects';
import type { FileEntry } from '$engine/vfs';
import type { HEAD } from '$engine/refs';

// ---------------------------------------------------------------------------
// Wire-format types
// ---------------------------------------------------------------------------

type WireFileEntry = { content: string; type: 'file' | 'dir' };

type WireObjects = {
  blobs: [string, string][];
  trees: [string, [string, string][]][];
  commits: Commit[];
};

type WireRefs = {
  branches: [string, string][];
  tags: [string, string][];
  head: HEAD;
};

type WireState = {
  vfs: [string, WireFileEntry][];
  objects: WireObjects;
  refs: WireRefs;
  index: [string, string][];
};

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

export function serialize(engine: GitEngine): string {
  // VFS snapshot
  const snap = engine.getVFS().snapshot();
  const wireVfs: [string, WireFileEntry][] = [];
  for (const [path, entry] of snap) {
    wireVfs.push([path, { content: entry.content, type: entry.type }]);
  }

  // Object store contents
  const wireTrees: [string, [string, string][]][] = engine._allTrees().map(([hash, entries]) => [
    hash,
    [...entries.entries()],
  ]);

  const wireObjects: WireObjects = {
    blobs: engine._allBlobs(),
    trees: wireTrees,
    commits: engine.allCommits(),
  };

  // Refs — use the low-level accessors to capture branches/tags with empty
  // targets (e.g. the initial 'main' branch before any commit exists).
  const wireRefs: WireRefs = {
    branches: engine._allBranchRefs(),
    tags: engine._allTagRefs(),
    head: engine.getHEAD(),
  };

  // Index
  const wireIndex: [string, string][] = [...engine._getIndex().entries()];

  const state: WireState = {
    vfs: wireVfs,
    objects: wireObjects,
    refs: wireRefs,
    index: wireIndex,
  };

  return JSON.stringify(state);
}

// ---------------------------------------------------------------------------
// Deserializer
// ---------------------------------------------------------------------------

export function deserialize(json: string): GitEngine {
  const state = JSON.parse(json) as WireState;

  const engine = new GitEngine();

  // Restore VFS
  const snapMap = new Map<string, FileEntry>();
  for (const [path, entry] of state.vfs) {
    snapMap.set(path, { content: entry.content, type: entry.type });
  }
  engine.getVFS().restore(snapMap);

  // Restore object store
  for (const [hash, content] of state.objects.blobs) {
    engine._restoreBlob(hash, content);
  }
  for (const [hash, entries] of state.objects.trees) {
    engine._restoreTree(hash, new Map(entries));
  }
  for (const commit of state.objects.commits) {
    engine._restoreCommit(commit);
  }

  // Restore refs
  engine._restoreRefs(state.refs.branches, state.refs.tags, state.refs.head);

  // Restore index
  engine._restoreIndex(new Map(state.index));

  return engine;
}
