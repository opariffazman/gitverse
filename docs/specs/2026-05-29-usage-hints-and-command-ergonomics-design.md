# Gitverse — Usage Hints & Command Ergonomics

**Date:** 2026-05-29
**Repo:** `opariffazman/gitverse`
**Status:** Draft
**Branch:** `feat/a11y-usability-pass` (PR #13) — version stays `0.7.0-rc.0`

---

## 1. Overview

Two cohesive usability improvements:

1. **Discoverability hints** so new users understand the `touch → git add → git commit`
   workflow without having to run `help` (today the only signpost is the welcome
   banner; the "use `touch` to add files" hint is buried in `help`).
2. **Command ergonomics** — common git shorthands that currently fail: combined
   short flags (`-am`), `git commit -a`/`-am`, `git switch -c` / `git checkout -c`,
   and `git add -A` / `-u`.

### DRY/KISS decisions (from design self-review)

- **One staging helper.** `add .`, `add -A`, `add -u`, and `commit -a` all route
  through a single `stageWorkingTree(..., { includeUntracked })` helper. No
  duplicated staging logic. As a correctness side-effect, `add .` now also stages
  deletions (matching real git), making `.` and `-A` equivalent.
- **Dropped `switch -` / `checkout -`** (checkout previous branch). It alone would
  require `RefStore` previous-branch state + persistence serialization + a parser
  special-case for the lone `-` token — disproportionate for the value. `-c`
  (create+switch) is kept as a trivial `-b` alias.

### Non-Goals

- `switch -` / `checkout -` (previous branch) — deferred.
- Dismissible/remembered hint state — hints are always-on and lightweight.
- Quote-aware combined flags beyond standard `git` short-flag clustering.

---

## 2. Parser — combined short-flag splitting

`parseGitCommand` (`src/engine/index.ts`) currently stores each `-flag` token
verbatim, so `-am` becomes a single unknown key. Change: when a token matches
`^-[a-zA-Z]{2,}$` (single dash, two-plus letters — **not** `--long`), split it
into individual single-letter flags. The **last** letter receives the following
values; earlier letters get an empty array. `--hard`, `-m`, `-b` are unaffected.

Example: `git commit -am "msg"` tokenizes to `commit`, then `-am` "msg" →
`opts = { '-a': [], '-m': ['msg'] }`.

This is the single place flag clustering is handled; every command benefits.

---

## 3. Shared staging helper

New file `src/engine/commands/staging.ts`:

```ts
import type { VirtualFileSystem } from '../vfs';
import type { ObjectStore } from '../objects';

/**
 * Stage working-tree changes into the index.
 * - Always stages deletions (committed paths no longer present in the VFS are
 *   removed from the index).
 * - includeUntracked=true  → stage every VFS file (adds + modifications).
 * - includeUntracked=false → stage only tracked files (present in committedTree
 *   or already in index): modifications, not brand-new untracked files.
 */
export function stageWorkingTree(
  vfs: VirtualFileSystem,
  objects: ObjectStore,
  index: Map<string, string>,
  committedTree: Map<string, string>,
  opts: { includeUntracked: boolean },
): void {
  const isTracked = (p: string) => committedTree.has(p) || index.has(p);

  // Stage adds/modifications.
  for (const p of vfs.allFilePaths()) {
    if (!opts.includeUntracked && !isTracked(p)) continue;
    const blobHash = objects.writeBlob(vfs.readFile(p));
    index.set(p, blobHash);
  }

  // Stage deletions: tracked paths that no longer exist in the VFS.
  for (const p of [...index.keys()]) {
    if (!vfs.exists(p)) index.delete(p);
  }
}
```

(The deletion loop iterates the index — a tracked path absent from the VFS is a
deletion regardless of `includeUntracked`. New untracked files never enter the
index, so `includeUntracked=false` correctly leaves them alone.)

---

## 4. `git add -A` / `-u` (and `.` unification)

`src/engine/commands/add.ts` gains opts handling. Precedence for the "stage many"
case (when no explicit pathspec, or pathspec is `.`):

- `add .`  → `stageWorkingTree(..., { includeUntracked: true })`
- `add -A` → `stageWorkingTree(..., { includeUntracked: true })`
- `add -u` → `stageWorkingTree(..., { includeUntracked: false })`

`add <file>` (specific path) keeps its existing single-file staging. If `add` is
called with neither a pathspec nor `-A`/`-u`/`.`, keep the current
`"Nothing specified, nothing added."` error.

`committedTree` is already passed to `cmdAdd`; if undefined, treat as empty.

---

## 5. `git commit -a` / `-am`

In the commit path in `src/engine/index.ts execute()`: when `opts.has('-a')`,
call `stageWorkingTree(vfs, objects, index, committedTree, { includeUntracked: false })`
**before** invoking `cmdCommit`. `cmdCommit` is otherwise unchanged — it still
requires `-m` (so `git commit -a` with no message produces the existing
`-m` error, matching git's "switch requires a value" behavior for this sandbox).

This reuses the §3 helper (DRY) and keeps `cmdCommit` focused on committing.

---

## 6. `git switch -c` / `git checkout -c`

`src/engine/commands/checkout.ts`: treat `-c` as an alias for `-b`. Concretely,
the create-and-switch path triggers when `opts.has('-b') || opts.has('-c')`, and
the branch name is read from whichever of `-b` / `-c` is present. `switch` already
aliases `checkout`, so `git switch -c <name>` and `git checkout -c <name>` both
create and switch. Existing `-b` behavior is unchanged.

---

## 7. Discoverability hints

### 7a. Empty-graph state (`src/ui/Graph.svelte`)

Replace the bare `No commits yet` paragraph with a short, dim, monospace 3-step
guide:

```
No commits yet

 1. touch readme.md      create a file
 2. git add readme.md    stage it
 3. git commit -m "init" commit it
```

Plain text inside the existing empty-state container; no new interactivity.

### 7b. Terminal input placeholder (`src/ui/Terminal.svelte`)

Add a context-aware `placeholder` on the command input (shows only when the input
is empty, so it never collides with the ghost-completion overlay which appears
while typing):

- Not initialized → `type a command — try 'git init'`
- Initialized      → `type a command — try 'touch readme.md' or 'help'`

Derived from `engine.isInitialized()`. The placeholder text must use the dim
terminal color and meet the same AA contrast bar already applied in this branch.

### 7c. Smart error hints

Append a single dim hint line to three specific outcomes (kept targeted — not a
general suggestion engine):

| Trigger | Existing output | Appended hint |
| --- | --- | --- |
| `git commit` with nothing staged | `nothing to commit, working tree clean` | `hint: create or modify a file with touch, then git add` |
| Unknown command | `<cmd>: command not found` | `hint: type 'help' to see available commands` |
| Git command before init | `fatal: not a git repository …` | `hint: run 'git init' first` |

Implementation: add an optional `hint?: string` to `CommandResult`
(`src/engine/commands/types.ts`) and to the router's `ShellResult`
(`src/shell/router.ts`), propagated through each router case. Set `hint` at the
three sources (commit's nothing-to-commit return, the `index.ts` not-a-repo
guard, and the router's `unknown` case). `executeCommand` (`src/store/engine.ts`)
emits the hint as a **separate** terminal line with `color: 'dim'` after the
output line — so it renders dim regardless of whether the main output was an
error (red). Keeping `hint` separate from `output` also keeps the message and
the nudge independently testable.

---

## 8. Testing

### Engine units (headless)

- **Parser splitting** (via `engine.execute` behavior): `git commit -am "x"` on a
  staged-or-`-a` change creates a commit with message `x`; `-a -m "x"` equivalent.
- **`commit -a` / `-am`**: commit a file; modify its content; `git commit -am "m"`
  stages the modification and commits it; a brand-new untracked file is **not**
  swept in by `-a`.
- **`switch -c` / `checkout -c`**: creates and switches to the new branch; HEAD
  attached to it; existing `-b` still works.
- **`add -A`**: stages a deletion (tracked file removed from VFS → removed from
  index on commit). **`add -u`**: stages a tracked modification but not a new
  untracked file. **`add .`**: now also stages deletions (update any existing test
  that asserted the old behavior — this is an intentional correctness fix).
- **Error hints**: outputs for the three §7c triggers contain their hint text.

### E2E (Playwright, existing harness)

- Empty-graph guide renders the 3 steps before any commit.
- Input placeholder reflects init state (before/after `git init`).

---

## 9. Out of Scope / Future

- `switch -` / `checkout -` previous-branch navigation.
- Fuzzy "did you mean" command suggestions.
- Persisted/dismissible hint preferences.
