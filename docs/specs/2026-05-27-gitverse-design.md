# Gitverse — Design Spec

**Date:** 2026-05-27
**Repo:** `opariffazman/gitverse`
**Status:** Draft

---

## 1. Overview

Gitverse is a realistic, browser-based git sandbox with live DAG visualization. Unlike learnGitBranching (which abstracts away the working directory, staging area, and file system entirely), Gitverse simulates the full three-area git model: working directory → staging index → committed tree. No tutorials or hand-holding — pure sandbox.

### Goals

- Realistic git command execution with simulated file system
- Live left-to-right branch visualization (mermaid gitGraph style)
- PWA with full offline support, installable on mobile
- Responsive desktop and mobile UI
- Serverless deployment on Cloudflare Workers

### Non-Goals (v1)

- Remote operations (push/pull/fetch/clone) — deferred to v2
- Guided tutorials or level system — pure sandbox
- Real file content editing — file mutations are simulated
- Full shell emulation — only curated file commands + git

---

## 2. Architecture

Three-module separation (Approach B):

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Git Engine  │◄────│    Shell    │◄────│  Renderer   │
│  (pure TS)   │────►│  (router)   │────►│  (Svelte 5) │
└─────────────┘     └─────────────┘     └─────────────┘
```

- **Git Engine** — pure TypeScript, zero DOM dependencies. Virtual file system + git object model + command processor. Fully testable headless.
- **Shell** — command routing layer. Parses input, dispatches git commands to engine, handles file builtins (ls, cat, touch, rm, mv). Manages history, autocomplete, prompt generation.
- **Renderer** — Svelte 5 components. Reads engine state reactively, renders SVG graph + terminal UI. Handles layout, focus toggle, animations.

Engine exposes state via `subscribe(listener)` pattern. Shell dispatches commands, engine processes them and emits state changes, renderer re-renders.

---

## 3. Git Engine

### 3.1 Virtual File System (VFS)

In-memory file tree. Flat structure with one level of directory nesting max.

```typescript
type FileEntry = {
  content: string;
  type: 'file' | 'dir';
};

// Storage: Map<string, FileEntry>
// Paths: "readme.md", "src/index.js", "src/" (dir marker)
```

Operations: `createFile`, `readFile`, `deleteFile`, `moveFile`, `listDir`, `exists`.

File content is auto-generated placeholder text. No free-form editing — mutations happen via "Simulate Changes" UI button or `sim change [file]` command, which randomly alters tracked file content to produce diffs.

### 3.2 Git Object Model

```typescript
type Blob = {
  hash: string;      // short hash, e.g. "a1b2c3d"
  content: string;
};

type Tree = {
  hash: string;
  entries: Map<string, string>; // filename → blob hash
};

type Commit = {
  hash: string;
  tree: string;       // tree hash
  parents: string[];   // parent commit hashes
  message: string;
  timestamp: number;
};

type Ref = {
  name: string;        // "main", "feat/login", "v1.0"
  target: string;      // commit hash
  type: 'branch' | 'tag';
};

type HEAD = {
  attached: boolean;
  target: string;      // branch name (attached) or commit hash (detached)
};
```

Content-addressable storage: hash derived from content (simplified, not real SHA-1). Short 7-char hashes for display.

### 3.3 Three-Area Model

```
Working Directory (VFS)  →  Staging Index  →  Committed Tree
       ↕ git add              ↕ git commit
       ↕ git checkout         ↕ git reset
```

- **Working Directory** — current VFS state
- **Staging Index** — `Map<path, blobHash>` of files staged for next commit
- **Committed Tree** — tree object pointed to by HEAD's commit

`git status` diffs all three areas to show untracked, modified, staged files.
`git diff` shows simulated diffs between areas.

### 3.4 Supported Commands (v1)

| Command | Behavior |
|---|---|
| `git init` | Initialize repo state (auto-runs on sandbox creation) |
| `git add <path>` / `git add .` | Stage files from working directory to index |
| `git commit -m "msg"` | Create commit from index |
| `git status` | Diff working/index/HEAD, show file states |
| `git log [--oneline] [--graph]` | Traverse and display commit DAG |
| `git diff` | Show simulated diffs (working vs index vs HEAD) |
| `git branch` / `git branch <name>` | List/create/delete branches |
| `git checkout <branch/commit>` / `git switch` | Move HEAD, update working directory |
| `git merge <branch>` | Three-way merge with simulated conflict markers |
| `git rebase <branch>` | Replay commits onto target |
| `git reset --soft/--mixed/--hard` | Move HEAD, optionally reset index/working dir |
| `git stash` / `git stash pop/list/drop` | Save/restore working state |
| `git tag <name> [commit]` | Create lightweight tags |
| `git rm <path>` | Remove from working directory and index |
| `git mv <old> <new>` | Rename/move file, update index |
| `git cherry-pick <commit>` | Apply specific commit to current branch |
| `git revert <commit>` | Create inverse commit |

Each command is a pure function: `(engine, args, opts) => CommandResult`.

```typescript
type CommandResult = {
  output: string;
  exitCode: number;
};
```

---

## 4. Shell Layer

### 4.1 File Builtins

Minimal set — no pipes, no redirection, no shell parsing. Pattern-matched commands.

| Command | Behavior |
|---|---|
| `ls [dir]` | List files in working directory or subdirectory |
| `cat <file>` | Print file content |
| `touch <file>` | Create empty file with auto-generated content |
| `rm <file>` | Delete file from working directory |
| `mv <src> <dst>` | Move/rename file in working directory |
| `clear` | Clear terminal output |
| `help` | List available commands |
| `sim change [file]` | Simulate modifications to tracked file(s). Outputs which file was changed and what kind of change (line added/removed/modified). If no file specified, picks a random tracked file. |

### 4.2 Command Router

```
User input
  → parse(input)
  → starts with "git " ? → GitEngine.execute(cmd, args, opts)
  → matches builtin?     → Shell.executeBuiltin(cmd, args)
  → else                 → "command not found: <cmd>"
```

### 4.3 Prompt (Powerlevel10k Style)

Colored, segment-based prompt reflecting repo state:

```
~/gitverse  main ✓ $                     ← clean repo (green branch)
~/gitverse  main ✗ [2M 1?] $            ← dirty (yellow branch)
~/gitverse  feat/login [1A 3M] $        ← staged + modified counts
~/gitverse  (a1b2c3d) $                 ← detached HEAD (red)
```

**Segments:**
- **Path** — `~/gitverse`, dimmed/muted color
- **Branch icon** — `` (git branch symbol)
- **Branch name** — colored by state:
  - Green: clean working tree
  - Yellow: dirty working tree (unstaged changes)
  - Red: detached HEAD
- **Clean/dirty indicator** — `✓` (green) or `✗` (red)
- **File counts** (when dirty) — `A`=staged (green), `M`=modified (red), `?`=untracked (grey), `D`=deleted (red)

Implemented as styled `<span>` elements with UnoCSS classes. No terminal escape codes.

### 4.4 Command History

- Stores last 100 commands in array
- Up/Down arrow navigation through history
- `Ctrl+R` reverse incremental search
- Persisted in IndexedDB alongside sandbox state

### 4.5 Tab Autocomplete

- Git subcommands: `git ch<tab>` → `checkout`, `cherry-pick`
- Branch names: `git checkout f<tab>` → `feat/login`
- File paths: `git add s<tab>` → `src/`
- Single match auto-fills, multiple matches show option list

---

## 5. Visualization (SVG Git Graph)

### 5.1 Layout

Left-to-right DAG rendering, mermaid gitGraph style:

- **X-axis** = commit order (topological sort, left=oldest, right=newest)
- **Y-axis** = branch swim lanes (each branch gets a fixed horizontal lane)
- **Commits** = colored circles with short hash label inside/below
- **Branch labels** = colored pills at branch tip commit
- **HEAD** = bold outline or arrow indicator on current commit
- **Edges** = curved SVG paths connecting parent→child, colored per branch
- **Merge commits** = two incoming edges from different lanes
- **Tags** = small label attached to tagged commit

### 5.2 Tech

- SVG elements rendered by Svelte components (not raw D3 DOM manipulation)
- `d3-dag` (1.2.1) for Sugiyama layered layout algorithm (topological ordering, lane assignment, edge routing)
- Svelte's fine-grained reactivity ensures only changed nodes/edges re-render

### 5.3 Animations

- CSS transitions on SVG `transform` and `opacity` attributes
- New commit: slides in from right with fade-in
- Branch pointer move: smooth translate to new commit
- Merge edge: draws in with path animation
- Rebase: commits fade out from old position, fade in at new position

### 5.4 Interaction

- Click commit node → popover showing commit details (hash, message, parent(s), files changed)
- Click branch label → equivalent to `git checkout <branch>`
- Pannable and zoomable via SVG `viewBox` manipulation (mouse drag + wheel on desktop, touch pinch/pan on mobile)

---

## 6. UI Layout & Focus System

### 6.1 Layered Design

Two layers, always both rendered:

1. **Background layer** — git graph SVG, full viewport
2. **Foreground layer** — terminal panel, semi-transparent overlay

Focus toggle swaps which layer is primary:

- **Terminal focused** (default): terminal is large centered panel (~70% viewport), dark background at ~85% opacity with `backdrop-filter: blur(8px)`. Graph visible but dimmed behind.
- **Graph focused**: terminal shrinks to bottom-right corner (compact, ~20% viewport). Graph brightens to full opacity. Terminal still functional in compact mode.

Toggle via button. Small pill-shaped button in terminal title bar: `[Graph]` / `[Terminal]`.

### 6.2 Desktop Layout

```
┌──────────────────────────────────────────────────────┐
│  ░░░░░░░░ GIT GRAPH (dimmed background) ░░░░░░░░░░  │
│  ░░░░░┌──────────────────────────────────┐░░░░░░░░░  │
│  ░░░░░│  FILES  [+ New] [~ Changes]     │░░░░░░░░░  │
│  ░░░░░│  readme.md ● | app.js ✓         │░░░░░░░░░  │
│  ░░░░░├──────────────────────────────────┤░░░░░░░░░  │
│  ░░░░░│ ~/gitverse  main ✗ [1M] $      │░░░░░░░░░  │
│  ░░░░░│ $ git status                    │░░░░░░░░░  │
│  ░░░░░│ $ git add .                     │░░░░░░░░░  │
│  ░░░░░│ $ git commit -m "feat"   [Graph]│░░░░░░░░░  │
│  ░░░░░│ ~/gitverse  main ✓ $ █         │░░░░░░░░░  │
│  ░░░░░└──────────────────────────────────┘░░░░░░░░░  │
└──────────────────────────────────────────────────────┘
```

### 6.3 Mobile Layout

- Terminal overlay takes ~90% viewport height
- File panel is a collapsible horizontal toolbar above terminal input
- Toggle button: small floating pill, top-right
- Graph focused mode: terminal collapses to single input line pinned at bottom, graph takes full screen

### 6.4 File Panel

Integrated into terminal panel (not a separate sidebar):

- Horizontal bar above terminal output showing files as chips/badges
- Each chip: filename + status icon (● modified, ✓ staged, ○ untracked, ✗ deleted)
- Color-coded: green=staged, red=modified, grey=untracked
- [+ New File] button → prompt for filename
- [~ Simulate Changes] button → mutate random tracked file
- Tap/click file chip → modal with file content or diff view

---

## 7. Keyboard Shortcuts

Safe terminal shortcuts only (no browser-intercepted keys):

| Shortcut | Action |
|---|---|
| `Up` / `Down` | Navigate command history |
| `Tab` | Autocomplete |
| `Ctrl+C` | Cancel/interrupt current input |
| `Ctrl+L` | Clear terminal |
| `Ctrl+A` | Move cursor to start of line |
| `Ctrl+E` | Move cursor to end of line |
| `Ctrl+U` | Clear line before cursor |
| `Ctrl+K` | Clear line after cursor |
| `Ctrl+R` | Reverse search history |
| `Alt+Backspace` | Delete word backward (replaces Ctrl+W) |

**Excluded** (browser intercepts): `Ctrl+W`, `Ctrl+N`, `Ctrl+T`, `Ctrl+Q`.

App-level shortcuts (toggle focus, undo, export) deferred to v2.

---

## 8. PWA & Persistence

### 8.1 PWA Configuration

- `vite-plugin-pwa` (1.3.0) with Workbox `generateSW` strategy
- Precache all static assets at install time
- `prompt` update strategy — user controls when new versions load
- Manifest:
  - `display: "standalone"`
  - `theme_color` / `background_color` matching terminal dark theme
  - App icons at 192px and 512px
  - `name: "Gitverse"`, `short_name: "Gitverse"`

### 8.2 Persistence (IndexedDB)

Storage via `idb-keyval` (6.2.4):

- **Auto-save** full engine state after every command execution
- **State blob** contents:
  - VFS snapshot (all files and content)
  - Git object store (blobs, trees, commits)
  - Refs (branches, tags, HEAD)
  - Staging index
  - Command history
- **Multiple sandbox slots** — save/load/delete named sandboxes
- **Export** — serialize state as JSON, encode into shareable URL fragment
- **Import** — decode URL fragment, restore full sandbox state
- **"New Sandbox"** button — reset to clean initialized repo

---

## 9. Tech Stack (Pinned Versions)

### 9.1 Dependencies

| Package | Version | Purpose |
|---|---|---|
| `svelte` | `5.55.9` | UI framework |
| `@sveltejs/vite-plugin-svelte` | `7.1.2` | Vite integration |
| `d3-dag` | `1.2.1` | DAG layout algorithms |
| `d3-hierarchy` | `3.1.2` | Tree layout utilities |
| `idb-keyval` | `6.2.4` | IndexedDB wrapper |
| `unocss` | `66.7.0` | Atomic CSS engine |

### 9.2 Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vite` | `8.0.14` | Build tool |
| `typescript` | `6.0.3` | Type system |
| `vitest` | `4.1.7` | Unit/integration tests |
| `@playwright/test` | `1.60.0` | E2E browser tests |
| `eslint` | `10.4.0` | Linter |
| `prettier` | `3.8.3` | Formatter |
| `prettier-plugin-svelte` | `4.0.1` | Svelte formatting |
| `eslint-plugin-svelte` | `3.17.1` | Svelte linting |
| `vite-plugin-pwa` | `1.3.0` | PWA generation |
| `wrangler` | `4.95.0` | Cloudflare Workers CLI |
| `workbox-precaching` | `7.4.1` | Service worker caching |

### 9.3 GitHub Actions (SHA-Pinned)

| Action | SHA | Version |
|---|---|---|
| `actions/checkout` | `de0fac2e4500dabe0009e67214ff5f5447ce83dd` | v6.0.2 |
| `actions/setup-node` | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` | v6.4.0 |
| `cloudflare/wrangler-action` | `ebbaa1584979971c8614a24965b4405ff95890e0` | v4.0.0 |

---

## 10. CI/CD

### 10.1 CI — Every Push and PR

`.github/workflows/ci.yml`:

- Trigger: push to any branch, pull request to `main`
- Steps: checkout → setup Node (LTS) → install → lint → typecheck → test (Vitest)

### 10.2 Deploy — Version Tag Push

`.github/workflows/deploy.yml`:

- Trigger: push tags matching `v*`
- Steps: checkout → setup Node (LTS) → install → lint → typecheck → test → build → deploy via `wrangler-action`
- Requires `CLOUDFLARE_API_TOKEN` repository secret

---

## 11. Project Structure

```
gitverse/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── src/
│   ├── engine/               ← Pure TS git engine (zero DOM deps)
│   │   ├── vfs.ts            ← Virtual file system
│   │   ├── objects.ts        ← Blob, Tree, Commit types & store
│   │   ├── refs.ts           ← Branch, Tag, HEAD management
│   │   ├── index.ts          ← GitEngine orchestrator
│   │   ├── diff.ts           ← Simulated diff generation
│   │   └── commands/         ← One file per git command
│   │       ├── add.ts
│   │       ├── commit.ts
│   │       ├── branch.ts
│   │       ├── checkout.ts
│   │       ├── merge.ts
│   │       ├── rebase.ts
│   │       ├── reset.ts
│   │       ├── stash.ts
│   │       ├── log.ts
│   │       ├── status.ts
│   │       ├── diff.ts
│   │       ├── tag.ts
│   │       ├── rm.ts
│   │       ├── mv.ts
│   │       ├── cherry-pick.ts
│   │       └── revert.ts
│   ├── shell/                ← Command routing + builtins
│   │   ├── parser.ts         ← Input tokenization
│   │   ├── router.ts         ← Git vs builtin dispatch
│   │   ├── builtins.ts       ← ls, cat, touch, rm, mv, clear, help, sim
│   │   ├── history.ts        ← Command history (100 entries)
│   │   ├── complete.ts       ← Tab autocomplete
│   │   └── prompt.ts         ← Powerlevel10k-style prompt generator
│   ├── ui/                   ← Svelte 5 components
│   │   ├── Terminal.svelte   ← Terminal emulator component
│   │   ├── Graph.svelte      ← SVG git graph
│   │   ├── FilePanel.svelte  ← File chips bar with status
│   │   ├── Layout.svelte     ← Focus toggle, layered layout
│   │   ├── Prompt.svelte     ← Colored prompt rendering
│   │   ├── CommitDetail.svelte ← Commit info popover
│   │   └── MobileToolbar.svelte ← Mobile-specific controls
│   ├── graph/                ← D3 layout logic
│   │   ├── layout.ts         ← DAG positioning via d3-dag
│   │   └── types.ts          ← Graph node/edge types
│   ├── store/                ← Svelte stores
│   │   ├── engine.ts         ← Reactive engine state wrapper
│   │   └── ui.ts             ← Focus mode, panel state
│   ├── persistence/          ← IndexedDB save/load
│   │   ├── storage.ts        ← idb-keyval wrapper
│   │   └── serializer.ts     ← Engine state ↔ JSON
│   ├── App.svelte
│   └── main.ts
├── tests/
│   ├── engine/               ← Headless engine tests
│   ├── shell/                ← Parser/router tests
│   └── e2e/                  ← Playwright browser tests
├── public/
│   ├── icons/                ← PWA icons (192, 512)
│   └── favicon.svg
├── wrangler.jsonc
├── vite.config.ts
├── uno.config.ts
├── tsconfig.json
├── eslint.config.js
├── .prettierrc
└── package.json
```

---

## 12. Future (v2+)

- Remote simulation (origin, push/pull/fetch/clone)
- `git reflog`
- Interactive rebase (`git rebase -i`)
- Challenge/level system (YAML-defined, inspired by cmdchallenge format)
- App-level keyboard shortcuts (Esc toggle, Ctrl+Z undo)
- Shareable sandbox URLs
- Themes (light mode, custom terminal colors)
- `git bisect`
- `git worktree`
