import type { GitEngine } from '$engine/index';

/**
 * Command planners for the explorer's beginner buttons. Pure: they only READ
 * engine state and return shell command strings; the caller dispatches them
 * through executeCommand() so every action echoes in the terminal.
 */

const EXAMPLE_FILES = ['README.md', 'index.html', 'src/app.js'];

/** Seed a tiny starter project. Idempotent: existing pieces are skipped. */
export function exampleFileCommands(eng: GitEngine): string[] {
  const vfs = eng.getVFS();
  const cmds: string[] = [];
  if (!vfs.exists('src/')) cmds.push('mkdir src');
  for (const f of EXAMPLE_FILES) {
    if (!vfs.exists(f)) cmds.push(`touch ${f}`);
  }
  return cmds;
}

const CHANGE_LINES = [
  'fix typo',
  'add TODO note',
  'update docs',
  'tweak wording',
  'refactor helper',
];
// Module counter (not Math.random) so output is deterministic and testable.
let changeCounter = 0;

/**
 * Append a realistic line to the first two tracked files (committed or
 * staged, alphabetical, still present in the VFS). Empty when nothing
 * qualifies — the UI disables the button in that case.
 */
export function simulateChangeCommands(eng: GitEngine): string[] {
  const vfs = eng.getVFS();
  const tracked = new Set([...eng.getCommittedTree().keys(), ...eng.getStagedFiles()]);
  return [...tracked]
    .filter((p) => vfs.exists(p))
    .sort()
    .slice(0, 2)
    .map((p) => `echo "${CHANGE_LINES[changeCounter++ % CHANGE_LINES.length]}" >> ${p}`);
}
