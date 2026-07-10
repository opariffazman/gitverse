# Beginner-Friendly File Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live IDE-style file explorer sidebar with git status badges, a "＋ Example files" button, and a "✎ Simulate changes" button, so beginners can *see* the working → staged → committed model.

**Architecture:** Zero engine changes. A pure derivation (`buildFileTree`) maps the existing engine queries (`getUntrackedFiles`/`getModifiedFiles`/`getStagedFiles`/`getDeletedFiles`/VFS) into a renderable model; a Svelte 5 component renders it as a left sidebar; buttons dispatch *real shell commands* through the existing `executeCommand()` so every action is visible in the terminal. One new shell builtin: `mkdir`.

**Tech Stack:** Svelte 5 (runes + `$store` auto-subscription), TypeScript strict, UnoCSS (theme colors `terminal-*` from `uno.config.ts`), Vitest (headless, `tests/**` except `tests/e2e`), Playwright (`tests/e2e`).

**Spec:** `docs/specs/2026-07-11-beginner-file-explorer-design.md`

## Global Constraints

- Work on branch `feat/beginner-file-explorer` (create from `main` before Task 1).
- Path aliases (vite.config.ts): `$engine`, `$shell`, `$ui`, `$graph`, `$store`, `$persistence`.
- VFS is flat + 1 directory level; directory entries are stored as `"name/"` keys.
- `git init` creates a `.git/` VFS dir — the explorer must never show `.git`.
- Badge colors: `U` = `text-terminal-green`, `M` = `text-terminal-yellow`, `●` (staged) = `text-terminal-blue`, `D` = `text-terminal-red` + strikethrough. (NOT `terminal-cyan` — it is visually identical to green.)
- Status precedence (one badge per file): `deleted` > `modified` > `staged` > `untracked` > `clean`.
- No `Math.random()` anywhere — simulate-changes cycles a module counter.
- Every command a button triggers must go through `executeCommand()` from `$store/engine` so it echoes in the terminal.
- Verify commands: `npm run test` (Vitest), `npm run typecheck`, `npm run lint`, `npm run test:e2e` (Playwright).
- Commit style: conventional commits (`feat:`, `test:`, `docs:`), no scopes required but `feat(ui):` style is used in history.

---

### Task 1: `mkdir` builtin

**Files:**
- Modify: `src/shell/parser.ts:1` (BUILTINS set)
- Modify: `src/shell/builtins.ts` (new case + help text)
- Modify: `src/shell/complete.ts:49,107` (top-level completion lists)
- Test: `tests/shell/builtins.test.ts`, `tests/shell/parser.test.ts`

**Interfaces:**
- Consumes: `vfs.createDir(name)`, `vfs.exists(path)` (existing).
- Produces: shell command `mkdir <dir>` — Task 4's `exampleFileCommands` emits `'mkdir src'`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/shell/builtins.test.ts` (imports for `GitEngine`, `executeBuiltin`, `ShellRouter` already exist at the top):

```ts
describe('mkdir', () => {
  it('creates a directory listable via ls', () => {
    const r = executeBuiltin(engine, 'mkdir', ['src']);
    expect(r.exitCode).toBe(0);
    expect(r.output).toBe('');
    expect(executeBuiltin(engine, 'ls', []).output).toContain('src/');
  });

  it('accepts a trailing slash', () => {
    const r = executeBuiltin(engine, 'mkdir', ['docs/']);
    expect(r.exitCode).toBe(0);
    expect(executeBuiltin(engine, 'ls', []).output).toContain('docs/');
  });

  it('errors on missing operand', () => {
    const r = executeBuiltin(engine, 'mkdir', []);
    expect(r.exitCode).toBe(1);
    expect(r.output).toBe('mkdir: missing operand');
  });

  it('rejects nested paths (flat + 1 level VFS)', () => {
    const r = executeBuiltin(engine, 'mkdir', ['a/b']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toBe(
      "mkdir: cannot create directory 'a/b': only one level of nesting is supported",
    );
  });

  it('errors when the entry already exists', () => {
    executeBuiltin(engine, 'mkdir', ['src']);
    const r = executeBuiltin(engine, 'mkdir', ['src']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toBe("mkdir: cannot create directory 'src': File exists");
  });

  it('errors when a file with the same name exists', () => {
    engine.getVFS().createFile('src', 'i am a file');
    const r = executeBuiltin(engine, 'mkdir', ['src']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toBe("mkdir: cannot create directory 'src': File exists");
  });

  it('routes through the shell router and enables touch into it', () => {
    const router = new ShellRouter(engine);
    expect(router.execute('mkdir lib').exitCode).toBe(0);
    expect(router.execute('touch lib/util.js').exitCode).toBe(0);
    expect(executeBuiltin(engine, 'ls', ['lib']).output).toContain('util.js');
  });
});
```

Append to `tests/shell/parser.test.ts` inside its existing top-level `describe` (match surrounding style — it tests `parseInput` from `$shell/parser`):

```ts
it('classifies mkdir as a builtin', () => {
  const p = parseInput('mkdir src');
  expect(p).toEqual({ type: 'builtin', command: 'mkdir', args: ['src'] });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/shell`
Expected: the new `mkdir` tests FAIL — `parseInput('mkdir src')` returns `{ type: 'unknown', ... }` and `executeBuiltin` returns `mkdir: command not found` (exit 127).

- [ ] **Step 3: Implement**

`src/shell/parser.ts:1` — add `'mkdir'`:

```ts
const BUILTINS = new Set(['ls', 'cat', 'touch', 'mkdir', 'rm', 'mv', 'clear', 'help', 'echo']);
```

`src/shell/builtins.ts` — insert a new case directly after the `touch` case (after its closing `}`):

```ts
    case 'mkdir': {
      if (args.length === 0) {
        return { output: 'mkdir: missing operand', exitCode: 1 };
      }
      const raw = args[0];
      const name = raw.endsWith('/') ? raw.slice(0, -1) : raw;
      if (name.includes('/')) {
        return {
          output: `mkdir: cannot create directory '${raw}': only one level of nesting is supported`,
          exitCode: 1,
        };
      }
      if (vfs.exists(name + '/') || vfs.exists(name)) {
        return { output: `mkdir: cannot create directory '${raw}': File exists`, exitCode: 1 };
      }
      vfs.createDir(name);
      return { output: '', exitCode: 0 };
    }
```

`src/shell/builtins.ts` help case — insert after the `touch` help line (`'    touch <file>      — create file …'`):

```ts
        '    mkdir <dir>       — create a folder (one level max)',
```

`src/shell/complete.ts` — add `'mkdir'` to both top-level command lists:

Line 49: `const TOP_LEVEL_PREINIT = ['git', 'ls', 'cat', 'touch', 'mkdir', 'rm', 'mv', 'clear', 'help'];`
Line 107: `const allCommands = ['git', 'ls', 'cat', 'touch', 'mkdir', 'rm', 'mv', 'clear', 'help'];`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/shell` then `npm run typecheck && npm run lint`
Expected: all PASS, no type/lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/shell/parser.ts src/shell/builtins.ts src/shell/complete.ts tests/shell/builtins.test.ts tests/shell/parser.test.ts
git commit -m "feat(shell): add mkdir builtin"
```

---

### Task 2: File-status model — `src/store/files.ts`

**Files:**
- Create: `src/store/files.ts`
- Test: `tests/store/files.test.ts` (new directory — Vitest picks up everything outside `tests/e2e`)

**Interfaces:**
- Consumes: `engine`, `engineVersion` writables from `$store/engine`; `GitEngine` getters `getVFS()`, `getUntrackedFiles()`, `getModifiedFiles()`, `getStagedFiles()`, `getDeletedFiles()` (all safe pre-init: `getCommittedTree()` returns an empty map with no HEAD).
- Produces (Tasks 3–4 rely on these exact names):

```ts
export type FileStatus = 'untracked' | 'modified' | 'staged' | 'deleted' | 'clean';
export type TreeEntry = { path: string; name: string; dir: string | null; status: FileStatus };
export type FileTreeModel = { dirs: Array<{ name: string; files: TreeEntry[] }>; rootFiles: TreeEntry[] };
export function buildFileTree(eng: GitEngine): FileTreeModel;
export const fileTree: Readable<FileTreeModel>;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/store/files.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { buildFileTree } from '$store/files';

let engine: GitEngine;

beforeEach(() => {
  engine = new GitEngine();
  engine.execute('git init');
});

function flat(engine: GitEngine) {
  const t = buildFileTree(engine);
  return [...t.dirs.flatMap((d) => d.files), ...t.rootFiles];
}

describe('buildFileTree', () => {
  it('returns an empty model for an empty VFS (hides .git)', () => {
    const t = buildFileTree(engine);
    expect(t.rootFiles).toEqual([]);
    expect(t.dirs).toEqual([]);
  });

  it('marks a new file untracked', () => {
    engine.getVFS().createFile('a.txt', 'hi');
    expect(flat(engine)).toEqual([
      { path: 'a.txt', name: 'a.txt', dir: null, status: 'untracked' },
    ]);
  });

  it('marks an added file staged', () => {
    engine.getVFS().createFile('a.txt', 'hi');
    engine.execute('git add a.txt');
    expect(flat(engine)[0].status).toBe('staged');
  });

  it('marks a committed file clean, then modified after an edit', () => {
    engine.getVFS().createFile('a.txt', 'hi');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "add"');
    expect(flat(engine)[0].status).toBe('clean');

    engine.getVFS().createFile('a.txt', 'hi\nedited');
    expect(flat(engine)[0].status).toBe('modified');
  });

  it('modified wins over staged when a staged file is re-edited', () => {
    engine.getVFS().createFile('a.txt', 'v1');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "v1"');
    engine.getVFS().createFile('a.txt', 'v2');
    engine.execute('git add a.txt'); // staged
    engine.getVFS().createFile('a.txt', 'v3'); // re-edited after staging
    expect(flat(engine)[0].status).toBe('modified');
  });

  it('keeps a deleted tracked file visible with status deleted', () => {
    engine.getVFS().createFile('a.txt', 'hi');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "add"');
    engine.getVFS().deleteFile('a.txt');
    expect(flat(engine)).toEqual([
      { path: 'a.txt', name: 'a.txt', dir: null, status: 'deleted' },
    ]);
  });

  it('groups directory files under dirs, root files under rootFiles', () => {
    engine.getVFS().createDir('src');
    engine.getVFS().createFile('src/app.js', 'x');
    engine.getVFS().createFile('README.md', 'x');
    const t = buildFileTree(engine);
    expect(t.dirs).toEqual([
      {
        name: 'src',
        files: [{ path: 'src/app.js', name: 'app.js', dir: 'src', status: 'untracked' }],
      },
    ]);
    expect(t.rootFiles.map((f) => f.path)).toEqual(['README.md']);
  });

  it('lists an empty directory with zero files', () => {
    engine.getVFS().createDir('empty');
    const t = buildFileTree(engine);
    expect(t.dirs).toEqual([{ name: 'empty', files: [] }]);
  });

  it('still shows the parent dir of a deleted file even if the dir was removed', () => {
    engine.getVFS().createDir('src');
    engine.getVFS().createFile('src/app.js', 'x');
    engine.execute('git add src/app.js');
    engine.execute('git commit -m "add"');
    engine.getVFS().deleteFile('src/app.js');
    engine.getVFS().deleteFile('src/'); // dir entry removed too
    const t = buildFileTree(engine);
    expect(t.dirs).toEqual([
      {
        name: 'src',
        files: [{ path: 'src/app.js', name: 'app.js', dir: 'src', status: 'deleted' }],
      },
    ]);
  });

  it('sorts dirs and files alphabetically', () => {
    engine.getVFS().createDir('zeta');
    engine.getVFS().createDir('alpha');
    engine.getVFS().createFile('b.txt', 'x');
    engine.getVFS().createFile('a.txt', 'x');
    const t = buildFileTree(engine);
    expect(t.dirs.map((d) => d.name)).toEqual(['alpha', 'zeta']);
    expect(t.rootFiles.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
  });

  it('works before git init (all files untracked)', () => {
    const fresh = new GitEngine();
    fresh.getVFS().createFile('a.txt', 'hi');
    expect(flat(fresh)[0].status).toBe('untracked');
  });
});
```

Note: `vfs.deleteFile('src/')` works because VFS stores dir entries under the `"src/"` key and `deleteFile` only checks key existence.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/store`
Expected: FAIL — `Cannot find module '$store/files'` (or equivalent resolve error).

- [ ] **Step 3: Implement `src/store/files.ts`**

```ts
import { derived } from 'svelte/store';
import type { GitEngine } from '$engine/index';
import { engine, engineVersion } from './engine';

export type FileStatus = 'untracked' | 'modified' | 'staged' | 'deleted' | 'clean';

export type TreeEntry = {
  path: string; // full VFS path, e.g. "src/app.js"
  name: string; // display name, e.g. "app.js"
  dir: string | null; // parent dir, or null for root (VFS is flat + 1 level)
  status: FileStatus;
};

export type FileTreeModel = {
  dirs: Array<{ name: string; files: TreeEntry[] }>;
  rootFiles: TreeEntry[];
};

/**
 * Pure derivation of the explorer model from engine state.
 * One badge per file; precedence: deleted > modified > staged > untracked.
 * Deleted-but-tracked files stay visible (struck through in the UI) until
 * the deletion is committed. `.git` is never shown.
 */
export function buildFileTree(eng: GitEngine): FileTreeModel {
  const vfs = eng.getVFS();
  const deleted = new Set(eng.getDeletedFiles());
  const modified = new Set(eng.getModifiedFiles());
  const staged = new Set(eng.getStagedFiles());
  const untracked = new Set(eng.getUntrackedFiles());

  const statusOf = (path: string): FileStatus => {
    if (deleted.has(path)) return 'deleted';
    if (modified.has(path)) return 'modified';
    if (staged.has(path)) return 'staged';
    if (untracked.has(path)) return 'untracked';
    return 'clean';
  };

  const toEntry = (path: string): TreeEntry => {
    const slash = path.indexOf('/');
    return {
      path,
      name: slash === -1 ? path : path.slice(slash + 1),
      dir: slash === -1 ? null : path.slice(0, slash),
      status: statusOf(path),
    };
  };

  // Live files plus tracked-but-deleted paths; the two sets are disjoint.
  const entries = [...vfs.allFilePaths(), ...deleted]
    .filter((p) => p !== '.git' && !p.startsWith('.git/'))
    .map(toEntry);

  // Dirs come from the VFS root listing; a deleted file may reference a dir
  // the VFS no longer has, so union in parents from the entries as well.
  const dirNames = new Set(
    vfs
      .listDir()
      .filter((e) => e.endsWith('/') && !e.startsWith('.'))
      .map((e) => e.slice(0, -1)),
  );
  for (const e of entries) {
    if (e.dir !== null) dirNames.add(e.dir);
  }

  const byName = (a: TreeEntry, b: TreeEntry) => a.name.localeCompare(b.name);
  return {
    dirs: [...dirNames].sort().map((name) => ({
      name,
      files: entries.filter((e) => e.dir === name).sort(byName),
    })),
    rootFiles: entries.filter((e) => e.dir === null).sort(byName),
  };
}

/** Live explorer model — recomputed after every executed command. */
export const fileTree = derived([engine, engineVersion], ([$engine]) => buildFileTree($engine));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/store` then `npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 5: Amend the spec's interface note and commit**

In `docs/specs/2026-07-11-beginner-file-explorer-design.md`, replace the two-line code block

```ts
export function buildFileTree(engine: GitEngine): TreeEntry[]; // pure fn
export const fileTree = derived([engine, engineVersion], ...); // thin wrapper
```

with

```ts
export type FileTreeModel = { dirs: { name: string; files: TreeEntry[] }[]; rootFiles: TreeEntry[] };
export function buildFileTree(engine: GitEngine): FileTreeModel; // pure fn
export const fileTree = derived([engine, engineVersion], ...); // thin wrapper
```

```bash
git add src/store/files.ts tests/store/files.test.ts docs/specs/2026-07-11-beginner-file-explorer-design.md
git commit -m "feat(store): derived file-tree model with git status per file"
```

---

### Task 3: Explorer component + layout integration (desktop)

**Files:**
- Create: `src/ui/FileTree.svelte`
- Modify: `src/ui/Layout.svelte`
- Modify: `docs/specs/2026-07-11-beginner-file-explorer-design.md` (staged badge cyan → blue, one word)

No headless test — this repo has no Svelte component test setup; behavior is covered by the Task 6 e2e spec. Verify via typecheck/lint and `npm run dev` smoke check.

**Interfaces:**
- Consumes: `fileTree`, `TreeEntry` from `$store/files`; `prefillTerminal` from `$store/ui`.
- Produces: `<FileTree />` component; an `<aside aria-label="File explorer">` landmark; per-file buttons carrying `data-status="<status>"` (Task 6 selects on this). Two header action buttons exist but are inert until Task 4 wires them (render them disabled with `title="coming in the next step"` for now — Task 4 replaces this).

- [ ] **Step 1: Create `src/ui/FileTree.svelte`**

```svelte
<script lang="ts">
  import { fileTree } from '$store/files';
  import type { FileStatus, TreeEntry } from '$store/files';
  import { prefillTerminal } from '$store/ui';

  // Per-dir collapse is throwaway view state — component-local, not persisted.
  let collapsedDirs = $state(new Set<string>());

  function toggleDir(name: string) {
    const next = new Set(collapsedDirs);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    collapsedDirs = next;
  }

  const BADGE: Record<Exclude<FileStatus, 'clean'>, { label: string; cls: string; title: string }> = {
    untracked: { label: 'U', cls: 'text-terminal-green', title: 'untracked — new file; stage it with git add' },
    modified: { label: 'M', cls: 'text-terminal-yellow', title: 'modified — changed since last commit; stage it with git add' },
    staged: { label: '●', cls: 'text-terminal-blue', title: 'staged — ready for git commit' },
    deleted: { label: 'D', cls: 'text-terminal-red', title: 'deleted — removed from the working directory' },
  };

  const hasFiles = $derived(
    $fileTree.rootFiles.length > 0 || $fileTree.dirs.some((d) => d.files.length > 0),
  );
</script>

{#snippet fileRow(f: TreeEntry, indented: boolean)}
  <button
    class="flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left hover:bg-terminal-dim/15 transition-colors {indented ? 'pl-6' : ''}"
    data-status={f.status}
    disabled={f.status === 'deleted'}
    onclick={() => prefillTerminal(`cat ${f.path}`)}
    title={f.status === 'clean' ? 'unchanged since last commit' : BADGE[f.status].title}
  >
    <span
      class="truncate {f.status === 'deleted'
        ? 'line-through text-terminal-dim'
        : f.status === 'clean'
          ? 'text-terminal-dim'
          : 'text-terminal-fg'}">{f.name}</span
    >
    {#if f.status !== 'clean'}
      <span class="shrink-0 pl-2 {BADGE[f.status].cls}">{BADGE[f.status].label}</span>
    {/if}
  </button>
{/snippet}

<aside
  class="flex h-full w-[230px] shrink-0 flex-col border-r border-terminal-dim/30 bg-terminal-bg font-mono text-xs"
  aria-label="File explorer"
>
  <div class="px-3 py-2 tracking-widest text-terminal-dim select-none">EXPLORER</div>

  <div class="flex flex-col gap-1 px-2 pb-2">
    <button
      class="rounded border border-terminal-dim/40 px-2 py-1 text-terminal-fg hover:border-terminal-dim/70 hover:bg-terminal-dim/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      disabled
      title="coming in the next step">＋ Example files</button
    >
    <button
      class="rounded border border-terminal-dim/40 px-2 py-1 text-terminal-fg hover:border-terminal-dim/70 hover:bg-terminal-dim/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      disabled
      title="coming in the next step">✎ Simulate changes</button
    >
  </div>

  <div class="flex-1 overflow-y-auto px-2 pb-2">
    {#if !hasFiles}
      <p class="px-1.5 py-4 text-terminal-dim">
        No files yet — click ＋ Example files, or type <code class="text-terminal-fg">touch &lt;name&gt;</code> in the terminal.
      </p>
    {:else}
      {#each $fileTree.dirs as d (d.name)}
        <button
          class="flex w-full items-center rounded px-1.5 py-0.5 text-left text-terminal-fg hover:bg-terminal-dim/15 transition-colors"
          onclick={() => toggleDir(d.name)}
          aria-expanded={!collapsedDirs.has(d.name)}
        >
          <span class="pr-1 text-terminal-dim">{collapsedDirs.has(d.name) ? '▸' : '▾'}</span>
          {d.name}/
        </button>
        {#if !collapsedDirs.has(d.name)}
          {#each d.files as f (f.path)}
            {@render fileRow(f, true)}
          {/each}
        {/if}
      {/each}
      {#each $fileTree.rootFiles as f (f.path)}
        {@render fileRow(f, false)}
      {/each}
    {/if}
  </div>

  <div class="border-t border-terminal-dim/30 px-3 py-2 text-[10px] text-terminal-dim select-none">
    <span class="text-terminal-green">U</span> new ·
    <span class="text-terminal-yellow">M</span> modified ·
    <span class="text-terminal-blue">●</span> staged ·
    <span class="text-terminal-red">D</span> deleted
  </div>
</aside>
```

- [ ] **Step 2: Integrate into `src/ui/Layout.svelte`**

Wrap the existing content in a flex row: the sidebar sits left; everything that exists today (absolute-positioned Reset/logo/GitHub link, graph, terminal) moves into a `relative` right-hand column so the absolute overlays keep anchoring correctly.

Replace the whole file with:

```svelte
<script lang="ts">
  import Terminal from './Terminal.svelte';
  import Graph from './Graph.svelte';
  import ResetButton from './ResetButton.svelte';
  import GithubLink from './GithubLink.svelte';
  import FileTree from './FileTree.svelte';
</script>

<div class="flex w-full h-full bg-terminal-bg">
  <div class="max-sm:hidden h-full">
    <FileTree />
  </div>

  <div class="relative flex flex-col flex-1 min-w-0 h-full">
    <!-- Reset: top-left. GitHub link: top-right corner. Logo sits between them
         (just left of the link on desktop / top-center on mobile). -->
    <div class="absolute top-3 left-4 z-20">
      <ResetButton />
    </div>

    <!-- GitHub source link: top-right corner, above the decorative logo -->
    <div class="absolute top-3 right-4 z-20">
      <GithubLink />
    </div>

    <!-- Desktop: top-right, offset left so it clears the GitHub link button -->
    <pre
      class="absolute top-3 right-16 z-10 font-mono text-terminal-dim/80 text-xs leading-tight select-none pointer-events-none max-sm:hidden">{` ██████╗ ██╗████████╗██╗   ██╗███████╗██████╗ ███████╗███████╗
██╔════╝ ██║╚══██╔══╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
██║  ███╗██║   ██║   ██║   ██║█████╗  ██████╔╝███████╗█████╗
██║   ██║██║   ██║   ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝
╚██████╔╝██║   ██║    ╚████╔╝ ███████╗██║  ██║███████║███████╗
 ╚═════╝ ╚═╝   ╚═╝     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝`}</pre>
    <!-- Mobile: centered -->
    <pre
      class="absolute top-2 left-1/2 -translate-x-1/2 z-10 font-mono text-terminal-dim/80 text-[5px] leading-tight select-none pointer-events-none sm:hidden">{` ██████╗ ██╗████████╗██╗   ██╗███████╗██████╗ ███████╗███████╗
██╔════╝ ██║╚══██╔══╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
██║  ███╗██║   ██║   ██║   ██║█████╗  ██████╔╝███████╗█████╗
██║   ██║██║   ██║   ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝
╚██████╔╝██║   ██║    ╚████╔╝ ███████╗██║  ██║███████║███████╗
 ╚═════╝ ╚═╝   ╚═╝     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝`}</pre>

    <!-- Graph: top section -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <Graph />
    </div>

    <!-- Terminal: bottom section -->
    <div
      class="h-[40vh] max-sm:h-[45vh] shrink-0 border-t border-terminal-dim/30 overflow-hidden"
      style="background-color: rgba(13, 17, 23, 0.95);"
    >
      <Terminal />
    </div>
  </div>
</div>
```

(Mobile keeps the explorer hidden for now; Task 5 adds the drawer toggle.)

- [ ] **Step 3: Amend the spec's badge color**

In `docs/specs/2026-07-11-beginner-file-explorer-design.md`, change

`  - \`●\` staged — cyan (git's "ready" color in the existing prompt)`

to

`  - \`●\` staged — blue (theme cyan is visually identical to green, so blue disambiguates from U)`

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (no unit tests touch the component; this guards regressions).
Then: `npm run dev`, open the app — sidebar renders with the empty-state hint; `touch a.txt` in the terminal makes `a.txt U` appear instantly; clicking it prefills `cat a.txt` with focus in the terminal input.

- [ ] **Step 5: Commit**

```bash
git add src/ui/FileTree.svelte src/ui/Layout.svelte docs/specs/2026-07-11-beginner-file-explorer-design.md
git commit -m "feat(ui): IDE-style file explorer sidebar with live git status badges"
```

---

### Task 4: Action planners + wire the buttons

**Files:**
- Create: `src/store/actions.ts`
- Modify: `src/ui/FileTree.svelte` (enable the two buttons)
- Test: `tests/store/actions.test.ts`

**Interfaces:**
- Consumes: `GitEngine` getters (`getVFS()`, `getCommittedTree()`, `getStagedFiles()`); `executeCommand`, `engine` from `$store/engine`; `fileTree` model from Task 2.
- Produces:

```ts
export function exampleFileCommands(eng: GitEngine): string[]; // idempotent seed plan
export function simulateChangeCommands(eng: GitEngine): string[]; // echo-append plan, [] when nothing tracked
```

- [ ] **Step 1: Write the failing tests**

Create `tests/store/actions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { ShellRouter } from '$shell/router';
import { exampleFileCommands, simulateChangeCommands } from '$store/actions';

let engine: GitEngine;
let router: ShellRouter;

function run(cmd: string) {
  const r = router.execute(cmd);
  expect(r.exitCode, `command failed: ${cmd} → ${r.output}`).toBe(0);
}

beforeEach(() => {
  engine = new GitEngine();
  router = new ShellRouter(engine);
  engine.execute('git init');
});

describe('exampleFileCommands', () => {
  it('plans the full starter set on an empty VFS', () => {
    expect(exampleFileCommands(engine)).toEqual([
      'mkdir src',
      'touch README.md',
      'touch index.html',
      'touch src/app.js',
    ]);
  });

  it('planned commands all execute successfully through the router', () => {
    for (const cmd of exampleFileCommands(engine)) run(cmd);
    expect(engine.getVFS().allFilePaths()).toEqual(['README.md', 'index.html', 'src/app.js'].sort());
  });

  it('is idempotent — skips whatever already exists', () => {
    for (const cmd of exampleFileCommands(engine)) run(cmd);
    expect(exampleFileCommands(engine)).toEqual([]);
  });

  it('skips only the existing pieces', () => {
    run('mkdir src');
    run('touch README.md');
    expect(exampleFileCommands(engine)).toEqual(['touch index.html', 'touch src/app.js']);
  });
});

describe('simulateChangeCommands', () => {
  it('returns [] when nothing is tracked', () => {
    engine.getVFS().createFile('a.txt', 'hi'); // untracked
    expect(simulateChangeCommands(engine)).toEqual([]);
  });

  it('targets the first two tracked files alphabetically', () => {
    for (const f of ['b.txt', 'a.txt', 'c.txt']) {
      run(`touch ${f}`);
      run(`git add ${f}`);
    }
    run('git commit -m "seed"');
    const cmds = simulateChangeCommands(engine);
    expect(cmds).toHaveLength(2);
    expect(cmds[0]).toMatch(/^echo ".+" >> a\.txt$/);
    expect(cmds[1]).toMatch(/^echo ".+" >> b\.txt$/);
  });

  it('includes staged-but-uncommitted files as tracked', () => {
    run('touch a.txt');
    run('git add a.txt');
    expect(simulateChangeCommands(engine)).toHaveLength(1);
  });

  it('skips tracked files deleted from the VFS', () => {
    run('touch a.txt');
    run('git add a.txt');
    run('git commit -m "seed"');
    engine.getVFS().deleteFile('a.txt');
    expect(simulateChangeCommands(engine)).toEqual([]);
  });

  it('planned commands execute and dirty the file', () => {
    run('touch a.txt');
    run('git add a.txt');
    run('git commit -m "seed"');
    for (const cmd of simulateChangeCommands(engine)) run(cmd);
    expect(engine.getModifiedFiles()).toEqual(['a.txt']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/store`
Expected: FAIL — cannot resolve `$store/actions`.

- [ ] **Step 3: Implement `src/store/actions.ts`**

```ts
import type { GitEngine } from '$engine/index';

/**
 * Command planners for the explorer's beginner buttons. Pure: they only READ
 * engine state and return shell command strings; the caller dispatches them
 * through executeCommand() so every action echoes in the terminal.
 */

const EXAMPLE_FILES = ['README.md', 'index.html', 'src/app.js'];

/** Seed a tiny starter project. Idempotent: existing pieces are skipped. */
export function exampleFileCommands(eng: GitEngine): string[] {
  const vfs = eng.getVFS();
  const cmds: string[] = [];
  if (!vfs.exists('src/')) cmds.push('mkdir src');
  for (const f of EXAMPLE_FILES) {
    if (!vfs.exists(f)) cmds.push(`touch ${f}`);
  }
  return cmds;
}

const CHANGE_LINES = [
  'fix typo',
  'add TODO note',
  'update docs',
  'tweak wording',
  'refactor helper',
];
// Module counter (not Math.random) so output is deterministic and testable.
let changeCounter = 0;

/**
 * Append a realistic line to the first two tracked files (committed or
 * staged, alphabetical, still present in the VFS). Empty when nothing
 * qualifies — the UI disables the button in that case.
 */
export function simulateChangeCommands(eng: GitEngine): string[] {
  const vfs = eng.getVFS();
  const tracked = new Set([...eng.getCommittedTree().keys(), ...eng.getStagedFiles()]);
  return [...tracked]
    .filter((p) => vfs.exists(p))
    .sort()
    .slice(0, 2)
    .map((p) => `echo "${CHANGE_LINES[changeCounter++ % CHANGE_LINES.length]}" >> ${p}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/store`
Expected: PASS.

- [ ] **Step 5: Wire the buttons in `src/ui/FileTree.svelte`**

Add to the `<script>` block:

```ts
  import { get } from 'svelte/store';
  import { engine, executeCommand } from '$store/engine';
  import { exampleFileCommands, simulateChangeCommands } from '$store/actions';

  const hasTracked = $derived(
    [...$fileTree.rootFiles, ...$fileTree.dirs.flatMap((d) => d.files)].some(
      (f) => f.status !== 'untracked',
    ),
  );

  function createExamples() {
    for (const cmd of exampleFileCommands(get(engine))) executeCommand(cmd);
  }

  function simulateChanges() {
    for (const cmd of simulateChangeCommands(get(engine))) executeCommand(cmd);
  }
```

Replace the two disabled placeholder buttons with:

```svelte
    <button
      class="rounded border border-terminal-dim/40 px-2 py-1 text-terminal-fg hover:border-terminal-dim/70 hover:bg-terminal-dim/10 transition-colors"
      onclick={createExamples}
      title="create README.md, index.html and src/app.js via touch/mkdir">＋ Example files</button
    >
    <button
      class="rounded border border-terminal-dim/40 px-2 py-1 text-terminal-fg hover:border-terminal-dim/70 hover:bg-terminal-dim/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      onclick={simulateChanges}
      disabled={!hasTracked}
      title={hasTracked
        ? 'append a line to tracked files so there is something to git add'
        : 'commit a file first — nothing is tracked yet'}>✎ Simulate changes</button
    >
```

- [ ] **Step 6: Verify and commit**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS.
Smoke (`npm run dev`): click ＋ Example files → four commands scroll through the terminal and the tree fills with `U` badges; ✎ stays disabled until a commit exists.

```bash
git add src/store/actions.ts tests/store/actions.test.ts src/ui/FileTree.svelte
git commit -m "feat(ui): example-files and simulate-changes buttons driving real commands"
```

---

### Task 5: Sidebar collapse (desktop) + drawer (mobile)

**Files:**
- Modify: `src/store/ui.ts`
- Modify: `src/ui/FileTree.svelte`
- Modify: `src/ui/Layout.svelte`

**Interfaces:**
- Consumes: nothing new.
- Produces: `explorerOpen: Writable<boolean>` in `$store/ui` (default `true`); `toggleExplorer(): void`. Desktop: collapsed sidebar shrinks to a slim rail. Mobile: sidebar renders as an overlay drawer; a `📁` button (aria-label "Toggle file explorer", `sm:hidden`) sits next to Reset.

- [ ] **Step 1: Add the store flag — `src/store/ui.ts`**

Append:

```ts
// Whether the file explorer sidebar is expanded (desktop) / open (mobile drawer).
export const explorerOpen = writable(true);

export function toggleExplorer(): void {
  explorerOpen.update((v) => !v);
}
```

- [ ] **Step 2: Collapse behavior in `src/ui/FileTree.svelte`**

Add imports: `import { explorerOpen, toggleExplorer } from '$store/ui';` (merge into the existing `$store/ui` import line).

Wrap the template: when `$explorerOpen` is false render only the rail; the header gets a collapse chevron. Replace the `<aside …>` opening block and header with:

```svelte
{#if $explorerOpen}
  <aside
    class="flex h-full w-[230px] shrink-0 flex-col border-r border-terminal-dim/30 bg-terminal-bg font-mono text-xs max-sm:absolute max-sm:inset-y-0 max-sm:left-0 max-sm:z-30 max-sm:shadow-2xl"
    aria-label="File explorer"
  >
    <div class="flex items-center justify-between px-3 py-2 select-none">
      <span class="tracking-widest text-terminal-dim">EXPLORER</span>
      <button
        class="rounded px-1 text-terminal-dim hover:text-terminal-fg transition-colors"
        onclick={toggleExplorer}
        aria-label="Collapse file explorer">«</button
      >
    </div>
    <!-- …everything else unchanged… -->
  </aside>
{:else}
  <div class="flex h-full w-9 shrink-0 flex-col items-center border-r border-terminal-dim/30 bg-terminal-bg pt-2 max-sm:hidden">
    <button
      class="rounded px-1 font-mono text-terminal-dim hover:text-terminal-fg transition-colors"
      onclick={toggleExplorer}
      aria-label="Expand file explorer">»</button
    >
  </div>
{/if}
```

- [ ] **Step 3: Mobile toggle + drawer host in `src/ui/Layout.svelte`**

The sidebar wrapper changes from `max-sm:hidden` to always-rendered (FileTree itself now handles both modes), and mobile gets a toggle button. In Layout:

- Change the sidebar wrapper to: `<div class="h-full max-sm:contents"><FileTree /></div>`
- Default `explorerOpen` must start CLOSED on small screens: in `Layout.svelte`'s script, add

```ts
  import { explorerOpen, toggleExplorer } from '$store/ui';
  import { onMount } from 'svelte';

  onMount(() => {
    if (window.matchMedia('(max-width: 639px)').matches) {
      explorerOpen.set(false);
    }
  });
```

- Add the mobile toggle next to the Reset button block:

```svelte
    <div class="absolute top-3 left-4 z-20 flex items-center gap-2">
      <ResetButton />
      <button
        class="sm:hidden rounded-lg border border-terminal-dim/40 bg-terminal-bg/80 px-3 py-1.5 font-mono text-xs text-terminal-dim hover:text-terminal-fg hover:border-terminal-dim/70 transition-colors backdrop-blur"
        onclick={toggleExplorer}
        aria-label="Toggle file explorer">📁</button
      >
    </div>
```

(The rail's `max-sm:hidden` means a closed drawer leaves no residue on mobile; the open drawer overlays the graph at `z-30` and the same `«` chevron closes it.)

- [ ] **Step 4: Verify and commit**

Run: `npm run test && npm run typecheck && npm run lint`
Smoke (`npm run dev`): desktop `«`/`»` collapses/expands; DevTools mobile viewport shows the 📁 toggle and drawer.

```bash
git add src/store/ui.ts src/ui/FileTree.svelte src/ui/Layout.svelte
git commit -m "feat(ui): explorer collapse rail and mobile drawer toggle"
```

---

### Task 6: E2E flow + docs

**Files:**
- Create: `tests/e2e/file-explorer.spec.ts`
- Modify: `CLAUDE.md` (project structure: `FilePanel.svelte` → `FileTree.svelte`; add `store/files.ts`, `store/actions.ts`, `mkdir` to builtins line)

**Interfaces:**
- Consumes: `data-status` attributes and `aria-label="File explorer"` from Task 3; button names from Tasks 3–5.

- [ ] **Step 1: Write the e2e spec**

Create `tests/e2e/file-explorer.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// Clear persisted state so each test starts from the welcome screen
// (same rationale as tests/e2e/a11y.spec.ts).
test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => {
    try {
      indexedDB.deleteDatabase('keyval-store');
    } catch {
      // ignore – storage may be unavailable in some environments
    }
  });
  await page.goto('./');
});

test('explorer drives the full beginner flow: seed → stage → commit → modify', async ({
  page,
}) => {
  const input = page.locator('#terminal-input');
  const explorer = page.getByRole('complementary', { name: 'File explorer' });

  // Empty state + disabled simulate button.
  await expect(explorer.getByText(/No files yet/)).toBeVisible();
  await expect(explorer.getByRole('button', { name: /Simulate changes/ })).toBeDisabled();

  // Seed example files; the real commands echo in the terminal.
  await explorer.getByRole('button', { name: /Example files/ }).click();
  await expect(explorer.getByRole('button', { name: 'README.md U' })).toBeVisible();
  await expect(explorer.getByText('src/')).toBeVisible();
  await expect(explorer.locator('[data-status="untracked"]')).toHaveCount(3);
  await expect(page.getByText('mkdir src')).toBeVisible();

  // init + stage all → badges flip to staged.
  await input.click();
  await input.fill('git init');
  await input.press('Enter');
  await input.fill('git add .');
  await input.press('Enter');
  await expect(explorer.locator('[data-status="staged"]')).toHaveCount(3);
  await expect(explorer.locator('[data-status="untracked"]')).toHaveCount(0);

  // Commit → everything clean; simulate becomes enabled.
  await input.fill('git commit -m "first"');
  await input.press('Enter');
  await expect(explorer.locator('[data-status="clean"]')).toHaveCount(3);
  const simulate = explorer.getByRole('button', { name: /Simulate changes/ });
  await expect(simulate).toBeEnabled();

  // Simulate changes → first two files alphabetically become modified.
  await simulate.click();
  await expect(explorer.locator('[data-status="modified"]')).toHaveCount(2);

  // Clicking a file prefills cat without executing.
  await explorer.getByRole('button', { name: /^README\.md/ }).click();
  await expect(input).toHaveValue('cat README.md');
  await expect(input).toBeFocused();
});

test('explorer collapses to a rail and expands again', async ({ page }) => {
  await expect(page.getByRole('complementary', { name: 'File explorer' })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse file explorer' }).click();
  await expect(page.getByRole('complementary', { name: 'File explorer' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand file explorer' }).click();
  await expect(page.getByRole('complementary', { name: 'File explorer' })).toBeVisible();
});
```

Note on the `'README.md U'` locator: a button's accessible name concatenates its text content (`README.md` + badge `U`) — this asserts name and badge in one go. If the accessible name computes differently, fall back to `explorer.locator('[data-status="untracked"]', { hasText: 'README.md' })`.

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e`
Expected: new spec PASSES; the pre-existing `a11y.spec.ts` must still pass — it axe-scans the initial view, which now includes the sidebar (this is the accessibility gate for the new UI).

- [ ] **Step 3: Update CLAUDE.md**

In the Project Structure block: replace `│   ├── FilePanel.svelte` with `│   ├── FileTree.svelte`; add `│   ├── files.ts` + `│   ├── actions.ts` under `store/`; in Key Design Decisions replace the "Simulate Changes button/command" wording if stale. In the builtins line of the structure comment (`ls, cat, touch, rm, mv, clear, help`) add `mkdir`.

- [ ] **Step 4: Full verification**

Run: `npm run test && npm run typecheck && npm run lint && npm run test:e2e`
Expected: everything green.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/file-explorer.spec.ts CLAUDE.md
git commit -m "test(e2e): file explorer beginner flow; docs: sync CLAUDE.md structure"
```

---

### Task 7: Release prep (RC bump)

Per the project release flow (CLAUDE.md): `feat:` commits → preminor.

- [ ] **Step 1: Bump RC version**

```bash
npm version preminor --preid=rc   # 0.8.0 → 0.9.0-rc.0
git push -u origin feat/beginner-file-explorer --follow-tags
```

- [ ] **Step 2: Open PR to main**

Title: `feat: beginner-friendly file explorer with live git status`. On merge, `deploy.yml` strips the RC suffix, tags `v0.9.0`, and deploys.
