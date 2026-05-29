import { VirtualFileSystem } from './vfs';
import { ObjectStore } from './objects';
import { RefStore } from './refs';
import type { Commit } from './objects';
import type { HEAD } from './refs';
import type { CommandResult } from './commands/types';
import { cmdAdd } from './commands/add';
import { cmdCommit } from './commands/commit';
import { cmdStatus } from './commands/status';
import { cmdLog } from './commands/log';
import { cmdDiff } from './commands/diff';
import { cmdBranch } from './commands/branch';
import { cmdCheckout } from './commands/checkout';
import { cmdMerge } from './commands/merge';
import { cmdReset } from './commands/reset';
import { cmdStash } from './commands/stash';
import type { StashEntry } from './commands/stash';
import { cmdTag } from './commands/tag';
import { cmdRm } from './commands/rm';
import { cmdMv } from './commands/mv';
import { cmdRebase } from './commands/rebase';
import { cmdCherryPick } from './commands/cherry-pick';
import { cmdRevert } from './commands/revert';
import { cmdInit } from './commands/init';

// ---------------------------------------------------------------------------
// Command parsing
// ---------------------------------------------------------------------------

type ParsedCommand = {
  command: string;
  args: string[];
  opts: Map<string, string[]>;
};

/**
 * Parse a git command string.
 *
 * - Strips the leading "git " prefix.
 * - Tokenizes respecting double-quoted strings (quotes are stripped).
 * - First token becomes the command name.
 * - Remaining tokens are classified:
 *     - Tokens starting with '-' are option flags.
 *     - The next token (if not another flag) is the option's value.
 *     - All other tokens are positional args.
 */
function parseGitCommand(input: string): ParsedCommand {
  // Strip optional leading "git " prefix
  const stripped = input.startsWith('git ') ? input.slice(4) : input;

  // Tokenize, respecting double-quoted strings
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ' ' && !inQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  if (tokens.length === 0) {
    return { command: '', args: [], opts: new Map() };
  }

  const command = tokens[0];
  const args: string[] = [];
  const opts: Map<string, string[]> = new Map();

  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.startsWith('-')) {
      // Collect values for this flag until the next flag
      const values: string[] = [];
      i++;
      while (i < tokens.length && !tokens[i].startsWith('-')) {
        values.push(tokens[i]);
        i++;
      }
      opts.set(token, values);
    } else {
      args.push(token);
      i++;
    }
  }

  return { command, args, opts };
}

// ---------------------------------------------------------------------------
// GitEngine
// ---------------------------------------------------------------------------

export class GitEngine {
  private vfs: VirtualFileSystem;
  private objects: ObjectStore;
  private refs: RefStore;
  /** Staging index: path → blob hash */
  private index: Map<string, string>;
  private listeners: Set<() => void>;
  /** Stash stack (LIFO). Index 0 is the most recent entry. */
  stashStack: StashEntry[];
  private initialized = false;

  constructor() {
    this.vfs = new VirtualFileSystem();
    this.objects = new ObjectStore();
    this.refs = new RefStore();
    this.index = new Map();
    this.listeners = new Set();
    this.stashStack = [];
  }

  // -------------------------------------------------------------------------
  // Initialization state
  // -------------------------------------------------------------------------

  isInitialized(): boolean {
    return this.initialized;
  }

  setInitialized(value: boolean): void {
    this.initialized = value;
  }

  // -------------------------------------------------------------------------
  // Public accessor for VFS (needed by tests and shell layer)
  // -------------------------------------------------------------------------

  getVFS(): VirtualFileSystem {
    return this.vfs;
  }

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // -------------------------------------------------------------------------
  // Command execution
  // -------------------------------------------------------------------------

  execute(input: string): CommandResult {
    const { command, args, opts } = parseGitCommand(input.trim());

    if (command !== 'init' && !this.initialized) {
      return {
        output: 'fatal: not a git repository (or any of the parent directories): .git',
        exitCode: 1,
      };
    }

    let result: CommandResult;

    // Presentation/addressing helpers handed to commands so they can render
    // C-labels in output and accept them at commit-ish argument positions.
    const label = (hash: string) => this.commitLabel(hash);
    const expand = (token: string) => this.expandCommitish(token);

    switch (command) {
      case 'init':
        result = cmdInit(this);
        if (result.exitCode === 0 && !this.refs.hasBranch('main')) {
          this.refs.createBranch('main', '');
          this.refs.attachHEAD('main');
        }
        break;
      case 'add':
        result = cmdAdd(args, opts, this.vfs, this.objects, this.index, this.getCommittedTree());
        break;

      case 'commit':
        result = cmdCommit(
          args,
          opts,
          this.objects,
          this.refs,
          this.index,
          () => this.getCommittedTree(),
          label,
        );
        break;

      case 'status':
        result = cmdStatus(
          this.refs,
          this.getStagedFiles(),
          this.getModifiedFiles(),
          this.getUntrackedFiles(),
          this.getDeletedFiles(),
          this.getCommittedTree(),
          this.index,
        );
        break;

      case 'log':
        result = cmdLog(args, opts, this.log(), this.refs, label);
        break;

      case 'diff':
        result = cmdDiff(args, opts, this.vfs, this.objects, this.index, this.getCommittedTree());
        break;

      case 'branch':
        result = cmdBranch(args, opts, this.refs, () => this.refs.resolveHEAD());
        break;

      case 'checkout':
      case 'switch':
        result = cmdCheckout(
          args,
          opts,
          this.refs,
          this.objects,
          this.vfs,
          this.index,
          expand,
          label,
        );
        break;

      case 'merge':
        result = cmdMerge(args, opts, this.refs, this.objects, this.vfs, this.index, expand, label);
        break;

      case 'reset':
        result = cmdReset(args, opts, this.refs, this.objects, this.vfs, this.index, expand, label);
        break;

      case 'stash':
        result = cmdStash(
          args,
          opts,
          this.vfs,
          this.index,
          this.stashStack,
          () => this.getCommittedTree(),
          (hash: string) => this.objects.readBlob(hash),
        );
        break;

      case 'tag':
        result = cmdTag(args, opts, this.refs, this.objects, expand);
        break;

      case 'rm':
        result = cmdRm(args, opts, this.vfs, this.index);
        break;

      case 'mv':
        result = cmdMv(args, opts, this.vfs, this.index);
        break;

      case 'rebase':
        result = cmdRebase(args, opts, this.refs, this.objects, this.vfs, this.index);
        break;

      case 'cherry-pick':
        result = cmdCherryPick(
          args,
          opts,
          this.refs,
          this.objects,
          this.vfs,
          this.index,
          expand,
          label,
        );
        break;

      case 'revert':
        result = cmdRevert(
          args,
          opts,
          this.refs,
          this.objects,
          this.vfs,
          this.index,
          expand,
          label,
        );
        break;

      default:
        result = {
          output: `git: '${command}' is not a git command. See 'git --help'.`,
          exitCode: 1,
        };
    }

    if (result.exitCode === 0) {
      this.notify();
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // HEAD / refs delegation
  // -------------------------------------------------------------------------

  getHEAD(): HEAD {
    return this.refs.getHEAD();
  }

  // -------------------------------------------------------------------------
  // Commit labels (C1, C2, …) — presentation/addressing layer over hashes
  // -------------------------------------------------------------------------

  /** Friendly label for a commit hash, e.g. "C3" or "C2'" for a rewrite. */
  commitLabel(hash: string): string {
    let current = hash;
    let primes = 0;
    while (this.objects.hasCommit(current)) {
      const c = this.objects.readCommit(current);
      if (c.rewriteOf === undefined) break;
      current = c.rewriteOf;
      primes++;
    }
    const ordinal = this.objects.commitOrdinal(current);
    if (ordinal === null) return hash.slice(0, 7);
    return `C${ordinal}` + "'".repeat(primes);
  }

  /** Resolve a label like "C3" (case-insensitive) to a commit hash, or null. */
  resolveCommitLabel(label: string): string | null {
    const match = /^C(\d+)$/i.exec(label.trim());
    if (!match) return null;
    const n = parseInt(match[1], 10);
    const commit = this.objects.allCommits()[n - 1];
    return commit ? commit.hash : null;
  }

  /**
   * Resolve a C-label to its commit hash at commit-ish argument positions.
   * Returns the token unchanged if it is not a label, does not resolve, or
   * collides with a real branch/tag name (real refs always win).
   */
  expandCommitish(token: string): string {
    if (!token) return token;
    if (this.refs.hasBranch(token) || this.refs.hasTag(token)) return token;
    return this.resolveCommitLabel(token) ?? token;
  }

  // -------------------------------------------------------------------------
  // Log
  // -------------------------------------------------------------------------

  /**
   * Returns commits reachable from HEAD, newest first.
   *
   * Walks the parent graph from HEAD using DFS, which naturally visits
   * children before parents.  The DFS insertion order is used as a
   * tiebreaker so that commits with identical millisecond timestamps
   * (common in tests) still appear in the correct child-before-parent
   * order.
   */
  log(): Commit[] {
    const headHash = this.refs.resolveHEAD();
    if (!headHash || !this.objects.hasCommit(headHash)) {
      return [];
    }

    const result: Commit[] = [];
    const visited = new Set<string>();
    const stack: string[] = [headHash];

    while (stack.length > 0) {
      const hash = stack.pop()!;
      if (visited.has(hash)) continue;
      visited.add(hash);

      if (!this.objects.hasCommit(hash)) continue;
      const commit = this.objects.readCommit(hash);
      result.push(commit);

      // Push parents — they will be processed (and thus appended) after the child
      for (const parent of commit.parents) {
        if (!visited.has(parent)) {
          stack.push(parent);
        }
      }
    }

    // Stable sort: primary key = timestamp desc, tiebreak = DFS insertion order
    // (result array already has DFS order; use index as tiebreaker)
    const order = new Map(result.map((c, i) => [c.hash, i]));
    result.sort((a, b) => {
      const tsDiff = b.timestamp - a.timestamp;
      if (tsDiff !== 0) return tsDiff;
      return (order.get(a.hash) ?? 0) - (order.get(b.hash) ?? 0);
    });

    return result;
  }

  // -------------------------------------------------------------------------
  // File state helpers
  // -------------------------------------------------------------------------

  /**
   * Returns the tree entries from the HEAD commit.
   * Returns an empty map if there are no commits yet.
   */
  getCommittedTree(): Map<string, string> {
    const headHash = this.refs.resolveHEAD();
    if (!headHash || !this.objects.hasCommit(headHash)) {
      return new Map();
    }
    const commit = this.objects.readCommit(headHash);
    return this.objects.readTree(commit.tree);
  }

  /**
   * Files present in VFS that are neither in the staging index
   * nor in the committed tree.
   */
  getUntrackedFiles(): string[] {
    const committedTree = this.getCommittedTree();
    return this.vfs.allFilePaths().filter((p) => !this.index.has(p) && !committedTree.has(p));
  }

  /**
   * Tracked files (in index or committed tree) whose VFS content
   * differs from what is recorded in the index or committed tree.
   *
   * A file is "modified" when:
   *  - It is in the committed tree and its current VFS content differs
   *    from the committed blob content, AND it is not re-staged.
   */
  getModifiedFiles(): string[] {
    const committedTree = this.getCommittedTree();
    const modified: string[] = [];

    for (const [path, committedBlobHash] of committedTree) {
      if (!this.vfs.exists(path)) continue; // deleted – not "modified" in this sense

      // If re-staged, compare VFS against the new staged blob
      if (this.index.has(path)) {
        const stagedBlobHash = this.index.get(path)!;
        // If staged hash matches committed hash, compare VFS content to staged
        if (stagedBlobHash === committedBlobHash) {
          const vfsContent = this.vfs.readFile(path);
          const stagedContent = this.objects.readBlob(stagedBlobHash);
          if (vfsContent !== stagedContent) {
            modified.push(path);
          }
        }
        // If staged hash differs from committed, the file is staged (not "modified" in git terms)
        // unless VFS content differs from the staged blob
        else {
          const vfsContent = this.vfs.readFile(path);
          const stagedContent = this.objects.readBlob(stagedBlobHash);
          if (vfsContent !== stagedContent) {
            modified.push(path);
          }
        }
      } else {
        // Not in index – compare VFS content to committed blob
        const vfsContent = this.vfs.readFile(path);
        const committedContent = this.objects.readBlob(committedBlobHash);
        if (vfsContent !== committedContent) {
          modified.push(path);
        }
      }
    }

    return modified;
  }

  /**
   * Files in the index that differ from the committed tree
   * (new files, or files with changed content vs committed).
   */
  getStagedFiles(): string[] {
    const committedTree = this.getCommittedTree();
    const staged: string[] = [];

    for (const [path, blobHash] of this.index) {
      const committedHash = committedTree.get(path);
      if (committedHash !== blobHash) {
        staged.push(path);
      }
    }

    return staged;
  }

  /**
   * Files in the committed tree that no longer exist in VFS
   * (deleted from the working directory but not staged for removal).
   */
  getDeletedFiles(): string[] {
    const committedTree = this.getCommittedTree();
    return [...committedTree.keys()].filter((p) => !this.vfs.exists(p));
  }

  /**
   * Returns true if there are any untracked, modified, staged, or deleted files.
   */
  isDirty(): boolean {
    return (
      this.getUntrackedFiles().length > 0 ||
      this.getModifiedFiles().length > 0 ||
      this.getStagedFiles().length > 0 ||
      this.getDeletedFiles().length > 0
    );
  }

  // -------------------------------------------------------------------------
  // Graph data accessors
  // -------------------------------------------------------------------------

  /**
   * Returns all commits in the object store (not just those reachable from HEAD).
   */
  allCommits(): Commit[] {
    return this.objects.allCommits();
  }

  /**
   * Returns all branch names and their target commit hashes.
   */
  allBranches(): Map<string, string> {
    const result = new Map<string, string>();
    for (const name of this.refs.listBranches()) {
      try {
        result.set(name, this.refs.resolveBranch(name));
      } catch {
        // skip branches with empty/invalid targets
      }
    }
    return result;
  }

  /**
   * Returns all tag names and their target commit hashes.
   */
  allTags(): Map<string, string> {
    const result = new Map<string, string>();
    for (const name of this.refs.listTags()) {
      try {
        result.set(name, this.refs.resolveTag(name));
      } catch {
        // skip
      }
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Persistence exposition – used by Task 15 serializer/deserializer
  // -------------------------------------------------------------------------

  /**
   * Returns all branch refs including those with empty targets
   * (needed for serialization round-trips before any commit).
   */
  _allBranchRefs(): [string, string][] {
    return this.refs.listBranches().map((name) => [name, this.refs.resolveBranch(name)]);
  }

  /**
   * Returns all tag refs.
   */
  _allTagRefs(): [string, string][] {
    return this.refs.listTags().map((name) => [name, this.refs.resolveTag(name)]);
  }

  /** Returns all blobs as [hash, content] pairs. */
  _allBlobs(): [string, string][] {
    return this.objects.allBlobs();
  }

  /** Returns all trees as [hash, entries] pairs. */
  _allTrees(): [string, Map<string, string>][] {
    return this.objects.allTrees();
  }

  /** Returns the current staging index. */
  _getIndex(): Map<string, string> {
    return new Map(this.index);
  }

  /** Restore a blob directly into the object store (bypasses hashing counter). */
  _restoreBlob(hash: string, content: string): void {
    this.objects.restoreBlob(hash, content);
  }

  /** Restore a tree directly into the object store (bypasses hashing counter). */
  _restoreTree(hash: string, entries: Map<string, string>): void {
    this.objects.restoreTree(hash, entries);
  }

  /** Restore a commit directly into the object store (bypasses hashing counter). */
  _restoreCommit(commit: Commit): void {
    this.objects.restoreCommit(commit);
  }

  /**
   * Restore refs (branches, tags, HEAD).
   * Clears existing state and replaces with the provided data.
   */
  _restoreRefs(branches: [string, string][], tags: [string, string][], head: HEAD): void {
    // Rebuild the ref store from scratch: delete all existing branches/tags,
    // then create the restored ones, then set HEAD.
    for (const name of this.refs.listBranches()) {
      try {
        // detach HEAD temporarily to allow deleting the current branch
        if (this.refs.getHEAD().attached && this.refs.getHEAD().target === name) {
          this.refs.detachHEAD('0000000');
        }
        this.refs.deleteBranch(name);
      } catch {
        // ignore
      }
    }
    for (const name of this.refs.listTags()) {
      this.refs.deleteTag(name);
    }

    for (const [name, target] of branches) {
      this.refs.createBranch(name, target);
    }
    for (const [name, target] of tags) {
      this.refs.createTag(name, target);
    }

    if (head.attached) {
      this.refs.attachHEAD(head.target);
    } else {
      this.refs.detachHEAD(head.target);
    }
  }

  /** Restore the staging index. */
  _restoreIndex(index: Map<string, string>): void {
    this.index.clear();
    for (const [path, hash] of index) {
      this.index.set(path, hash);
    }
  }
}
