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

File builtins: `ls` `cat` `touch` `rm` `mv` `clear` `help` `sim change`

## Features

- **Live SVG graph** — left-to-right DAG, d3-dag layout, animated transitions
- **Terminal emulator** — history (Up/Down/Ctrl+R), tab autocomplete, ghost text suggestions
- **Powerlevel10k prompt** — branch name, status icons, file counts (A/M/?/D)
- **Three-area model** — working dir, staging index, committed tree all tracked
- **Commit detail popover** — hash, message, parents, changed files
- **Focus toggle** — graph-focused or terminal-focused layout (60/40 split)
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
│   ├── builtins.ts   # ls, cat, touch, rm, mv, clear, help, sim
│   ├── history.ts    # Command history + Ctrl+R search
│   ├── complete.ts   # Tab autocomplete
│   └── prompt.ts     # Powerlevel10k-style prompt
├── ui/               # Svelte 5 components
│   ├── Terminal.svelte
│   ├── Graph.svelte
│   ├── CommitDetail.svelte
│   ├── Layout.svelte
│   └── Prompt.svelte
├── graph/            # d3-dag layout logic
├── store/            # Svelte stores (engine + UI state)
├── persistence/      # IndexedDB save/load + serialization
├── App.svelte
└── main.ts
tests/
├── engine/           # 9 test files — headless engine tests
├── shell/            # 4 test files — parser, router, builtins, prompt
├── graph/            # Layout computation tests
└── persistence/      # Serialization tests
```

## Design Decisions

- **No shell emulation** — curated git commands + minimal file builtins only
- **Simulated file changes** — no text editing; `sim change` mutates tracked files
- **Flat VFS** — files + one directory level max
- **Left-to-right DAG** — mermaid gitGraph style, SVG rendered, d3-dag layout
- **Layered UI** — graph background, semi-transparent terminal overlay
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
- **release.yml** — RC → stable version bump + tag push on PR merge
- **deploy.yml** — production deploy to GitHub Pages on stable `v*` tag push

## Numbers

| Metric            | Count  |
| ----------------- | ------ |
| Source lines      | ~4,800 |
| Test lines        | ~3,500 |
| Git commands      | 17     |
| File builtins     | 8      |
| Svelte components | 5      |
| Total commits     | 64     |

## License

MIT
