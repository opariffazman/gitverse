import type { CommandResult } from './types';
import type { RefStore } from '../refs';

/**
 * git branch              — list all branches, current marked with *
 * git branch <name>       — create a new branch at HEAD
 * git branch -d <name>    — delete branch (safe, refuses if current)
 * git branch -D <name>    — delete branch (force, refuses if current)
 */
export function cmdBranch(
  args: string[],
  opts: Map<string, string[]>,
  refs: RefStore,
  resolveHEAD: () => string,
): CommandResult {
  const hasDelete = opts.has('-d') || opts.has('-D');

  // --- Delete branch ---
  if (hasDelete) {
    const flag = opts.has('-d') ? '-d' : '-D';
    const deleteArgs = opts.get(flag)!;
    if (deleteArgs.length === 0) {
      return {
        output: `error: option '${flag}' requires a branch name`,
        exitCode: 128,
      };
    }
    const branchName = deleteArgs[0];
    // Check existence first (deleteBranch silently ignores missing branches)
    if (!refs.hasBranch(branchName)) {
      return {
        output: `error: branch '${branchName}' not found`,
        exitCode: 1,
      };
    }

    try {
      refs.deleteBranch(branchName);
      return {
        output: `Deleted branch ${branchName}.`,
        exitCode: 0,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // deleteBranch throws when it's the current branch
      if (msg.toLowerCase().includes('current branch')) {
        return {
          output: `error: Cannot delete branch '${branchName}': it is the current branch`,
          exitCode: 1,
        };
      }
      return {
        output: `error: branch '${branchName}' not found`,
        exitCode: 1,
      };
    }
  }

  // --- Create branch ---
  if (args.length > 0) {
    const branchName = args[0];

    // Need a real HEAD commit to point the new branch at
    const headHash = resolveHEAD();
    if (!headHash) {
      return {
        output: `fatal: Not a valid object name: '${refs.getHEAD().target}'`,
        exitCode: 128,
      };
    }

    try {
      refs.createBranch(branchName, headHash);
      return { output: '', exitCode: 0 };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('already exists')) {
        return {
          output: `fatal: A branch named '${branchName}' already exists.`,
          exitCode: 128,
        };
      }
      return { output: `fatal: ${msg}`, exitCode: 128 };
    }
  }

  // --- List branches ---
  const branches = refs.listBranches();
  const head = refs.getHEAD();
  const current = head.attached ? head.target : null;

  const lines = branches.map((name) => {
    const marker = name === current ? '* ' : '  ';
    return `${marker}${name}`;
  });

  return {
    output: lines.join('\n'),
    exitCode: 0,
  };
}
