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
   the map. Collect the chain.
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
  - `N` dot groups, where `N` scales with `segmentCount` (≈ one dot per hop) so spacing
    stays constant. Each dot `<g>` contains a bright core circle + a softer, larger halo
    circle (cyan `#22d3ee`).
  - Each dot `<g>` carries `<animateMotion dur={D} repeatCount="indefinite" begin="{i * D / N}s"><mpath href="#head-flow-path"/></animateMotion>`.
  - `D` (total traversal duration) scales with `segmentCount` for constant speed,
    e.g. `D = segmentCount * PER_SEGMENT_SECONDS`.
- When `prefersReducedMotion` is true and a flow path exists: render a single static
  `<path d={flow.d}>` with a brighter cyan stroke and no animation; render no dots.

### Why SMIL, not JS

The codebase already uses SVG SMIL (`<animate>` on the HEAD glow ring, Graph.svelte:210).
`animateMotion` + `mpath` over a single concatenated guide path gives free, continuous
flow across multi-segment Béziers with zero per-frame JavaScript and no requestAnimationFrame
loop to manage. It stays consistent with the existing animation approach.

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
