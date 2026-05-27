import type { GitEngine } from '$engine/index';

/** Git subcommands that can be completed */
const GIT_SUBCOMMANDS = [
  'add',
  'branch',
  'checkout',
  'cherry-pick',
  'commit',
  'diff',
  'log',
  'merge',
  'mv',
  'rebase',
  'reset',
  'revert',
  'rm',
  'stash',
  'status',
  'switch',
  'tag',
];

/** Subcommands that accept branch names as the next argument */
const BRANCH_SUBCOMMANDS = new Set(['checkout', 'switch', 'merge', 'rebase']);

/** Subcommands that accept file paths as the next argument */
const FILE_SUBCOMMANDS = new Set(['add', 'rm', 'mv', 'diff', 'cat', 'touch']);

/**
 * Returns a list of completion candidates for the given partial input.
 *
 * Completion rules:
 * 1. If input is "git " (exactly), return all git subcommands.
 * 2. If input starts with "git " and has a partial subcommand, complete it.
 * 3. If input is "git <subcommand> " (space after), return context-specific completions:
 *    - Branch names for checkout/switch/merge/rebase
 *    - File paths for add/rm/mv/diff
 * 4. For builtins like ls/cat/touch/rm/mv/diff with a partial path, complete file paths.
 */
export function getCompletions(input: string, engine: GitEngine): string[] {
  const trimmed = input;

  // --- git completions ---
  if (trimmed === 'git') {
    return GIT_SUBCOMMANDS.map(s => `git ${s}`);
  }

  if (trimmed.startsWith('git ')) {
    const rest = trimmed.slice(4);
    const parts = rest.split(' ');

    // Completing the subcommand itself
    if (parts.length === 1) {
      const partial = parts[0];
      return GIT_SUBCOMMANDS.filter(s => s.startsWith(partial)).map(s => `git ${s}`);
    }

    // Completing argument to a subcommand
    const subcommand = parts[0];
    const partial = parts.slice(1).join(' ');

    if (BRANCH_SUBCOMMANDS.has(subcommand)) {
      return completeBranches(engine, `git ${subcommand} `, partial);
    }

    if (FILE_SUBCOMMANDS.has(subcommand) || subcommand === 'diff') {
      return completeFilePaths(engine, `git ${subcommand} `, partial);
    }

    return [];
  }

  // --- builtin completions ---
  const builtinParts = trimmed.split(' ');
  if (builtinParts.length >= 2) {
    const builtin = builtinParts[0];
    const partial = builtinParts.slice(1).join(' ');
    const prefix = `${builtin} `;

    if (FILE_SUBCOMMANDS.has(builtin) || builtin === 'cat' || builtin === 'touch') {
      return completeFilePaths(engine, prefix, partial);
    }
  }

  // --- top-level command completion ---
  if (!trimmed.includes(' ')) {
    const allCommands = [
      'git',
      'ls',
      'cat',
      'touch',
      'rm',
      'mv',
      'clear',
      'help',
      'sim',
    ];
    return allCommands.filter(c => c.startsWith(trimmed) && c !== trimmed);
  }

  return [];
}

function completeBranches(engine: GitEngine, prefix: string, partial: string): string[] {
  try {
    const head = engine.getHEAD();
    // Access branches via execute — we can't directly read refs
    // Instead, we call git branch and parse the output
    const result = engine.execute('git branch');
    const branches = result.output
      .split('\n')
      .map(line => line.replace(/^\*?\s+/, '').trim())
      .filter(b => b.length > 0);

    // Also include HEAD's detached commit if relevant
    const candidates = branches;
    if (!head.attached) {
      candidates.push(head.target.slice(0, 7));
    }

    return candidates
      .filter(b => b.startsWith(partial))
      .map(b => `${prefix}${b}`);
  } catch {
    return [];
  }
}

function completeFilePaths(engine: GitEngine, prefix: string, partial: string): string[] {
  try {
    const vfs = engine.getVFS();
    const allPaths = vfs.allFilePaths();
    const dirEntries = vfs.listDir(); // includes "dir/" markers

    const candidates = [...allPaths, ...dirEntries.filter(e => e.endsWith('/'))];

    return [...new Set(candidates)]
      .filter(p => p.startsWith(partial))
      .map(p => `${prefix}${p}`);
  } catch {
    return [];
  }
}
