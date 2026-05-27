import { VirtualFileSystem } from './vfs';
import { ObjectStore } from './objects';
import { RefStore } from './refs';
import type { Commit } from './objects';
import type { HEAD } from './refs';
import type { CommandResult } from './commands/types';
import { cmdAdd } from './commands/add';
import { cmdCommit } from './commands/commit';
import { cmdStatus } from './commands/status';

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

  constructor() {
    this.vfs = new VirtualFileSystem();
    this.objects = new ObjectStore();
    this.refs = new RefStore();
    this.index = new Map();
    this.listeners = new Set();
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

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // -------------------------------------------------------------------------
  // Command execution
  // -------------------------------------------------------------------------

  execute(input: string): CommandResult {
    const { command, args, opts } = parseGitCommand(input.trim());

    let result: CommandResult;

    switch (command) {
      case 'add':
        result = cmdAdd(args, opts, this.vfs, this.objects, this.index);
        break;

      case 'commit':
        result = cmdCommit(
          args,
          opts,
          this.objects,
          this.refs,
          this.index,
          () => this.getCommittedTree(),
        );
        break;

      case 'status':
        result = cmdStatus(
          this.refs,
          this.getStagedFiles(),
          this.getModifiedFiles(),
          this.getUntrackedFiles(),
          this.getCommittedTree(),
          this.index,
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
  // Log
  // -------------------------------------------------------------------------

  /** Returns all commits sorted newest-first (by timestamp). */
  log(): Commit[] {
    return this.objects
      .allCommits()
      .sort((a, b) => b.timestamp - a.timestamp);
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
    return this.vfs
      .allFilePaths()
      .filter(p => !this.index.has(p) && !committedTree.has(p));
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
   * Returns true if there are any untracked, modified, or staged files.
   */
  isDirty(): boolean {
    return (
      this.getUntrackedFiles().length > 0 ||
      this.getModifiedFiles().length > 0 ||
      this.getStagedFiles().length > 0
    );
  }
}
