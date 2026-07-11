# Gitverse — Beginner-Friendly File Explorer

**Date:** 2026-07-11
**Repo:** `opariffazman/gitverse`
**Status:** Draft
**Goal:** Make Gitverse approachable for git beginners: a live IDE-style file
tree, one-click example files, and minimal visual cues that teach the
working → staged → committed model.

---

## 1. Overview

Three additions, all UI/shell layer — **zero engine changes** (every needed
query already exists: `getVFS().listDir()`, `getUntrackedFiles()`,
`getModifiedFiles()`, `getStagedFiles()`, `getDeletedFiles()`):

1. **Live file explorer** — a persistent left sidebar (VS Code style) showing
   the virtual file system with per-file git status badges, updating after
   every command.
2. **"＋ Example files" button** — seeds a tiny starter project by running
   real `mkdir`/`touch` commands *through the terminal*, so the beginner sees
   exactly what happened and can repeat it by hand.
3. **"✎ Simulate changes" button** — appends a line to tracked files via
   `echo "…" >> <file>` (already supported), so there is always something to
   `git add` / `git commit`. Fulfils the "Simulate Changes" item from the
   original design spec that was never built.

### Layout (user-approved)

```
┌──────────┬──────────────────────────────┐
│ EXPLORER │                              │
│ + Example│        GRAPH (DAG)           │
│──────────│                              │
│ ▾ src/   │                              │
│   app.js U                              │
│ README M ├──────────────────────────────┤
│ index  ● │  $ git add .                 │
│          │  $ git commit -m "..."       │
│ U=new    │       TERMINAL               │
└──────────┴──────────────────────────────┘
```

Sidebar ≈ 230px on desktop, collapsible. On mobile (`max-sm`) it is hidden
behind a toggle button (drawer over the graph) so the terminal keeps priority.

### Non-Goals

- No in-browser text editing of file contents (design decision: simulated
  changes only).
- No tutorials/levels — the explorer is passive; it visualizes, never blocks.
- No engine API changes.

---

## 2. Derived file-status store — `src/store/files.ts`

Pure derivation, headless-testable:

```ts
export type FileStatus = 'untracked' | 'modified' | 'staged' | 'deleted' | 'clean';
export type TreeEntry = {
  path: string;          // full VFS path, e.g. "src/app.js"
  name: string;          // display name, e.g. "app.js"
  dir: string | null;    // parent dir or null for root (VFS is flat + 1 level)
  status: FileStatus;
};

export type FileTreeModel = { dirs: { name: string; files: TreeEntry[] }[]; rootFiles: TreeEntry[] };
export function buildFileTree(engine: GitEngine): FileTreeModel; // pure fn
export const fileTree = derived([engine, engineVersion], ...); // thin wrapper
```

**Status precedence** (one badge per file, beginner-simple):
`deleted` > `modified` > `staged` > `untracked` > `clean`.
A file both staged and re-modified shows `M` — the working-tree change is
what the beginner must act on next, matching VS Code's single-letter habit.

Deleted files still appear in the tree (name struck through, `D` badge) until
the deletion is committed — they come from `getDeletedFiles()`, not the VFS.

Directories come from `listDir()` root markers (`"src/"`); entries are grouped
dirs-first, then root files, both alphabetical.

---

## 3. Explorer component — `src/ui/FileTree.svelte`

- Header `EXPLORER` + two action buttons (section 4).
- Folder rows toggle collapse (`▾`/`▸`); default expanded. Collapse state is
  local component state — not persisted.
- File row: icon-less name + colored badge letter, matching the existing
  terminal palette:
  - `U` untracked — green
  - `M` modified — yellow
  - `●` staged — cyan (git's "ready" color in the existing prompt)
  - `D` deleted — red, name struck through
  - clean — dim, no badge
- Badge `title` tooltip spells it out (e.g. "modified — not staged").
- **Click a file** → `prefillTerminal('cat <path>')` (reuses the mechanism
  Graph already uses): input is pre-filled + focused, user presses Enter.
  Teaches the command instead of hiding it.
- **Empty state:** when the VFS has no files, show a short centered hint:
  "No files yet — click ＋ Example files, or type `touch <name>`".
- **Legend:** one dim line pinned at the bottom:
  `U new · M modified · ● staged · D deleted`.

### Layout.svelte changes

Root becomes a horizontal flex: `<FileTree/>` (shrink-0, `w-[230px]`,
`max-sm:hidden` + drawer toggle) beside the existing graph/terminal column.
A collapse chevron in the sidebar header shrinks it to a slim rail; a mobile
toggle button (top-left, next to Reset) opens it as an overlay drawer.

---

## 4. Action buttons

Both buttons pipe **real commands through `executeCommand()`** so every action
is visible and replayable in the terminal.

**＋ Example files** — runs, in order:

```
mkdir src
touch README.md
touch index.html
touch src/app.js
```

(`touch` already auto-generates plausible content per file type.)
Skips files that already exist (checked via VFS before dispatch) so the button
is idempotent. Enabled always — works before or after `git init`.

**✎ Simulate changes** — picks the first 2 tracked files (committed or
staged, alphabetical, still present in the VFS) and runs
`echo "<change line>" >> <file>` for each, cycling through a small fixed set
of realistic lines ("fix typo", "add TODO note", …) with a module counter —
no randomness. Disabled (with tooltip "commit a file first") when nothing is
tracked.

### New builtin: `mkdir`

`src/shell/builtins.ts` gains `mkdir <name>` → `vfs.createDir(name)`, with the
same error style as the other builtins: missing operand → exit 1; nested path
(`a/b`) rejected per the flat+1-level VFS rule; existing entry →
`mkdir: cannot create directory '<name>': File exists` (exit 1, real-shell
semantics). Added to `help` output and tab-completion.

---

## 5. Testing

- **Unit (headless):** `tests/engine`-style tests for `buildFileTree` —
  status precedence, dir grouping, deleted-file visibility;
  `mkdir` builtin behavior (creates dir, rejects `a/b`, duplicate errors with
  "File exists").
- **E2E (Playwright):** one flow — click ＋ Example files → tree shows 3 files
  + `src/` with `U` badges → `git init`, `git add .` → badges flip to `●` →
  `git commit` → badges clear → click ✎ Simulate changes → `M` appears →
  click a file → terminal input pre-filled with `cat <path>`.

---

## 6. Release

Feature branch → RC bump (`npm version preminor --preid=rc`) → PR → merge
deploys per the standard flow. `feat:` commits → preminor.
