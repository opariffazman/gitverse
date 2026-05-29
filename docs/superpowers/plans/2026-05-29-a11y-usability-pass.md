# Accessibility & Usability Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Gitverse graph + terminal to WCAG 2.1 AA, replace checkout-on-click with terminal prefill, show friendly `Cx` labels in the detached prompt and prime labels (`C2'`) for rebased commits, and swap graph scroll for a follow-HEAD pan/zoom viewport.

**Architecture:** Engine changes are pure TypeScript (lineage field + label computation) and TDD'd headless. Shell prompt is a one-line label swap, TDD'd. UI work (Svelte 5) is wired through a tiny new store and verified by Playwright + axe-core. Pan/zoom math lives in a pure `src/graph/viewport.ts` module so it can be unit-tested without the DOM.

**Tech Stack:** Svelte 5 (runes), TypeScript strict, Vitest (headless engine/shell/graph units), Playwright + axe-core (e2e/a11y), hand-built SVG (no graph lib).

**Spec:** `docs/specs/2026-05-29-a11y-usability-pass-design.md`

---

## File Structure

**Engine (pure TS):**
- Modify `src/engine/objects.ts` — add `rewriteOf?: string` to `Commit`.
- Modify `src/engine/commands/rebase.ts` — set `rewriteOf` when minting replayed commits.
- Modify `src/engine/index.ts` — `commitLabel` walks the `rewriteOf` chain to build prime labels.

**Shell:**
- Modify `src/shell/prompt.ts` — detached HEAD renders `commitLabel`, not short hash.

**Store:**
- Modify `src/store/ui.ts` — `pendingInput` store + `prefillTerminal` helper.

**Graph viewport (pure TS, new):**
- Create `src/graph/viewport.ts` — pure pan/zoom transform helpers.

**UI (Svelte):**
- Modify `src/ui/Graph.svelte` — prefill on activate, svg aria-label, roving tabindex, node focus ring, reduced-motion glow gate, pan/zoom viewport + follow-HEAD, zoom controls.
- Modify `src/ui/Terminal.svelte` — consume `pendingInput`, `role="log"`/`aria-live`, labeled input, focus-visible.
- Modify `src/ui/Layout.svelte` — graph container `overflow-hidden`.

**Tests:**
- `tests/engine/labels.test.ts` (extend) — prime labels.
- `tests/engine/rebase.test.ts` (extend) — `rewriteOf` set.
- `tests/engine/persistence` — covered by existing serializer round-trip; add a prime-survives-reload assertion (see Task 1).
- `tests/shell/prompt.test.ts` (extend) — detached prompt label.
- `tests/graph/viewport.test.ts` (new) — pan/zoom helpers.
- `tests/e2e/a11y.spec.ts` (new) — axe + keyboard + prefill + pan/zoom.

---

## Task 1: Rebase prime labels (engine)

**Files:**
- Modify: `src/engine/objects.ts:16-22` (Commit type)
- Modify: `src/engine/commands/rebase.ts:206-211` (writeCommit call)
- Modify: `src/engine/index.ts:335-338` (commitLabel)
- Test: `tests/engine/labels.test.ts`, `tests/engine/rebase.test.ts`

- [ ] **Step 1: Write failing tests for prime labels**

Append to `tests/engine/labels.test.ts` (uses the existing `setup`/`commit` helpers in that file):

```ts
describe('GitEngine commit labels — rebase primes', () => {
  it('labels a rebased commit with one prime', () => {
    const eng = setup();
    commit(eng, 'base.txt', 'base');
    eng.execute('git checkout -b feature');
    commit(eng, 'f1.txt', 'f1');
    const featLabelBefore = eng.commitLabel(eng.getHEAD().target); // detached? no, attached
    expect(featLabelBefore).toBe('C2');

    eng.execute('git checkout main');
    commit(eng, 'm1.txt', 'm1'); // diverge
    eng.execute('git checkout feature');
    eng.execute('git rebase main');

    // New tip is the rewritten 'f1' commit — its original was C2.
    const tipHash = eng.allBranches().get('feature')!;
    expect(eng.commitLabel(tipHash)).toBe("C2'");
  });

  it('stacks primes on repeated rebase', () => {
    const eng = setup();
    commit(eng, 'base.txt', 'base');
    eng.execute('git checkout -b feature');
    commit(eng, 'f1.txt', 'f1'); // C2

    eng.execute('git checkout main');
    commit(eng, 'm1.txt', 'm1');
    eng.execute('git checkout feature');
    eng.execute('git rebase main'); // C2 -> C2'

    eng.execute('git checkout main');
    commit(eng, 'm2.txt', 'm2');
    eng.execute('git checkout feature');
    eng.execute('git rebase main'); // C2' -> C2''

    const tipHash = eng.allBranches().get('feature')!;
    expect(eng.commitLabel(tipHash)).toBe("C2''");
  });

  it('original commit keeps its plain label after rebase', () => {
    const eng = setup();
    commit(eng, 'base.txt', 'base');
    eng.execute('git checkout -b feature');
    const origC2 = commit(eng, 'f1.txt', 'f1');
    eng.execute('git checkout main');
    commit(eng, 'm1.txt', 'm1');
    eng.execute('git checkout feature');
    eng.execute('git rebase main');

    expect(eng.commitLabel(origC2)).toBe('C2'); // abandoned original unchanged
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- labels`
Expected: FAIL — rebased tip currently labels as a later ordinal (e.g. `C4`), not `C2'`.

- [ ] **Step 3: Add `rewriteOf` to the Commit type**

In `src/engine/objects.ts`, change the `Commit` type (lines 16-22):

```ts
export type Commit = {
  hash: string;
  tree: string; // tree hash
  parents: string[];
  message: string;
  timestamp: number;
  rewriteOf?: string; // hash of the commit this one rewrote (rebase); never part of the hash
};
```

No change to `hashContent` input — the serialized string at `objects.ts:124` already omits `rewriteOf`, so the hash is unaffected. `WriteCommitInput = Omit<Commit, 'hash'>` now accepts an optional `rewriteOf` automatically.

- [ ] **Step 4: Set `rewriteOf` in rebase**

In `src/engine/commands/rebase.ts`, the replay loop (lines 206-211) becomes:

```ts
    const newTreeHash = objects.writeTree(newTree);
    const newCommitHash = objects.writeCommit({
      tree: newTreeHash,
      parents: [currentParent],
      message: commit.message,
      timestamp: Date.now(),
      rewriteOf: commit.hash, // lineage: this rewrites `commit`
    });
```

- [ ] **Step 5: Walk the chain in `commitLabel`**

In `src/engine/index.ts`, replace `commitLabel` (lines 335-338):

```ts
  /** Friendly label for a commit hash, e.g. "C3" or "C2'" for a rewrite. */
  commitLabel(hash: string): string {
    // Walk the rewrite chain back to the original commit, counting primes.
    let current = hash;
    let primes = 0;
    while (this.objects.hasCommit(current)) {
      const c = this.objects.readCommit(current);
      if (c.rewriteOf === undefined) break;
      current = c.rewriteOf;
      primes++;
    }
    const ordinal = this.objects.commitOrdinal(current);
    if (ordinal === null) return hash.slice(0, 7);
    return `C${ordinal}` + "'".repeat(primes);
  }
```

(`hasCommit` and `readCommit` already exist on `ObjectStore` — they are used in `rebase.ts`.)

- [ ] **Step 6: Run tests, verify they pass**

Run: `npm run test -- labels`
Expected: PASS (all three new tests + existing label tests).

- [ ] **Step 7: Add a `rewriteOf` assertion to the rebase suite**

Append to `tests/engine/rebase.test.ts` (uses its `engineWithBase` helper):

```ts
describe('git rebase — lineage', () => {
  it('sets rewriteOf on each replayed commit', () => {
    const engine = engineWithBase();
    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('f1.txt', 'f1');
    engine.execute('git add f1.txt');
    engine.execute('git commit -m "add f1"');
    const origHash = engine.log()[0].hash;

    engine.execute('git checkout main');
    engine.getVFS().createFile('m1.txt', 'm1');
    engine.execute('git add m1.txt');
    engine.execute('git commit -m "m1"');
    engine.execute('git checkout feature');
    engine.execute('git rebase main');

    const tip = engine.allCommits().find((c) => c.hash === engine.allBranches().get('feature'));
    expect(tip?.rewriteOf).toBe(origHash);
  });

  it('persists rewriteOf through serialize/restore (prime survives reload)', () => {
    const engine = engineWithBase();
    engine.execute('git checkout -b feature');
    engine.getVFS().createFile('f1.txt', 'f1');
    engine.execute('git add f1.txt');
    engine.execute('git commit -m "add f1"');
    engine.execute('git checkout main');
    engine.getVFS().createFile('m1.txt', 'm1');
    engine.execute('git add m1.txt');
    engine.execute('git commit -m "m1"');
    engine.execute('git checkout feature');
    engine.execute('git rebase main');
    const tipHash = engine.allBranches().get('feature')!;
    const labelBefore = engine.commitLabel(tipHash);

    // Round-trip through the serializer.
    const { serialize, deserialize } = require('$persistence/serializer');
    const restored = new GitEngine();
    deserialize(restored, serialize(engine));
    expect(restored.commitLabel(tipHash)).toBe(labelBefore);
  });
});
```

> If `serialize`/`deserialize` export names differ, open `src/persistence/serializer.ts` and use the actual exported function names. The point: `commits: engine.allCommits()` already spreads the full `Commit` (incl. `rewriteOf`) and `_restoreCommit` copies it whole, so no serializer code change is needed — this test proves it.

- [ ] **Step 8: Run tests, verify they pass**

Run: `npm run test -- rebase`
Expected: PASS. If the round-trip test fails because `rewriteOf` is dropped, add it explicitly to the wire `commits` mapping in `src/persistence/serializer.ts` and re-run.

- [ ] **Step 9: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/engine/objects.ts src/engine/commands/rebase.ts src/engine/index.ts tests/engine/labels.test.ts tests/engine/rebase.test.ts
git commit -m "feat: prime labels (C2') for rebased commits"
```

---

## Task 2: Detached-HEAD prompt label

**Files:**
- Modify: `src/shell/prompt.ts:33-35`
- Test: `tests/shell/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/shell/prompt.test.ts`:

```ts
describe('prompt — detached HEAD', () => {
  it('shows the Cx label, not a raw hash', () => {
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "first"');
    engine.execute('git checkout C1'); // detach at C1

    const segs = generatePrompt(engine);
    expect(segmentByText(segs, 'C1')).toBeDefined();
    // No 7-char hex hash segment.
    expect(segs.some((s) => /^[0-9a-f]{7}$/.test(s.text))).toBe(false);
  });

  it('detached label is red', () => {
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "first"');
    engine.execute('git checkout C1');
    const segs = generatePrompt(engine);
    expect(segmentByText(segs, 'C1')?.color).toBe('red');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- prompt`
Expected: FAIL — prompt currently shows the 7-char hash.

- [ ] **Step 3: Swap the detached branch to use `commitLabel`**

In `src/shell/prompt.ts`, the detached branch (lines 33-35) becomes:

```ts
  // Branch name or detached commit label
  if (!head.attached) {
    segments.push({ text: engine.commitLabel(head.target), color: 'red' });
  } else {
    segments.push({ text: head.target, color: dirty ? 'yellow' : 'green' });
  }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- prompt`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/shell/prompt.ts tests/shell/prompt.test.ts
git commit -m "feat: show Cx label in detached-HEAD prompt"
```

---

## Task 3: Graph → terminal prefill

**Files:**
- Modify: `src/store/ui.ts` (currently just comments)
- Modify: `src/ui/Graph.svelte:152-172` (selectNode)
- Modify: `src/ui/Terminal.svelte` (consume store)

- [ ] **Step 1: Add the prefill store**

Replace the contents of `src/store/ui.ts` with:

```ts
import { writable } from 'svelte/store';

// Command text the graph wants placed into the terminal input (not executed).
// Terminal consumes it, sets the input, focuses, then resets this to null.
export const pendingInput = writable<string | null>(null);

export function prefillTerminal(cmd: string): void {
  pendingInput.set(cmd);
}
```

- [ ] **Step 2: Prefill instead of execute in the graph**

In `src/ui/Graph.svelte`:

Add to the import block near the top (the existing `engine` import is from `$store/engine`):

```ts
  import { prefillTerminal } from '$store/ui';
```

Replace `selectNode` (lines 152-172) with:

```ts
  function selectNode(node: GraphNode) {
    if (node.type === 'phantom') return;

    // Show this node's detail.
    selectedHash = node.hash;

    let command: string;
    if (node.branches.length > 0) {
      const branch =
        headBranch && node.branches.includes(headBranch) ? headBranch : node.branches[0];
      command = `git checkout ${branch}`;
    } else {
      command = `git checkout ${node.label ?? node.hash}`;
    }
    // Prefill the terminal — the user reviews and presses Enter. Never auto-runs.
    prefillTerminal(command);
  }
```

(`executeCommand` may now be an unused import — remove it from the `$store/engine` import line if ESLint flags it.)

- [ ] **Step 3: Consume the store in the terminal**

In `src/ui/Terminal.svelte`, add to the import block:

```ts
  import { pendingInput } from '$store/ui';
```

After the existing `let scrollEl` declaration (around line 12), add an effect:

```ts
  $effect(() => {
    const cmd = $pendingInput;
    if (cmd === null) return;
    inputValue = cmd;
    cursorPos = cmd.length;
    pendingInput.set(null); // re-arm so re-selecting the same node works again
    tick().then(() => {
      inputEl?.focus();
      inputEl?.setSelectionRange(cursorPos, cursorPos);
    });
  });
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open the app. Run `git commit` a couple of times via the terminal, then click a commit node.
Expected: the terminal input is filled with `git checkout C…`, the input is focused, cursor at end, and **nothing executes** until you press Enter. Clicking the same node again re-fills it.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` and `npm run lint`

```bash
git add src/store/ui.ts src/ui/Graph.svelte src/ui/Terminal.svelte
git commit -m "feat: graph node click prefills checkout into terminal"
```

---

## Task 4: Terminal accessibility (role=log, label, focus-visible)

**Files:**
- Modify: `src/ui/Terminal.svelte:195-244`

- [ ] **Step 1: Make the output region a live log**

In `src/ui/Terminal.svelte`, the scroll container `<div bind:this={scrollEl} ...>` (line 195) gets log semantics. Change its opening tag to:

```svelte
<div
  bind:this={scrollEl}
  class="h-full overflow-y-auto p-3 space-y-0.5 font-mono text-sm"
  role="log"
  aria-live="polite"
  aria-label="Terminal output"
  onclick={focusInput}
>
```

- [ ] **Step 2: Label the input and add a visible focus ring**

Replace the `<input ...>` element (lines 221-232) with:

```svelte
      <label for="terminal-input" class="sr-only">Terminal command input</label>
      <input
        id="terminal-input"
        bind:this={inputEl}
        type="text"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck={false}
        class="w-full bg-transparent border-none text-terminal-fg caret-terminal-green font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-terminal-green/70 rounded-sm"
        value={inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
      />
```

> `sr-only` is a standard visually-hidden utility. UnoCSS does not ship it by default — verify it renders hidden in the browser. If it is not defined, add this rule to `src/app.css` (or the global stylesheet imported by `main.ts`):
>
> ```css
> .sr-only {
>   position: absolute;
>   width: 1px;
>   height: 1px;
>   padding: 0;
>   margin: -1px;
>   overflow: hidden;
>   clip: rect(0, 0, 0, 0);
>   white-space: nowrap;
>   border: 0;
> }
> ```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Tab to the input — a visible green focus ring appears. With a screen reader (VoiceOver: Cmd+F5), run a command and confirm the output line is announced.

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck` and `npm run lint`

```bash
git add src/ui/Terminal.svelte src/app.css
git commit -m "feat: terminal a11y — live log region, labeled input, focus ring"
```

---

## Task 5: Graph accessibility (svg label, roving tabindex, focus ring, reduced-motion)

**Files:**
- Modify: `src/ui/Graph.svelte` (svg element, node `<circle>`, HEAD glow, script)

- [ ] **Step 1: Add a reactive svg summary label**

In `src/ui/Graph.svelte` script block, add a derived summary near the other `$derived`s (after `headCommitHash`):

```ts
  const graphSummary = $derived.by(() => {
    const n = layout.nodes.filter((nd) => nd.type !== 'phantom').length;
    const head = headBranch ? `HEAD on ${headBranch}` : 'detached HEAD';
    return `Commit graph: ${n} commit${n === 1 ? '' : 's'}, ${head}`;
  });
```

Change the `<svg ...>` opening tag (line 189) to carry the role + label:

```svelte
    <svg
      width={svgWidth}
      height={svgHeight}
      class="block"
      style="min-width: 100%; min-height: 100%;"
      role="group"
      aria-label={graphSummary}
    >
```

- [ ] **Step 2: Add roving-tabindex state + key handler**

In the script block add:

```ts
  let focusedIndex = $state(0);

  const commitNodes = $derived(layout.nodes.filter((n) => n.type !== 'phantom'));

  function onNodeKeydown(e: KeyboardEvent, node: GraphNode, index: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectNode(node);
      return;
    }
    const last = commitNodes.length - 1;
    let next = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(index + 1, last);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(index - 1, 0);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    focusedIndex = next;
    const el = document.getElementById(`commit-node-${next}`);
    el?.focus();
  }
```

- [ ] **Step 3: Apply roving tabindex + focus ring to the commit circle**

Replace the interactive commit `<circle>` (lines 358-371) with a version using a stable index. Note the `{#each}` already exposes `ni`; we need the index among commit nodes — use `commitNodes.indexOf(node)`:

```svelte
            {@const cIdx = commitNodes.indexOf(node)}
            <circle
              id={`commit-node-${cIdx}`}
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill={color}
              stroke={node.isHEAD ? '#22d3ee' : color}
              stroke-width={node.isHEAD ? 3 : 1.5}
              style="cursor: pointer;"
              class="focus-visible:outline-none"
              onclick={() => selectNode(node)}
              role="button"
              tabindex={cIdx === focusedIndex ? 0 : -1}
              aria-label={`Commit ${node.label ?? node.hash}: ${node.message}. Activate to prefill git checkout.`}
              onkeydown={(e) => onNodeKeydown(e, node, cIdx)}
            />
            {#if cIdx === focusedIndex}
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS + 4}
                fill="none"
                stroke="#ffffff"
                stroke-width="2"
                stroke-dasharray="3 2"
                pointer-events="none"
                class="graph-focus-ring"
              />
            {/if}
```

Add to a `<style>` block at the bottom of `Graph.svelte` (the ring should only show when a node actually has focus, not always):

```svelte
<style>
  .graph-focus-ring {
    opacity: 0;
  }
  :global(circle[role='button']:focus-visible) + .graph-focus-ring,
  :global(circle[role='button']:focus) + .graph-focus-ring {
    opacity: 1;
  }
</style>
```

> If the adjacent-sibling selector proves brittle across the keyed `{#each}`, fall back to a simpler always-visible ring on the focused index (drop the opacity rule). The functional requirement is: the keyboard-focused node is visibly outlined.

- [ ] **Step 4: Gate the HEAD glow pulse under reduced motion**

`prefersReducedMotion` already exists in the script. Wrap the HEAD glow `<animate>` (lines 260-265) so it only animates when motion is allowed. Replace the glow `<circle>` block (lines 251-266) with:

```svelte
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS + 8}
              fill="none"
              stroke="#22d3ee"
              stroke-width="2.5"
              opacity="0.5"
            >
              {#if !prefersReducedMotion}
                <animate
                  attributeName="opacity"
                  values="0.3;0.7;0.3"
                  dur="2s"
                  repeatCount="indefinite"
                />
              {/if}
            </circle>
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Tab into the graph — focus lands on one node (one tab stop), Arrow keys move the dashed focus ring between commits, Home/End jump to ends, Enter/Space prefills checkout. Toggle OS "reduce motion" — the HEAD pulse stops; the static ring remains.

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck` and `npm run lint`

```bash
git add src/ui/Graph.svelte
git commit -m "feat: graph a11y — svg label, roving tabindex, focus ring, reduced-motion"
```

---

## Task 6: Graph pan/zoom viewport with follow-HEAD

**Files:**
- Create: `src/graph/viewport.ts`
- Test: `tests/graph/viewport.test.ts`
- Modify: `src/ui/Graph.svelte` (transform, pointer/wheel handlers, controls)
- Modify: `src/ui/Layout.svelte:31` (overflow-hidden)

- [ ] **Step 1: Write failing tests for the pure viewport helpers**

Create `tests/graph/viewport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clampZoom, zoomAt, fitTransform, followHeadPan, MIN_K, MAX_K } from '$graph/viewport';

describe('viewport helpers', () => {
  it('clamps zoom into [MIN_K, MAX_K]', () => {
    expect(clampZoom(MAX_K + 5)).toBe(MAX_K);
    expect(clampZoom(MIN_K - 5)).toBe(MIN_K);
    expect(clampZoom(1)).toBe(1);
  });

  it('zoomAt keeps the focus point stationary', () => {
    const start = { panX: 0, panY: 0, k: 1 };
    // Zoom in by 2x centered at screen point (100, 100).
    const next = zoomAt(start, 2, 100, 100);
    // The content point under (100,100) before and after must be identical.
    const before = { x: (100 - start.panX) / start.k, y: (100 - start.panY) / start.k };
    const after = { x: (100 - next.panX) / next.k, y: (100 - next.panY) / next.k };
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
    expect(next.k).toBeCloseTo(2, 5);
  });

  it('fitTransform centers content within the viewport with zoom <= 1', () => {
    const t = fitTransform(400, 200, 800, 600, 40);
    expect(t.k).toBeLessThanOrEqual(1);
    expect(t.k).toBeGreaterThan(0);
    // Content center maps near viewport center.
    const cx = t.panX + (400 / 2) * t.k;
    const cy = t.panY + (200 / 2) * t.k;
    expect(cx).toBeCloseTo(400, 0);
    expect(cy).toBeCloseTo(300, 0);
  });

  it('followHeadPan centers the given node, preserving zoom', () => {
    const t = followHeadPan({ panX: 0, panY: 0, k: 2 }, 300, 150, 800, 600);
    expect(t.k).toBe(2);
    expect(t.panX + 300 * t.k).toBeCloseTo(400, 5);
    expect(t.panY + 150 * t.k).toBeCloseTo(300, 5);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- viewport`
Expected: FAIL — module `$graph/viewport` does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `src/graph/viewport.ts`:

```ts
// Pure pan/zoom transform math for the commit graph. No DOM access — unit-tested.

export type Transform = { panX: number; panY: number; k: number };

export const MIN_K = 0.2;
export const MAX_K = 2.5;

export function clampZoom(k: number): number {
  return Math.min(MAX_K, Math.max(MIN_K, k));
}

/**
 * Zoom by `factor` about screen point (cx, cy), keeping the content point
 * under the cursor stationary.
 */
export function zoomAt(t: Transform, factor: number, cx: number, cy: number): Transform {
  const k = clampZoom(t.k * factor);
  const ratio = k / t.k;
  return {
    k,
    panX: cx - (cx - t.panX) * ratio,
    panY: cy - (cy - t.panY) * ratio,
  };
}

export function panBy(t: Transform, dx: number, dy: number): Transform {
  return { ...t, panX: t.panX + dx, panY: t.panY + dy };
}

/** Fit content (contentW × contentH) into the viewport with padding; zoom capped at 1. */
export function fitTransform(
  contentW: number,
  contentH: number,
  viewW: number,
  viewH: number,
  padding: number,
): Transform {
  if (contentW <= 0 || contentH <= 0) return { panX: 0, panY: 0, k: 1 };
  const kx = (viewW - padding * 2) / contentW;
  const ky = (viewH - padding * 2) / contentH;
  const k = clampZoom(Math.min(kx, ky, 1));
  return {
    k,
    panX: (viewW - contentW * k) / 2,
    panY: (viewH - contentH * k) / 2,
  };
}

/** Pan (keeping zoom) so content point (nodeX, nodeY) sits at the viewport center. */
export function followHeadPan(
  t: Transform,
  nodeX: number,
  nodeY: number,
  viewW: number,
  viewH: number,
): Transform {
  return {
    k: t.k,
    panX: viewW / 2 - nodeX * t.k,
    panY: viewH / 2 - nodeY * t.k,
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test -- viewport`
Expected: PASS.

- [ ] **Step 5: Wire the viewport into Graph.svelte**

In `src/ui/Graph.svelte` script block, import the helpers and add transform state:

```ts
  import {
    type Transform,
    clampZoom,
    zoomAt,
    panBy,
    fitTransform,
    followHeadPan,
    MIN_K,
    MAX_K,
  } from '$graph/viewport';

  let transform = $state<Transform>({ panX: GRAPH_PADDING, panY: GRAPH_PADDING, k: 1 });
  let followHead = $state(true);
  let viewportEl: HTMLDivElement;
  let dragging = $state(false);
  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

  function viewSize() {
    return { w: viewportEl?.clientWidth ?? 800, h: viewportEl?.clientHeight ?? 600 };
  }

  function fit() {
    const { w, h } = viewSize();
    transform = fitTransform(layout.width, layout.height, w, h, GRAPH_PADDING);
    followHead = false;
  }

  function zoomButton(factor: number) {
    const { w, h } = viewSize();
    transform = zoomAt(transform, factor, w / 2, h / 2);
    followHead = false;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = viewportEl.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    transform = zoomAt(transform, factor, e.clientX - rect.left, e.clientY - rect.top);
    followHead = false;
  }

  function onPointerDown(e: PointerEvent) {
    // Ignore drags that start on an interactive node (let click/keyboard handle those).
    if ((e.target as Element).getAttribute('role') === 'button') return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, panX: transform.panX, panY: transform.panY };
    viewportEl.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    transform = {
      ...transform,
      panX: dragStart.panX + (e.clientX - dragStart.x),
      panY: dragStart.panY + (e.clientY - dragStart.y),
    };
    followHead = false;
  }

  function onPointerUp(e: PointerEvent) {
    dragging = false;
    viewportEl.releasePointerCapture?.(e.pointerId);
  }

  function onViewportKeydown(e: KeyboardEvent) {
    const STEP = 40;
    if (e.key === '+' || e.key === '=') zoomButton(1.1);
    else if (e.key === '-' || e.key === '_') zoomButton(1 / 1.1);
    else if (e.key === '0') fit();
    else if (e.key === 'ArrowUp') transform = panBy(transform, 0, STEP);
    else if (e.key === 'ArrowDown') transform = panBy(transform, 0, -STEP);
    else if (e.key === 'ArrowLeft') transform = panBy(transform, STEP, 0);
    else if (e.key === 'ArrowRight') transform = panBy(transform, -STEP, 0);
    else return;
    e.preventDefault();
    if (e.key !== '0') followHead = false;
  }

  // Follow HEAD: when a new commit lands and follow is engaged, recenter on HEAD.
  $effect(() => {
    void $engineVersion;
    if (!followHead) return;
    const headNode = layout.nodes.find((n) => n.hash === headCommitHash);
    if (!headNode) return;
    const { w, h } = viewSize();
    transform = followHeadPan(transform, headNode.x, headNode.y, w, h);
  });
```

> Pinch-zoom on touch: pointer-events deliver two pointers; a minimal two-pointer pinch can be added later. Basic one-finger pan + buttons + wheel cover the AA requirement now (the `fit` control guarantees reachability). Note this limitation in the e2e task rather than blocking here.

- [ ] **Step 6: Apply the transform and remove SVG overflow sizing**

The outer wrapper div (line 183) becomes the fixed-size viewport. Replace it and the SVG group transform:

Change the wrapper `<div class="relative w-full h-full overflow-auto bg-terminal-bg">` (line 183) to:

```svelte
<div
  bind:this={viewportEl}
  class="relative w-full h-full overflow-hidden bg-terminal-bg touch-none"
  role="application"
  aria-label="Commit graph viewport. Arrow keys pan, plus and minus zoom, 0 fits."
  tabindex="0"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onkeydown={onViewportKeydown}
>
```

Change the `<svg ...>` to fill the viewport (not size-to-content), and move the pan/zoom onto the inner `<g>`:

```svelte
    <svg width="100%" height="100%" class="block" role="group" aria-label={graphSummary}>
      <g transform={`translate(${transform.panX}, ${transform.panY}) scale(${transform.k})`}>
```

(Delete the old `transform="translate({GRAPH_PADDING}, {GRAPH_PADDING})"` on the group and the `width={svgWidth} height={svgHeight}` attributes — `svgWidth`/`svgHeight` may now be unused; remove their `$derived` declarations if ESLint flags them.)

- [ ] **Step 7: Add on-screen zoom controls**

Just before the closing `</div>` of the viewport (after the `{#if selectedNode}` block), add:

```svelte
  <div class="absolute bottom-3 right-3 z-20 flex flex-col gap-1">
    <button
      type="button"
      class="w-9 h-9 rounded bg-terminal-bg/90 border border-terminal-dim/40 text-terminal-fg text-lg leading-none hover:border-terminal-green focus-visible:ring-2 focus-visible:ring-terminal-green"
      aria-label="Zoom in"
      onclick={() => zoomButton(1.2)}>+</button
    >
    <button
      type="button"
      class="w-9 h-9 rounded bg-terminal-bg/90 border border-terminal-dim/40 text-terminal-fg text-lg leading-none hover:border-terminal-green focus-visible:ring-2 focus-visible:ring-terminal-green"
      aria-label="Zoom out"
      onclick={() => zoomButton(1 / 1.2)}>−</button
    >
    <button
      type="button"
      class="w-9 h-9 rounded bg-terminal-bg/90 border border-terminal-dim/40 text-terminal-fg text-xs leading-none hover:border-terminal-green focus-visible:ring-2 focus-visible:ring-terminal-green"
      aria-label="Fit graph to view"
      onclick={fit}>fit</button
    >
  </div>
```

- [ ] **Step 8: Layout container to overflow-hidden**

In `src/ui/Layout.svelte`, change the graph wrapper (line 31) from:

```svelte
  <div class="flex-1 min-h-0 overflow-auto">
```

to:

```svelte
  <div class="flex-1 min-h-0 overflow-hidden">
```

- [ ] **Step 9: Manual verification**

Run: `npm run dev`. Commit several times — the camera keeps HEAD centered (follow). Drag to pan, wheel to zoom toward cursor — follow disengages. Click `fit` (or focus the graph and press `0`) — the whole DAG fits. No scrollbars appear at any graph length. Focus graph, use Arrow keys to pan and `+`/`−` to zoom.

- [ ] **Step 10: Typecheck + commit**

Run: `npm run typecheck`, `npm run lint`, `npm run test -- viewport`

```bash
git add src/graph/viewport.ts tests/graph/viewport.test.ts src/ui/Graph.svelte src/ui/Layout.svelte
git commit -m "feat: graph pan/zoom viewport with follow-HEAD camera"
```

---

## Task 7: E2E — axe-core + keyboard + prefill + pan/zoom

**Files:**
- Create: `tests/e2e/a11y.spec.ts`
- Modify: `package.json` (add `@axe-core/playwright` dev dep)

- [ ] **Step 1: Install the axe Playwright integration**

Run:

```bash
npm install -D @axe-core/playwright@4
```

Expected: added to `devDependencies`.

- [ ] **Step 2: Write the e2e + a11y spec**

Create `tests/e2e/a11y.spec.ts`. Match the base path used by existing e2e tests (the app serves under `/gitverse/` per `vite.config.ts`; if existing specs navigate to `/`, use `/` — check one existing spec in `tests/e2e/` and mirror its `page.goto`).

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/'); // mirror existing e2e specs' base URL
});

test('no WCAG 2.1 AA violations on initial view', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('clicking a commit node prefills checkout without executing', async ({ page }) => {
  const input = page.locator('#terminal-input');
  await input.click();
  await input.fill('git commit -m first');
  await input.press('Enter');

  // Click the commit circle.
  await page.locator('circle[role="button"]').first().click();

  await expect(input).toHaveValue(/git checkout/);
  // It did NOT execute: no new prompt line containing the checkout command output yet.
  await expect(input).toBeFocused();
});

test('graph is keyboard navigable and fit works', async ({ page }) => {
  const input = page.locator('#terminal-input');
  await input.click();
  await input.fill('git commit -m a');
  await input.press('Enter');
  await input.fill('git commit -m b');
  await input.press('Enter');

  // Focus the graph viewport and exercise pan/zoom keys + fit.
  await page.locator('[role="application"]').focus();
  await page.keyboard.press('Equal'); // zoom in (+)
  await page.keyboard.press('0'); // fit
  await page.getByRole('button', { name: 'Fit graph to view' }).click();

  // Tab to a commit node and activate it.
  await page.locator('circle[role="button"]').first().focus();
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue(/git checkout/);
});

test('reduced motion disables the HEAD pulse animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const input = page.locator('#terminal-input');
  await input.click();
  await input.fill('git commit -m a');
  await input.press('Enter');
  // The glow <animate> element must not be rendered under reduced motion.
  await expect(page.locator('circle animate')).toHaveCount(0);
});
```

> Pinch-zoom is not covered (out of scope this pass — see Task 6 note). If any axe violation surfaces (e.g. contrast on a prompt segment or button), fix it at its source file and re-run rather than suppressing the rule.

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e -- a11y`
Expected: all four tests PASS. If axe reports a contrast violation, adjust the offending color in the relevant component / UnoCSS theme until ≥4.5:1, then re-run.

- [ ] **Step 4: Run the full unit + typecheck gate**

Run: `npm run test` then `npm run typecheck` then `npm run lint`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/a11y.spec.ts package.json package-lock.json
git commit -m "test: e2e a11y — axe, keyboard nav, prefill, pan/zoom, reduced motion"
```

---

## Self-Review Notes

- **Spec §2 (prefill)** → Task 3. **§3 (detached prompt)** → Task 2. **§4 (prime labels + persistence)** → Task 1. **§5 (pan/zoom + follow-HEAD + fit)** → Task 6. **§6 terminal AA** → Task 4; **§6 graph AA** → Task 5. **§7 testing** → distributed across Tasks 1–2 (engine/shell), 6 (viewport units), 7 (e2e/axe).
- **Known verification points flagged inline** (not placeholders): exact serializer export names (Task 1 Step 7), `sr-only` availability in UnoCSS (Task 4), focus-ring sibling selector robustness (Task 5), e2e base URL (Task 7). Each has a concrete fallback.
- **Type consistency:** `Transform`, `clampZoom`, `zoomAt`, `panBy`, `fitTransform`, `followHeadPan`, `MIN_K`, `MAX_K` are defined in Task 6 Step 3 and consumed identically in Steps 1 and 5. `pendingInput`/`prefillTerminal` defined in Task 3 Step 1, consumed in Steps 2–3. `rewriteOf` defined in Task 1 Step 3, used in Steps 4–5.
- **Out of scope (per spec §8):** addressable primes, advanced pinch-zoom, animated camera transitions.
