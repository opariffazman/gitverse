import type { GitEngine } from '../index';
import type { CommandResult } from './types';

export function cmdInit(engine: GitEngine): CommandResult {
  if (engine.isInitialized()) {
    return { output: 'Reinitialized existing Git repository', exitCode: 0 };
  }

  engine.setInitialized(true);
  engine.getVFS().createDir('.git');

  return { output: 'Initialized empty Git repository', exitCode: 0 };
}
