# CLAUDE.md

## Project Overview

Gitverse is a realistic, browser-based git sandbox with live DAG visualization. It simulates the full three-area git model (working directory → staging index → committed tree) with a virtual file system, rendered as an interactive SVG graph. Pure sandbox — no tutorials or levels.

**Design spec:** `docs/specs/2026-05-27-gitverse-design.md`

## Architecture

Three-module separation:

- **Git Engine** (`src/engine/`) — pure TypeScript, zero DOM deps. VFS + git object model + command processor. Testable headless.
- **Shell** (`src/shell/`) — command routing, file builtins (ls/cat/touch/rm/mv), history, autocomplete, powerlevel10k-style prompt.
- **Renderer** (`src/ui/`) — Svelte 5 components. SVG graph + terminal UI + file panel. Layered layout with focus toggle.

Engine emits state → Renderer subscribes. Shell dispatches → Engine processes.

## Tech Stack

| Layer         | Choice                   | Version         |
| ------------- | ------------------------ | --------------- |
| Framework     | Svelte 5                 | 5.55.9          |
| Language      | TypeScript (strict)      | 6.0.3           |
| Styling       | UnoCSS                   | 66.7.0          |
| Visualization | SVG + d3-dag             | 1.2.1           |
| Build         | Vite                     | 8.0.14          |
| PWA           | vite-plugin-pwa          | 1.3.0           |
| Testing       | Vitest + Playwright      | 4.1.7 / 1.60.0  |
| Deploy        | Cloudflare Workers       | wrangler 4.95.0 |
| Storage       | IndexedDB via idb-keyval | 6.2.4           |

## Commands

```bash
# Development
npm install
npm run dev              # Vite dev server

# Build
npm run build            # Production build

# Testing
npm run test             # Vitest unit/integration
npm run test:e2e         # Playwright e2e
npm run typecheck        # TypeScript check

# Linting
npm run lint             # ESLint
npm run format           # Prettier

# Deploy (via CI on v* tag push, or manual)
npx wrangler deploy
```

## Project Structure

```
src/
├── engine/           # Pure TS git engine (zero DOM deps)
│   ├── vfs.ts        # Virtual file system
│   ├── objects.ts    # Blob, Tree, Commit types & store
│   ├── refs.ts       # Branch, Tag, HEAD management
│   ├── index.ts      # GitEngine orchestrator
│   ├── diff.ts       # Simulated diff generation
│   └── commands/     # One file per git command
├── shell/            # Command routing + builtins
│   ├── parser.ts     # Input tokenization
│   ├── router.ts     # Git vs builtin dispatch
│   ├── builtins.ts   # ls, cat, touch, rm, mv, clear, help, sim
│   ├── history.ts    # Command history
│   ├── complete.ts   # Tab autocomplete
│   └── prompt.ts     # Powerlevel10k-style prompt
├── ui/               # Svelte 5 components
│   ├── Terminal.svelte
│   ├── Graph.svelte
│   ├── FilePanel.svelte
│   ├── Layout.svelte
│   ├── Prompt.svelte
│   ├── CommitDetail.svelte
│   └── MobileToolbar.svelte
├── graph/            # D3 layout logic
├── store/            # Svelte stores
├── persistence/      # IndexedDB save/load
├── App.svelte
└── main.ts
tests/
├── engine/           # Headless engine tests
├── shell/            # Parser/router tests
└── e2e/              # Playwright browser tests
```

## Key Design Decisions

- **No shell emulation** — terminal handles git commands + minimal file builtins only
- **Simulated file changes** — no text editing; "Simulate Changes" button/command mutates tracked files
- **Flat + 1 level VFS** — files and one level of directories max
- **Left-to-right DAG** — mermaid gitGraph style, SVG rendered by Svelte, d3-dag for layout
- **Layered UI** — graph as background, terminal as semi-transparent overlay, toggle focus
- **Safe keyboard shortcuts only** — skip Ctrl+W/N/T/Q (browser intercepts), use Alt+Backspace for delete-word
- **Local-only v1** — no remote operations (push/pull/fetch), deferred to v2

## Testing Conventions

- Engine tests run headless — no DOM, no Svelte, pure TypeScript
- Shell tests verify parsing, routing, and builtin behavior
- E2E tests use Playwright for full browser interaction
- All git commands should have corresponding engine tests

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint + typecheck + test on every push/PR
- **Release** (`.github/workflows/release.yml`): on PR merge to main, auto-bumps RC → stable and deploys
- **Deploy** (`.github/workflows/deploy.yml`): build + deploy to Cloudflare Workers on `v*` tag push
- GitHub Actions pinned to SHA for security

## Release Flow

**Always bump an RC version before creating a PR to main.** The release workflow only triggers auto-deploy when it detects an RC version (e.g. `v0.3.0-rc.0`). On PR merge, it strips the RC suffix, tags stable (`v0.3.0`), and deploys.

```bash
# Before opening PR — scan commits for bump type:
# feat: → preminor, fix:/chore: → prepatch, BREAKING: → premajor
npm version preminor --preid=rc   # e.g. 0.3.0 → 0.4.0-rc.0
git push --follow-tags
# Then open PR. On merge, release.yml bumps to 0.4.0 and deploys.
```

## Deployment

- Cloudflare Workers with static asset hosting
- Config: `wrangler.jsonc` (JSONC format, not TOML)
- SPA routing via `not_found_handling: "single-page-application"`
- Requires `CLOUDFLARE_API_TOKEN` repository secret
