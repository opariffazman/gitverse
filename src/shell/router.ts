import type { GitEngine } from '$engine/index';
import { parseInput } from './parser';
import { executeBuiltin } from './builtins';
import type { ShellResult } from './types';

export type { ShellResult } from './types';

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
        return { output: result.output, exitCode: result.exitCode, hint: result.hint };
      }

      case 'builtin':
        return executeBuiltin(this.engine, parsed.command, parsed.args);

      case 'unknown':
        return {
          output: `${parsed.command}: command not found`,
          exitCode: 127,
          hint: "type 'help' to see available commands",
        };
    }
  }
}
