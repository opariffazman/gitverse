# Graph Energy Flow — Design Spec

**Date:** 2026-05-29
**Status:** Approved, ready for implementation plan

## Goal

Add an animated "energy flow" effect to the git DAG visualization: a continuous
stream of glowing dots that travels along the current branch's first-parent chain,
from the root commit toward the current HEAD tip. Communicates "where you are" and
gives the graph a living, active feel.

## Behavior

- **Style:** traveling pulse / comet — discrete glowing dots, not a gradient or dashes.
- **Scope:** active branch path only — the first-parent ancestry chain from the root
  commit to the current HEAD commit. At merge commits, follow the first parent only
  (this is the "current branch" mainline). Works for both attached HEAD (branch tip)
  and detached HEAD (arbitrary commit).
- **Cadence:** continuous stream — several evenly-spaced dots flow nonstop root → HEAD,
  looping forever. Reads as a steady energy current.
- **Direction:** always root (oldest) → HEAD (newest).
- **Constant speed:** the perceived dot speed stays the same regardless of how many
  commits are on the path. Animation duration scales with the path's segment count.
- **Degenerate cases:** when the active path has fewer than 2 nodes (empty repo with a
  phantom node, or a single root commit that is also HEAD), render no flow.
- **Reduced motion:** when `prefers-reduced-motion: reduce` is set, render no moving
  dots. Instead draw the active path as a static, brighter cyan stroke so the
  "where am I" information is still conveyed without animation.

## Architecture

Two pieces, matching the existing engine/renderer separation.

### 1. Pure module: `src/graph/flow.ts`

DOM-free, headless-testable (same class as the engine and `src/graph/layout.ts`).

```ts
export function buildActiveFlow(
  nodes: GraphNode[],
  headCommitHash: string,
  orientation: Orientation,
): { d: string; segmentCount: number } | null;
```

Algorithm:

1. Look up the HEAD node by `headCommitHash`. If missing, return `null`.
2. Walk first-parent ancestry: starting from HEAD, repeatedly follow `node.parents[0]`
   (resolved against a hash→node map built from `nodes`) until a node has no parent in
   the map. Collect the chain. Skip any node with `type === 'phantom'` or empty hash so
   the empty-repo phantom node never produces a (degenerate) flow.
3. Reverse the chain to get root → HEAD order.
4. If fewer than 2 nodes, return `null`.
5. For each consecutive pair `(parent, child)`, append one cubic-Bézier segment to a
   single combined path string `d`. The curve math mirrors the existing `edgePath` in
   `Graph.svelte`, but in parent → child direction:
   - horizontal: control points at the mid-X between the two nodes.
   - vertical: control points at the mid-Y between the two nodes.
   The first segment starts with `M <rootX> <rootY>`; subsequent segments append `C ...`
   (the path stays connected because each segment's start equals the previous end).
6. Return `{ d, segmentCount }` where `segmentCount` is the number of hops.

This function owns the curve geometry so the Svelte component stays declarative.
To avoid duplicated Bézier math, the shared single-segment curve helper may be
extracted/exported so both `Graph.svelte`'s `edgePath` and `flow.ts` use one source
of truth (parametrized by direction + orientation).

### 2. Renderer: `Graph.svelte`

- New `$derived` value computes the active flow from `layout.nodes` + the existing
  `headCommitHash` derived value, by calling `buildActiveFlow`.
- New `prefersReducedMotion` `$state`, wired with `matchMedia('(prefers-reduced-motion: reduce)')`
  using the same `$effect` + listener pattern as the existing `isMobile` media query
  (Graph.svelte:14-22).
- Render the flow layer **after the edges loop and before the nodes loop**, so dots
  ride on top of the edge wires but slide underneath the commit circles.
- When motion is allowed and a flow path exists:
  - One invisible guide `<path id="head-flow-path" d={flow.d} fill="none" stroke="none">`.
    Use `stroke="none" fill="none"` (NOT `display:none`) so the geometry stays live for
    `mpath` to reference.
  - `N` dot groups, where `N` scales with `segmentCount` (≈ one dot per hop) so spacing
    stays constant. Each dot `<g>` contains a bright core circle + a softer, larger halo
    circle (cyan `#22d3ee`).
  - Each dot `<g>` carries `<animateMotion dur={D} repeatCount="indefinite" begin="{i * D / N}s"><mpath xlink:href="#head-flow-path"/></animateMotion>`.
  - `D` (total traversal duration) scales with `segmentCount` for constant speed,
    e.g. `D = segmentCount * PER_SEGMENT_SECONDS`.
  - Dots are decorative: every flow element gets `pointer-events="none"` and the layer
    is `aria-hidden="true"` so dots never intercept clicks on nodes/edges and add no
    a11y noise.
  - **Force remount on path change:** wrap the whole flow layer in a Svelte `{#key flow.d}`
    block. SMIL `animateMotion` snapshots the `mpath` geometry when the animation begins
    and does not reliably re-read a mutated `d`; re-keying recreates the elements so the
    flow tracks HEAD movement / new commits. (See Known Risks.)
- When `prefersReducedMotion` is true and a flow path exists: render a single static
  `<path d={flow.d}>` with a brighter cyan stroke and no animation; render no dots.

### Why SMIL, not JS

The codebase already uses SVG SMIL (`<animate>` on the HEAD glow ring, Graph.svelte:210).
`animateMotion` + `mpath` over a single concatenated guide path gives free, continuous
flow across multi-segment Béziers with zero per-frame JavaScript and no requestAnimationFrame
loop to manage. It stays consistent with the existing animation approach.

## Known risks & implementation notes

Surfaced during spec self-review — verify each in the browser during implementation:

1. **SMIL does not track a mutated path (HIGH).** `animateMotion` + `mpath` snapshot the
   referenced path geometry at animation start. Mutating the guide `<path d>` in place
   (HEAD moves, commit added, orientation flip) will not redirect in-flight dots.
   Mitigation: `{#key flow.d}` around the flow layer to remount the SMIL elements.
2. **`mpath` href attribute (MED).** Safari historically requires `xlink:href` on
   `<mpath>`; plain `href` is the modern form. Use `xlink:href` (works across Chromium,
   Firefox, Safari). Confirm dots actually move in Safari.
3. **`<base>` / fragment-reference resolution (LOW–MED).** The app builds under base path
   `/gitverse/`. If the document ends up with a `<base href>` element, in-document
   fragment refs like `xlink:href="#head-flow-path"` can resolve against the base URL and
   break in some browsers. Vite's `base` config rewrites asset URLs, not necessarily via a
   `<base>` element — verify there is no `<base>` tag, or use an absolute-to-current-URL
   ref if one exists.
4. **Non-uniform speed on lane-change segments (LOW).** `animateMotion` advances at a
   constant rate over the path *parameter*, not arc length. Commits are evenly spaced, so
   straight mainline segments are near-equal length and look uniform, but a segment that
   also changes lane is longer and the dot will appear to briefly speed up. Acceptable for
   v1; revisit with `keyPoints`/`keyTimes` only if it reads badly.

## Testing

- **Headless unit tests** (`tests/graph/flow.test.ts`) on `buildActiveFlow`:
  - linear history: chain is ordered root → HEAD; `segmentCount === commits - 1`.
  - returns `null` for 0 or 1 nodes.
  - detached HEAD: path ends at the detached commit, not a branch tip.
  - merge commit: chain follows first parent only (does not branch into the second parent).
  - missing `headCommitHash`: returns `null`.
- **Animation/visual:** verified manually in the browser (SMIL motion is not unit-testable).

## Out of scope

- Pulsing other branches or all edges.
- Gradient/marching-dash styles.
- Event-driven (one-shot) surges on HEAD movement.
- User toggle to enable/disable the effect (reduced-motion handling aside).
