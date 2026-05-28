import type { CommandResult, LabelFn } from './types';
import type { Commit } from '../objects';
import type { RefStore } from '../refs';

/**
 * git log [--oneline]
 *
 * Shows commits reachable from HEAD, sorted newest first.
 *
 * Default format:
 *   commit <hash> (<decoration>)
 *   <message>
 *   (blank line between commits)
 *
 * --oneline format:
 *   <short-hash> (<decoration>) <message>
 */
export function cmdLog(
  _args: string[],
  opts: Map<string, string[]>,
  commits: Commit[],
  refs: RefStore,
  label: LabelFn,
): CommandResult {
  if (commits.length === 0) {
    return {
      output: 'your current branch has no commits yet',
      exitCode: 0,
    };
  }

  const oneline = opts.has('--oneline');

  // Build a map from commit hash → branch names pointing to it
  const branchMap = new Map<string, string[]>();
  for (const branchName of refs.listBranches()) {
    let branchHash: string;
    try {
      branchHash = refs.resolveBranch(branchName);
    } catch {
      continue;
    }
    if (!branchHash) continue;
    const existing = branchMap.get(branchHash) ?? [];
    existing.push(branchName);
    branchMap.set(branchHash, existing);
  }

  // Build a map from commit hash → tag names pointing to it
  const tagMap = new Map<string, string[]>();
  for (const tagName of refs.listTags()) {
    let tagHash: string;
    try {
      tagHash = refs.resolveTag(tagName);
    } catch {
      continue;
    }
    if (!tagHash) continue;
    const existing = tagMap.get(tagHash) ?? [];
    existing.push(`tag: ${tagName}`);
    tagMap.set(tagHash, existing);
  }

  const head = refs.getHEAD();

  /**
   * Build the decoration string for a commit hash.
   * Format: " (HEAD -> main, tag: v1.0, other-branch)"
   */
  function buildDecoration(hash: string): string {
    const parts: string[] = [];

    const branches = branchMap.get(hash) ?? [];
    const tags = tagMap.get(hash) ?? [];

    // HEAD pointer
    if (head.attached) {
      if (branches.includes(head.target)) {
        parts.push(`HEAD -> ${head.target}`);
        // add remaining branches (excluding the HEAD one)
        for (const b of branches) {
          if (b !== head.target) parts.push(b);
        }
      } else {
        for (const b of branches) parts.push(b);
      }
    } else {
      // Detached HEAD
      if (head.target === hash) parts.push('HEAD');
      for (const b of branches) parts.push(b);
    }

    for (const t of tags) parts.push(t);

    if (parts.length === 0) return '';
    return ` (${parts.join(', ')})`;
  }

  const lines: string[] = [];

  if (oneline) {
    for (const commit of commits) {
      const decoration = buildDecoration(commit.hash);
      lines.push(`${label(commit.hash)}${decoration} ${commit.message}`);
    }
  } else {
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const decoration = buildDecoration(commit.hash);
      lines.push(`commit ${label(commit.hash)}${decoration}`);
      lines.push(commit.message);
      if (i < commits.length - 1) {
        lines.push('');
      }
    }
  }

  return { output: lines.join('\n'), exitCode: 0 };
}
