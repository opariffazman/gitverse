import { writable, derived, get } from 'svelte/store';
import { GitEngine } from '$engine/index';
import { CommandHistory } from '$shell/history';
import { ShellRouter } from '$shell/router';
import { generatePrompt } from '$shell/prompt';
import type { PromptSegment } from '$shell/prompt';

export type TerminalLine = {
  id: number;
  prompt?: PromptSegment[];
  input?: string;
  output?: string;
  isError?: boolean;
};

let lineIdCounter = 0;

function createEngineStore() {
  const eng = new GitEngine();
  const store = writable(eng);
  return store;
}

export const engine = createEngineStore();
export const history = writable(new CommandHistory());
export const terminalLines = writable<TerminalLine[]>([]);

export const prompt = derived(engine, ($engine) => {
  return generatePrompt($engine);
});

export function executeCommand(command: string): void {
  const eng = get(engine);
  const hist = get(history);
  const router = new ShellRouter(eng);

  // Capture current prompt segments
  const promptSegments = generatePrompt(eng);

  // Execute command via router
  const result = router.execute(command);

  // Push command to history
  hist.push(command);

  // Handle clear special case
  if (command.trim() === 'clear') {
    terminalLines.set([]);
    return;
  }

  // Add prompt+input and output lines
  const inputLine: TerminalLine = {
    id: ++lineIdCounter,
    prompt: promptSegments,
    input: command,
  };

  const outputLine: TerminalLine = {
    id: ++lineIdCounter,
    output: result.output,
    isError: result.exitCode !== 0,
  };

  terminalLines.update((lines) => {
    const updated = [...lines, inputLine];
    if (result.output !== '') {
      updated.push(outputLine);
    }
    return updated;
  });

  // Notify engine store subscribers about possible state change
  engine.set(eng);
}
