# Usage Hints & Command Ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `touch → git add → git commit` workflow discoverable (empty-graph guide, input placeholder, smart error hints) and add common git shorthands (`-am`, `commit -a`, `switch/checkout -c`, `add -A/-u`).

**Architecture:** Engine changes are pure TypeScript, TDD'd headless. One parser change (split clustered short flags) enables `-am` everywhere. One shared `stageWorkingTree` helper backs `add .`/`-A`/`-u` and `commit -a`. A new optional `hint?` field on the command result carries dim contextual nudges to the terminal. UI hints (empty-state guide, placeholder) are verified via the existing Playwright/axe harness.

**Tech Stack:** TypeScript (strict), Svelte 5 runes, Vitest (headless engine/shell), Playwright (e2e).

**Spec:** `docs/specs/2026-05-29-usage-hints-and-command-ergonomics-design.md`
**Branch:** `feat/a11y-usability-pass` (PR #13) — version stays `0.7.0-rc.0`.

---

## File Structure

- Modify `src/engine/index.ts` — `parseGitCommand` (export + cluster-split); `commit` case pre-stages on `-a`; not-a-repo guard gets a `hint`.
- Create `src/engine/commands/staging.ts` — `stageWorkingTree` shared helper.
- Modify `src/engine/commands/add.ts` — `-A`/`-u` + route `.` through the helper.
- Modify `src/engine/commands/checkout.ts` — `-c` as alias for `-b`.
- Modify `src/engine/commands/commit.ts` — `hint` on nothing-to-commit.
- Modify `src/engine/commands/types.ts` — add `hint?: string` to `CommandResult`.
- Modify `src/shell/router.ts` — `hint?` on `ShellResult`, propagate; `unknown` hint.
- Modify `src/store/engine.ts` — `executeCommand` emits a dim hint line.
- Modify `src/ui/Graph.svelte` — empty-graph guide.
- Modify `src/ui/Terminal.svelte` — context-aware placeholder.
- Tests: `tests/engine/parser.test.ts` (new), `tests/engine/staging-add.test.ts` (new), extend `tests/engine/commit*` (a/-am), `tests/engine/branch-checkout.test.ts` (-c), `tests/shell/router.test.ts` (unknown hint), `tests/engine/hints.test.ts` (new), `tests/e2e/a11y.spec.ts` (hints UI).

---

## Task 1: Parser — split clustered short flags

**Files:**
- Modify: `src/engine/index.ts` (`parseGitCommand`, ~lines 47-99)
- Test: `tests/engine/parser.test.ts` (new)

- [ ] **Step 1: Export `parseGitCommand`**

In `src/engine/index.ts`, change `function parseGitCommand(` to `export function parseGitCommand(`. (It returns `{ command, args, opts }` where `opts: Map<string, string[]>`.) Also export its return type if not already; if the type is inline, add near it:

```ts
export type ParsedCommand = { command: string; args: string[]; opts: Map<string, string[]> };
```

(If `ParsedCommand` already exists, just ensure it is exported.)

- [ ] **Step 2: Write the failing test**

Create `tests/engine/parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseGitCommand } from '$engine/index';

describe('parseGitCommand — clustered short flags', () => {
  it('splits -am into -a and -m, value binds to the last', () => {
    const { command, opts } = parseGitCommand('git commit -am "hello world"');
    expect(command).toBe('commit');
    expect(opts.has('-a')).toBe(true);
    expect(opts.get('-a')).toEqual([]);
    expect(opts.get('-m')).toEqual(['hello world']);
  });

  it('leaves long flags untouched', () => {
    const { opts } = parseGitCommand('git reset --hard HEAD');
    expect(opts.has('--hard')).toBe(true);
    expect(opts.has('-h')).toBe(false);
    expect(opts.has('-a')).toBe(false);
  });

  it('leaves single short flags untouched', () => {
    const { opts } = parseGitCommand('git checkout -b feature');
    expect(opts.get('-b')).toEqual(['feature']);
  });

  it('splits a 3-letter cluster, value binds to the last', () => {
    const { opts } = parseGitCommand('git commit -nam "x"');
    expect(opts.has('-n')).toBe(true);
    expect(opts.has('-a')).toBe(true);
    expect(opts.get('-m')).toEqual(['x']);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npm run test -- parser`
Expected: FAIL — `-am` currently stored as a single key, `opts.get('-m')` is undefined.

- [ ] **Step 4: Implement cluster expansion**

In `parseGitCommand`, after `const command = tokens[0];` and before the args/opts loop, build an expanded token list and iterate it instead of `tokens` from index 1. Replace the existing loop region:

```ts
  const command = tokens[0];
  const args: string[] = [];
  const opts: Map<string, string[]> = new Map();

  // Expand clustered short flags: "-am" -> "-a","-m". The value-collection loop
  // below binds following values to the LAST flag, matching git (`-am "msg"`).
  // Long flags ("--hard") and single short flags ("-m") are untouched.
  const flagTokens: string[] = [];
  for (let k = 1; k < tokens.length; k++) {
    const t = tokens[k];
    if (/^-[a-zA-Z]{2,}$/.test(t)) {
      for (const ch of t.slice(1)) flagTokens.push(`-${ch}`);
    } else {
      flagTokens.push(t);
    }
  }

  let i = 0;
  while (i < flagTokens.length) {
    const token = flagTokens[i];
    if (token.startsWith('-')) {
      const values: string[] = [];
      i++;
      while (i < flagTokens.length && !flagTokens[i].startsWith('-')) {
        values.push(flagTokens[i]);
        i++;
      }
      opts.set(token, values);
    } else {
      args.push(token);
      i++;
    }
  }

  return { command, args, opts };
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npm run test -- parser`
Expected: PASS.

- [ ] **Step 6: Full suite (regression) + typecheck**

Run: `npm run test` (expect 382 still pass — no command consumed `-am` before) then `npm run typecheck`.
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/engine/index.ts tests/engine/parser.test.ts
git commit -m "feat: split clustered short flags in git command parser (-am)"
```

---

## Task 2: Shared staging helper + `add -A` / `-u`

**Files:**
- Create: `src/engine/commands/staging.ts`
- Modify: `src/engine/commands/add.ts`
- Test: `tests/engine/staging-add.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/staging-add.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

function repoWithCommit(): GitEngine {
  const eng = new GitEngine();
  eng.execute('git init');
  eng.getVFS().createFile('a.txt', 'a');
  eng.execute('git add a.txt');
  eng.execute('git commit -m "base"');
  return eng;
}

describe('git add -A / -u / .', () => {
  it('add -A stages a deletion of a tracked file', () => {
    const eng = repoWithCommit();
    eng.getVFS().deleteFile('a.txt');
    eng.execute('git add -A');
    expect(eng.getStagedFiles()).toContain('a.txt'); // staged as a deletion
    eng.execute('git commit -m "remove a"');
    // After commit, the committed tree no longer has a.txt.
    expect(eng.getCommittedTreePaths()).not.toContain('a.txt');
  });

  it('add -u stages a tracked modification but not a new untracked file', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('a.txt', 'a-modified'); // modify tracked
    eng.getVFS().createFile('new.txt', 'new'); // untracked
    eng.execute('git add -u');
    expect(eng.getStagedFiles()).toContain('a.txt');
    expect(eng.getStagedFiles()).not.toContain('new.txt');
  });

  it('add -A stages a new untracked file', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('new.txt', 'new');
    eng.execute('git add -A');
    expect(eng.getStagedFiles()).toContain('new.txt');
  });

  it('add . stages a deletion (aligned with -A)', () => {
    const eng = repoWithCommit();
    eng.getVFS().deleteFile('a.txt');
    eng.execute('git add .');
    eng.execute('git commit -m "remove via dot"');
    expect(eng.getCommittedTreePaths()).not.toContain('a.txt');
  });
});
```

> This test uses `eng.getStagedFiles()` (already exists) and a helper `getCommittedTreePaths()`. If `getCommittedTreePaths()` does not exist on `GitEngine`, replace those two assertions with: `expect([...eng.allCommits()].length).toBeGreaterThan(0)` is NOT sufficient — instead assert via status, e.g. after deletion+add, `eng.getStagedFiles()` includes the path (deletion is represented by the path leaving the index, so for the deletion case assert `expect(eng.getStagedFiles()).not.toContain('a.txt')` is wrong). **Preferred:** read the committed tree through the existing private accessor. Inspect `src/engine/index.ts` for a public method that exposes committed-tree paths (e.g. `getCommittedTree()` may be public). If only `getCommittedTree()` exists, use `expect([...eng.getCommittedTree().keys()]).not.toContain('a.txt')`. Use whatever public accessor exists; do not add one solely for the test if `getCommittedTree()` is accessible.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- staging-add`
Expected: FAIL — `add -A`/`-u` not handled; `add .` does not stage deletions.

- [ ] **Step 3: Create the staging helper**

Create `src/engine/commands/staging.ts`:

```ts
import type { VirtualFileSystem } from '../vfs';
import type { ObjectStore } from '../objects';

/**
 * Stage working-tree changes into the index.
 * - Always stages deletions: tracked paths no longer present in the VFS are
 *   removed from the index.
 * - includeUntracked=true  → stage every VFS file (adds + modifications).
 * - includeUntracked=false → stage only tracked files (in committedTree or
 *   already in index): modifications, never brand-new untracked files.
 */
export function stageWorkingTree(
  vfs: VirtualFileSystem,
  objects: ObjectStore,
  index: Map<string, string>,
  committedTree: Map<string, string>,
  opts: { includeUntracked: boolean },
): void {
  const isTracked = (p: string) => committedTree.has(p) || index.has(p);

  for (const p of vfs.allFilePaths()) {
    if (!opts.includeUntracked && !isTracked(p)) continue;
    index.set(p, objects.writeBlob(vfs.readFile(p)));
  }

  for (const p of [...index.keys()]) {
    if (!vfs.exists(p)) index.delete(p);
  }
}
```

- [ ] **Step 4: Wire `-A` / `-u` and route `.` through the helper**

In `src/engine/commands/add.ts`: import the helper, rename `_opts` → `opts`, and handle the multi-file cases. Replace the body from the `if (args.length === 0)` guard down to the `.` branch:

```ts
import { stageWorkingTree } from './staging';
// ...
export function cmdAdd(
  args: string[],
  opts: Map<string, string[]>,
  vfs: VirtualFileSystem,
  objects: ObjectStore,
  index: Map<string, string>,
  committedTree?: Map<string, string>,
): CommandResult {
  const tree = committedTree ?? new Map<string, string>();

  // -A: everything (adds + mods + deletions). -u: tracked changes only.
  if (opts.has('-A')) {
    stageWorkingTree(vfs, objects, index, tree, { includeUntracked: true });
    return { output: '', exitCode: 0 };
  }
  if (opts.has('-u')) {
    stageWorkingTree(vfs, objects, index, tree, { includeUntracked: false });
    return { output: '', exitCode: 0 };
  }

  if (args.length === 0) {
    return { output: 'Nothing specified, nothing added.', exitCode: 1 };
  }

  const pathArg = args[0];

  // "." now also stages deletions (same as -A) for correctness.
  if (pathArg === '.') {
    stageWorkingTree(vfs, objects, index, tree, { includeUntracked: true });
    return { output: '', exitCode: 0 };
  }

  // ... keep the existing single-file path below (exists check + stageFile) ...
```

Keep the existing single-file `stageFile`/`exists` logic for a named path. Remove the now-unused old `.` loop. The local `stageFile` closure can remain for the single-file case (it has the unchanged-dedup nicety).

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm run test -- staging-add`
Expected: PASS.

- [ ] **Step 6: Update any existing `add .` test that pinned the old no-deletion behavior**

Run: `npm run test`
If a previously-green test now fails because `add .` stages a deletion (the intended correctness change), update that test to expect the deletion to be staged. Re-run `npm run test` until green. Report which test you changed and why.

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/engine/commands/staging.ts src/engine/commands/add.ts tests/engine/staging-add.test.ts
git commit -m "feat: git add -A/-u via shared staging helper; add . stages deletions"
```

---

## Task 3: `git commit -a` / `-am`

**Files:**
- Modify: `src/engine/index.ts` (the `commit` case in `execute()`, ~lines 197-208)
- Test: `tests/engine/commit-a.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/commit-a.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

function repoWithCommit(): GitEngine {
  const eng = new GitEngine();
  eng.execute('git init');
  eng.getVFS().createFile('a.txt', 'a');
  eng.execute('git add a.txt');
  eng.execute('git commit -m "base"');
  return eng;
}

describe('git commit -a / -am', () => {
  it('-am stages tracked modifications and commits with the message', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('a.txt', 'a-modified');
    const before = eng.log().length;
    const res = eng.execute('git commit -am "update a"');
    expect(res.exitCode).toBe(0);
    expect(eng.log().length).toBe(before + 1);
    expect(eng.log()[0].message).toBe('update a');
  });

  it('-a does not sweep in a brand-new untracked file', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('a.txt', 'a-modified'); // tracked, modified
    eng.getVFS().createFile('new.txt', 'new'); // untracked
    eng.execute('git commit -am "only tracked"');
    // new.txt was not committed → still untracked.
    expect(eng.getUntrackedFiles()).toContain('new.txt');
  });

  it('-a -m (separate flags) behaves the same as -am', () => {
    const eng = repoWithCommit();
    eng.getVFS().createFile('a.txt', 'a2');
    const res = eng.execute('git commit -a -m "sep"');
    expect(res.exitCode).toBe(0);
    expect(eng.log()[0].message).toBe('sep');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- commit-a`
Expected: FAIL — `-a` not handled; the modification is never staged, so "nothing to commit".

- [ ] **Step 3: Pre-stage on `-a` in the commit case**

In `src/engine/index.ts`, add the import near the other command imports:

```ts
import { stageWorkingTree } from './commands/staging';
```

In the `case 'commit':` block, before the `cmdCommit(...)` call:

```ts
      case 'commit':
        if (opts.has('-a')) {
          stageWorkingTree(this.vfs, this.objects, this.index, this.getCommittedTree(), {
            includeUntracked: false,
          });
        }
        result = cmdCommit(
          args,
          opts,
          this.objects,
          this.refs,
          this.index,
          () => this.getCommittedTree(),
          label,
        );
        break;
```

(`-m` is still required by `cmdCommit`, so `git commit -a` with no message keeps the existing `-m` error — matching the spec.)

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test -- commit-a`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck + commit**

Run: `npm run test` then `npm run typecheck`

```bash
git add src/engine/index.ts tests/engine/commit-a.test.ts
git commit -m "feat: git commit -a/-am stages tracked changes before committing"
```

---

## Task 4: `git switch -c` / `git checkout -c`

**Files:**
- Modify: `src/engine/commands/checkout.ts` (~lines 73, 84-89)
- Test: `tests/engine/branch-checkout.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine/branch-checkout.test.ts` (it constructs a `GitEngine` and commits; mirror the file's existing helpers — make at least one commit so HEAD resolves):

```ts
describe('git switch -c / checkout -c', () => {
  function repo() {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a');
    eng.execute('git add a.txt');
    eng.execute('git commit -m "base"');
    return eng;
  }

  it('switch -c creates and switches to a new branch', () => {
    const eng = repo();
    const res = eng.execute('git switch -c feature');
    expect(res.exitCode).toBe(0);
    const head = eng.getHEAD();
    expect(head.attached).toBe(true);
    expect(head.target).toBe('feature');
    expect([...eng.allBranches().keys()]).toContain('feature');
  });

  it('checkout -c also creates and switches', () => {
    const eng = repo();
    const res = eng.execute('git checkout -c feat2');
    expect(res.exitCode).toBe(0);
    expect(eng.getHEAD().target).toBe('feat2');
  });

  it('existing -b still works', () => {
    const eng = repo();
    expect(eng.execute('git checkout -b feat3').exitCode).toBe(0);
    expect(eng.getHEAD().target).toBe('feat3');
  });
});
```

> If `branch-checkout.test.ts` does not already import `GitEngine`, add `import { GitEngine } from '$engine/index';` at the top (or reuse the file's existing import/helpers).

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- branch-checkout`
Expected: FAIL — `switch -c` / `checkout -c` not recognized (no branch created).

- [ ] **Step 3: Treat `-c` as an alias for `-b`**

In `src/engine/commands/checkout.ts`:

```ts
  const createAndSwitch = opts.has('-b') || opts.has('-c');
```

and where the new branch name is read:

```ts
  const bFlag = opts.get('-b') ?? opts.get('-c');
```

Leave the rest of the create-and-switch logic unchanged (it already uses `bFlag`/`createAndSwitch`).

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test -- branch-checkout`
Expected: PASS (including the existing `-b` regression).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/engine/commands/checkout.ts tests/engine/branch-checkout.test.ts
git commit -m "feat: git switch -c / checkout -c (alias for -b)"
```

---

## Task 5: Smart error hints (`hint?` field + 3 sources)

**Files:**
- Modify: `src/engine/commands/types.ts`, `src/engine/commands/commit.ts`, `src/engine/index.ts`, `src/shell/router.ts`, `src/store/engine.ts`
- Test: `tests/engine/hints.test.ts` (new), `tests/shell/router.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/hints.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

describe('contextual hints', () => {
  it('git command before init suggests git init', () => {
    const eng = new GitEngine();
    const res = eng.execute('git status');
    expect(res.output).toContain('not a git repository');
    expect(res.hint).toContain("git init");
  });

  it('nothing-to-commit suggests touch + git add', () => {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a');
    eng.execute('git add a.txt');
    eng.execute('git commit -m "base"');
    const res = eng.execute('git commit -m "again"'); // nothing staged
    expect(res.output).toContain('nothing to commit');
    expect(res.hint).toContain('touch');
  });
});
```

Append to `tests/shell/router.test.ts`:

```ts
describe('router — unknown command hint', () => {
  it('unknown command suggests help', () => {
    // Mirror how this file constructs a ShellRouter / engine.
    const eng = new GitEngine();
    const router = new ShellRouter(eng);
    const res = router.execute('frobnicate');
    expect(res.output).toContain('command not found');
    expect(res.hint).toContain('help');
  });
});
```

> Match `router.test.ts`'s existing imports for `GitEngine` and `ShellRouter`. If it already imports them, reuse those; do not duplicate imports.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- hints router`
Expected: FAIL — `hint` is undefined everywhere.

- [ ] **Step 3: Add `hint?` to `CommandResult`**

In `src/engine/commands/types.ts`:

```ts
export type CommandResult = {
  output: string;
  exitCode: number;
  hint?: string;
};
```

- [ ] **Step 4: Set the three hints**

`src/engine/commands/commit.ts` — the nothing-to-commit return:

```ts
  if (!hasChanges) {
    return {
      output: 'On branch main\nnothing to commit, working tree clean',
      exitCode: 1,
      hint: 'create or modify a file with touch, then git add',
    };
  }
```

`src/engine/index.ts` — the not-a-repo guard at the top of `execute()`:

```ts
    if (command !== 'init' && !this.initialized) {
      return {
        output: 'fatal: not a git repository (or any of the parent directories): .git',
        exitCode: 1,
        hint: "run 'git init' first",
      };
    }
```

- [ ] **Step 5: Propagate `hint` through the router + add the unknown hint**

In `src/shell/router.ts`, extend `ShellResult` and pass `hint` through:

```ts
export type ShellResult = { output: string; exitCode: number; hint?: string };
```

```ts
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
```

(`executeBuiltin` returns a `CommandResult`, which now structurally includes the optional `hint` — no change needed there unless you want a builtin hint; none required.)

- [ ] **Step 6: Emit the hint as a dim line in `executeCommand`**

In `src/store/engine.ts`, after the `outputLine` is defined and the `terminalLines.update(...)` block, add the hint line. Update the block:

```ts
  const outputLine: TerminalLine = {
    id: ++lineIdCounter,
    output: result.output,
    isError: result.exitCode !== 0,
  };

  const hintLine: TerminalLine | null = result.hint
    ? { id: ++lineIdCounter, output: `hint: ${result.hint}`, color: 'dim' }
    : null;

  terminalLines.update((lines) => {
    const updated = [...lines, inputLine];
    if (result.output !== '') updated.push(outputLine);
    if (hintLine) updated.push(hintLine);
    return updated;
  });
```

(`result` here is the `ShellResult` from `router.execute`. `TerminalLine` already supports `color: 'dim'`.)

- [ ] **Step 7: Run tests, verify they pass**

Run: `npm run test -- hints router`
Expected: PASS.

- [ ] **Step 8: Full suite + typecheck + commit**

Run: `npm run test` then `npm run typecheck`

```bash
git add src/engine/commands/types.ts src/engine/commands/commit.ts src/engine/index.ts src/shell/router.ts src/store/engine.ts tests/engine/hints.test.ts tests/shell/router.test.ts
git commit -m "feat: contextual dim hints for not-a-repo, nothing-to-commit, unknown command"
```

---

## Task 6: UI hints — empty-graph guide + input placeholder

**Files:**
- Modify: `src/ui/Graph.svelte` (empty-state block)
- Modify: `src/ui/Terminal.svelte` (input placeholder)

- [ ] **Step 1: Empty-graph workflow guide**

In `src/ui/Graph.svelte`, replace the empty-state block:

```svelte
  {#if layout.nodes.length === 0}
    <div class="flex items-center justify-center w-full h-full">
      <p class="font-mono text-terminal-dim text-sm select-none">No commits yet</p>
    </div>
```

with a 3-step guide:

```svelte
  {#if layout.nodes.length === 0}
    <div class="flex items-center justify-center w-full h-full">
      <pre class="font-mono text-terminal-dim text-sm leading-6 select-none">{`No commits yet

 1. touch readme.md       create a file
 2. git add readme.md     stage it
 3. git commit -m "init"  commit it`}</pre>
    </div>
```

- [ ] **Step 2: Context-aware terminal placeholder**

In `src/ui/Terminal.svelte`, derive a placeholder from engine init state. The component already imports `engine` from `$store/engine`. Add near the other `$derived`s:

```ts
  const placeholder = $derived(
    $engine.isInitialized()
      ? "type a command — try 'touch readme.md' or 'help'"
      : "type a command — try 'git init'",
  );
```

Add `placeholder={placeholder}` to the `<input ...>` element (the one with `id="terminal-input"`). The browser shows it only when the input is empty, so it never overlaps the ghost-completion overlay (which appears while typing).

> Confirm `GitEngine` exposes `isInitialized()` (it does — used in `prompt.ts`). If `$engine` is not already a reactive subscription in this component, it is (Terminal imports `engine` and uses `$engine` for ghost completion).

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Before `git init`: graph shows the 3-step guide; input placeholder reads "…try 'git init'". After `git init`: placeholder reads "…try 'touch readme.md' or 'help'". After a commit: the guide is replaced by the graph.

- [ ] **Step 4: Typecheck + lint + build + commit**

Run: `npm run typecheck`, `npm run lint`, `npm run build`

```bash
git add src/ui/Graph.svelte src/ui/Terminal.svelte
git commit -m "feat: empty-graph workflow guide + context-aware terminal placeholder"
```

---

## Task 7: E2E — hints render

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Add e2e assertions**

Append to `tests/e2e/a11y.spec.ts` (reuse the file's existing `makeCommit` helper and `page.goto('./')` pattern):

```ts
test('empty-graph guide and placeholder are shown', async ({ page }) => {
  // Before init: placeholder suggests git init.
  const input = page.locator('#terminal-input');
  await expect(input).toHaveAttribute('placeholder', /git init/);
  // Empty-graph guide visible.
  await expect(page.getByText('No commits yet')).toBeVisible();
  await expect(page.getByText(/touch readme\.md/)).toBeVisible();

  // After init: placeholder switches.
  await input.click();
  await input.fill('git init');
  await input.press('Enter');
  await expect(input).toHaveAttribute('placeholder', /touch readme\.md/);
});

test('unknown command shows a dim hint line', async ({ page }) => {
  const input = page.locator('#terminal-input');
  await input.click();
  await input.fill('frobnicate');
  await input.press('Enter');
  await expect(page.getByText(/command not found/)).toBeVisible();
  await expect(page.getByText(/type 'help' to see available commands/)).toBeVisible();
});
```

- [ ] **Step 2: Run e2e**

Run: `npm run test:e2e -- a11y`
Expected: all pass (existing + 2 new). If the empty-graph guide text is split across the `<pre>` in a way that breaks `getByText`, assert with a regex against a unique fragment (e.g. `/git commit -m "init"/`).

- [ ] **Step 3: Full gate + commit**

Run: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `npm run test:e2e`

```bash
git add tests/e2e/a11y.spec.ts
git commit -m "test: e2e for empty-graph guide, placeholder, and unknown-command hint"
```

---

## Self-Review Notes

- **Spec coverage:** §2 parser → Task 1. §3 staging helper → Task 2. §4 add -A/-u → Task 2. §5 commit -a/-am → Task 3. §6 switch/checkout -c → Task 4. §7c smart hints → Task 5. §7a empty-graph + §7b placeholder → Task 6. §8 testing → distributed; e2e UI hints → Task 7.
- **DRY:** one `stageWorkingTree` helper (Task 2) reused by `add`/`commit -a` (Task 3). One parser change (Task 1) enables `-am` for all commands.
- **Flagged verification points (not placeholders):** committed-tree accessor name in Task 2 Step 1 (use existing `getCommittedTree()` / `getStagedFiles()`); `router.test.ts` import style in Task 5 Step 1; empty-state `getByText` robustness in Task 7 Step 2. Each has a concrete fallback.
- **Type consistency:** `stageWorkingTree(vfs, objects, index, committedTree, { includeUntracked })` is defined in Task 2 Step 3 and called identically in Task 2 Step 4 and Task 3 Step 3. `hint?: string` defined in Task 5 Step 3 (`CommandResult`) and Step 5 (`ShellResult`), consumed in Task 5 Step 6. `parseGitCommand` exported in Task 1 Step 1, used in Task 1 Step 2 test.
- **Out of scope (per spec §9):** `switch -`/`checkout -`, fuzzy suggestions, dismissible hints.
```
