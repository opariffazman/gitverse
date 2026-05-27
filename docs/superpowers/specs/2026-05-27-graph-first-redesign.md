# Gitverse Graph-First Redesign

**Date:** 2026-05-27
**Approach:** Surgical Fixes + Layout Tweak (Approach A)

## 1. Bug Fixes

### 1a. Shell builtins bypass engine.notify()

**Problem:** `rm`, `touch`, `mv` in `src/shell/builtins.ts` mutate VFS directly but never call `engine.notify()`. UI doesn't re-render git status after these operations.

**Fix:** After every VFS-mutating builtin, call `engine.notify()` so subscribers (UI) re-query status.

**Files:** `src/shell/builtins.ts`

### 1b. git add . shows verbose output

**Problem:** `git add .` outputs a list of all files being staged. Real git is silent.

**Fix:** Return empty string from `git add .` and `git add <file>`.

**Files:** `src/engine/commands/add.ts`

## 2. Removals

### 2a. sim command

Remove the `sim change` command entirely:

- Delete handler from `src/shell/builtins.ts`
- Remove from help output in `src/shell/builtins.ts`
- Remove from autocomplete candidates in `src/shell/complete.ts`
- Delete associated tests

### 2b. FilePanel component

Delete `src/ui/FilePanel.svelte` entirely. Remove import and usage from `src/ui/Layout.svelte`. Users rely on prompt status indicators and `git status` command.

### 2c. MobileToolbar component

Delete `src/ui/MobileToolbar.svelte` entirely. Remove import and usage from `src/ui/Layout.svelte`. Mobile uses same docked terminal as desktop (40% instead of 30%).

### 2d. Overlay/opacity/blur system

Remove from `src/ui/Layout.svelte`:
- Opacity range slider
- Backdrop blur computation
- Focus toggle button and `focusMode` store usage
- All absolute positioning / overlay logic

## 3. Prompt Redesign

### Format

```
gitverse  main +1 ~2 ?3 ❯ 
```

### Segments (left to right)

| Segment | Content | Color | Condition |
|---------|---------|-------|-----------|
| Repo name | `gitverse` | dim grey | Always |
| Branch icon | `` (U+E0A0) | cyan | Always |
| Branch name | `main` / short hash | green=clean, yellow=dirty, red=detached | Always |
| Staged count | `+N` | green | Only if >0 |
| Modified count | `~N` | yellow | Only if >0 |
| Untracked count | `?N` | dim grey | Only if >0 |
| Cursor | `❯` | cyan | Always |

### Detached HEAD

Show `` + short commit hash (7 chars) in red instead of branch name.

### Clean state

```
gitverse  main ❯ 
```

### Font

MesloLGS NF loaded as woff2 web font via `@font-face`. Used as primary terminal font. Provides Nerd Font glyphs (`` branch icon) and proper monospace rendering.

**Files:** `src/shell/prompt.ts`, `src/ui/Prompt.svelte`, new font asset in `public/fonts/`

## 4. ASCII Welcome Banner

On terminal session start, render:

```
██████╗ ██╗████████╗██╗   ██╗███████╗██████╗ ███████╗███████╗
██╔════╝ ██║╚══██╔══╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
██║  ███╗██║   ██║   ██║   ██║█████╗  ██████╔╝███████╗█████╗  
██║   ██║██║   ██║   ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝  
╚██████╔╝██║   ██║    ╚████╔╝ ███████╗██║  ██║███████║███████╗
 ╚═════╝ ╚═╝   ╚═╝     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝

interactive git sandbox — type 'help' for commands
```

- Block letters in cyan/gradient
- Subtitle in dim grey
- Pushed into terminal output buffer once on init
- Clears with `clear` command

**Files:** `src/ui/Terminal.svelte` or new `src/shell/welcome.ts`

## 5. Ghost Text Autosuggestion

### Behavior

As user types, display top completion candidate as grey ghost text after cursor position.

- `git ch` shows ghost `eckout` in dim grey
- Right arrow or Tab accepts suggestion (fills input)
- Source: completion candidates only (from `src/shell/complete.ts`)
- No suggestion if no match or empty input
- Updates on every keystroke

### Rendering

- Input text: white
- Ghost text: dim grey, same font, appended after input
- Cursor: blinking block or line at end of real input (before ghost text)

**Files:** `src/ui/Terminal.svelte`, `src/shell/complete.ts` (may need sync API)

## 6. Graph Layout — Alternating Branch Lanes

### Lane Assignment

Main branch stays at lane 0 (visual center). New branches alternate sides:

| Branch creation order | Lane |
|----------------------|------|
| main | 0 |
| 1st branch | -1 (below) |
| 2nd branch | +1 (above) |
| 3rd branch | -2 (below) |
| 4th branch | +2 (above) |

### Lane Persistence

Branch lane stays allocated until branch ref is deleted (`git branch -d`). Merge commits draw edge back to main lane but branch lane remains.

### Node & Spacing Scale-Up

| Property | Old | New |
|----------|-----|-----|
| NODE_RADIUS | 12 | 18 |
| LANE_SPACING_Y | 50 | 80 |
| NODE_SPACING_X | 80 | 120 |

Branch label pills scale proportionally.

### Edge Style

Bezier curves with smooth rounded corners for fork/merge lines. No sharp angles.

### Color Assignment

Keep 6-color lane cycle. Assign by branch creation order (stable — doesn't shift when branches are deleted).

### Auto-Centering

SVG viewBox centers on main branch lane (y=0). Expands symmetrically as branches grow above/below. Horizontal scroll as commits accumulate.

**Files:** `src/graph/layout.ts`, `src/ui/Graph.svelte`

## 7. UI Layout — 70/30 Split

### Desktop (≥640px)

- Graph: top 70% of viewport, scrollable
- Terminal: bottom 30%, fixed height, own scroll context
- Subtle top border on terminal for separation
- No overlay, no opacity slider, no blur, no focus toggle

### Mobile (<640px)

- Graph: top 60% of viewport
- Terminal: bottom 40%
- Same docked split, no overlay

### Component Structure

```
<Layout>
  <Graph />        <!-- top section, flex-grow -->
  <Terminal />      <!-- bottom section, fixed height -->
</Layout>
```

No FilePanel. No MobileToolbar. Clean two-panel split.

**Files:** `src/ui/Layout.svelte`

## Files Changed Summary

| File | Action |
|------|--------|
| `src/shell/builtins.ts` | Fix notify, remove sim, update help |
| `src/engine/commands/add.ts` | Silent output |
| `src/shell/complete.ts` | Remove sim, support sync API for ghost text |
| `src/shell/prompt.ts` | Rewrite — p10k minimal format |
| `src/ui/Prompt.svelte` | Rewrite — new segment rendering |
| `src/ui/Layout.svelte` | Rewrite — 70/30 split, remove overlay/focus/FilePanel/MobileToolbar |
| `src/ui/Graph.svelte` | Scale up nodes, update viewBox centering |
| `src/graph/layout.ts` | Rewrite lane assignment — alternating +/- from center |
| `src/ui/Terminal.svelte` | Add welcome banner, ghost text autosuggestion |
| `src/ui/FilePanel.svelte` | Delete |
| `src/ui/MobileToolbar.svelte` | Delete |
| `public/fonts/MesloLGS-NF.woff2` | Add (new asset) |
| `src/app.css` or font config | Add @font-face for MesloLGS NF |
