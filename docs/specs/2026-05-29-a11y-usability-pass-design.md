# Gitverse — Accessibility & Usability Pass

**Date:** 2026-05-29
**Repo:** `opariffazman/gitverse`
**Status:** Draft
**Bar:** WCAG 2.1 AA

---

## 1. Overview

An accessibility and usability pass across both interaction surfaces — the SVG
commit graph and the terminal — held to a WCAG 2.1 AA bar so acceptance is
objective (axe-core + manual screen-reader pass).

Alongside the compliance work, three behavioral changes requested during
brainstorming sharpen how the graph and terminal communicate git state:

1. Graph nodes no longer execute checkout on click. Activating a node
   **prefills** `git checkout <x>` into the terminal input (not executed),
   keeping the terminal as the single execution surface.
2. The detached-HEAD prompt shows the friendly `Cx` label instead of a raw
   short hash.
3. Rebased commits are labeled `Cx'` (stacking primes on repeated rebase) to
   show "same logical commit, new hash."

The graph also moves from an overflow-scroll container to a true pan/zoom
viewport with a follow-HEAD camera.

### Goals

- Meet WCAG 2.1 AA on graph + terminal.
- Terminal is the single command-execution surface; the graph *suggests*.
- Clearer commit identity: friendly labels in the prompt, prime notation for
  rewrites.
- Pan/zoom graph that feels like a camera, not a scrollable page.

### Non-Goals

- Making `Cx'` addressable as a commit-ish (display-only for now).
- Replacing hand-built SVG with a charting/graph library.
- New remote operations or commands beyond labeling/prompt changes.

---

## 2. Graph → Terminal Prefill

Replaces checkout-on-click. The terminal stays the only place commands run.

### Store

`src/store/ui.ts` (currently an empty placeholder whose own comment reserves it
for this) gains:

```ts
import { writable } from 'svelte/store';

// Command text the graph wants placed into the terminal input (not executed).
export const pendingInput = writable<string | null>(null);

export function prefillTerminal(cmd: string): void {
  pendingInput.set(cmd);
}
```

### Graph

`Graph.selectNode` stops calling `executeCommand`. Instead:

- If the node has a branch, prefill `git checkout <branch>` (prefer the HEAD
  branch when it lives on the node, matching today's logic).
- Otherwise prefill `git checkout <Cx label>`.

The `CommitDetail` panel still opens on activation so the user sees what they
are about to check out.

### Terminal

An `$effect` watches `pendingInput`:

1. On a non-null value: set `inputValue`, move the cursor to the end, focus the
   input.
2. Reset the store to `null` (so re-selecting the same node re-arms it).

**Nothing runs automatically.** The user reviews the prefilled command and
presses Enter.

### Accessibility

Each node remains a focusable control with an accessible name like:

> "Commit C2, <message>, on branch main, HEAD. Activates: prefill git checkout
> command."

(See §6 for roving tabindex and focus styling.)

---

## 3. Detached-HEAD Prompt Label

`src/shell/prompt.ts`: when `!head.attached`, render
`engine.commitLabel(head.target)` (→ `C2`) instead of
`head.target.slice(0, 7)`. The red color is preserved. `commitLabel` already
falls back to the short hash when a commit has no ordinal, so no extra
guarding is needed.

---

## 4. Rebase Prime Labels (`C2'`)

Rewritten commits display as the original's label plus a prime per rewrite
(`C2'`, then `C2''`, …). Display-only — addressing is unchanged.

### Object model

`src/engine/objects.ts`: add an optional lineage pointer to `Commit`:

```ts
export type Commit = {
  hash: string;
  tree: string;
  parents: string[];
  message: string;
  timestamp: number;
  rewriteOf?: string; // hash of the commit this one rewrote (rebase)
};
```

`rewriteOf` is **excluded from the hash content** (the existing
`tree:…\nparents:…\nmessage:…\ntimestamp:…` serialization already omits it —
keep it that way; lineage must never change a commit's hash).

### Rebase

`src/engine/commands/rebase.ts`: when minting each replayed commit, set
`rewriteOf` to the original commit's hash being replayed. The original commits
remain in the store (rebase abandons them, as real git does) and keep their
ordinals.

### Label computation

`src/engine/index.ts commitLabel(hash)`:

1. Walk the `rewriteOf` chain from `hash` to its root (the original commit that
   was never itself a rewrite). Count the hops = prime depth.
2. Label = `C{rootOrdinal}` + `"'".repeat(depth)`.
3. If the root has no ordinal, fall back to the short hash (current behavior).

Example: original `C2` rebased once → new commit labels as `C2'`; rebase that
again → `C2''`.

### Addressing

`resolveCommitLabel` is unchanged — it parses `C\d+` only, not primes. Users
address commits by plain ordinal or hash. (A future enhancement could accept
`C2'`; out of scope here.)

### Persistence

The IndexedDB persistence layer must serialize and restore `rewriteOf` so
prime labels survive reload. `restoreCommit` already copies the whole commit
object; verify the serialize side includes the field.

---

## 5. Graph Pan/Zoom Viewport

Replaces the overflow-scroll container (scrollbars on a growing DAG break the
feel) with a camera-style pan/zoom viewport.

### Mechanics

- `Layout` + `Graph`: drop `overflow-auto`, use `overflow-hidden`. The SVG
  fills its container. The inner content `<g>` carries a
  `translate(panX, panY) scale(k)` transform instead of letting the SVG size
  overflow.
- **Pan:** pointer drag (mouse + one-finger touch).
- **Zoom:** mouse wheel toward the cursor; pinch on touch.
- **On-screen controls:** `+`, `−`, and `fit` buttons (real, keyboard-operable
  `<button>`s).
- **Keyboard (when the graph region is focused):** arrows pan, `+`/`−` zoom,
  `0` (or the `fit` button) recenters/fits.

Hand-rolled with pointer events — no new dependency, consistent with the rest
of the hand-built SVG. (d3-zoom is a possible alternative but is not used.)

**DRY:** all four input sources (buttons, wheel, keyboard, pinch) route through
one small set of helpers — `zoomBy(factor, centerPoint)`, `panBy(dx, dy)`,
`fit()` — operating on a single `{ panX, panY, k }` state plus one `followHead`
boolean. No input source reimplements the transform math.

### Camera behavior — Follow HEAD

- **Auto (default):** zoom level fixed; on a new commit (or any layout change),
  auto-pan so HEAD / the newest commit stays in view, like a camera tracking
  the tip.
- **Manual pan/zoom disengages follow** until the next commit or until the user
  fits.
- **`fit` / `0`:** zoom out so the *entire* DAG fits the viewport. Manual
  wheel/pinch zoom-out works freely to any level at any time. So the user gets
  hands-off tip-tracking by default, and full-graph overview on demand.

### Accessibility

The pan/zoom widget is fully keyboard-operable (buttons + key bindings) and the
`fit` control guarantees all content is reachable without a mouse, satisfying
1.4.10 (Reflow) and 1.4.4 (Resize text).

---

## 6. Mechanical WCAG 2.1 AA Fixes

### Terminal

- Output scroll container: `role="log"` + `aria-live="polite"` so command
  output is announced to screen readers as it appears.
- Input: a visually-hidden `<label for>` (e.g. "Terminal command input") tied
  to an `id` on the input.
- A real `:focus-visible` indicator on the input (not color-only); the current
  `outline-none` removes the default without replacing it.
- Contrast audit: verify prompt-segment colors meet 4.5:1 on `#0d1117`. The
  ghost-completion text is decorative (`aria-hidden`) so its low contrast is
  acceptable.

### Graph

- `<svg>` gets `role="group"` + a single reactive `aria-label` summarizing
  state ("Commit graph: N commits, HEAD on main at C5"). One string, no
  separate `<title>`/`<desc>` restating the same thing.
- **Roving tabindex:** the graph is a single tab stop; Arrow keys move focus
  between nodes (Home/End → first/last). Avoids one tab stop per commit.
- `:focus-visible` outline on nodes.
- Gate the HEAD glow pulse `<animate>` under `prefers-reduced-motion` (the
  energy flow is already gated).
- Use of color (1.4.1): branch identity is also carried by text pills and `Cx`
  labels, so color is not the sole means — verify and document.

---

## 7. Testing

### Engine unit tests (headless)

- `commitLabel` prime: single rewrite → `C2'`; stacked rewrites → `C2''`.
- Rebase sets `rewriteOf` on each replayed commit; originals keep their
  ordinals.
- Persistence round-trip preserves `rewriteOf`.

### Shell unit tests

- Detached-HEAD prompt renders `Cx` (and falls back to short hash with no
  ordinal).

### E2E (Playwright + axe-core)

- Zero WCAG 2.1 AA violations on the main view (axe-core).
- Keyboard flow: tab to terminal → run a command → arrow-navigate the graph →
  activate a node → input is prefilled with `git checkout …` → Enter runs it.
- Pan/zoom: `fit` shows the whole graph; follow-HEAD keeps the tip visible
  after a commit; `prefers-reduced-motion` disables pulse + flow.

### Manual

- Screen-reader checklist: terminal output announced, node names read
  meaningfully, graph summary present, controls labeled.

---

## 8. Out of Scope / Future

- Addressable prime labels (`git checkout C2'`).
- Mobile pinch-zoom refinements beyond basic two-finger support.
- Animated camera transitions (follow-HEAD can start as an instant recenter).
