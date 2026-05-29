# Graph Energy Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a continuous stream of glowing cyan dots flowing along the current branch's first-parent chain (root commit → HEAD) in the git DAG visualization.

**Architecture:** A new pure, DOM-free module `src/graph/flow.ts` builds a single concatenated SVG cubic-Bézier path string for the active first-parent chain and is unit-tested headless. `Graph.svelte` consumes it, rendering an invisible guide path plus SMIL `animateMotion` dots that ride it, with a `prefers-reduced-motion` static-stroke fallback.

**Tech Stack:** Svelte 5 (runes), TypeScript (strict), SVG SMIL animation, Vitest (`vitest run`), svelte-check, ESLint.

**Spec:** `docs/superpowers/specs/2026-05-29-graph-energy-flow-design.md`

---

## File Structure

- **Create** `src/graph/flow.ts` — pure geometry: `cubicSegment()` (one Bézier command) + `buildActiveFlow()` (chain walk → combined path `d` + segment count). Zero DOM deps.
- **Create** `tests/graph/flow.test.ts` — headless unit tests for both exports.
- **Modify** `src/ui/Graph.svelte` — import the helpers, DRY `edgePath` onto `cubicSegment`, add reduced-motion state + `activeFlow` derived, render the flow layer between edges and nodes.

Reference for existing conventions:

- Existing pure layout module: `src/graph/layout.ts` (exports `Orientation`, spacing consts).
- Existing test style + `makeNode` helper: `tests/graph/layout.test.ts`.
- Existing SMIL precedent: HEAD glow `<animate>` at `src/ui/Graph.svelte:200-217`.
- Existing media-query pattern: `isMobile` `$effect` at `src/ui/Graph.svelte:14-22`.
- Existing `edgePath`: `src/ui/Graph.svelte:159-166`.
- Existing `headCommitHash` derived: `src/ui/Graph.svelte:122-131`.

---

## Task 1: Pure flow module (`src/graph/flow.ts`)

**Files:**

- Create: `src/graph/flow.ts`
- Test: `tests/graph/flow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/graph/flow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildActiveFlow, cubicSegment } from '$graph/flow';
import type { GraphNode } from '$graph/types';

function makeNode(hash: string, parents: string[], overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    hash,
    type: 'commit' as const,
    parents,
    message: `commit ${hash}`,
    branches: [],
    tags: [],
    isHEAD: false,
    lane: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe('cubicSegment', () => {
  it('horizontal: control points at mid-X', () => {
    expect(cubicSegment(0, 0, 100, 40, 'horizontal')).toBe('C 50 0, 50 40, 100 40');
  });

  it('vertical: control points at mid-Y', () => {
    expect(cubicSegment(0, 0, 40, 100, 'vertical')).toBe('C 0 50, 40 50, 40 100');
  });
});

describe('buildActiveFlow', () => {
  it('returns null when head hash is empty', () => {
    const nodes = [makeNode('a', [], { x: 10, y: 10 })];
    expect(buildActiveFlow(nodes, '', 'horizontal')).toBeNull();
  });

  it('returns null when head hash is not found', () => {
    const nodes = [makeNode('a', [], { x: 10, y: 10 })];
    expect(buildActiveFlow(nodes, 'zzz', 'horizontal')).toBeNull();
  });

  it('returns null for a single-node chain (root == head)', () => {
    const nodes = [makeNode('a', [], { x: 10, y: 10 })];
    expect(buildActiveFlow(nodes, 'a', 'horizontal')).toBeNull();
  });

  it('builds an ordered root -> head path for linear history', () => {
    // a (root) <- b <- c (head)
    const nodes = [
      makeNode('a', [], { x: 100, y: 50 }),
      makeNode('b', ['a'], { x: 200, y: 50 }),
      makeNode('c', ['b'], { x: 300, y: 50, isHEAD: true }),
    ];
    const flow = buildActiveFlow(nodes, 'c', 'horizontal');
    expect(flow).not.toBeNull();
    expect(flow!.segmentCount).toBe(2);
    // starts at the root (a), ends at the head (c)
    expect(flow!.d.startsWith('M 100 50')).toBe(true);
    expect(flow!.d.endsWith('300 50')).toBe(true);
  });

  it('follows first parent only at a merge commit', () => {
    // mainline: a <- b <- m(head); feature: a <- f; m merges b (first) + f (second)
    const nodes = [
      makeNode('a', [], { x: 100, y: 50 }),
      makeNode('b', ['a'], { x: 200, y: 50 }),
      makeNode('f', ['a'], { x: 200, y: 150 }),
      makeNode('m', ['b', 'f'], { x: 300, y: 50, isHEAD: true }),
    ];
    const flow = buildActiveFlow(nodes, 'm', 'horizontal');
    expect(flow).not.toBeNull();
    // chain is a -> b -> m (3 nodes, 2 hops); the second parent f is excluded
    expect(flow!.segmentCount).toBe(2);
    expect(flow!.d).not.toContain('150'); // f's y-coord never appears
  });

  it('handles detached HEAD ending at an interior commit', () => {
    const nodes = [
      makeNode('a', [], { x: 100, y: 50 }),
      makeNode('b', ['a'], { x: 200, y: 50, isHEAD: true }),
      makeNode('c', ['b'], { x: 300, y: 50 }),
    ];
    const flow = buildActiveFlow(nodes, 'b', 'horizontal');
    expect(flow).not.toBeNull();
    expect(flow!.segmentCount).toBe(1); // a -> b only
    expect(flow!.d.endsWith('200 50')).toBe(true);
  });

  it('ignores phantom nodes', () => {
    const nodes = [makeNode('', [], { type: 'phantom', x: 168, y: 112 })];
    expect(buildActiveFlow(nodes, '', 'horizontal')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/graph/flow.test.ts`
Expected: FAIL — cannot resolve `$graph/flow` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/graph/flow.ts`:

```ts
import type { GraphNode } from './types';
import type { Orientation } from './layout';

/**
 * One cubic-Bézier command (no leading `M`) from (fromX,fromY) to (toX,toY).
 * Mirrors the curve shape used by edges so the flow rides the same wires.
 */
export function cubicSegment(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  orientation: Orientation,
): string {
  if (orientation === 'horizontal') {
    const midX = (fromX + toX) / 2;
    return `C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  }
  const midY = (fromY + toY) / 2;
  return `C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}

/**
 * Builds the active-branch flow path: the first-parent chain from the root
 * commit to the HEAD commit, as a single connected SVG path string.
 * Returns null when there is no drawable flow (<2 real nodes).
 */
export function buildActiveFlow(
  nodes: GraphNode[],
  headCommitHash: string,
  orientation: Orientation,
): { d: string; segmentCount: number } | null {
  if (!headCommitHash) return null;

  const byHash = new Map<string, GraphNode>();
  for (const n of nodes) {
    if (n.type === 'phantom' || !n.hash) continue;
    byHash.set(n.hash, n);
  }

  let cur = byHash.get(headCommitHash);
  if (!cur) return null;

  // Walk first-parent ancestry HEAD -> root.
  const chain: GraphNode[] = [];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.hash)) {
    seen.add(cur.hash);
    chain.push(cur);
    const parent = cur.parents[0];
    cur = parent ? byHash.get(parent) : undefined;
  }

  chain.reverse(); // root -> HEAD
  if (chain.length < 2) return null;

  let d = `M ${chain[0].x} ${chain[0].y}`;
  for (let i = 1; i < chain.length; i++) {
    const from = chain[i - 1];
    const to = chain[i];
    d += ` ${cubicSegment(from.x, from.y, to.x, to.y, orientation)}`;
  }

  return { d, segmentCount: chain.length - 1 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/graph/flow.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/graph/flow.ts tests/graph/flow.test.ts
git commit -m "feat: pure active-branch flow path builder for graph energy effect"
```

---

## Task 2: Render the flow in `Graph.svelte`

No automated test — SMIL motion is visual. Verified by typecheck, build, and manual browser check. Follow the steps exactly.

**Files:**

- Modify: `src/ui/Graph.svelte`

- [ ] **Step 1: Import the flow helpers**

In `src/ui/Graph.svelte`, find (line ~3):

```ts
import { computeLayout, NODE_SPACING_X, LANE_SPACING_Y } from '$graph/layout';
import type { Orientation } from '$graph/layout';
```

Add immediately after the `Orientation` import:

```ts
import { buildActiveFlow, cubicSegment } from '$graph/flow';
```

- [ ] **Step 2: Add flow constants**

Find:

```ts
const LANE_COLORS = ['#4ade80', '#60a5fa', '#c084fc', '#f87171', '#facc15', '#22d3ee'];
const NODE_RADIUS = 25;
const GRAPH_PADDING = 80;
```

Add after `GRAPH_PADDING`:

```ts
const FLOW_COLOR = '#22d3ee';
const FLOW_PER_SEGMENT_SEC = 0.6;
```

- [ ] **Step 3: DRY `edgePath` onto `cubicSegment`**

Replace the whole `edgePath` function (lines ~159-166):

```ts
function edgePath(edge: GraphEdge): string {
  if (orientation === 'horizontal') {
    const midX = (edge.fromX + edge.toX) / 2;
    return `M ${edge.fromX} ${edge.fromY} C ${midX} ${edge.fromY}, ${midX} ${edge.toY}, ${edge.toX} ${edge.toY}`;
  }
  const midY = (edge.fromY + edge.toY) / 2;
  return `M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${midY}, ${edge.toX} ${midY}, ${edge.toX} ${edge.toY}`;
}
```

with:

```ts
function edgePath(edge: GraphEdge): string {
  return `M ${edge.fromX} ${edge.fromY} ${cubicSegment(edge.fromX, edge.fromY, edge.toX, edge.toY, orientation)}`;
}
```

- [ ] **Step 4: Add `prefersReducedMotion` state**

Find the `isMobile` effect (lines ~12-22):

```ts
let isMobile = $state(false);

$effect(() => {
  const mq = window.matchMedia('(max-width: 640px)');
  isMobile = mq.matches;
  function onChange(e: MediaQueryListEvent) {
    isMobile = e.matches;
  }
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
});
```

Add immediately after that closing `});`:

```ts
let prefersReducedMotion = $state(false);

$effect(() => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  prefersReducedMotion = mq.matches;
  function onChange(e: MediaQueryListEvent) {
    prefersReducedMotion = e.matches;
  }
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
});
```

- [ ] **Step 5: Add the `activeFlow` derived value**

Find the `headCommitHash` derived block (ends ~line 131):

```ts
const headCommitHash = $derived.by(() => {
  const eng = $engine;
  void $engineVersion;
  try {
    const h = eng.getHEAD();
    return h.attached ? (eng.allBranches().get(h.target) ?? '') : h.target;
  } catch {
    return '';
  }
});
```

Add immediately after that closing `});`:

```ts
const activeFlow = $derived(buildActiveFlow(layout.nodes, headCommitHash, orientation));
const flowDur = $derived(activeFlow ? activeFlow.segmentCount * FLOW_PER_SEGMENT_SEC : 0);
const flowDots = $derived(activeFlow ? activeFlow.segmentCount : 0);
```

- [ ] **Step 6: Render the flow layer between edges and nodes**

Find the end of the edges `{#each}` block and the start of the nodes block (lines ~192-194):

```svelte
        {/each}

        <!-- Nodes -->
```

Replace that exact region with:

```svelte
        {/each}

        <!-- Active-branch energy flow -->
        {#if activeFlow}
          {#if prefersReducedMotion}
            <path
              d={activeFlow.d}
              fill="none"
              stroke={FLOW_COLOR}
              stroke-width="3"
              opacity="0.55"
            />
          {:else}
            {#key activeFlow.d}
              <g aria-hidden="true" pointer-events="none">
                <path id="head-flow-path" d={activeFlow.d} fill="none" stroke="none" />
                {#each Array(flowDots) as _, i (i)}
                  <g>
                    <circle r="9" fill={FLOW_COLOR} opacity="0.3" />
                    <circle r="4" fill={FLOW_COLOR} />
                    <animateMotion
                      dur="{flowDur}s"
                      begin="{(i * flowDur) / flowDots}s"
                      repeatCount="indefinite"
                    >
                      <mpath xlink:href="#head-flow-path" />
                    </animateMotion>
                  </g>
                {/each}
              </g>
            {/key}
          {/if}
        {/if}

        <!-- Nodes -->
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

If svelte-check flags `xlink:href` as deprecated/unknown, replace `xlink:href="#head-flow-path"` with `href="#head-flow-path"` and add a code comment noting Safari may need xlink; re-run typecheck.

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: no errors. The `{#each Array(flowDots) as _, i (i)}` uses `_` for the unused item; if ESLint flags it, rename to `{#each Array(flowDots) as _unused, i (i)}`.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 10: Manual browser verification**

Run: `npm run dev`, open the app, then:

1. `git init` then run several commits (use the simulate-changes command/button + `git add -A` + `git commit`) until there are 4+ commits on `main`.
   - Expect: cyan dots stream continuously from the root commit toward the HEAD commit along `main`. Speed looks even.
2. `git commit` one more time.
   - Expect: the stream extends to the new tip (the `{#key}` remount picks up the new path) — dots flow all the way to the new HEAD, no frozen/stale path.
3. `git checkout -b feature`, commit, then `git checkout main`.
   - Expect: flow follows whichever branch HEAD is on; on `main` it runs root → main tip.
4. Create a merge (`git merge feature` onto main) so a merge commit exists.
   - Expect: the flow follows the first-parent mainline only; it does not divert down the feature lane.
5. `git checkout <a commit hash>` to detach HEAD.
   - Expect: flow ends at that commit, not the branch tip.
6. Empty repo (fresh `git init`, no commits) and single-commit repo.
   - Expect: no dots, no errors in console.
7. Toggle OS "reduce motion" on and reload.
   - Expect: no moving dots; the active path shows as a static brighter cyan stroke.
8. Resize to mobile width (vertical orientation).
   - Expect: flow renders correctly along the vertical layout.
9. Click a commit circle that a dot is passing over.
   - Expect: the click still selects the commit (dots have `pointer-events="none"`).

Confirm zero console errors throughout.

- [ ] **Step 11: Commit**

```bash
git add src/ui/Graph.svelte
git commit -m "feat: animated energy flow along active branch path in graph"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** traveling-pulse style ✓ (dots), active-path-only scope ✓ (`buildActiveFlow` first-parent walk), continuous stream ✓ (N staggered indefinite dots), constant speed ✓ (`dur` scales with `segmentCount`), root→HEAD direction ✓, <2-node guard ✓, reduced-motion static fallback ✓ (Task 2 Step 6), pure headless module + tests ✓ (Task 1). All four "Known risks" addressed: SMIL remount via `{#key}` (Step 6), `xlink:href` (Step 6 + Step 7 fallback), no `<base>` tag confirmed during planning, non-uniform speed accepted as documented.
- **Placeholder scan:** none — all code blocks complete, all commands explicit.
- **Type consistency:** `buildActiveFlow(nodes, headCommitHash, orientation)` and `cubicSegment(fromX, fromY, toX, toY, orientation)` signatures identical across Task 1 (definition + tests) and Task 2 (call sites). Return shape `{ d, segmentCount }` used consistently.
