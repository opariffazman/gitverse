import type { CommandResult } from './types';
import type { RefStore } from '../refs';

/**
 * git status
 *
 * Shows:
 *  - Current branch name or detached HEAD
 *  - Staged files (new file / modified vs committed tree)
 *  - Unstaged modified files (tracked files changed in VFS vs index)
 *  - Untracked files
 */
export function cmdStatus(
  refs: RefStore,
  stagedFiles: string[],
  modifiedFiles: string[],
  untrackedFiles: string[],
  deletedFiles: string[],
  committedTree: Map<string, string>,
  index: Map<string, string>,
): CommandResult {
  const lines: string[] = [];

  // Branch / HEAD line
  const head = refs.getHEAD();
  if (head.attached) {
    lines.push(`On branch ${head.target}`);
  } else {
    lines.push(`HEAD detached at ${head.target.slice(0, 7)}`);
  }

  const hasStagedFiles = stagedFiles.length > 0;
  const hasModifiedFiles = modifiedFiles.length > 0;
  const hasUntrackedFiles = untrackedFiles.length > 0;
  const hasDeletedFiles = deletedFiles.length > 0;

  if (!hasStagedFiles && !hasModifiedFiles && !hasUntrackedFiles && !hasDeletedFiles) {
    lines.push('nothing to commit, working tree clean');
    return { output: lines.join('\n'), exitCode: 0 };
  }

  // Staged changes
  if (hasStagedFiles) {
    lines.push('');
    lines.push('Changes to be committed:');
    lines.push('  (use "git restore --staged <file>..." to unstage)');
    for (const f of stagedFiles.sort()) {
      const label = committedTree.has(f) && index.has(f) ? 'modified' : 'new file';
      lines.push(`\t${label}:   ${f}`);
    }
  }

  // Unstaged modifications
  if (hasModifiedFiles) {
    lines.push('');
    lines.push('Changes not staged for commit:');
    lines.push('  (use "git add <file>..." to update what will be committed)');
    for (const f of modifiedFiles.sort()) {
      lines.push(`\tmodified:   ${f}`);
    }
  }

  // Deleted files
  if (hasDeletedFiles) {
    lines.push('');
    lines.push('Deleted files:');
    lines.push('  (use "git checkout <file>" to restore)');
    for (const f of deletedFiles.sort()) {
      lines.push(`\tdeleted:    ${f}`);
    }
  }

  // Untracked files
  if (hasUntrackedFiles) {
    lines.push('');
    lines.push('Untracked files:');
    lines.push('  (use "git add <file>..." to include in what will be committed)');
    for (const f of untrackedFiles.sort()) {
      lines.push(`\t${f}`);
    }
  }

  return { output: lines.join('\n'), exitCode: 0 };
}
