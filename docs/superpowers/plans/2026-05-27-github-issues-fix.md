# GitHub Issues Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 5 open GitHub issues — 3 bugs (#1, #3, #4) and 2 enhancements (#2, #5).

**Architecture:** Terminal UI fixes are isolated to Svelte components and stores. Graph fixes span the layout algorithm (pure TS), engine store reactivity, and SVG rendering. The branch-aware lane assignment replaces the current parent-inheritance algorithm with one that traces branch membership from tips backward, so commits on different branches always get different swim lanes.

**Tech Stack:** Svelte 5, TypeScript, UnoCSS, SVG, Vitest

**Parallelization:** Tasks 1–4 modify independent files and can run in parallel. Task 5 modifies Graph.svelte (same as Task 4) and must run after Task 4.

---

## File Map

| File | Task | Action | Responsibility |
|------|------|--------|----------------|
| `src/ui/Terminal.svelte` | 1 | Modify | Bottom-anchor prompt via inner flex wrapper |
| `src/store/ui.ts` | 2 | Modify | Add `terminalOpacity` persisted store |
| `src/ui/Layout.svelte` | 2 | Modify | Add opacity slider, apply dynamic bg |
| `uno.config.ts` | 2 | Modify | Remove bg opacity from `terminal-panel` shortcut |
| `src/graph/layout.ts` | 3 | Modify | Branch-aware lane assignment algorithm |
| `tests/graph/layout.test.ts` | 3 | Modify | Add branch divergence tests |
| `src/store/engine.ts` | 4 | Modify | Add `engineVersion` signal for reactivity |
| `src/ui/Graph.svelte` | 4, 5 | Modify | Track version, add SVG padding, HEAD indicator |

---

### Task 1: Terminal Prompt Bottom-Anchoring (Issue #1)

**Closes:** #1
**Files:**
- Modify: `src/ui/Terminal.svelte:162-178`

**Problem:** The scrollable output area uses `flex-1` which takes all space, but content starts at the top. When there's little or no output, the prompt sits high in the panel with empty space below it. Real terminals show the prompt at the bottom with output growing upward.

**Fix:** Wrap terminal lines in an inner flex container with `justify-end min-h-full` so content is pushed to the bottom of the scroll area.

- [ ] **Step 1: Modify Terminal.svelte output area**

Replace the scrollable output div (lines 162-178):

```svelte
<!-- OLD -->
<div bind:this={scrollEl} class="flex-1 overflow-y-auto p-3 space-y-0.5">
  {#each $terminalLines as line (line.id)}
    ...
  {/each}
</div>

<!-- NEW -->
<div bind:this={scrollEl} class="flex-1 overflow-y-auto p-3">
  <div class="flex flex-col justify-end min-h-full space-y-0.5">
    {#each $terminalLines as line (line.id)}
      ...
    {/each}
  </div>
</div>
```

The inner wrapper with `flex flex-col justify-end min-h-full` pushes content to the bottom when there's unused space. Move `space-y-0.5` from the scroll container to the inner wrapper. When content exceeds the viewport, `min-h-full` stops constraining and `overflow-y-auto` on the parent handles scrolling.

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: PASS (no type changes, only template)

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Check:
1. Empty terminal: prompt/input anchored at bottom of panel
2. Run `git status`: output appears above the input, input stays at bottom
3. Run many commands: scrollbar appears, auto-scroll to bottom works
4. Toggle focus mode: prompt stays at bottom in both modes

- [ ] **Step 4: Commit**

```bash
git add src/ui/Terminal.svelte
git commit -m "fix: anchor terminal prompt to bottom of panel (#1)"
```

---

### Task 2: Terminal Opacity Slider (Issue #2)

**Closes:** #2
**Files:**
- Modify: `src/store/ui.ts`
- Modify: `src/ui/Layout.svelte`
- Modify: `uno.config.ts`

- [ ] **Step 1: Add `terminalOpacity` store to `src/store/ui.ts`**

Add after the existing `toggleFocus` function:

```typescript
function createPersistedWritable(key: string, defaultValue: number) {
  const stored =
    typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  const initial = stored !== null ? parseFloat(stored) : defaultValue;
  const store = writable(initial);
  store.subscribe((value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(value));
    }
  });
  return store;
}

export const terminalOpacity = createPersistedWritable(
  'gitverse-terminal-opacity',
  0.85,
);
```

- [ ] **Step 2: Update UnoCSS shortcut in `uno.config.ts`**

Remove the background opacity from the `terminal-panel` shortcut (the bg will be applied via inline style):

```typescript
// OLD
'terminal-panel': 'bg-terminal-bg/85 backdrop-blur-8 rounded-lg border border-terminal-dim/30',

// NEW
'terminal-panel': 'backdrop-blur-8 rounded-lg border border-terminal-dim/30',
```

- [ ] **Step 3: Update Layout.svelte with slider and dynamic opacity**

Add import:
```typescript
import { focusMode, toggleFocus, terminalOpacity } from '$store/ui';
```

Add inline style to the terminal panel div (line 18-22):
```svelte
<div
  class="absolute terminal-panel flex flex-col transition-all duration-300 ease-in-out"
  class:terminal-focused={isTerminalFocused}
  class:graph-focused={!isTerminalFocused}
  style="background-color: rgba(13, 17, 23, {$terminalOpacity})"
>
```

Replace the title bar (lines 24-33) to include the slider:
```svelte
<div class="flex items-center justify-between px-3 py-2 border-b border-terminal-dim/30">
  <span class="font-mono text-xs text-terminal-dim select-none">terminal</span>
  <div class="flex items-center gap-2">
    <input
      type="range"
      min="0.3"
      max="1"
      step="0.05"
      value={$terminalOpacity}
      oninput={(e) =>
        terminalOpacity.set(
          parseFloat((e.target as HTMLInputElement).value),
        )}
      class="w-16 h-1 appearance-none bg-terminal-dim/40 rounded cursor-pointer"
      style="accent-color: #58a6ff"
      title="Terminal opacity ({Math.round($terminalOpacity * 100)}%)"
    />
    <button
      class="font-mono text-xs text-terminal-grey hover:text-terminal-fg transition-colors px-2 py-0.5 rounded hover:bg-terminal-dim/20"
      onclick={toggleFocus}
      title={isTerminalFocused ? 'Focus graph' : 'Focus terminal'}
    >
      {isTerminalFocused ? '⇱ graph' : '⇲ terminal'}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Verify build**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`

Check:
1. Slider visible in terminal title bar next to the focus toggle button
2. Drag slider left: terminal becomes more transparent, graph visible through it
3. Drag slider right: terminal becomes opaque
4. Reload page: slider position persists
5. Range: minimum ~30% opacity (graph clearly visible), maximum 100% (fully opaque)

- [ ] **Step 6: Commit**

```bash
git add src/store/ui.ts src/ui/Layout.svelte uno.config.ts
git commit -m "feat: add terminal opacity slider (#2)"
```

---

### Task 3: Branch-Aware Lane Assignment (Issue #3)

**Closes:** #3
**Files:**
- Modify: `src/graph/layout.ts:88-129`
- Modify: `tests/graph/layout.test.ts`

**Problem:** The current lane algorithm inherits the parent's lane when `childCountAssigned === 0`. When a branch is created from main's tip and a commit is made on it (without new main commits), the branch commit inherits main's lane because it's the first child. All commits render on one horizontal line.

**Fix:** Before lane assignment, compute branch membership by walking backward from branch tips. Only inherit a parent's lane when the commit is on the same branch. Different branch = new lane.

- [ ] **Step 1: Write failing tests in `tests/graph/layout.test.ts`**

Add these test cases at the end of the file:

```typescript
describe('computeLayout – branch divergence with named branches', () => {
  it('feat branch from main tip gets a different lane', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root'], { branches: ['main'] });
    const B = makeNode('B', ['A'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.lane).toBe(byHash.get('A')!.lane);
    expect(byHash.get('B')!.lane).not.toBe(byHash.get('A')!.lane);
  });

  it('main branch keeps lane 0 while feat gets lane 1', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A'], { branches: ['main'] });
    const C = makeNode('C', ['A'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B, C]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    // root, A, B (main lineage) on lane 0
    expect(byHash.get('root')!.lane).toBe(0);
    expect(byHash.get('A')!.lane).toBe(0);
    expect(byHash.get('B')!.lane).toBe(0);
    // C (feat) on a different lane
    expect(byHash.get('C')!.lane).not.toBe(0);
  });
});

describe('computeLayout – parallel branches', () => {
  it('long main and feat branches stay on separate lanes', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A']);
    const C = makeNode('C', ['B'], { branches: ['main'] });
    const D = makeNode('D', ['B'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B, C, D]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    const mainLane = byHash.get('root')!.lane;
    expect(byHash.get('A')!.lane).toBe(mainLane);
    expect(byHash.get('B')!.lane).toBe(mainLane);
    expect(byHash.get('C')!.lane).toBe(mainLane);
    expect(byHash.get('D')!.lane).not.toBe(mainLane);
  });
});

describe('computeLayout – merge across branches', () => {
  it('merge commit rejoins the main lane', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A']);
    const C = makeNode('C', ['B']);
    const D = makeNode('D', ['A'], { branches: ['feat'] });
    const M = makeNode('M', ['C', 'D'], { branches: ['main'] });
    const { nodes, edges } = computeLayout([root, A, B, C, D, M]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    // M (main) should share main's lane
    expect(byHash.get('M')!.lane).toBe(byHash.get('root')!.lane);
    // D (feat) on different lane
    expect(byHash.get('D')!.lane).not.toBe(byHash.get('root')!.lane);
    // Merge edges exist
    const pairs = new Set(edges.map((e) => `${e.from}→${e.to}`));
    expect(pairs.has('M→C')).toBe(true);
    expect(pairs.has('M→D')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run tests/graph/layout.test.ts`
Expected: New tests FAIL (branch commits inherit parent lane)

- [ ] **Step 3: Implement branch-aware lane assignment in `src/graph/layout.ts`**

Replace the lane assignment section (lines 88-129) with:

```typescript
  // --- Branch membership ---
  // Walk backward from each branch tip to assign commits to branches.
  // Main/master processed first so they claim the primary lane.
  const branchTips = new Map<string, string>();
  for (const n of nodeMap.values()) {
    for (const b of n.branches) {
      branchTips.set(b, n.hash);
    }
  }

  const branchOrder = [...branchTips.keys()].sort((a, b) => {
    if (a === 'main' || a === 'master') return -1;
    if (b === 'main' || b === 'master') return 1;
    return a.localeCompare(b);
  });

  const commitBranch = new Map<string, string>();
  for (const branch of branchOrder) {
    let current: string | undefined = branchTips.get(branch);
    while (current && nodeMap.has(current) && !commitBranch.has(current)) {
      commitBranch.set(current, branch);
      current = nodeMap.get(current)!.parents[0];
    }
  }

  // --- Lane assignment ---
  // Inherit parent lane only when on the same branch and parent hasn't
  // already given its lane to another child. Different branch = new lane.
  const childCountAssigned = new Map<string, number>();
  const laneOf = new Map<string, number>();
  let nextLane = 0;

  for (const hash of topoOrder) {
    const node = nodeMap.get(hash)!;
    const validParents = node.parents.filter((p) => nodeMap.has(p));
    const myBranch = commitBranch.get(hash);

    let assignedLane: number;

    if (validParents.length === 0) {
      assignedLane = nextLane++;
    } else {
      const firstParent = validParents[0];
      const parentLane = laneOf.get(firstParent);
      const parentBranch = commitBranch.get(firstParent);
      const parentChildCount = childCountAssigned.get(firstParent) ?? 0;
      const sameBranch = myBranch === parentBranch;

      if (parentChildCount === 0 && parentLane !== undefined && sameBranch) {
        assignedLane = parentLane;
      } else {
        assignedLane = nextLane++;
      }

      if (sameBranch) {
        childCountAssigned.set(firstParent, parentChildCount + 1);
      }

      for (let i = 1; i < validParents.length; i++) {
        const p = validParents[i];
        childCountAssigned.set(p, (childCountAssigned.get(p) ?? 0) + 1);
      }
    }

    laneOf.set(hash, assignedLane);
  }
```

Also update the doc comment at the top of the function (lines 13-25) — replace step 3:

```typescript
 * 3. Branch membership: walk backward from branch tips to assign commits
 *    to branches. Main/master gets priority.
 * 4. Lane assignment: inherit parent lane only when on the same branch.
 *    Different branch always gets a new lane.
```

- [ ] **Step 4: Run all tests**

Run: `npm run test -- --run tests/graph/layout.test.ts`
Expected: ALL tests PASS (including existing ones)

Key verifications:
- Existing "single commit" test: node without branches → lane 0 ✓
- Existing "linear chain" test: all nodes without branches, same undefined branch → all lane 0 ✓
- Existing "branching" test: nodes without branches, childCount logic still works ✓
- New "branch divergence" tests: different named branches → different lanes ✓

- [ ] **Step 5: Commit**

```bash
git add src/graph/layout.ts tests/graph/layout.test.ts
git commit -m "fix: branch-aware lane assignment for diverging graph (#3)"
```

---

### Task 4: Initial Commit Visibility + Graph Reactivity (Issue #4)

**Closes:** #4
**Files:**
- Modify: `src/store/engine.ts:26,76`
- Modify: `src/ui/Graph.svelte`

**Problem:** Two issues combine to make commits invisible in the graph:
1. **Reactivity:** `engine.set(eng)` passes the same object reference. Svelte 5's signal equality check (`===`) sees no change and skips re-derivation of the layout.
2. **Clipping:** The SVG has no padding, so labels extending above/below nodes at the edges are clipped.

**Fix:** Add an `engineVersion` counter that increments after each command, forcing `$derived.by` to re-run. Add SVG padding via a `<g transform>` wrapper.

- [ ] **Step 1: Add `engineVersion` to `src/store/engine.ts`**

Add after line 28 (`export const terminalLines = ...`):

```typescript
export const engineVersion = writable(0);
```

Then in `executeCommand()`, after `engine.set(eng)` (line 76), add:

```typescript
  engine.set(eng);
  engineVersion.update((v) => v + 1);
```

- [ ] **Step 2: Update Graph.svelte to track version and add padding**

Full replacement for `src/ui/Graph.svelte`:

```svelte
<script lang="ts">
  import { engine, engineVersion } from '$store/engine';
  import { computeLayout } from '$graph/layout';
  import type { GraphNode, GraphEdge } from '$graph/types';
  import CommitDetail from './CommitDetail.svelte';

  const LANE_COLORS = ['#4ade80', '#60a5fa', '#c084fc', '#f87171', '#facc15', '#22d3ee'];
  const NODE_RADIUS = 12;
  const GRAPH_PADDING = 40;

  const layout = $derived.by(() => {
    const eng = $engine;
    void $engineVersion;
    const allCommits = eng.allCommits();
    if (allCommits.length === 0) {
      return { nodes: [], edges: [], width: 0, height: 0 };
    }

    const headHash = (() => {
      try {
        return eng.getHEAD().attached
          ? (eng.allBranches().get(eng.getHEAD().target) ?? '')
          : eng.getHEAD().target;
      } catch {
        return '';
      }
    })();

    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const branchMap = new Map<string, string[]>();
    for (const [name, hash] of eng.allBranches()) {
      if (!hash) continue;
      branchMap.set(hash, [...(branchMap.get(hash) ?? []), name]);
    }

    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const tagMap = new Map<string, string[]>();
    for (const [name, hash] of eng.allTags()) {
      if (!hash) continue;
      tagMap.set(hash, [...(tagMap.get(hash) ?? []), name]);
    }

    const inputNodes: GraphNode[] = allCommits.map((c) => ({
      hash: c.hash,
      parents: c.parents,
      message: c.message,
      branches: branchMap.get(c.hash) ?? [],
      tags: tagMap.get(c.hash) ?? [],
      isHEAD: c.hash === headHash,
      lane: 0,
      x: 0,
      y: 0,
    }));

    return computeLayout(inputNodes);
  });

  let selectedNode = $state<GraphNode | null>(null);

  function selectNode(node: GraphNode) {
    selectedNode = selectedNode?.hash === node.hash ? null : node;
  }

  function laneColor(lane: number): string {
    return LANE_COLORS[lane % LANE_COLORS.length];
  }

  function edgePath(edge: GraphEdge): string {
    const midX = (edge.fromX + edge.toX) / 2;
    return `M ${edge.fromX} ${edge.fromY} C ${midX} ${edge.fromY}, ${midX} ${edge.toY}, ${edge.toX} ${edge.toY}`;
  }
</script>

<div class="relative w-full h-full overflow-auto bg-terminal-bg">
  {#if layout.nodes.length === 0}
    <div class="flex items-center justify-center w-full h-full">
      <p class="font-mono text-terminal-dim text-sm select-none">No commits yet</p>
    </div>
  {:else}
    <svg
      width={layout.width + GRAPH_PADDING * 2}
      height={layout.height + GRAPH_PADDING * 2}
      class="block"
      style="min-width: 100%; min-height: 100%;"
    >
      <g transform="translate({GRAPH_PADDING}, {GRAPH_PADDING})">
        <!-- Edges -->
        {#each layout.edges as edge (edge.from + '→' + edge.to)}
          {@const fromNode = layout.nodes.find((n) => n.hash === edge.from)}
          <path
            d={edgePath(edge)}
            fill="none"
            stroke={fromNode ? laneColor(fromNode.lane) : '#888'}
            stroke-width="2"
            opacity="0.6"
          />
        {/each}

        <!-- Nodes -->
        {#each layout.nodes as node (node.hash)}
          {@const color = laneColor(node.lane)}
          <!-- Branch labels above node -->
          {#each node.branches as branch, bi (branch)}
            {@const pillWidth = Math.max(branch.length * 5.6 + 14, 36)}
            <rect
              x={node.x - pillWidth / 2}
              y={node.y - NODE_RADIUS - 22 - bi * 18}
              width={pillWidth}
              height={16}
              rx={4}
              fill={color}
              opacity="0.85"
            />
            <text
              x={node.x}
              y={node.y - NODE_RADIUS - 22 - bi * 18 + 11}
              text-anchor="middle"
              font-family="monospace"
              font-size="9"
              fill="#0d1117">{branch}</text
            >
          {/each}

          <!-- Tag labels below node -->
          {#each node.tags ?? [] as tag, ti (tag)}
            <rect
              x={node.x - 20}
              y={node.y + NODE_RADIUS + 4 + ti * 18}
              width={40}
              height={14}
              rx={3}
              fill="#f59e0b"
              opacity="0.85"
            />
            <text
              x={node.x}
              y={node.y + NODE_RADIUS + 4 + ti * 18 + 10}
              text-anchor="middle"
              font-family="monospace"
              font-size="8"
              fill="#0d1117">{tag}</text
            >
          {/each}

          <!-- Commit circle -->
          <circle
            cx={node.x}
            cy={node.y}
            r={NODE_RADIUS}
            fill={color}
            stroke={node.isHEAD ? '#ffffff' : color}
            stroke-width={node.isHEAD ? 3 : 1}
            style="cursor: pointer;"
            onclick={() => selectNode(node)}
            role="button"
            tabindex="0"
            aria-label={`Commit ${node.hash}: ${node.message}`}
            onkeydown={(e) => e.key === 'Enter' && selectNode(node)}
          />

          <!-- Short hash label inside circle -->
          <text
            x={node.x}
            y={node.y + 4}
            text-anchor="middle"
            font-family="monospace"
            font-size="8"
            fill="#0d1117"
            pointer-events="none">{node.hash.slice(0, 4)}</text
          >
        {/each}
      </g>
    </svg>
  {/if}

  <!-- Commit detail popover -->
  {#if selectedNode}
    <CommitDetail node={selectedNode} onclose={() => (selectedNode = null)} />
  {/if}
</div>
```

Key changes from original:
- Import `engineVersion` (line 2)
- Add `GRAPH_PADDING = 40` constant (line 9)
- Add `void $engineVersion` in derived (line 14) to force re-evaluation
- SVG dimensions include `+ GRAPH_PADDING * 2` (lines 82-83)
- All content wrapped in `<g transform="translate(...)">` (line 87)
- Branch label pills use dynamic width based on text length (line 98)

- [ ] **Step 3: Verify build**

Run: `npm run typecheck && npm run test -- --run`
Expected: ALL PASS

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`

Check:
1. Open app, run `touch file.txt`, `git add file.txt`, `git commit -m "init"`
2. Graph immediately shows a single green node with "main" label above
3. Make more commits → graph grows left-to-right
4. Toggle focus mode → graph visible in both modes
5. Nodes have padding around edges (no clipping of labels)

- [ ] **Step 5: Commit**

```bash
git add src/store/engine.ts src/ui/Graph.svelte
git commit -m "fix: initial commit visibility and graph reactivity (#4)"
```

---

### Task 5: HEAD Indicator Enhancement (Issue #5)

**Closes:** #5
**Depends on:** Task 4 (modifies same Graph.svelte file)
**Files:**
- Modify: `src/ui/Graph.svelte`

**Design:**
- **Attached HEAD** (on branch): The branch pill for HEAD's target shows `HEAD → branchName` in cyan (#22d3ee) instead of the lane color. Visually distinct, no extra vertical space needed.
- **Detached HEAD** (on commit): A standalone `HEAD` pill with dashed cyan border appears above the commit.
- **Glow ring:** A pulsing cyan ring around the HEAD commit node for at-a-glance visibility.

- [ ] **Step 1: Add `headBranch` derived and update node rendering in `src/ui/Graph.svelte`**

Add after the `layout` derived (after the closing `});`):

```typescript
  const headBranch = $derived.by(() => {
    const eng = $engine;
    void $engineVersion;
    try {
      const h = eng.getHEAD();
      return h.attached ? h.target : null;
    } catch {
      return null;
    }
  });
```

Replace the `<!-- Nodes -->` section inside the `<g>` group with:

```svelte
        <!-- Nodes -->
        {#each layout.nodes as node (node.hash)}
          {@const color = laneColor(node.lane)}

          <!-- HEAD glow ring -->
          {#if node.isHEAD}
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS + 4}
              fill="none"
              stroke="#22d3ee"
              stroke-width="2"
              opacity="0.5"
            >
              <animate
                attributeName="opacity"
                values="0.3;0.7;0.3"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          {/if}

          <!-- Branch labels above node -->
          {#each node.branches as branch, bi (branch)}
            {@const isHeadBranch = node.isHEAD && headBranch === branch}
            {@const label = isHeadBranch ? `HEAD → ${branch}` : branch}
            {@const pillWidth = Math.max(label.length * 5.6 + 14, 36)}
            <rect
              x={node.x - pillWidth / 2}
              y={node.y - NODE_RADIUS - 22 - bi * 18}
              width={pillWidth}
              height={16}
              rx={4}
              fill={isHeadBranch ? '#22d3ee' : color}
              opacity={isHeadBranch ? 0.95 : 0.85}
            />
            <text
              x={node.x}
              y={node.y - NODE_RADIUS - 22 - bi * 18 + 11}
              text-anchor="middle"
              font-family="monospace"
              font-size="9"
              fill="#0d1117"
              font-weight={isHeadBranch ? 'bold' : 'normal'}>{label}</text
            >
          {/each}

          <!-- Detached HEAD label (when HEAD points directly at commit, not a branch) -->
          {#if node.isHEAD && !headBranch}
            {@const pillWidth = 4 * 5.6 + 14}
            {@const headY = node.y - NODE_RADIUS - 22 - node.branches.length * 18}
            <rect
              x={node.x - pillWidth / 2}
              y={headY - 13}
              width={pillWidth}
              height={16}
              rx={4}
              fill="none"
              stroke="#22d3ee"
              stroke-width="1.5"
              stroke-dasharray="3 2"
            />
            <text
              x={node.x}
              y={headY - 1}
              text-anchor="middle"
              font-family="monospace"
              font-size="9"
              font-weight="bold"
              fill="#22d3ee">HEAD</text
            >
          {/if}

          <!-- Tag labels below node -->
          {#each node.tags ?? [] as tag, ti (tag)}
            <rect
              x={node.x - 20}
              y={node.y + NODE_RADIUS + 4 + ti * 18}
              width={40}
              height={14}
              rx={3}
              fill="#f59e0b"
              opacity="0.85"
            />
            <text
              x={node.x}
              y={node.y + NODE_RADIUS + 4 + ti * 18 + 10}
              text-anchor="middle"
              font-family="monospace"
              font-size="8"
              fill="#0d1117">{tag}</text
            >
          {/each}

          <!-- Commit circle -->
          <circle
            cx={node.x}
            cy={node.y}
            r={NODE_RADIUS}
            fill={color}
            stroke={node.isHEAD ? '#22d3ee' : color}
            stroke-width={node.isHEAD ? 2 : 1}
            style="cursor: pointer;"
            onclick={() => selectNode(node)}
            role="button"
            tabindex="0"
            aria-label={`Commit ${node.hash}: ${node.message}`}
            onkeydown={(e) => e.key === 'Enter' && selectNode(node)}
          />

          <!-- Short hash label inside circle -->
          <text
            x={node.x}
            y={node.y + 4}
            text-anchor="middle"
            font-family="monospace"
            font-size="8"
            fill="#0d1117"
            pointer-events="none">{node.hash.slice(0, 4)}</text
          >
        {/each}
```

Changes from Task 4 baseline:
- Added `headBranch` derived
- Added HEAD glow ring with pulse animation
- Branch pill: `isHeadBranch` check → cyan fill + "HEAD → branch" label + bold text
- Detached HEAD: separate dashed-border cyan pill above node
- Commit circle stroke: changed from `#ffffff` to `#22d3ee` for HEAD nodes

- [ ] **Step 2: Verify build**

Run: `npm run typecheck && npm run test -- --run`
Expected: ALL PASS

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Check:
1. Make initial commit → "HEAD → main" label in cyan above the node, pulsing glow ring
2. Create branch: `git branch feat && git checkout feat` → "HEAD → feat" moves to new branch tip
3. Make commit on feat → HEAD indicator follows
4. Detach HEAD: `git checkout <hash>` → "HEAD" label with dashed border appears on commit
5. Reattach: `git checkout main` → back to "HEAD → main" format
6. HEAD visible in both terminal-focused and graph-focused modes
7. HEAD label doesn't clash with branch/tag labels

- [ ] **Step 4: Commit**

```bash
git add src/ui/Graph.svelte
git commit -m "feat: prominent HEAD indicator with glow and branch arrow (#5)"
```
