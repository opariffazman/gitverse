# Gitverse

Browser-based git sandbox. Live DAG visualization. Full three-area model (working dir → staging index → committed tree). Virtual file system, interactive SVG graph. No tutorials, no levels — pure sandbox.

**Stack:** Svelte 5 · TypeScript (strict) · UnoCSS · d3-dag · Vite · GitHub Pages

## What It Does

Type git commands in terminal. Watch graph update in real time. Entire git workflow simulated in browser — branching, merging, rebasing, cherry-picking, stashing, reverting. All local, all visual.

Three-module architecture:

```
Engine (pure TS) ← Shell (router) ← Renderer (Svelte 5)
```

- **Engine** — zero DOM deps. VFS + git object model + command processor. Testable headless.
- **Shell** — command routing, file builtins, history, tab autocomplete, powerlevel10k-style prompt.
- **Renderer** — Svelte 5 components. SVG graph + terminal UI + file panel.

## Git Commands

17 commands implemented:

| Category | Commands                                                                                  |
| -------- | ----------------------------------------------------------------------------------------- |
| Core     | `git init` `git add` `git commit` `git status` `git log` `git diff`                       |
| Branch   | `git branch` `git checkout` `git switch`                                                  |
| Advanced | `git merge` `git rebase` `git reset` `git stash` `git tag` `git cherry-pick` `git revert` |
| File     | `git rm` `git mv`                                                                         |

File builtins: `ls` `cat` `touch` `echo` `rm` `mv` `clear` `help`

`echo text > file` (overwrite) and `echo text >> file` (append) simulate file content changes — the modify counterpart to `touch`.

Common shorthands work too: `git commit -am`, `git switch -c <name>` / `git checkout -c`, `git add -A` / `-u`, and clustered short flags (`-am` = `-a -m`).

## Features

- **Live SVG graph** — left-to-right DAG, d3-dag layout, animated transitions
- **Pan + zoom** — drag to pan, wheel/pinch to zoom, no scrollbars. Follow-HEAD camera tracks the tip; `recenter` snaps back, `fit` frames the whole tree
- **Click a node** — drops `git checkout Cx` into the terminal (you press Enter). Terminal stays the only place commands run
- **Terminal** — history (Up/Down/Ctrl+R), tab autocomplete, ghost-text suggestions, context-aware placeholder
- **Contextual hints** — dim nudges when stuck (no repo, nothing staged, unknown command) + one-time onboarding tips after `git init` and the first commit
- **Accessibility (WCAG 2.1 AA)** — keyboard graph nav (Tab + arrows), screen-reader live regions, labeled input, reduced-motion support
- **Powerlevel10k prompt** — branch name, status icons, file counts (A/M/?/D); detached HEAD shows friendly `Cx`
- **Three-area model** — working dir, staging index, committed tree all tracked
- **Rebase prime labels** — rewritten commits show `C2'` (same commit, new hash; stacks on repeat: `C2''`)
- **Commit detail popover** — hash, message, parents, changed files
- **Persistence** — auto-save to IndexedDB, multiple sandbox slots, export/import
- **PWA** — installable, works offline, service worker caching
- **Responsive** — desktop + mobile layouts

## Quick Start

```bash
npm install
npm run dev
```

Open browser. Type git commands. Watch graph grow.

## Scripts

```bash
npm run dev           # Vite dev server
npm run build         # Production build
npm run test          # Vitest unit/integration
npm run test:e2e      # Playwright e2e
npm run typecheck     # TypeScript check
npm run lint          # ESLint
npm run format        # Prettier
```

## Project Structure

```
src/
├── engine/           # Pure TS git engine (zero DOM deps)
│   ├── vfs.ts        # Virtual file system
│   ├── objects.ts    # Blob, Tree, Commit types & store
│   ├── refs.ts       # Branch, Tag, HEAD management
│   ├── index.ts      # GitEngine orchestrator
│   ├── diff.ts       # Diff generation
│   └── commands/     # 17 git commands, one file each
├── shell/            # Command routing + builtins
│   ├── parser.ts     # Input tokenization
│   ├── router.ts     # Git vs builtin dispatch
│   ├── builtins.ts   # ls, cat, touch, echo, rm, mv, clear, help
│   ├── history.ts    # Command history + Ctrl+R search
│   ├── complete.ts   # Tab autocomplete
│   └── prompt.ts     # Powerlevel10k-style prompt
├── ui/               # Svelte 5 components
│   ├── Terminal.svelte
│   ├── Graph.svelte
│   ├── CommitDetail.svelte
│   ├── Layout.svelte
│   ├── Prompt.svelte
│   └── ResetButton.svelte
├── graph/            # d3-dag layout + pan/zoom viewport math
├── store/            # Svelte stores (engine + UI state)
├── persistence/      # IndexedDB save/load + serialization
├── App.svelte
└── main.ts
tests/
├── engine/           # 16 test files — headless engine tests
├── shell/            # 5 test files — parser, router, builtins, echo, prompt
├── graph/            # layout + pan/zoom viewport tests
├── store/            # store behavior tests
├── e2e/              # Playwright + axe-core a11y / interaction tests
└── persistence/      # serialization tests
```

## Design Decisions

- **No shell emulation** — curated git commands + minimal file builtins only
- **Simulated file changes** — no text editor; `touch` creates, `echo text > file` / `>> file` writes/appends content
- **Graph suggests, terminal executes** — clicking a node prefills `git checkout`, never auto-runs; one execution surface
- **Git-accurate** — `commit -a`/`-am` stage tracked changes only (never untracked); hints point you to `git add` for new files
- **Accessible by default** — WCAG 2.1 AA: keyboard graph nav, screen-reader live regions, reduced-motion
- **Flat VFS** — files + one directory level max
- **Left-to-right DAG** — mermaid gitGraph style, SVG rendered, d3-dag layout, pan/zoom viewport
- **Safe shortcuts** — skips Ctrl+W/N/T/Q (browser intercepts), Alt+Backspace for delete-word
- **Local-only v1** — no remote ops (push/pull/fetch), deferred to v2

## Tech

| Layer         | Choice                 | Version        |
| ------------- | ---------------------- | -------------- |
| Framework     | Svelte 5               | 5.55.9         |
| Language      | TypeScript (strict)    | 6.0.3          |
| Styling       | UnoCSS                 | 66.7.0         |
| Visualization | SVG + d3-dag           | 1.2.1          |
| Build         | Vite                   | 8.0.14         |
| PWA           | vite-plugin-pwa        | 1.3.0          |
| Testing       | Vitest + Playwright    | 4.1.7 / 1.60.0 |
| Deploy        | GitHub Pages           | actions v4     |
| Storage       | IndexedDB (idb-keyval) | 6.2.4          |

## Deploy

Runs on GitHub Pages. Deployed automatically via CI.

**Setup:** enable GitHub Pages on repo → source: `gh-pages` branch.

CI/CD:

- **ci.yml** — lint + typecheck + test on every push/PR
- **preview.yml** — PR preview deploy to GitHub Pages (`/pr-preview/pr-N/`), auto-cleanup on close
- **deploy.yml** — on PR merge: bump RC → stable, build, deploy to GitHub Pages

## Numbers

| Metric            | Count  |
| ----------------- | ------ |
| Source lines      | ~4,800 |
| Test lines        | ~3,500 |
| Git commands      | 17     |
| File builtins     | 8      |
| Svelte components | 6      |
| Total commits     | 165    |

## License

MIT
