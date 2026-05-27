# Graph-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gitverse visualization-first — bigger graph with alternating branch lanes, compact docked terminal with p10k-style prompt, ghost text autosuggestion, and removal of sim/FilePanel/overlay cruft.

**Architecture:** Surgical changes across three layers: engine (bug fixes), shell (prompt rewrite, builtin cleanup, autocomplete ghost text), UI (layout split, graph scale-up, terminal compaction). No new components — only modify/delete existing ones.

**Tech Stack:** Svelte 5, TypeScript, UnoCSS, SVG, MesloLGS NF (woff2 web font)

---

### Task 1: Bug Fix — Shell builtins call engine.notify()

**Files:**

- Modify: `src/shell/builtins.ts` (return value change)
- Modify: `src/shell/router.ts:29-31` (call notify after builtin)
- Test: `tests/shell/builtins.test.ts`

The fix goes in the router, not the builtins. `executeBuiltin` is a pure function that returns a result — it shouldn't have side effects. The router already has the engine reference, so it calls `notify()` after any successful VFS-mutating builtin.

- [ ] **Step 1: Write failing test — rm triggers dirty state**

Add to `tests/shell/builtins.test.ts`:

```typescript
describe('VFS-mutating builtins trigger status change', () => {
  it('rm on committed file makes engine dirty', () => {
    engine.getVFS().createFile('tracked.txt', 'content');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    expect(engine.isDirty()).toBe(false);

    // Use ShellRouter so notify() fires
    const router = new ShellRouter(engine);
    router.execute('rm tracked.txt');
    expect(engine.isDirty()).toBe(true);
  });

  it('touch creates untracked file visible to engine', () => {
    const router = new ShellRouter(engine);
    router.execute('touch newfile.txt');
    expect(engine.getUntrackedFiles()).toContain('newfile.txt');
  });

  it('mv on committed file makes engine dirty', () => {
    engine.getVFS().createFile('a.txt', 'content');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');

    const router = new ShellRouter(engine);
    router.execute('mv a.txt b.txt');
    expect(engine.isDirty()).toBe(true);
  });
});
```

Also add import at top of test file:

```typescript
import { ShellRouter } from '$shell/router';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/shell/builtins.test.ts --reporter=verbose`
Expected: FAIL — `rm` test fails because `isDirty()` returns false (no notify)

- [ ] **Step 3: Fix router to call notify after VFS-mutating builtins**

In `src/shell/router.ts`, the engine's `notify()` is private. The store layer (`src/store/engine.ts`) already calls `engine.set(eng)` + `engineVersion.update()` after `executeCommand()` — which covers both git commands AND builtins. So the UI reactivity already works through the store.

The actual issue is: `engine.notify()` is private and only called inside `engine.execute()`. But the Svelte store subscription in `src/store/engine.ts:77-78` already triggers re-render after every `executeCommand()` call (which covers builtins via the router).

Let's verify this — if the store already handles it, the test should pass via `ShellRouter` since the store calls `engine.set(eng)` after. But the test uses `ShellRouter` directly without the store. The tests above should actually pass because `engine.isDirty()` queries VFS directly.

Wait — re-reading the test: after `router.execute('rm tracked.txt')`, the VFS file is deleted. `engine.isDirty()` calls `getModifiedFiles()` which compares VFS to committed tree. The file is committed but gone from VFS. This should return dirty.

The real bug is in the UI: `engine.notify()` isn't called, so Svelte store subscribers don't re-render. But in tests, `isDirty()` is a direct query — it will return the correct value.

The actual fix needs to be: make `notify()` public on GitEngine, then call it from the router after builtin execution.

In `src/engine/index.ts`, change `private notify()` to `notify()` (remove private keyword):

```typescript
notify(): void {
  for (const listener of this.listeners) {
    listener();
  }
}
```

In `src/shell/router.ts`, add notify call after builtin:

```typescript
case 'builtin': {
  const result = executeBuiltin(this.engine, parsed.command, parsed.args);
  this.engine.notify();
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/shell/builtins.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/index.ts src/shell/router.ts tests/shell/builtins.test.ts
git commit -m "fix: shell builtins (rm/touch/mv) now trigger engine notify for UI re-render"
```

---

### Task 2: Bug Fix — git add silent output

**Files:**

- Modify: `src/engine/commands/add.ts:32` (already silent)
- Test: `tests/engine/core.test.ts`

Looking at the code, `git add .` already returns `{ output: '', exitCode: 0 }` (line 32) and single-file add also returns `{ output: '', exitCode: 0 }` (line 47). The output is already empty.

The reported bug "git add . shows prompt for all files to be added" likely means the UI displays something. Check if the prompt re-render after `git add .` shows file counts changing. This is actually the notify bug from Task 1 — after fixing notify, the prompt will update correctly.

- [ ] **Step 1: Write a test confirming git add . is silent**

Add to `tests/engine/core.test.ts`:

```typescript
it('git add . returns empty output', () => {
  engine.getVFS().createFile('a.txt', 'aaa');
  engine.getVFS().createFile('b.txt', 'bbb');
  const result = engine.execute('git add .');
  expect(result.output).toBe('');
  expect(result.exitCode).toBe(0);
});

it('git add <file> returns empty output', () => {
  engine.getVFS().createFile('c.txt', 'ccc');
  const result = engine.execute('git add c.txt');
  expect(result.output).toBe('');
  expect(result.exitCode).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it passes (confirms already silent)**

Run: `npm run test -- tests/engine/core.test.ts --reporter=verbose`
Expected: PASS — output is already empty string

- [ ] **Step 3: Commit**

```bash
git add tests/engine/core.test.ts
git commit -m "test: confirm git add returns silent output"
```

---

### Task 3: Remove sim command, FilePanel, MobileToolbar

**Files:**

- Modify: `src/shell/builtins.ts` (delete sim handler + MUTATIONS const + help reference)
- Modify: `src/shell/complete.ts:88` (remove 'sim' from command list)
- Delete: `src/ui/FilePanel.svelte`
- Delete: `src/ui/MobileToolbar.svelte`
- Modify: `src/ui/Layout.svelte` (remove FilePanel, MobileToolbar imports)
- Modify: `tests/shell/builtins.test.ts` (remove sim tests, update help test)

- [ ] **Step 1: Update help test to not expect sim**

In `tests/shell/builtins.test.ts`, replace the `help` describe block:

```typescript
describe('help', () => {
  it('returns help text with exit 0', () => {
    const r = executeBuiltin(engine, 'help', []);
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('git');
    expect(r.output).toContain('ls');
    expect(r.output).toContain('touch');
    expect(r.output).not.toContain('sim');
  });
});
```

- [ ] **Step 2: Delete sim tests from builtins.test.ts**

Remove the entire `describe('sim', ...)` block (lines 158-191 in `tests/shell/builtins.test.ts`).

- [ ] **Step 3: Run tests to verify they fail (help still mentions sim)**

Run: `npm run test -- tests/shell/builtins.test.ts --reporter=verbose`
Expected: FAIL — help output still contains 'sim'

- [ ] **Step 4: Remove sim from builtins.ts**

In `src/shell/builtins.ts`:

1. Delete the `MUTATIONS` constant (lines 21-27).
2. Delete the entire `case 'sim':` block (lines 168-198).
3. Replace the help text with:

```typescript
    case 'help': {
      const lines = [
        'Available commands:',
        '',
        '  Git commands:',
        '    git add <file|.>',
        '    git commit -m "<message>"',
        '    git status',
        '    git log',
        '    git diff [file]',
        '    git branch [name]',
        '    git checkout <branch|commit>',
        '    git switch <branch>',
        '    git merge <branch>',
        '    git rebase <branch>',
        '    git reset [--soft|--mixed|--hard] <ref>',
        '    git stash [pop|apply|list|drop]',
        '    git tag [name]',
        '    git rm <file>',
        '    git mv <src> <dst>',
        '    git cherry-pick <hash>',
        '    git revert <hash>',
        '',
        '  File builtins:',
        '    ls [dir]          — list files',
        '    cat <file>        — show file content',
        '    touch <file>      — create file (hint: use this to add files!)',
        '    rm <file>         — delete file',
        '    mv <src> <dst>    — move/rename file',
        '    clear             — clear the terminal',
        '',
        '  Other:',
        '    help              — show this message',
      ];
      return { output: lines.join('\n'), exitCode: 0 };
    }
```

4. In `src/shell/complete.ts`, line 88, remove `'sim'` from the `allCommands` array:

```typescript
const allCommands = ['git', 'ls', 'cat', 'touch', 'rm', 'mv', 'clear', 'help'];
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- tests/shell/builtins.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Delete FilePanel.svelte and MobileToolbar.svelte**

```bash
rm src/ui/FilePanel.svelte src/ui/MobileToolbar.svelte
```

- [ ] **Step 7: Strip Layout.svelte to a minimal shell**

Replace `src/ui/Layout.svelte` entirely with this placeholder (full layout redesign comes in Task 8):

```svelte
<script lang="ts">
  import Terminal from './Terminal.svelte';
  import Graph from './Graph.svelte';
</script>

<div class="relative w-full h-full overflow-hidden bg-terminal-bg">
  <div class="absolute inset-0 overflow-auto">
    <Graph />
  </div>
  <div
    class="absolute bottom-0 left-0 right-0"
    style="height: 30%; background-color: rgba(13, 17, 23, 0.95);"
  >
    <div class="h-full overflow-hidden border-t border-terminal-dim/30">
      <Terminal />
    </div>
  </div>
</div>
```

- [ ] **Step 8: Run full test suite + typecheck**

Run: `npm run typecheck && npm run test -- --reporter=verbose`
Expected: PASS — no references to deleted components remain

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: remove sim command, FilePanel, MobileToolbar, overlay system"
```

---

### Task 4: Add MesloLGS NF web font

**Files:**

- Create: `public/fonts/MesloLGS-NF-Regular.woff2` (download)
- Modify: `src/app.css` (add @font-face)

- [ ] **Step 1: Download MesloLGS NF woff2**

```bash
mkdir -p public/fonts
curl -L -o public/fonts/MesloLGS-NF-Regular.woff2 \
  "https://raw.githubusercontent.com/romkatv/powerlevel10k-media/master/MesloLGS%20NF%20Regular.ttf"
```

The upstream only provides TTF. Convert to woff2 or use TTF directly. For simplicity, use TTF with `@font-face` — browsers handle TTF fine:

```bash
curl -L -o public/fonts/MesloLGS-NF-Regular.ttf \
  "https://raw.githubusercontent.com/romkatv/powerlevel10k-media/master/MesloLGS%20NF%20Regular.ttf"
```

- [ ] **Step 2: Add @font-face to app.css**

Replace `src/app.css`:

```css
@font-face {
  font-family: 'MesloLGS NF';
  src: url('/fonts/MesloLGS-NF-Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

body {
  background: #0d1117;
  color: #c9d1d9;
  font-family:
    'MesloLGS NF', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Verify font loads in dev server**

Run: `npm run dev`
Open browser, inspect terminal text — should render in MesloLGS NF. The `` character (U+E0A0) should display as a branch icon.

- [ ] **Step 4: Commit**

```bash
git add public/fonts/MesloLGS-NF-Regular.ttf src/app.css
git commit -m "feat: add MesloLGS NF web font for nerd font icons"
```

---

### Task 5: Prompt redesign — p10k minimal

**Files:**

- Modify: `src/shell/prompt.ts` (complete rewrite)
- Modify: `src/ui/Prompt.svelte` (add cyan color)

- [ ] **Step 1: Write failing test for new prompt format**

Create `tests/shell/prompt.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { generatePrompt, type PromptSegment } from '$shell/prompt';

let engine: GitEngine;

function segmentText(segments: PromptSegment[]): string {
  return segments.map((s) => s.text).join('');
}

function segmentByText(segments: PromptSegment[], text: string): PromptSegment | undefined {
  return segments.find((s) => s.text.includes(text));
}

beforeEach(() => {
  engine = new GitEngine();
});

describe('prompt — clean state', () => {
  it('shows repo name, branch icon, branch, and cursor', () => {
    const segs = generatePrompt(engine);
    const full = segmentText(segs);
    expect(full).toContain('gitverse');
    expect(full).toContain('');
    expect(full).toContain('main');
    expect(full).toContain('❯');
  });

  it('repo name is dim', () => {
    const segs = generatePrompt(engine);
    expect(segs[0].text).toBe('gitverse ');
    expect(segs[0].color).toBe('dim');
  });

  it('branch icon is cyan', () => {
    const segs = generatePrompt(engine);
    const icon = segmentByText(segs, '');
    expect(icon?.color).toBe('cyan');
  });

  it('branch name is green when clean', () => {
    const segs = generatePrompt(engine);
    const branch = segmentByText(segs, 'main');
    expect(branch?.color).toBe('green');
  });

  it('no +N ~N ?N segments when clean', () => {
    const segs = generatePrompt(engine);
    const full = segmentText(segs);
    expect(full).not.toMatch(/\+\d/);
    expect(full).not.toMatch(/~\d/);
    expect(full).not.toMatch(/\?\d/);
  });
});

describe('prompt — dirty state', () => {
  it('shows ?N for untracked files', () => {
    engine.getVFS().createFile('new.txt', 'content');
    const segs = generatePrompt(engine);
    const untracked = segmentByText(segs, '?1');
    expect(untracked).toBeDefined();
    expect(untracked?.color).toBe('dim');
  });

  it('shows +N for staged files in green', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.execute('git add a.txt');
    const segs = generatePrompt(engine);
    const staged = segmentByText(segs, '+1');
    expect(staged).toBeDefined();
    expect(staged?.color).toBe('green');
  });

  it('shows ~N for modified files in yellow', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    engine.getVFS().createFile('a.txt', 'modified');
    const segs = generatePrompt(engine);
    const modified = segmentByText(segs, '~1');
    expect(modified).toBeDefined();
    expect(modified?.color).toBe('yellow');
  });

  it('branch name is yellow when dirty', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    const segs = generatePrompt(engine);
    const branch = segmentByText(segs, 'main');
    expect(branch?.color).toBe('yellow');
  });
});

describe('prompt — detached HEAD', () => {
  it('shows short hash in red when detached', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.execute('git add .');
    engine.execute('git commit -m "first"');
    const head = engine.getHEAD();
    engine.execute(`git checkout ${head.target}`);
    const segs = generatePrompt(engine);
    const hash = segmentByText(segs, head.target.slice(0, 7));
    expect(hash).toBeDefined();
    expect(hash?.color).toBe('red');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/shell/prompt.test.ts --reporter=verbose`
Expected: FAIL — old prompt format doesn't match new expectations

- [ ] **Step 3: Rewrite prompt.ts**

Replace `src/shell/prompt.ts` entirely:

```typescript
import type { GitEngine } from '$engine/index';

export type PromptSegment = {
  text: string;
  color: 'dim' | 'green' | 'yellow' | 'red' | 'blue' | 'grey' | 'fg' | 'cyan';
};

export function generatePrompt(engine: GitEngine): PromptSegment[] {
  const head = engine.getHEAD();
  const dirty = engine.isDirty();
  const staged = engine.getStagedFiles();
  const modified = engine.getModifiedFiles();
  const untracked = engine.getUntrackedFiles();

  const segments: PromptSegment[] = [];

  // Repo name
  segments.push({ text: 'gitverse ', color: 'dim' });

  // Branch icon (Nerd Font U+E0A0)
  segments.push({ text: ' ', color: 'cyan' });

  // Branch name or detached hash
  if (!head.attached) {
    segments.push({ text: head.target.slice(0, 7), color: 'red' });
  } else {
    segments.push({ text: head.target, color: dirty ? 'yellow' : 'green' });
  }

  // Staged count
  if (staged.length > 0) {
    segments.push({ text: ` +${staged.length}`, color: 'green' });
  }

  // Modified count
  if (modified.length > 0) {
    segments.push({ text: ` ~${modified.length}`, color: 'yellow' });
  }

  // Untracked count
  if (untracked.length > 0) {
    segments.push({ text: ` ?${untracked.length}`, color: 'dim' });
  }

  // Cursor
  segments.push({ text: ' ❯ ', color: 'cyan' });

  return segments;
}
```

- [ ] **Step 4: Add 'cyan' to Prompt.svelte color map**

In `src/ui/Prompt.svelte`, add `cyan` to the `colorClassMap`:

```typescript
const colorClassMap: Record<PromptSegment['color'], string> = {
  dim: 'text-terminal-dim',
  green: 'text-terminal-green',
  yellow: 'text-terminal-yellow',
  red: 'text-terminal-red',
  blue: 'text-terminal-blue',
  grey: 'text-terminal-grey',
  fg: 'text-terminal-fg',
  cyan: 'text-cyan-400',
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- tests/shell/prompt.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `npm run test -- --reporter=verbose`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/shell/prompt.ts src/ui/Prompt.svelte tests/shell/prompt.test.ts
git commit -m "feat: p10k minimal prompt with nerd font branch icon and colored status counts"
```

---

### Task 6: ASCII welcome banner

**Files:**

- Modify: `src/store/engine.ts` (inject banner on init)

The banner is terminal output — it belongs in the initial `terminalLines` state, not in a component.

- [ ] **Step 1: Add welcome banner to engine store init**

In `src/store/engine.ts`, replace the `terminalLines` initialization:

```typescript
const WELCOME_BANNER = `\x1b[CYAN]██████╗ ██╗████████╗██╗   ██╗███████╗██████╗ ███████╗███████╗
██╔════╝ ██║╚══██╔══╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
██║  ███╗██║   ██║   ██║   ██║█████╗  ██████╔╝███████╗█████╗  
██║   ██║██║   ██║   ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝  
╚██████╔╝██║   ██║    ╚████╔╝ ███████╗██║  ██║███████║███████╗
 ╚═════╝ ╚═╝   ╚═╝     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝`;

const WELCOME_SUBTITLE = "interactive git sandbox — type 'help' for commands";

function createInitialLines(): TerminalLine[] {
  return [
    { id: ++lineIdCounter, output: WELCOME_BANNER, isError: false },
    { id: ++lineIdCounter, output: WELCOME_SUBTITLE, isError: false },
  ];
}

export const terminalLines = writable<TerminalLine[]>(createInitialLines());
```

- [ ] **Step 2: Handle banner coloring in Terminal.svelte**

In `src/ui/Terminal.svelte`, update the output rendering to detect the `\x1b[CYAN]` marker and apply cyan coloring. Replace the output `div` (around line 171):

```svelte
{:else if line.output !== undefined && line.output !== ''}
  <div
    class="leading-6 whitespace-pre-wrap break-all"
    class:text-cyan-400={line.output.startsWith('\x1b[CYAN]')}
    class:text-terminal-red={line.isError && !line.output.startsWith('\x1b[CYAN]')}
    class:text-terminal-fg={!line.isError && !line.output.startsWith('\x1b[CYAN]')}
    class:text-terminal-dim={line.output === WELCOME_SUBTITLE}
  >
    {line.output.replace('\x1b[CYAN]', '')}
  </div>
{/if}
```

Wait — this is getting hacky with escape codes. Simpler approach: use a `type` field on TerminalLine.

Actually, even simpler — just use CSS classes on the two banner lines. Since we control `createInitialLines()`, add a `class` field:

Better approach: keep it minimal. The banner lines are just output lines. Add a `color` optional field to `TerminalLine`:

In `src/store/engine.ts`, update the type:

```typescript
export type TerminalLine = {
  id: number;
  prompt?: PromptSegment[];
  input?: string;
  output?: string;
  isError?: boolean;
  color?: 'cyan' | 'dim';
};
```

Update `createInitialLines()`:

```typescript
function createInitialLines(): TerminalLine[] {
  return [
    { id: ++lineIdCounter, output: WELCOME_BANNER, color: 'cyan' },
    { id: ++lineIdCounter, output: WELCOME_SUBTITLE, color: 'dim' },
  ];
}
```

No escape codes needed. The banner string is plain text.

In `src/ui/Terminal.svelte`, update the output rendering:

```svelte
{:else if line.output !== undefined && line.output !== ''}
  <div
    class="leading-6 whitespace-pre-wrap break-all"
    class:text-cyan-400={line.color === 'cyan'}
    class:text-terminal-dim={line.color === 'dim'}
    class:text-terminal-red={line.isError && !line.color}
    class:text-terminal-fg={!line.isError && !line.color}
  >
    {line.output}
  </div>
{/if}
```

- [ ] **Step 3: Verify banner appears in dev server**

Run: `npm run dev`
Open browser — terminal should show cyan ASCII GITVERSE banner + dim subtitle before first prompt.

- [ ] **Step 4: Verify `clear` removes the banner**

Type `clear` in terminal — banner should disappear (already handled by `terminalLines.set([])`).

- [ ] **Step 5: Commit**

```bash
git add src/store/engine.ts src/ui/Terminal.svelte
git commit -m "feat: ASCII GITVERSE welcome banner on terminal init"
```

---

### Task 7: Ghost text autosuggestion

**Files:**

- Modify: `src/ui/Terminal.svelte` (ghost text rendering + accept logic)

- [ ] **Step 1: Add ghost text derived state**

In `src/ui/Terminal.svelte`, add after the existing `inputValue` state:

```typescript
const ghostText = $derived.by(() => {
  if (!inputValue) return '';
  const eng = get(engine);
  const completions = getCompletions(inputValue, eng);
  if (completions.length === 0) return '';
  const best = completions[0];
  if (best.startsWith(inputValue) && best !== inputValue) {
    return best.slice(inputValue.length);
  }
  return '';
});
```

- [ ] **Step 2: Add Right arrow acceptance in handleKeydown**

In the `handleKeydown` function, add before the `Tab` handler:

```typescript
if (e.key === 'ArrowRight' && ghostText && cursorPos === inputValue.length) {
  e.preventDefault();
  inputValue = inputValue + ghostText;
  cursorPos = inputValue.length;
  tick().then(() => {
    if (inputEl) inputEl.setSelectionRange(cursorPos, cursorPos);
  });
  return;
}
```

Also update the existing Tab handler to accept ghost text if present:

```typescript
if (e.key === 'Tab') {
  e.preventDefault();
  if (ghostText) {
    inputValue = inputValue + ghostText;
    cursorPos = inputValue.length;
    tick().then(() => {
      if (inputEl) inputEl.setSelectionRange(cursorPos, cursorPos);
    });
    return;
  }
  const eng = get(engine);
  const completions = getCompletions(inputValue, eng);
  if (completions.length === 1) {
    inputValue = completions[0];
    cursorPos = inputValue.length;
    tick().then(() => {
      if (inputEl) inputEl.setSelectionRange(cursorPos, cursorPos);
    });
  }
  return;
}
```

- [ ] **Step 3: Render ghost text after input**

Replace the input line div at the bottom of Terminal.svelte:

```svelte
<div class="flex items-baseline leading-6">
  <Prompt segments={$prompt} />
  <div class="relative flex-1 ml-1">
    <input
      bind:this={inputEl}
      type="text"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck={false}
      class="w-full bg-transparent outline-none border-none text-terminal-fg caret-terminal-green font-mono text-sm"
      value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
    />
    {#if ghostText}
      <span
        class="absolute top-0 left-0 pointer-events-none font-mono text-sm text-terminal-dim/50 whitespace-pre"
        aria-hidden="true">{inputValue}<span class="text-terminal-dim/40">{ghostText}</span></span
      >
    {/if}
  </div>
</div>
```

Note: The ghost text span overlays the input. The `inputValue` portion is transparent (same position as the real input), and the `ghostText` portion renders in dim after it. Since the real input has visible text, the ghost text's `inputValue` prefix must be invisible:

```svelte
{#if ghostText}
  <span
    class="absolute top-0 left-0 pointer-events-none font-mono text-sm whitespace-pre"
    aria-hidden="true"
    ><span class="invisible">{inputValue}</span><span class="text-terminal-dim/40">{ghostText}</span
    ></span
  >
{/if}
```

- [ ] **Step 4: Verify ghost text in dev server**

Run: `npm run dev`
Type `git ch` — should see ghost `eckout` in dim grey.
Press Tab or Right arrow — should complete to `git checkout`.
Type `git ` — should see ghost suggestion for first subcommand.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/Terminal.svelte
git commit -m "feat: ghost text autosuggestion with Tab/Right arrow acceptance"
```

---

### Task 8: Graph layout — alternating branch lanes

**Files:**

- Modify: `src/graph/layout.ts` (rewrite lane assignment)
- Modify: `tests/graph/layout.test.ts` (update expectations)

- [ ] **Step 1: Write failing tests for alternating lanes**

Replace `tests/graph/layout.test.ts` entirely:

```typescript
import { describe, it, expect } from 'vitest';
import { computeLayout, NODE_SPACING_X, LANE_SPACING_Y } from '$graph/layout';
import type { Orientation } from '$graph/layout';
import type { GraphNode } from '$graph/types';

function makeNode(hash: string, parents: string[], overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    hash,
    parents,
    message: `commit ${hash}`,
    branches: [],
    tags: [],
    isHEAD: false,
    lane: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe('computeLayout – empty', () => {
  it('returns empty result for empty input', () => {
    const { nodes, edges, width, height } = computeLayout([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
    expect(width).toBe(0);
    expect(height).toBe(0);
  });
});

describe('computeLayout – single commit', () => {
  it('positions at first slot', () => {
    const nodes = [makeNode('aaa', [])];
    const { nodes: out } = computeLayout(nodes);
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(NODE_SPACING_X);
  });

  it('assigns lane 0 to root', () => {
    const nodes = [makeNode('aaa', [])];
    const { nodes: out } = computeLayout(nodes);
    expect(out[0].lane).toBe(0);
  });

  it('no edges for single commit', () => {
    const { edges } = computeLayout([makeNode('aaa', [])]);
    expect(edges).toHaveLength(0);
  });
});

describe('computeLayout – linear chain', () => {
  const root = makeNode('root', []);
  const A = makeNode('A', ['root']);
  const B = makeNode('B', ['A']);

  it('orders left-to-right', () => {
    const { nodes } = computeLayout([root, A, B]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.x).toBeLessThan(byHash.get('A')!.x);
    expect(byHash.get('A')!.x).toBeLessThan(byHash.get('B')!.x);
  });

  it('all share lane 0', () => {
    const { nodes } = computeLayout([root, A, B]);
    for (const n of nodes) expect(n.lane).toBe(0);
  });

  it('generates correct edges', () => {
    const { edges } = computeLayout([root, A, B]);
    const pairs = edges.map((e) => `${e.from}→${e.to}`).sort();
    expect(pairs).toContain('A→root');
    expect(pairs).toContain('B→A');
  });
});

describe('computeLayout – alternating branch lanes', () => {
  it('first branch goes to lane -1 (below main)', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root'], { branches: ['main'] });
    const B = makeNode('B', ['root'], { branches: ['feat1'] });
    const { nodes } = computeLayout([root, A, B]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.lane).toBe(0);
    expect(byHash.get('A')!.lane).toBe(0);
    expect(byHash.get('B')!.lane).toBe(-1);
  });

  it('second branch goes to lane +1 (above main)', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A'], { branches: ['main'] });
    const C = makeNode('C', ['A'], { branches: ['feat1'] });
    const D = makeNode('D', ['A'], { branches: ['feat2'] });
    const { nodes } = computeLayout([root, A, B, C, D]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('C')!.lane).toBe(-1);
    expect(byHash.get('D')!.lane).toBe(1);
  });

  it('third branch goes to lane -2', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root'], { branches: ['main'] });
    const B = makeNode('B', ['root'], { branches: ['feat1'] });
    const C = makeNode('C', ['root'], { branches: ['feat2'] });
    const D = makeNode('D', ['root'], { branches: ['feat3'] });
    const { nodes } = computeLayout([root, A, B, C, D]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('B')!.lane).toBe(-1);
    expect(byHash.get('C')!.lane).toBe(1);
    expect(byHash.get('D')!.lane).toBe(-2);
  });
});

describe('computeLayout – merge commit', () => {
  it('generates edges from merge to both parents', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['root']);
    const merge = makeNode('merge', ['A', 'B']);
    const { edges } = computeLayout([root, A, B, merge]);
    const pairs = new Set(edges.map((e) => `${e.from}→${e.to}`));
    expect(pairs.has('merge→A')).toBe(true);
    expect(pairs.has('merge→B')).toBe(true);
  });

  it('merge appears after both parents in X', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['root']);
    const merge = makeNode('merge', ['A', 'B']);
    const { nodes } = computeLayout([root, A, B, merge]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('merge')!.x).toBeGreaterThan(byHash.get('A')!.x);
    expect(byHash.get('merge')!.x).toBeGreaterThan(byHash.get('B')!.x);
  });
});

describe('computeLayout – edge coordinates', () => {
  it('edge coords match node positions', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const { nodes, edges } = computeLayout([root, A]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    const edge = edges.find((e) => e.from === 'A' && e.to === 'root')!;
    expect(edge.fromX).toBe(byHash.get('A')!.x);
    expect(edge.fromY).toBe(byHash.get('A')!.y);
    expect(edge.toX).toBe(byHash.get('root')!.x);
    expect(edge.toY).toBe(byHash.get('root')!.y);
  });
});

describe('computeLayout – main keeps lane 0', () => {
  it('main branch commits stay on lane 0', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A']);
    const C = makeNode('C', ['B'], { branches: ['main'] });
    const D = makeNode('D', ['B'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B, C, D]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.lane).toBe(0);
    expect(byHash.get('A')!.lane).toBe(0);
    expect(byHash.get('B')!.lane).toBe(0);
    expect(byHash.get('C')!.lane).toBe(0);
    expect(byHash.get('D')!.lane).not.toBe(0);
  });
});

describe('computeLayout – merge across branches', () => {
  it('merge commit rejoins the main lane', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A']);
    const C = makeNode('C', ['B']);
    const D = makeNode('D', ['A'], { branches: ['feat'] });
    const M = makeNode('M', ['C', 'D'], { branches: ['main'] });
    const { nodes, edges } = computeLayout([root, A, B, C, D, M]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('M')!.lane).toBe(byHash.get('root')!.lane);
    expect(byHash.get('D')!.lane).not.toBe(byHash.get('root')!.lane);
    const pairs = new Set(edges.map((e) => `${e.from}→${e.to}`));
    expect(pairs.has('M→C')).toBe(true);
    expect(pairs.has('M→D')).toBe(true);
  });
});

describe('computeLayout – vertical orientation', () => {
  const vert: Orientation = 'vertical';

  it('commits stack top-to-bottom, lanes go left-to-right', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const { nodes } = computeLayout([root, A], vert);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.y).toBeLessThan(byHash.get('A')!.y);
    expect(byHash.get('root')!.x).toBe(byHash.get('A')!.x);
  });

  it('branches go left-to-right in vertical mode', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root'], { branches: ['main'] });
    const B = makeNode('B', ['root'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B], vert);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('A')!.x).not.toBe(byHash.get('B')!.x);
  });

  it('returns orientation in result', () => {
    const { orientation } = computeLayout([makeNode('a', [])], vert);
    expect(orientation).toBe('vertical');
  });

  it('returns horizontal orientation by default', () => {
    const { orientation } = computeLayout([makeNode('a', [])]);
    expect(orientation).toBe('horizontal');
  });
});
```

- [ ] **Step 2: Run test to verify alternating lane tests fail**

Run: `npm run test -- tests/graph/layout.test.ts --reporter=verbose`
Expected: FAIL — alternating lane tests fail (lanes are 0,1,2 instead of 0,-1,+1)

- [ ] **Step 3: Rewrite layout.ts with alternating lane algorithm**

Replace `src/graph/layout.ts` entirely:

```typescript
import type { GraphNode, GraphEdge } from './types';

export const NODE_SPACING_X = 120;
export const LANE_SPACING_Y = 80;

export type Orientation = 'horizontal' | 'vertical';

export type LayoutResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  orientation: Orientation;
};

function nextAlternatingLane(branchIndex: number): number {
  if (branchIndex === 0) return 0;
  const side = branchIndex % 2 === 1 ? -1 : 1;
  const magnitude = Math.ceil(branchIndex / 2);
  return side * magnitude;
}

export function computeLayout(
  inputNodes: GraphNode[],
  orientation: Orientation = 'horizontal',
): LayoutResult {
  if (inputNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0, orientation };
  }

  const nodeMap = new Map<string, GraphNode>();
  for (const n of inputNodes) {
    nodeMap.set(n.hash, { ...n });
  }

  // --- Topological sort (Kahn's algorithm) ---
  const childrenOf = new Map<string, string[]>();

  for (const n of nodeMap.values()) {
    for (const p of n.parents) {
      if (!nodeMap.has(p)) continue;
      childrenOf.set(p, [...(childrenOf.get(p) ?? []), n.hash]);
    }
  }

  const dep = new Map<string, number>();
  for (const n of nodeMap.values()) {
    dep.set(n.hash, n.parents.filter((p) => nodeMap.has(p)).length);
  }

  const queue: string[] = [];
  for (const [hash, d] of dep) {
    if (d === 0) queue.push(hash);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const hash = queue.shift()!;
    topoOrder.push(hash);
    for (const child of childrenOf.get(hash) ?? []) {
      const newDep = (dep.get(child) ?? 1) - 1;
      dep.set(child, newDep);
      if (newDep === 0) queue.push(child);
    }
  }

  for (const hash of nodeMap.keys()) {
    if (!topoOrder.includes(hash)) topoOrder.push(hash);
  }

  // --- Branch membership ---
  const branchTips = new Map<string, string>();
  for (const n of nodeMap.values()) {
    for (const b of n.branches) {
      branchTips.set(b, n.hash);
    }
  }

  const primaryBranch = (n: string) => (n === 'main' ? 0 : n === 'master' ? 1 : 2);
  const branchOrder = [...branchTips.keys()].sort((a, b) => {
    const pa = primaryBranch(a);
    const pb = primaryBranch(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  const commitBranch = new Map<string, string>();
  for (const branch of branchOrder) {
    let current: string | undefined = branchTips.get(branch);
    while (current && nodeMap.has(current) && !commitBranch.has(current)) {
      commitBranch.set(current, branch);
      current = nodeMap.get(current)!.parents[0];
    }
  }

  // --- Alternating lane assignment ---
  const childCountAssigned = new Map<string, number>();
  const laneOf = new Map<string, number>();
  let branchCount = 0;
  const branchLane = new Map<string, number>();

  for (const hash of topoOrder) {
    const node = nodeMap.get(hash)!;
    const validParents = node.parents.filter((p) => nodeMap.has(p));
    const myBranch = commitBranch.get(hash);

    let assignedLane: number;

    if (validParents.length === 0) {
      assignedLane = nextAlternatingLane(branchCount++);
      if (myBranch && !branchLane.has(myBranch)) {
        branchLane.set(myBranch, assignedLane);
      }
    } else {
      const firstParent = validParents[0];
      const parentLane = laneOf.get(firstParent);
      const parentBranch = commitBranch.get(firstParent);
      const parentChildCount = childCountAssigned.get(firstParent) ?? 0;
      const sameBranch = myBranch === parentBranch;

      if (parentChildCount === 0 && parentLane !== undefined && sameBranch) {
        assignedLane = parentLane;
      } else if (myBranch && branchLane.has(myBranch)) {
        assignedLane = branchLane.get(myBranch)!;
      } else {
        assignedLane = nextAlternatingLane(branchCount++);
        if (myBranch && !branchLane.has(myBranch)) {
          branchLane.set(myBranch, assignedLane);
        }
      }

      if (sameBranch) {
        childCountAssigned.set(firstParent, parentChildCount + 1);
      }

      for (let i = 1; i < validParents.length; i++) {
        childCountAssigned.set(validParents[i], (childCountAssigned.get(validParents[i]) ?? 0) + 1);
      }
    }

    laneOf.set(hash, assignedLane);
  }

  // --- Assign x, y positions ---
  // Lanes can be negative, so we need to compute an offset to keep everything positive
  const allLanes = [...laneOf.values()];
  const minLane = Math.min(...allLanes);
  const maxLane = Math.max(...allLanes);

  const commitSpacing = orientation === 'horizontal' ? NODE_SPACING_X : 70;
  const laneSpacing = orientation === 'horizontal' ? LANE_SPACING_Y : 120;

  // Center offset: shift so that the minimum lane maps to a positive coordinate
  // Lane 0 (main) stays in the visual center
  const laneOffset = -minLane;

  const positioned: GraphNode[] = [];
  topoOrder.forEach((hash, index) => {
    const node = nodeMap.get(hash)!;
    const lane = laneOf.get(hash) ?? 0;
    const adjustedLane = lane + laneOffset;
    const x =
      orientation === 'horizontal'
        ? (index + 1) * commitSpacing
        : adjustedLane * laneSpacing + laneSpacing;
    const y =
      orientation === 'horizontal'
        ? adjustedLane * laneSpacing + laneSpacing
        : (index + 1) * commitSpacing;
    positioned.push({ ...node, lane, x, y });
  });

  // --- Generate edges ---
  const edges: GraphEdge[] = [];
  const posMap = new Map<string, { x: number; y: number }>();
  for (const n of positioned) {
    posMap.set(n.hash, { x: n.x, y: n.y });
  }

  for (const n of positioned) {
    for (const parentHash of n.parents) {
      const parentPos = posMap.get(parentHash);
      if (!parentPos) continue;
      edges.push({
        from: n.hash,
        to: parentHash,
        fromX: n.x,
        fromY: n.y,
        toX: parentPos.x,
        toY: parentPos.y,
      });
    }
  }

  const maxX = positioned.reduce((m, n) => Math.max(m, n.x), 0);
  const maxY = positioned.reduce((m, n) => Math.max(m, n.y), 0);
  const totalLanes = maxLane - minLane + 1;

  return {
    nodes: positioned,
    edges,
    width: maxX + (orientation === 'horizontal' ? commitSpacing : laneSpacing),
    height: maxY + (orientation === 'horizontal' ? laneSpacing : commitSpacing),
    orientation,
  };
}
```

- [ ] **Step 4: Run layout tests**

Run: `npm run test -- tests/graph/layout.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/graph/layout.ts tests/graph/layout.test.ts
git commit -m "feat: alternating branch lanes — first below, second above main"
```

---

### Task 9: Graph scale-up and auto-centering

**Files:**

- Modify: `src/ui/Graph.svelte` (node radius, pill sizes, viewBox centering)

- [ ] **Step 1: Update Graph.svelte constants and pill rendering**

In `src/ui/Graph.svelte`:

Change constants at top:

```typescript
const NODE_RADIUS = 18;
const GRAPH_PADDING = 60;
```

Update branch label pill sizing (around line 164):

```typescript
{@const pillWidth = Math.max(label.length * 7.5 + 20, 48)}
```

Update pill height and text positioning — change `height={16}` to `height={22}`, `rx={4}` to `rx={6}`, and text `y={ly + 11}` to `y={ly + 15}`, `font-size="9"` to `font-size="14"` for branch labels.

Update tag sizing similarly: `height={14}` → `height={20}`, `font-size="8"` → `font-size="12"`.

Update hash text inside circles: `font-size="8"` → `font-size="10"`.

Update edge stroke width: `stroke-width="2"` → `stroke-width="2.5"`.

Update HEAD glow ring radius: `r={NODE_RADIUS + 4}` → `r={NODE_RADIUS + 6}`.

- [ ] **Step 2: Update pill positioning math for new sizes**

Branch labels (horizontal mode):

```typescript
{@const ly = isVert ? node.y - 11 + bi * 26 : node.y - NODE_RADIUS - 30 - bi * 26}
```

Tag labels:

```typescript
{@const ly = isVert
  ? node.y - 11 + (node.branches.length + ti) * 26 + (node.branches.length > 0 ? 4 : 0)
  : node.y + NODE_RADIUS + 6 + ti * 26}
```

Tag width: `Math.max(tag.length * 6.5 + 14, 48)`.

Detached HEAD pill: update similarly with new sizes.

- [ ] **Step 3: Add auto-centering viewBox**

Replace the SVG element with auto-centering logic. Since lanes can be negative, the layout already computes positive Y coordinates via the offset. The graph should auto-scroll to show HEAD:

Add after the `layout` derived:

```typescript
const svgWidth = $derived(layout.width + GRAPH_PADDING * 2);
const svgHeight = $derived(layout.height + GRAPH_PADDING * 2);
```

Keep the existing SVG with these computed dimensions.

- [ ] **Step 4: Verify graph appearance in dev server**

Run: `npm run dev`
Create some branches and commits — verify:

- Nodes are larger (18px radius)
- Branch labels are readable (14px font)
- First branch appears below main
- Second branch above main
- Edges are smooth bezier curves

- [ ] **Step 5: Run typecheck and full tests**

Run: `npm run typecheck && npm run test -- --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/Graph.svelte
git commit -m "feat: scale up graph nodes/labels, auto-centering viewBox"
```

---

### Task 10: Layout redesign — 70/30 split

**Files:**

- Modify: `src/ui/Layout.svelte` (final clean version)
- Modify: `src/store/ui.ts` (remove focusMode, toggleFocus, terminalOpacity)

- [ ] **Step 1: Clean up ui store — remove dead exports**

Replace `src/store/ui.ts`:

```typescript
// UI store — intentionally minimal after overlay removal
// Preserved as module for future UI state (e.g., selected panel, graph zoom)
```

- [ ] **Step 2: Rewrite Layout.svelte — clean 70/30 split**

Replace `src/ui/Layout.svelte`:

```svelte
<script lang="ts">
  import Terminal from './Terminal.svelte';
  import Graph from './Graph.svelte';
</script>

<div class="flex flex-col w-full h-full bg-terminal-bg">
  <!-- Graph: top section -->
  <div class="flex-1 min-h-0 overflow-auto">
    <Graph />
  </div>

  <!-- Terminal: bottom section -->
  <div
    class="h-[30vh] md:h-[30vh] max-sm:h-[40vh] shrink-0 border-t border-terminal-dim/30 overflow-hidden"
    style="background-color: rgba(13, 17, 23, 0.95);"
  >
    <Terminal />
  </div>
</div>
```

- [ ] **Step 3: Remove dead imports across codebase**

Check if anything imports from `src/store/ui.ts`:

```bash
grep -r "from '\$store/ui'" src/ --include='*.ts' --include='*.svelte'
```

If Layout.svelte was the only consumer (which it was — focusMode, toggleFocus, terminalOpacity), all references are now removed.

- [ ] **Step 4: Run typecheck and full tests**

Run: `npm run typecheck && npm run test -- --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Verify layout in dev server**

Run: `npm run dev`
Verify:

- Graph takes ~70% top
- Terminal docked at bottom ~30%
- No overlay, no opacity slider, no focus toggle
- Both panels scrollable independently
- Mobile: terminal takes ~40%

- [ ] **Step 6: Commit**

```bash
git add src/ui/Layout.svelte src/store/ui.ts
git commit -m "feat: 70/30 graph/terminal split layout, remove overlay system"
```

---

### Task 11: Final integration test and cleanup

**Files:**

- All previously modified files

- [ ] **Step 1: Run full test suite**

Run: `npm run test -- --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 4: Build production**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Visual smoke test**

Run: `npm run dev` and verify all features work together:

1. ASCII banner displays on load
2. Prompt shows `gitverse  main ❯` in correct colors
3. Type `touch a.txt` — prompt updates to show `?1`
4. Type `git add .` — silent output, prompt shows `+1`
5. Type `git commit -m "init"` — prompt returns to clean state
6. Type `git branch feat` + `git checkout feat` — graph shows branch below main
7. Type `touch b.txt` + `git add .` + `git commit -m "feat work"` — new node on branch lane
8. Ghost text works when typing `git ch` → shows `eckout`
9. Graph nodes are large, labels readable
10. Terminal is compact at bottom 30%

- [ ] **Step 6: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: integration cleanup after graph-first redesign"
```
