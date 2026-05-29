const BUILTINS = new Set(['ls', 'cat', 'touch', 'rm', 'mv', 'clear', 'help', 'echo']);

export type ParsedInput =
  | { type: 'git'; raw: string }
  | { type: 'builtin'; command: string; args: string[] }
  | { type: 'unknown'; command: string }
  | { type: 'empty' };

/**
 * Classify a raw input string into one of four categories:
 * - empty: blank or whitespace-only input
 * - git: starts with "git " or equals "git"
 * - builtin: first token is a known builtin command
 * - unknown: unrecognized command
 */
export function parseInput(raw: string): ParsedInput {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { type: 'empty' };
  }

  // Git commands
  if (trimmed === 'git' || trimmed.startsWith('git ')) {
    return { type: 'git', raw: trimmed };
  }

  // Tokenize (simple space split, no quote handling needed for builtins)
  const tokens = trimmed.split(/\s+/);
  const command = tokens[0];
  const args = tokens.slice(1);

  if (BUILTINS.has(command)) {
    return { type: 'builtin', command, args };
  }

  return { type: 'unknown', command };
}
