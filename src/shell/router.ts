import type { GitEngine } from '$engine/index';
import { parseInput } from './parser';
import { executeBuiltin } from './builtins';

export type ShellResult = { output: string; exitCode: number };

/**
 * Routes a raw input string to the appropriate handler:
 * - empty input → no-op (empty output, exit 0)
 * - git commands → engine.execute()
 * - builtins → executeBuiltin()
 * - unknown commands → error message, exit 127
 */
export class ShellRouter {
  constructor(private engine: GitEngine) {}

  execute(raw: string): ShellResult {
    const parsed = parseInput(raw);

    switch (parsed.type) {
      case 'empty':
        return { output: '', exitCode: 0 };

      case 'git': {
        const result = this.engine.execute(parsed.raw);
        return { output: result.output, exitCode: result.exitCode };
      }

      case 'builtin':
        return executeBuiltin(this.engine, parsed.command, parsed.args);

      case 'unknown':
        return {
          output: `${parsed.command}: command not found`,
          exitCode: 127,
        };
    }
  }
}
