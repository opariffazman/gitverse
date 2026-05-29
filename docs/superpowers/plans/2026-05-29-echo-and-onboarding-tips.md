# `echo` File Simulation & Onboarding Tips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `echo`-redirection file modification, fix the misleading "nothing to commit" message, replace the verbose empty-graph guide with two minimal one-time tips (create flow on init, modify flow on first commit), and de-touch the placeholder.

**Architecture:** A new `echo` file builtin provides content modification (the missing complement to `touch`). The engine's existing `hint?` dim-line mechanism carries two one-time tips. `cmdCommit` becomes untracked-aware for an accurate nothing-to-commit message. UI changes revert the guide and adjust the placeholder.

**Tech Stack:** TypeScript (strict), Svelte 5 runes, Vitest (headless engine/shell), Playwright (e2e).

**Spec:** `docs/specs/2026-05-29-echo-and-onboarding-tips-design.md`
**Branch:** `feat/a11y-usability-pass` (PR #13) — version stays `0.7.0-rc.0`.

---

## File Structure

- Modify `src/shell/parser.ts` — add `'echo'` to `BUILTINS`.
- Modify `src/shell/builtins.ts` — `echo` case (`>`/`>>`) + help entry.
- Modify `src/engine/commands/commit.ts` — untracked-aware nothing-to-commit; root-commit tip hint.
- Modify `src/engine/index.ts` — pass `getUntrackedFiles()` to `cmdCommit`; init-tip hint.
- Modify `src/ui/Graph.svelte` — revert empty-state to bare "No commits yet".
- Modify `src/ui/Terminal.svelte` — de-touch the initialized placeholder.
- Tests: new `tests/shell/echo.test.ts`; new `tests/engine/echo-loop.test.ts`; update `tests/engine/hints.test.ts`; update `tests/e2e/a11y.spec.ts`.

---

## Task 1: `echo` builtin with `>` / `>>`

**Files:**
- Modify: `src/shell/parser.ts` (BUILTINS set, line 1)
- Modify: `src/shell/builtins.ts` (new `echo` case + help text)
- Test: `tests/shell/echo.test.ts` (new), `tests/engine/echo-loop.test.ts` (new)

- [ ] **Step 1: Write failing tests**

Create `tests/shell/echo.test.ts` (mirror how other shell builtin tests construct things — they call `executeBuiltin(engine, command, args)` or go through a router; check `tests/shell/builtins.test.ts` for the exact pattern and reuse it). Using the router path is simplest because it tokenizes for you:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { ShellRouter } from '$shell/router';

let engine: GitEngine;
let router: ShellRouter;

beforeEach(() => {
  engine = new GitEngine();
  engine.execute('git init');
  router = new ShellRouter(engine);
});

describe('echo builtin', () => {
  it('prints text when there is no redirect', () => {
    expect(router.execute('echo hello world').output).toBe('hello world');
  });

  it('echo > file overwrites content', () => {
    router.execute('echo first > f.txt');
    router.execute('echo second > f.txt');
    expect(engine.getVFS().readFile('f.txt')).toBe('second');
  });

  it('echo >> file appends on a new line', () => {
    router.execute('echo line1 > f.txt');
    router.execute('echo line2 >> f.txt');
    expect(engine.getVFS().readFile('f.txt')).toBe('line1\nline2');
  });

  it('echo >> creates the file if missing', () => {
    router.execute('echo only >> new.txt');
    expect(engine.getVFS().readFile('new.txt')).toBe('only');
  });

  it('strips one outer pair of double quotes', () => {
    router.execute('echo "hello world" > q.txt');
    expect(engine.getVFS().readFile('q.txt')).toBe('hello world');
  });

  it('echo > file with no text writes an empty file', () => {
    router.execute('echo > empty.txt');
    expect(engine.getVFS().readFile('empty.txt')).toBe('');
  });

  it('errors with no redirect target', () => {
    const res = router.execute('echo hi >');
    expect(res.exitCode).not.toBe(0);
    expect(res.output).toContain('missing redirect target');
  });
});
```

Create `tests/engine/echo-loop.test.ts` (proves the full create→modify→commit-am loop):

```ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';
import { ShellRouter } from '$shell/router';

describe('full loop: touch → add → commit → echo >> → commit -am', () => {
  it('commit -am picks up an echo modification to a tracked file', () => {
    const eng = new GitEngine();
    const router = new ShellRouter(eng);
    router.execute('git init');
    router.execute('touch f.txt');
    router.execute('git add f.txt');
    router.execute('git commit -m "first"');
    const afterFirst = eng.log().length;

    router.execute('echo "more content" >> f.txt'); // modify tracked file
    const res = router.execute('git commit -am "update"');

    expect(res.exitCode).toBe(0);
    expect(eng.log().length).toBe(afterFirst + 1);
    expect(eng.log()[0].message).toBe('update');
  });
});
```

> Confirm `GitEngine` exposes `getVFS()` and `log()` (both used elsewhere) and that `ShellRouter` is constructed as `new ShellRouter(engine)` (per `router.ts`). Adjust imports to the repo's actual test idiom if `builtins.test.ts` does it differently.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- echo`
Expected: FAIL — `echo` is unknown (`command not found`) / not a builtin.

- [ ] **Step 3: Register `echo` as a builtin**

In `src/shell/parser.ts` line 1:

```ts
const BUILTINS = new Set(['ls', 'cat', 'touch', 'rm', 'mv', 'clear', 'help', 'echo']);
```

- [ ] **Step 4: Implement the `echo` case**

In `src/shell/builtins.ts`, add a `case 'echo':` to the switch (alongside `touch`/`cat`). `vfs` is already in scope (`const vfs = engine.getVFS()`):

```ts
    case 'echo': {
      // Detect a redirect operator, possibly glued to the target (">f" / ">>f").
      let redirect: '>' | '>>' | null = null;
      let redirectIdx = -1;
      let gluedTarget = '';
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '>>' || a.startsWith('>>')) {
          redirect = '>>';
          redirectIdx = i;
          gluedTarget = a.slice(2);
          break;
        }
        if (a === '>' || a.startsWith('>')) {
          redirect = '>';
          redirectIdx = i;
          gluedTarget = a.slice(1);
          break;
        }
      }

      if (redirect === null) {
        return { output: args.join(' '), exitCode: 0 };
      }

      let content = args.slice(0, redirectIdx).join(' ');
      if (content.length >= 2 && content.startsWith('"') && content.endsWith('"')) {
        content = content.slice(1, -1);
      }

      const target = gluedTarget || args[redirectIdx + 1];
      if (!target) {
        return { output: 'echo: missing redirect target', exitCode: 1 };
      }

      const slashIdx = target.indexOf('/');
      if (slashIdx !== -1) {
        const dir = target.substring(0, slashIdx);
        if (!vfs.exists(dir + '/')) {
          return {
            output: `echo: cannot create '${target}': No such file or directory`,
            exitCode: 1,
          };
        }
      }

      if (redirect === '>') {
        vfs.createFile(target, content);
      } else {
        const existing = vfs.exists(target) ? vfs.readFile(target) : '';
        vfs.createFile(target, existing === '' ? content : existing + '\n' + content);
      }
      return { output: '', exitCode: 0 };
    }
```

- [ ] **Step 5: Add `echo` to the help text**

In `src/shell/builtins.ts`, in the `help` case's file-builtins list (after the `touch` line), add:

```ts
        "    echo <text> > <file>   — write text to a file (overwrite)",
        "    echo <text> >> <file>  — append text (use to modify tracked files!)",
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `npm run test -- echo`
Expected: PASS (both files).

- [ ] **Step 7: Full suite + typecheck + lint + commit**

Run: `npm run test` (was 409, now +8), `npm run typecheck`, `npm run lint`

```bash
git add src/shell/parser.ts src/shell/builtins.ts tests/shell/echo.test.ts tests/engine/echo-loop.test.ts
git commit -m "feat: echo builtin with > and >> to simulate file modifications"
```

---

## Task 2: Untracked-aware "nothing to commit"

**Files:**
- Modify: `src/engine/commands/commit.ts` (the nothing-staged return + signature)
- Modify: `src/engine/index.ts` (the `cmdCommit(...)` call, ~line 216)
- Test: update `tests/engine/hints.test.ts`

- [ ] **Step 1: Update the failing test**

In `tests/engine/hints.test.ts`, the existing test `'nothing-to-commit suggests touch + git add'` now describes the OLD behavior. Replace it with two tests reflecting the new untracked-aware message:

```ts
  it('nothing staged WITH untracked files → untracked message + git add hint', () => {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a'); // untracked, never added
    const res = eng.execute('git commit -m "x"');
    expect(res.output).toContain('nothing added to commit but untracked files present');
    expect(res.hint).toContain('git add');
  });

  it('nothing staged with a truly clean tree → clean message, no hint', () => {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a');
    eng.execute('git add a.txt');
    eng.execute('git commit -m "base"');
    const res = eng.execute('git commit -m "again"'); // clean, no untracked
    expect(res.output).toContain('nothing to commit, working tree clean');
    expect(res.hint).toBeUndefined();
  });
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- hints`
Expected: FAIL — current code always returns "working tree clean" with the old `touch` hint regardless of untracked files.

- [ ] **Step 3: Add `untracked` param to `cmdCommit`**

In `src/engine/commands/commit.ts`, append a parameter to the signature:

```ts
export function cmdCommit(
  _args: string[],
  opts: Map<string, string[]>,
  objects: ObjectStore,
  refs: RefStore,
  index: Map<string, string>,
  getCommittedTree: () => Map<string, string>,
  label: LabelFn,
  untracked: string[],
): CommandResult {
```

- [ ] **Step 4: Branch the nothing-staged message on untracked presence**

Replace the existing `if (!hasChanges) { ... }` block in `commit.ts`:

```ts
  if (!hasChanges) {
    const head = refs.getHEAD();
    const branchLabel = head.attached ? head.target : 'HEAD (detached)';
    if (untracked.length > 0) {
      return {
        output: `On branch ${branchLabel}\nnothing added to commit but untracked files present`,
        exitCode: 1,
        hint: "use 'git add <file>' to track new files — commit -am only re-commits already-tracked files",
      };
    }
    return {
      output: `On branch ${branchLabel}\nnothing to commit, working tree clean`,
      exitCode: 1,
    };
  }
```

(The old `hint: 'create or modify a file with touch, then git add'` is removed.)

- [ ] **Step 5: Pass untracked files at the call site**

In `src/engine/index.ts`, the `cmdCommit(...)` call (~line 216) — add the new argument last:

```ts
        result = cmdCommit(
          args,
          opts,
          this.objects,
          this.refs,
          this.index,
          () => this.getCommittedTree(),
          label,
          this.getUntrackedFiles(),
        );
```

(Keep the `-a` pre-stage `if` block above this call exactly as-is.)

- [ ] **Step 6: Run tests, verify they pass**

Run: `npm run test -- hints`
Expected: PASS.

- [ ] **Step 7: Full suite + typecheck + commit**

Run: `npm run test` (the `commit-a` "clean tree" tests still pass — truly-clean still says "nothing to commit, working tree clean"), `npm run typecheck`

```bash
git add src/engine/commands/commit.ts src/engine/index.ts tests/engine/hints.test.ts
git commit -m "feat: untracked-aware nothing-to-commit message + git add hint"
```

---

## Task 3: One-time onboarding tips (init + root commit)

**Files:**
- Modify: `src/engine/index.ts` (the `init` case)
- Modify: `src/engine/commands/commit.ts` (the successful-commit return)
- Test: `tests/engine/hints.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/engine/hints.test.ts`:

```ts
describe('onboarding tips', () => {
  it('git init carries a create-flow tip', () => {
    const eng = new GitEngine();
    const res = eng.execute('git init');
    expect(res.exitCode).toBe(0);
    expect(res.hint).toContain('touch');
  });

  it('the first (root) commit carries a modify-flow echo tip', () => {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a');
    eng.execute('git add a.txt');
    const res = eng.execute('git commit -m "first"');
    expect(res.exitCode).toBe(0);
    expect(res.hint).toContain('echo');
  });

  it('a later (non-root) commit has no echo tip', () => {
    const eng = new GitEngine();
    eng.execute('git init');
    eng.getVFS().createFile('a.txt', 'a');
    eng.execute('git add a.txt');
    eng.execute('git commit -m "first"');
    eng.getVFS().createFile('b.txt', 'b');
    eng.execute('git add b.txt');
    const res = eng.execute('git commit -m "second"');
    expect(res.exitCode).toBe(0);
    expect(res.hint).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- hints`
Expected: FAIL — no hints on init or the root commit.

- [ ] **Step 3: Add the init tip**

In `src/engine/index.ts`, the `init` case currently does `result = cmdInit(this);` then creates the `main` branch. After that block, on success set the hint:

```ts
      case 'init':
        result = cmdInit(this);
        if (result.exitCode === 0 && !this.refs.hasBranch('main')) {
          this.refs.createBranch('main', '');
          this.refs.attachHEAD('main');
        }
        if (result.exitCode === 0) {
          result.hint = "create a file with 'touch <name>', then 'git add' and 'git commit'";
        }
        break;
```

- [ ] **Step 4: Add the root-commit tip**

In `src/engine/commands/commit.ts`, the successful-commit path determines `parents`. The success return currently looks like `return { output: <commit line>, exitCode: 0 };`. Capture whether this is the root commit (no parents) and attach the hint:

```ts
  // (after: const parents = parentHash ? [parentHash] : [];  and the commit is written)
  const isRoot = parents.length === 0;
  // ... build the existing success `output` string unchanged ...
  return {
    output: <existing success output expression>,
    exitCode: 0,
    ...(isRoot
      ? { hint: "modify a tracked file with 'echo text >> <file>', then 'git commit -am'" }
      : {}),
  };
```

> Do not change the success `output` string — only add the conditional `hint`. Read the actual success return in `commit.ts` and splice the `...(isRoot ? {...} : {})` into that exact object.

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm run test -- hints`
Expected: PASS.

- [ ] **Step 6: Full suite + typecheck + commit**

Run: `npm run test`, `npm run typecheck`

```bash
git add src/engine/index.ts src/engine/commands/commit.ts tests/engine/hints.test.ts
git commit -m "feat: one-time onboarding tips on git init and the first commit"
```

---

## Task 4: Revert empty-graph guide + de-touch placeholder

**Files:**
- Modify: `src/ui/Graph.svelte` (empty-state block)
- Modify: `src/ui/Terminal.svelte` (placeholder derived)

- [ ] **Step 1: Revert the empty-graph guide**

In `src/ui/Graph.svelte`, replace the multi-line `<pre>` guide inside the
`{#if commitNodes.length === 0}` block with the original bare paragraph:

```svelte
  {#if commitNodes.length === 0}
    <div class="flex items-center justify-center w-full h-full">
      <p class="font-mono text-terminal-dim text-sm select-none">No commits yet</p>
    </div>
```

Keep the `commitNodes.length === 0` condition and the conditional `aria-label`
(`'Commit graph area — no commits yet'`) on the viewport div unchanged.

- [ ] **Step 2: De-touch the initialized placeholder**

In `src/ui/Terminal.svelte`, the `placeholder` derived currently returns
`"type a command — try 'touch readme.md' or 'help'"` when initialized. Change that
branch to drop the touch reference:

```ts
  const placeholder = $derived(
    $engine.isInitialized()
      ? "type a command — try 'help'"
      : "type a command — try 'git init'",
  );
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Empty repo (pre- and post-init) shows bare "No commits yet". After `git init` the placeholder reads "…try 'help'" (no touch). After `git init` a dim `hint:` line appears in the terminal. After a commit the graph renders.

- [ ] **Step 4: typecheck + lint + build + commit**

Run: `npm run typecheck`, `npm run lint`, `npm run build`

```bash
git add src/ui/Graph.svelte src/ui/Terminal.svelte
git commit -m "feat: revert verbose empty-graph guide to 'No commits yet'; de-touch placeholder"
```

---

## Task 5: Update e2e to the new behavior

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Update the guide/placeholder e2e test**

The existing test `'empty-graph guide shows before and after init; placeholder is context-aware'` asserts the 3-step guide text (`/git commit -m "init"/`) and the `touch readme.md` placeholder — both removed now. Replace that test with:

```ts
test('empty-graph shows bare "No commits yet"; placeholder de-touched after init', async ({ page }) => {
  const input = page.locator('#terminal-input');

  // Before init.
  await expect(input).toHaveAttribute('placeholder', /git init/);
  await expect(page.getByText('No commits yet')).toBeVisible();
  await expect(page.getByText(/git commit -m "init"/)).toHaveCount(0); // no 3-step guide

  // After init: placeholder no longer mentions touch; bare "No commits yet" remains.
  await input.click();
  await input.fill('git init');
  await input.press('Enter');
  await expect(input).toHaveAttribute('placeholder', /help/);
  await expect(input).not.toHaveAttribute('placeholder', /touch/);
  await expect(page.getByText('No commits yet')).toBeVisible();
});
```

- [ ] **Step 2: Add an e2e for the post-init tip line**

Append:

```ts
test('git init prints a one-time touch tip', async ({ page }) => {
  const input = page.locator('#terminal-input');
  await input.click();
  await input.fill('git init');
  await input.press('Enter');
  await expect(page.getByText(/create a file with 'touch/)).toBeVisible();
});
```

(The `unknown command shows a dim hint line` test stays as-is.)

- [ ] **Step 3: Run e2e**

Run: `npm run test:e2e`
Expected: all pass. If a `getByText` is brittle, use a unique regex fragment.

- [ ] **Step 4: Full gate + commit**

Run: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `npm run test:e2e`

```bash
git add tests/e2e/a11y.spec.ts
git commit -m "test: e2e for bare empty-state, de-touched placeholder, and init tip"
```

---

## Self-Review Notes

- **Spec coverage:** §2 echo → Task 1. §3 init tip → Task 3. §4 root-commit tip → Task 3. §5 untracked-aware message → Task 2. §6 revert guide + placeholder → Task 4. §7 testing → distributed; e2e → Task 5. The full-loop demonstrability (§1) → Task 1's `echo-loop.test.ts`.
- **Breaking-change updates flagged (not placeholders):** Task 2 Step 1 and Task 5 Step 1 explicitly REPLACE prior-feature tests whose behavior this change supersedes (the old `touch` nothing-to-commit hint; the 3-step guide / `touch` placeholder e2e).
- **Type consistency:** `cmdCommit`'s new `untracked: string[]` last param (Task 2 Step 3) is supplied at the only call site (Task 2 Step 5) via `this.getUntrackedFiles()`. `result.hint` set in Task 3 uses the `hint?` field already on `CommandResult`. `commitNodes` (Task 4) is the existing derived.
- **Out of scope (per spec §8):** richer quote tokenization, `simulate` command, persisted/dismissible tips, modified-but-unstaged message nuance.
```
