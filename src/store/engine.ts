import { writable, derived, get } from 'svelte/store';
import { GitEngine } from '$engine/index';
import { CommandHistory } from '$shell/history';
import { ShellRouter } from '$shell/router';
import { generatePrompt } from '$shell/prompt';
import type { PromptSegment } from '$shell/prompt';
import { serialize, deserialize } from '$persistence/serializer';
import { autoSave, autoLoad, saveHistory, loadHistory } from '$persistence/storage';

export type TerminalLine = {
  id: number;
  prompt?: PromptSegment[];
  input?: string;
  output?: string;
  isError?: boolean;
  color?: 'cyan' | 'dim';
};

let lineIdCounter = 0;

const WELCOME_BANNER = `┌─────────────────────────────────────┐
│         Welcome to Gitverse         │
│     A browser-based git sandbox     │
│                                     │
│     Type 'git init' to begin        │
│     Type 'help' for commands        │
└─────────────────────────────────────┘`;

function createInitialLines(): TerminalLine[] {
  return [{ id: ++lineIdCounter, output: WELCOME_BANNER, color: 'cyan' }];
}

function createEngineStore() {
  const eng = new GitEngine();
  const store = writable(eng);
  return store;
}

export const engine = createEngineStore();
export const history = writable(new CommandHistory());
export const terminalLines = writable<TerminalLine[]>(createInitialLines());
export const engineVersion = writable(0);

/**
 * Restore the previous session (engine + command history) from IndexedDB.
 * Call once on boot. A missing or corrupt save leaves defaults in place.
 */
export async function hydrate(): Promise<void> {
  const json = await autoLoad();
  if (json) {
    try {
      engine.set(deserialize(json));
      engineVersion.update((v) => v + 1);
    } catch {
      // corrupt save – keep the fresh engine
    }
  }

  const entries = await loadHistory();
  if (entries.length > 0) {
    const hist = get(history);
    hist.restore(entries);
    history.set(hist);
  }
}

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

  // Push command to history and persist it
  hist.push(command);
  saveHistory(hist.getEntries());

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
  engineVersion.update((v) => v + 1);

  // Persist state asynchronously after every command
  autoSave(serialize(eng));
}
