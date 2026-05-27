/**
 * Content-addressable object store with blob, tree, and commit objects.
 *
 * Uses FNV-1a based hashing to produce 7-char hex strings.
 * An internal counter is appended to every hash input to guarantee
 * that two objects created at different times never collide, even
 * if their raw content is identical.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Blob = { hash: string; content: string };
export type Tree = { hash: string; entries: Map<string, string> }; // filename → blob hash
export type Commit = {
  hash: string;
  tree: string;       // tree hash
  parents: string[];
  message: string;
  timestamp: number;
};

type WriteCommitInput = Omit<Commit, 'hash'>;

// ---------------------------------------------------------------------------
// FNV-1a hash (32-bit) → 7-char hex
// ---------------------------------------------------------------------------

/** FNV-1a constants for 32-bit */
const FNV_PRIME = 0x01000193;
const FNV_OFFSET_BASIS = 0x811c9dc5;

/**
 * Hash `content` using FNV-1a and return the lower 28 bits as a
 * zero-padded 7-character hex string.
 *
 * Deterministic: same string → same output, always.
 */
export function hashContent(content: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < content.length; i++) {
    // XOR with byte, then multiply by prime (keep it 32-bit with >>> 0)
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  // Take the lower 28 bits (7 hex digits)
  return (hash & 0xfffffff).toString(16).padStart(7, '0');
}

// ---------------------------------------------------------------------------
// ObjectStore
// ---------------------------------------------------------------------------

export class ObjectStore {
  private blobs: Map<string, string>;
  private trees: Map<string, Map<string, string>>;
  private commits: Map<string, Commit>;
  /** Monotonically increasing counter appended to content before hashing. */
  private counter: number;

  constructor() {
    this.blobs = new Map();
    this.trees = new Map();
    this.commits = new Map();
    this.counter = 0;
  }

  // -------------------------------------------------------------------------
  // Internal helper – produces a unique hash each call
  // -------------------------------------------------------------------------
  private nextHash(content: string): string {
    const unique = `${content}\x00${this.counter++}`;
    return hashContent(unique);
  }

  // -------------------------------------------------------------------------
  // Blobs
  // -------------------------------------------------------------------------

  writeBlob(content: string): string {
    const hash = this.nextHash(content);
    this.blobs.set(hash, content);
    return hash;
  }

  readBlob(hash: string): string {
    const content = this.blobs.get(hash);
    if (content === undefined) {
      throw new Error(`Blob not found: ${hash}`);
    }
    return content;
  }

  // -------------------------------------------------------------------------
  // Trees
  // -------------------------------------------------------------------------

  writeTree(entries: Map<string, string>): string {
    // Serialize entries deterministically for hashing
    const serialized = [...entries.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, blobHash]) => `${name}:${blobHash}`)
      .join('\n');
    const hash = this.nextHash(serialized);
    // Store a copy of the entries map
    this.trees.set(hash, new Map(entries));
    return hash;
  }

  readTree(hash: string): Map<string, string> {
    const entries = this.trees.get(hash);
    if (!entries) {
      throw new Error(`Tree not found: ${hash}`);
    }
    return new Map(entries);
  }

  // -------------------------------------------------------------------------
  // Commits
  // -------------------------------------------------------------------------

  writeCommit(input: WriteCommitInput): string {
    const serialized = `tree:${input.tree}\nparents:${input.parents.join(',')}\nmessage:${input.message}\ntimestamp:${input.timestamp}`;
    const hash = this.nextHash(serialized);
    const commit: Commit = { hash, ...input, parents: [...input.parents] };
    this.commits.set(hash, commit);
    return hash;
  }

  readCommit(hash: string): Commit {
    const commit = this.commits.get(hash);
    if (!commit) {
      throw new Error(`Commit not found: ${hash}`);
    }
    return { ...commit, parents: [...commit.parents] };
  }

  hasCommit(hash: string): boolean {
    return this.commits.has(hash);
  }

  allCommits(): Commit[] {
    return [...this.commits.values()].map(c => ({ ...c, parents: [...c.parents] }));
  }

  // -------------------------------------------------------------------------
  // Serialization helpers (used by Task 15 persistence layer)
  // -------------------------------------------------------------------------

  allBlobs(): [string, string][] {
    return [...this.blobs.entries()];
  }

  allTrees(): [string, Map<string, string>][] {
    return [...this.trees.entries()].map(([h, m]) => [h, new Map(m)]);
  }

  restoreBlob(hash: string, content: string): void {
    this.blobs.set(hash, content);
  }

  restoreTree(hash: string, entries: Map<string, string>): void {
    this.trees.set(hash, new Map(entries));
  }

  restoreCommit(commit: Commit): void {
    this.commits.set(commit.hash, { ...commit, parents: [...commit.parents] });
  }
}
