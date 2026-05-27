# Git Init Requirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `git init` a required first command — no branch shown pre-init, `.git/` directory created on init, phantom graph node for visual feedback, `ls` enhanced with `-a`/`-l` flags, README command audit cleanup.

**Architecture:** Add `initialized` flag to GitEngine. RefStore starts empty. `git init` sets flag, creates `main` branch, `.git/` dir. Engine `execute()` gates all non-init git commands. Shell, prompt, autocomplete, graph, and persistence all read `isInitialized()`.

**Tech Stack:** TypeScript, Svelte 5, Vitest, d3-dag

---

## Task Dependency Graph

```
Task 1 (engine core) ──┬──→ Task 3 (shell: prompt + autocomplete + rm guard)
                        ├──→ Task 4 (persistence)
                        ├──→ Task 5 (graph phantom node)
                        ├──→ Task 6 (welcome banner + store)
                        └──→ Task 7 (update existing tests)
Task 2 (ls flags)  ── independent
Task 8 (README/CLAUDE.md) ── independent
```

**Parallelizable:** Tasks 1+2+8 can run simultaneously. Tasks 3+4+5+6 can run simultaneously after Task 1. Task 7 runs after Task 1.

---

### Task 1: Engine Init Foundation

**Files:**
- Modify: `src/engine/refs.ts:17-21` (constructor)
- Modify: `src/engine/index.ts:115-122` (constructor), `src/engine/index.ts:153-254` (execute)
- Create: `src/engine/commands/init.ts`
- Create: `tests/engine/init.test.ts`

- [ ] **Step 1: Write init tests**

Create `tests/engine/init.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';

describe('git init', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
  });

  it('starts uninitialized', () => {
    expect(engine.isInitialized()).toBe(false);
  });

  it('has no branches before init', () => {
    expect(engine.allBranches().size).toBe(0);
  });

  it('initializes repository', () => {
    const result = engine.execute('git init');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Initialized empty Git repository');
    expect(engine.isInitialized()).toBe(true);
  });

  it('creates main branch on init', () => {
    engine.execute('git init');
    const head = engine.getHEAD();
    expect(head.attached).toBe(true);
    expect(head.target).toBe('main');
    expect(engine.allBranches().has('main')).toBe(true);
  });

  it('creates .git/ directory on init', () => {
    engine.execute('git init');
    expect(engine.getVFS().exists('.git/')).toBe(true);
  });

  it('returns reinitialized on double init', () => {
    engine.execute('git init');
    const result = engine.execute('git init');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Reinitialized existing Git repository');
  });

  it('gates git commands before init', () => {
    engine.getVFS().createFile('readme.md', '# hello');
    const result = engine.execute('git add readme.md');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('fatal: not a git repository');
  });

  it('allows git commands after init', () => {
    engine.execute('git init');
    engine.getVFS().createFile('readme.md', '# hello');
    const result = engine.execute('git add readme.md');
    expect(result.exitCode).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --reporter=verbose tests/engine/init.test.ts`
Expected: All 7 tests FAIL (isInitialized doesn't exist, git init not recognized).

- [ ] **Step 3: Modify RefStore constructor to start empty**

In `src/engine/refs.ts`, change the constructor (lines 17-21):

```typescript
// Before
constructor() {
  this.head = { attached: true, target: 'main' };
  this.branches = new Map([['main', '']]);
  this.tags = new Map();
}

// After
constructor() {
  this.head = { attached: false, target: '' };
  this.branches = new Map();
  this.tags = new Map();
}
```

- [ ] **Step 4: Add initialized flag and isInitialized() to GitEngine**

In `src/engine/index.ts`, add property after the existing private fields (around line 112):

```typescript
private initialized = false;
```

Add public accessor after the constructor (after line 122):

```typescript
isInitialized(): boolean {
  return this.initialized;
}

setInitialized(value: boolean): void {
  this.initialized = value;
}
```

- [ ] **Step 5: Create cmdInit command**

Create `src/engine/commands/init.ts`:

```typescript
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
```

Note: The `cmdInit` function also needs to set up the main branch and HEAD. But those are on `refs` which is private. Two options: (a) expose refs or (b) have the engine's execute dispatch handle the ref setup after cmdInit returns. Option (b) is cleaner — keep cmdInit focused and let the engine do ref setup in the `case 'init'` handler:

In `src/engine/index.ts`, add the import and case in the `execute()` switch (before the `default` case, around line 246):

```typescript
// Add import at top of file
import { cmdInit } from './commands/init';

// Add case in execute() switch
case 'init':
  result = cmdInit(this);
  if (result.exitCode === 0 && !this.refs.hasBranch('main')) {
    this.refs.createBranch('main', '');
    this.refs.attachHEAD('main');
  }
  break;
```

- [ ] **Step 6: Add init gate to execute()**

In `src/engine/index.ts`, add the gate at the top of `execute()` (after parsing, before the switch — around line 156):

```typescript
if (command !== 'init' && !this.initialized) {
  return {
    output: 'fatal: not a git repository (or any of the parent directories): .git',
    exitCode: 1,
  };
}
```

- [ ] **Step 7: Run tests**

Run: `npm run test -- --reporter=verbose tests/engine/init.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/commands/init.ts src/engine/index.ts src/engine/refs.ts tests/engine/init.test.ts
git commit -m "feat: add git init command with initialized flag and command gating"
```

---

### Task 2: `ls` Flag Enhancement

**Files:**
- Modify: `src/shell/builtins.ts:27-34` (ls case)
- Modify: `tests/shell/builtins.test.ts` (add ls flag tests)

- [ ] **Step 1: Write ls flag tests**

Add to `tests/shell/builtins.test.ts` inside the existing `describe('ls', ...)` block (after line 41):

```typescript
it('hides dotfiles by default', () => {
  engine.getVFS().createDir('.git');
  engine.getVFS().createFile('readme.md', '# hello');
  const result = executeBuiltin(engine, 'ls', []);
  expect(result.output).not.toContain('.git');
  expect(result.output).toContain('readme.md');
});

it('shows dotfiles with -a flag', () => {
  engine.getVFS().createDir('.git');
  engine.getVFS().createFile('readme.md', '# hello');
  const result = executeBuiltin(engine, 'ls', ['-a']);
  expect(result.output).toContain('.git');
  expect(result.output).toContain('readme.md');
});

it('shows long format with -l flag', () => {
  engine.getVFS().createDir('src');
  engine.getVFS().createFile('readme.md', '# hello');
  const result = executeBuiltin(engine, 'ls', ['-l']);
  expect(result.output).toContain('drwxr-xr-x');
  expect(result.output).toContain('-rw-r--r--');
  expect(result.output).toContain('src/');
  expect(result.output).toContain('readme.md');
});

it('combines -la flags', () => {
  engine.getVFS().createDir('.git');
  engine.getVFS().createFile('readme.md', '# hello');
  const result = executeBuiltin(engine, 'ls', ['-la']);
  expect(result.output).toContain('.git');
  expect(result.output).toContain('drwxr-xr-x');
  expect(result.output).toContain('-rw-r--r--');
});

it('handles separate -l -a flags', () => {
  engine.getVFS().createDir('.git');
  engine.getVFS().createFile('readme.md', '# hello');
  const result = executeBuiltin(engine, 'ls', ['-l', '-a']);
  expect(result.output).toContain('.git');
  expect(result.output).toContain('drwxr-xr-x');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --reporter=verbose tests/shell/builtins.test.ts`
Expected: New tests FAIL (ls doesn't filter dotfiles or support flags).

- [ ] **Step 3: Implement ls flag parsing**

Replace the ls case in `src/shell/builtins.ts` (lines 27-34):

```typescript
case 'ls': {
  const flags = new Set<string>();
  const paths: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('-')) {
      for (const ch of arg.slice(1)) flags.add(ch);
    } else {
      paths.push(arg);
    }
  }
  const showAll = flags.has('a');
  const longFormat = flags.has('l');
  const dir = paths[0];

  let entries = vfs.listDir(dir);
  if (!showAll) {
    entries = entries.filter((e) => !e.startsWith('.'));
  }
  if (entries.length === 0) {
    return { output: '', exitCode: 0 };
  }
  if (longFormat) {
    const lines = entries.map((e) => {
      const perm = e.endsWith('/') ? 'drwxr-xr-x' : '-rw-r--r--';
      return `${perm}  ${e}`;
    });
    return { output: lines.join('\n'), exitCode: 0 };
  }
  return { output: entries.join('  '), exitCode: 0 };
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- --reporter=verbose tests/shell/builtins.test.ts`
Expected: All tests PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/shell/builtins.ts tests/shell/builtins.test.ts
git commit -m "feat: add -a and -l flags to ls builtin"
```

---

### Task 3: Shell Updates (Prompt + Autocomplete + rm Guard)

**Depends on:** Task 1

**Files:**
- Modify: `src/shell/prompt.ts:8-55`
- Modify: `src/shell/complete.ts:4-28`
- Modify: `src/shell/builtins.ts:77-92` (rm case)
- Modify: `tests/shell/prompt.test.ts`
- Modify: `tests/shell/builtins.test.ts`

- [ ] **Step 1: Write prompt test for uninitialized state**

Add to `tests/shell/prompt.test.ts`, new describe block:

```typescript
describe('uninitialized state', () => {
  it('shows no branch segment when uninitialized', () => {
    const engine = new GitEngine();
    const segments = generatePrompt(engine);
    const text = segmentText(segments);
    expect(text).not.toContain('main');
    expect(text).toContain('gitverse');
    expect(text).toContain('❯');
  });

  it('shows branch after init', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const segments = generatePrompt(engine);
    const text = segmentText(segments);
    expect(text).toContain('main');
  });
});
```

- [ ] **Step 2: Write rm guard test**

Add to `tests/shell/builtins.test.ts` inside the `describe('rm', ...)` block:

```typescript
it('refuses to delete .git directory', () => {
  engine.execute('git init');
  const result = executeBuiltin(engine, 'rm', ['.git/']);
  expect(result.exitCode).toBe(1);
  expect(engine.getVFS().exists('.git/')).toBe(true);
});
```

Note: This test needs `engine.execute('git init')` to create `.git/`. If Task 1 is already applied, the engine in builtins tests needs init too. Check if the builtins test `beforeEach` already calls `git init` — if not, add it for tests that need it, or call `engine.execute('git init')` inline in this test.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- --reporter=verbose tests/shell/prompt.test.ts tests/shell/builtins.test.ts`
Expected: New tests FAIL.

- [ ] **Step 4: Update prompt for uninitialized state**

In `src/shell/prompt.ts`, add early return at start of `generatePrompt` (after line 9):

```typescript
export function generatePrompt(engine: GitEngine): PromptSegment[] {
  if (!engine.isInitialized()) {
    return [
      { text: 'gitverse ', color: 'dim' },
      { text: '❯ ', color: 'cyan' },
    ];
  }

  // ... rest of existing function unchanged
```

- [ ] **Step 5: Update autocomplete for uninitialized state**

In `src/shell/complete.ts`, add `'init'` to `GIT_SUBCOMMANDS` array (line 4). Then in `getCompletions` function, add early filter when uninitialized. After the engine parameter is available, add:

```typescript
// At top of getCompletions, after determining tokens
if (!engine.isInitialized()) {
  const TOP_LEVEL_PREINIT = ['git', 'ls', 'cat', 'touch', 'rm', 'mv', 'clear', 'help'];
  if (tokens.length <= 1) {
    return TOP_LEVEL_PREINIT.filter((c) => c.startsWith(partial)).map((c) => c + ' ');
  }
  if (tokens[0] === 'git') {
    return ['init'].filter((c) => c.startsWith(partial)).map((c) => `git ${c} `);
  }
  // File completions for builtins still work
  if (FILE_SUBCOMMANDS.has(tokens[0])) {
    return completeFilePaths(engine, tokens[0] + ' ', partial);
  }
  return [];
}
```

- [ ] **Step 6: Add .git/ deletion guard to rm builtin**

In `src/shell/builtins.ts`, in the `rm` case (around line 77), add guard before the existing `!vfs.exists` check:

```typescript
case 'rm': {
  if (args.length === 0) return { output: 'usage: rm <path>', exitCode: 1 };
  const path = args[0];
  if (path === '.git' || path === '.git/') {
    return { output: 'rm: cannot remove .git: protected directory', exitCode: 1 };
  }
  if (!vfs.exists(path)) {
    return { output: `rm: ${path}: No such file or directory`, exitCode: 1 };
  }
  vfs.deleteFile(path);
  return { output: '', exitCode: 0 };
}
```

- [ ] **Step 7: Run tests**

Run: `npm run test -- --reporter=verbose tests/shell/prompt.test.ts tests/shell/builtins.test.ts`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shell/prompt.ts src/shell/complete.ts src/shell/builtins.ts tests/shell/prompt.test.ts tests/shell/builtins.test.ts
git commit -m "feat: prompt hides branch pre-init, autocomplete filters pre-init, guard .git/ deletion"
```

---

### Task 4: Persistence

**Depends on:** Task 1

**Files:**
- Modify: `src/persistence/serializer.ts:44-49` (WireState), `src/persistence/serializer.ts:55-93` (serialize), `src/persistence/serializer.ts:99-129` (deserialize)
- Modify: `tests/persistence/serializer.test.ts`

- [ ] **Step 1: Write persistence tests**

Add to `tests/persistence/serializer.test.ts`:

```typescript
describe('initialized state', () => {
  it('round-trips initialized flag', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const json = serialize(engine);
    const restored = deserialize(json);
    expect(restored.isInitialized()).toBe(true);
  });

  it('round-trips uninitialized state', () => {
    const engine = new GitEngine();
    const json = serialize(engine);
    const restored = deserialize(json);
    expect(restored.isInitialized()).toBe(false);
  });

  it('defaults old saves without initialized field to true', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    engine.getVFS().createFile('readme.md', '# hello');
    engine.execute('git add readme.md');
    engine.execute('git commit -m "initial"');
    const json = serialize(engine);
    const parsed = JSON.parse(json);
    delete parsed.initialized;
    const restored = deserialize(JSON.stringify(parsed));
    expect(restored.isInitialized()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --reporter=verbose tests/persistence/serializer.test.ts`
Expected: New tests FAIL (initialized not in WireState).

- [ ] **Step 3: Add initialized to serialization**

In `src/persistence/serializer.ts`, update `WireState` type (line 44):

```typescript
type WireState = {
  initialized: boolean;
  vfs: [string, WireFileEntry][];
  objects: WireObjects;
  refs: WireRefs;
  index: [string, string][];
};
```

In `serialize()` function, add `initialized` to the output object (around line 56):

```typescript
const state: WireState = {
  initialized: engine.isInitialized(),
  vfs: vfsEntries,
  // ... rest unchanged
};
```

In `deserialize()` function, restore the flag (after creating engine, around line 102):

```typescript
export function deserialize(json: string): GitEngine {
  const state = JSON.parse(json) as WireState;
  const engine = new GitEngine();

  // Backwards compat: old saves without initialized field default to true
  if (state.initialized !== undefined) {
    engine.setInitialized(state.initialized);
  } else {
    engine.setInitialized(true);
  }

  // ... rest of existing restore logic unchanged
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- --reporter=verbose tests/persistence/serializer.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/serializer.ts tests/persistence/serializer.test.ts
git commit -m "feat: serialize/deserialize initialized flag with backwards compat"
```

---

### Task 5: Graph Phantom Node

**Depends on:** Task 1

**Files:**
- Modify: `src/graph/types.ts:1-11`
- Modify: `src/ui/Graph.svelte` (node generation + rendering)
- Modify: `tests/graph/layout.test.ts`

- [ ] **Step 1: Write phantom node test**

Add to `tests/graph/layout.test.ts`:

```typescript
describe('phantom node', () => {
  it('is not included when uninitialized', () => {
    const engine = new GitEngine();
    const commits = engine.allCommits();
    expect(commits).toHaveLength(0);
  });

  it('uses phantom type for zero-commit initialized state', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const commits = engine.allCommits();
    expect(commits).toHaveLength(0);
    // Phantom node generation happens in Graph.svelte, not layout
    // This test verifies the engine state that triggers phantom node
    expect(engine.isInitialized()).toBe(true);
    expect(engine.allBranches().has('main')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify**

Run: `npm run test -- --reporter=verbose tests/graph/layout.test.ts`
Expected: Tests pass (they're testing engine state, phantom rendering is in Svelte).

- [ ] **Step 3: Add type to GraphNode**

In `src/graph/types.ts`, add `type` field to `GraphNode` (line 1):

```typescript
export type GraphNode = {
  hash: string;
  type: 'commit' | 'phantom';
  parents: string[];
  message: string;
  branches: string[];
  tags?: string[];
  isHEAD: boolean;
  lane: number;
  x: number;
  y: number;
};
```

- [ ] **Step 4: Fix all GraphNode construction sites**

In `src/ui/Graph.svelte`, where `inputNodes` are created from `allCommits` (around line 64-74), add `type: 'commit'` to each node:

```typescript
const inputNodes: GraphNode[] = allCommits.map((c) => ({
  hash: c.hash,
  type: 'commit' as const,
  parents: c.parents,
  // ... rest unchanged
}));
```

- [ ] **Step 5: Add phantom node generation in Graph.svelte**

In `src/ui/Graph.svelte`, after building `inputNodes` from `allCommits` and before calling `computeLayout`, add phantom node logic:

```typescript
// After inputNodes creation, before computeLayout call
if (inputNodes.length === 0 && $engine.isInitialized()) {
  const phantomNode: GraphNode = {
    hash: '',
    type: 'phantom',
    parents: [],
    message: '',
    branches: ['main'],
    tags: [],
    isHEAD: true,
    lane: 0,
    x: NODE_SPACING_X,
    y: LANE_SPACING_Y,
  };
  // Skip layout computation, render single node directly
  nodes = [phantomNode];
  edges = [];
} else {
  const layout = computeLayout(inputNodes);
  nodes = layout.nodes;
  edges = layout.edges;
}
```

- [ ] **Step 6: Render phantom node differently in SVG**

In `src/ui/Graph.svelte`, in the SVG node rendering section (around line 244), add conditional styling:

```svelte
<circle
  cx={node.x}
  cy={node.y}
  r={NODE_RADIUS}
  fill={node.type === 'phantom' ? 'transparent' : color}
  stroke={node.type === 'phantom' ? '#484f58' : (node.isHEAD ? '#22d3ee' : color)}
  stroke-width={node.type === 'phantom' ? 2 : (node.isHEAD ? 3 : 1.5)}
  stroke-dasharray={node.type === 'phantom' ? '6 3' : 'none'}
  style="cursor: pointer;"
  onclick={() => node.type !== 'phantom' && selectNode(node)}
/>
```

For the hash text inside the node, hide it for phantom:

```svelte
{#if node.type !== 'phantom'}
  <text
    x={node.x}
    y={node.y + 5}
    text-anchor="middle"
    font-family="monospace"
    font-size="14"
    fill="#0d1117"
    pointer-events="none">{node.hash.slice(0, 4)}</text>
{/if}
```

- [ ] **Step 7: Fix layout.test.ts if needed**

If `computeLayout` tests construct GraphNode objects, add `type: 'commit'` to them. Search for GraphNode literals in the test and add the field.

- [ ] **Step 8: Commit**

```bash
git add src/graph/types.ts src/ui/Graph.svelte tests/graph/layout.test.ts
git commit -m "feat: phantom node on graph after git init with zero commits"
```

---

### Task 6: Welcome Banner + Store

**Depends on:** Task 1

**Files:**
- Modify: `src/store/engine.ts:30-35` (createInitialLines)

- [ ] **Step 1: Update welcome banner for uninitialized state**

In `src/store/engine.ts`, update the `WELCOME_BANNER` and `WELCOME_SUBTITLE` constants and `createInitialLines` (around lines 10-35):

```typescript
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
```

Remove the old `WELCOME_SUBTITLE` line if it exists — single banner is sufficient.

- [ ] **Step 2: Verify dev server shows banner**

Run: `npm run dev`
Open browser. Verify:
- Welcome banner appears
- Prompt shows `gitverse ❯` (no branch)
- Type `git init` — prompt changes to show `main` branch
- Type `ls -la` — shows `.git/` directory

- [ ] **Step 3: Commit**

```bash
git add src/store/engine.ts
git commit -m "feat: welcome banner with git init hint for uninitialized state"
```

---

### Task 7: Update Existing Tests

**Depends on:** Task 1

**Files:**
- Modify: `tests/engine/core.test.ts`
- Modify: `tests/engine/branch-checkout.test.ts`
- Modify: `tests/engine/merge.test.ts`
- Modify: `tests/engine/rebase.test.ts`
- Modify: `tests/engine/reset-stash-tag.test.ts`
- Modify: `tests/engine/log-diff.test.ts`
- Modify: `tests/engine/vfs.test.ts`
- Modify: `tests/engine/objects.test.ts`
- Modify: `tests/engine/refs.test.ts`
- Modify: `tests/shell/builtins.test.ts`
- Modify: `tests/shell/router.test.ts`
- Modify: `tests/shell/prompt.test.ts`
- Modify: `tests/graph/layout.test.ts`
- Modify: `tests/persistence/serializer.test.ts`

- [ ] **Step 1: Run full test suite to see what breaks**

Run: `npm run test -- --reporter=verbose`
Note every failing test. Most will fail because the engine starts uninitialized and commands are gated.

- [ ] **Step 2: Fix engine tests**

For every `beforeEach` that creates a `new GitEngine()` and then runs git commands, add `engine.execute('git init')` after the constructor call.

Pattern — in each test file's `beforeEach`:

```typescript
beforeEach(() => {
  engine = new GitEngine();
  engine.execute('git init');  // ADD THIS LINE
});
```

Apply to: `core.test.ts`, `branch-checkout.test.ts`, `merge.test.ts`, `rebase.test.ts`, `reset-stash-tag.test.ts`, `log-diff.test.ts`.

For helper functions like `engineWithCommit()` in these files, add `engine.execute('git init')` after `new GitEngine()`.

For `vfs.test.ts`, `objects.test.ts`, `refs.test.ts` — these test lower-level modules directly and may not use `engine.execute()`. Check if they fail; if not, no changes needed. If `refs.test.ts` tests assume `main` branch exists at construction, update those tests to either create the branch manually or use `engine.execute('git init')`.

- [ ] **Step 3: Fix shell tests**

In `tests/shell/builtins.test.ts`, add `engine.execute('git init')` to `beforeEach` if tests use git commands. Tests that only use file builtins (ls, touch, rm, mv, cat) don't need it.

In `tests/shell/router.test.ts`, add init where tests dispatch git commands.

In `tests/shell/prompt.test.ts`, existing tests that check branch display need init. The new "uninitialized state" tests from Task 3 should NOT have init.

- [ ] **Step 4: Fix graph and persistence tests**

In `tests/graph/layout.test.ts`, add init to tests that construct engines and call git commands.

In `tests/persistence/serializer.test.ts`, add init to existing serialization tests that create commits.

- [ ] **Step 5: Run full test suite**

Run: `npm run test -- --reporter=verbose`
Expected: ALL tests PASS.

- [ ] **Step 6: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add tests/
git commit -m "test: add git init to all existing test setups"
```

---

### Task 8: README / CLAUDE.md Cleanup

**Independent — no dependencies**

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Remove `sim change` from README**

In `README.md`, find the file builtins line:

```
File builtins: `ls` `cat` `touch` `rm` `mv` `clear` `help` `sim change`
```

Replace with:

```
File builtins: `ls` `cat` `touch` `rm` `mv` `clear` `help`
```

Update the Numbers table — builtins count from 8 to 7.

- [ ] **Step 2: Remove `sim` from CLAUDE.md**

In `CLAUDE.md`, find the builtins line in the shell section:

```
│   ├── builtins.ts   # ls, cat, touch, rm, mv, clear, help, sim
```

Replace with:

```
│   ├── builtins.ts   # ls, cat, touch, rm, mv, clear, help
```

- [ ] **Step 3: Run prettier**

Run: `npm run format`

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: remove non-existent sim command from README and CLAUDE.md"
```
