<script lang="ts">
  import { untrack } from 'svelte';
  import { engine, engineVersion } from '$store/engine';
  import { prefillTerminal } from '$store/ui';
  import { computeLayout, NODE_SPACING_X, LANE_SPACING_Y } from '$graph/layout';
  import type { Orientation } from '$graph/layout';
  import { buildActiveFlow, cubicSegment } from '$graph/flow';
  import {
    type Transform,
    zoomAt,
    panBy,
    fitTransform,
    followHeadPan,
    clampZoom,
  } from '$graph/viewport';
  import type { GraphNode, GraphEdge } from '$graph/types';
  import CommitDetail from './CommitDetail.svelte';

  const LANE_COLORS = ['#4ade80', '#60a5fa', '#c084fc', '#f87171', '#facc15', '#22d3ee'];
  const NODE_RADIUS = 25;
  const GRAPH_PADDING = 80;
  const FLOW_COLOR = '#22d3ee';
  const FLOW_PER_SEGMENT_SEC = 2.4;
  const ZOOM_STEP_KEY = 1.1; // finer zoom step for +/- keys
  const ZOOM_STEP_BTN = 1.2; // coarser step for on-screen buttons

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

  const orientation: Orientation = $derived(isMobile ? 'vertical' : 'horizontal');

  const layout = $derived.by(() => {
    const eng = $engine;
    void $engineVersion;
    const allCommits = eng.allCommits();
    if (allCommits.length === 0) {
      if (eng.isInitialized()) {
        const phantomNode: GraphNode = {
          hash: '',
          type: 'phantom',
          parents: [],
          message: '',
          branches: ['main'],
          tags: [],
          isHEAD: true,
          lane: 0,
          x: NODE_SPACING_X,
          y: LANE_SPACING_Y,
        };
        return {
          nodes: [phantomNode],
          edges: [],
          width: NODE_SPACING_X * 2,
          height: LANE_SPACING_Y * 2,
          orientation: orientation as Orientation,
        };
      }
      return {
        nodes: [],
        edges: [],
        width: 0,
        height: 0,
        orientation: orientation as Orientation,
      };
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
      type: 'commit' as const,
      parents: c.parents,
      message: c.message,
      label: eng.commitLabel(c.hash),
      branches: branchMap.get(c.hash) ?? [],
      tags: tagMap.get(c.hash) ?? [],
      isHEAD: c.hash === headHash,
      lane: 0,
      x: 0,
      y: 0,
    }));

    return computeLayout(inputNodes, orientation);
  });

  let selectedHash = $state<string | null>(null);

  const selectedNode = $derived(
    selectedHash ? (layout.nodes.find((n) => n.hash === selectedHash) ?? null) : null,
  );

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

  const graphSummary = $derived.by(() => {
    const n = layout.nodes.filter((nd) => nd.type !== 'phantom').length;
    const head = headBranch ? `HEAD on ${headBranch}` : 'detached HEAD';
    return `Commit graph: ${n} commit${n === 1 ? '' : 's'}, ${head}`;
  });

  let focusedIndex = $state(0);
  let graphFocused = $state(false);
  let nodesGroupEl: SVGGElement | undefined = $state(undefined);
  const commitNodes = $derived(layout.nodes.filter((n) => n.type !== 'phantom'));
  const commitNodeIndex = $derived(new Map(commitNodes.map((n, i) => [n, i])));
  // Clamp the roving tab stop so a shrinking commit list never strands tabindex.
  const tabStopIndex = $derived(
    commitNodes.length === 0 ? 0 : Math.min(focusedIndex, commitNodes.length - 1),
  );

  function onNodeKeydown(e: KeyboardEvent, node: GraphNode, index: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Stop the bubbled viewport handler from also acting on this key.
      e.stopPropagation();
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
    // Stop the bubbled viewport handler from also panning on this key.
    e.stopPropagation();
    focusedIndex = next;
    const el = nodesGroupEl?.querySelector<SVGCircleElement>(`#commit-node-${next}`);
    el?.focus();
  }

  const activeFlow = $derived(buildActiveFlow(layout.nodes, headCommitHash, orientation));
  const flowDur = $derived(activeFlow ? activeFlow.segmentCount * FLOW_PER_SEGMENT_SEC : 0);
  const flowDots = $derived(activeFlow ? activeFlow.segmentCount : 0);

  function selectNode(node: GraphNode) {
    if (node.type === 'phantom') return;
    selectedHash = node.hash;
    let command: string;
    if (node.branches.length > 0) {
      const branch =
        headBranch && node.branches.includes(headBranch) ? headBranch : node.branches[0];
      command = `git checkout ${branch}`;
    } else {
      // Prime labels (e.g. "C2'") are display-only and not addressable, so fall
      // back to the hash for rewritten commits; the plain Cn label is fine.
      const addressable = node.label && !node.label.includes("'");
      command = `git checkout ${addressable ? node.label : node.hash}`;
    }
    prefillTerminal(command);
  }

  function laneColor(lane: number): string {
    return LANE_COLORS[((lane % LANE_COLORS.length) + LANE_COLORS.length) % LANE_COLORS.length];
  }

  function edgePath(edge: GraphEdge): string {
    return `M ${edge.fromX} ${edge.fromY} ${cubicSegment(edge.fromX, edge.fromY, edge.toX, edge.toY, orientation)}`;
  }

  let transform = $state<Transform>({ panX: GRAPH_PADDING, panY: GRAPH_PADDING, k: 1 });
  let followHead = $state(true);
  let viewportEl: HTMLDivElement;
  let dragging = $state(false);
  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
  let dragPointerId: number | null = null;

  function viewSize() {
    return { w: viewportEl?.clientWidth ?? 800, h: viewportEl?.clientHeight ?? 600 };
  }
  function fit() {
    const { w, h } = viewSize();
    transform = fitTransform(layout.width, layout.height, w, h, GRAPH_PADDING);
    followHead = false;
  }
  // Single zoom entry point: while following, zoom keeps HEAD centered (cursor
  // ignored); otherwise zoom toward (cx, cy).
  function applyZoom(factor: number, cx: number, cy: number) {
    if (followHead) {
      const k = clampZoom(transform.k * factor);
      const headNode = layout.nodes.find((n) => n.hash === headCommitHash);
      const { w, h } = viewSize();
      transform = headNode
        ? followHeadPan({ ...transform, k }, headNode.x, headNode.y, w, h)
        : { ...transform, k };
    } else {
      transform = zoomAt(transform, factor, cx, cy);
    }
  }
  function zoomButton(factor: number) {
    const { w, h } = viewSize();
    applyZoom(factor, w / 2, h / 2);
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = viewportEl.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    applyZoom(factor, e.clientX - rect.left, e.clientY - rect.top);
  }
  function recenter() {
    followHead = true;
    const headNode = layout.nodes.find((n) => n.hash === headCommitHash);
    if (!headNode) return;
    const { w, h } = viewSize();
    transform = followHeadPan(transform, headNode.x, headNode.y, w, h);
  }
  function onPointerDown(e: PointerEvent) {
    // Let interactive children handle their own clicks/keys: SVG commit circles
    // (role="button") and the overlaid zoom controls (native <button>). Without
    // this, the bubbled pointerdown starts a viewport drag and the resulting
    // pointer capture swallows the control's click.
    if ((e.target as Element).closest('button, [role="button"]')) return;
    if (dragPointerId !== null) return; // already dragging with another pointer; ignore second finger
    dragPointerId = e.pointerId;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, panX: transform.panX, panY: transform.panY };
    viewportEl.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    transform = {
      ...transform,
      panX: dragStart.panX + (e.clientX - dragStart.x),
      panY: dragStart.panY + (e.clientY - dragStart.y),
    };
    followHead = false;
  }
  function onPointerUp(e: PointerEvent) {
    // Also routed from onpointercancel; cancel carries the active drag's pointerId, so this is safe.
    if (e.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = null;
    viewportEl.releasePointerCapture?.(e.pointerId);
  }
  function onViewportKeydown(e: KeyboardEvent) {
    const STEP = 40;
    // +/- route through zoomButton → applyZoom, so they stay follow-aware.
    if (e.key === '+' || e.key === '=') zoomButton(ZOOM_STEP_KEY);
    else if (e.key === '-' || e.key === '_') zoomButton(1 / ZOOM_STEP_KEY);
    else if (e.key === '0') recenter();
    else if (e.key === 'f' || e.key === 'F') fit();
    else if (e.key === 'ArrowUp') {
      transform = panBy(transform, 0, STEP);
      followHead = false;
    } else if (e.key === 'ArrowDown') {
      transform = panBy(transform, 0, -STEP);
      followHead = false;
    } else if (e.key === 'ArrowLeft') {
      transform = panBy(transform, STEP, 0);
      followHead = false;
    } else if (e.key === 'ArrowRight') {
      transform = panBy(transform, -STEP, 0);
      followHead = false;
    } else return;
    e.preventDefault();
  }
  // Follow HEAD: when engine state changes and follow is engaged, recenter on HEAD.
  // Tracked deps are $engineVersion, followHead, layout, headCommitHash — NOT transform.
  // The current transform's zoom is read via untrack to avoid self-triggering this effect.
  $effect(() => {
    void $engineVersion;
    if (!followHead) return;
    const headNode = layout.nodes.find((n) => n.hash === headCommitHash);
    if (!headNode) return;
    const { w, h } = viewSize();
    if (w === 0 || h === 0) return; // not yet laid out / collapsed; avoid recentering to top-left
    const cur = untrack(() => transform);
    transform = followHeadPan(cur, headNode.x, headNode.y, w, h);
  });
</script>

<!--
  role="application" makes this a custom interactive pan/zoom canvas: it is intentionally
  focusable (tabindex) and owns wheel/pointer/keyboard handlers so screen readers pass
  keystrokes through. The two a11y rules below are false positives for that deliberate role.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={viewportEl}
  class="relative w-full h-full overflow-hidden bg-terminal-bg touch-none"
  role="application"
  aria-label={commitNodes.length === 0
    ? 'Commit graph area — no commits yet'
    : 'Commit graph viewport. Drag or arrow keys pan, plus and minus zoom, 0 recenters on HEAD, f fits the whole graph.'}
  tabindex="0"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onkeydown={onViewportKeydown}
>
  {#if commitNodes.length === 0}
    <div class="flex items-center justify-center w-full h-full">
      <p class="font-mono text-terminal-dim text-sm select-none">No commits yet</p>
    </div>
  {:else}
    <svg
      width="100%"
      height="100%"
      class="block"
      role="group"
      aria-label={graphSummary}
      onfocusin={() => (graphFocused = true)}
      onfocusout={() => (graphFocused = false)}
    >
      <g
        bind:this={nodesGroupEl}
        transform={`translate(${transform.panX}, ${transform.panY}) scale(${transform.k})`}
      >
        <!-- Edges -->
        {#each layout.edges as edge (edge.from + '→' + edge.to)}
          {@const fromNode = layout.nodes.find((n) => n.hash === edge.from)}
          <path
            d={edgePath(edge)}
            fill="none"
            stroke={fromNode ? laneColor(fromNode.lane) : '#888'}
            stroke-width="3"
            opacity="0.6"
          />
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
            <!-- {#key} remounts the whole layer when the path changes: SMIL animateMotion
                 snapshots its mpath geometry at start and won't re-read a mutated d. The remount
                 also makes the inner index-keyed each safe — old dots are discarded wholesale. -->
            {#key activeFlow.d}
              <g aria-hidden="true" pointer-events="none">
                <path id="head-flow-path" d={activeFlow.d} fill="none" stroke="none" />
                {#each Array(flowDots) as _unused, i (i)}
                  <g>
                    <circle r="9" fill={FLOW_COLOR} opacity="0.3" />
                    <circle r="4" fill={FLOW_COLOR} />
                    <animateMotion
                      dur="{flowDur}s"
                      begin="{(i * flowDur) / flowDots}s"
                      repeatCount="indefinite"
                    >
                      <!-- xlink:href for Safari/older browsers; href is standard SVG 2 -->
                      <mpath xlink:href="#head-flow-path" href="#head-flow-path" />
                    </animateMotion>
                  </g>
                {/each}
              </g>
            {/key}
          {/if}
        {/if}

        <!-- Nodes -->
        {#each layout.nodes as node, ni (node.type === 'phantom' ? `phantom-${ni}` : node.hash)}
          {@const color = laneColor(node.lane)}
          {@const isVert = orientation === 'vertical'}

          <!-- HEAD glow ring -->
          {#if node.isHEAD}
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
          {/if}

          <!-- Branch labels -->
          {#each node.branches as branch, bi (branch)}
            {@const isHeadBranch = node.isHEAD && headBranch === branch}
            {@const label = isHeadBranch ? `HEAD → ${branch}` : branch}
            {@const pillWidth = Math.max(label.length * 10.5 + 28, 64)}
            {@const lx = isVert ? node.x + NODE_RADIUS + 8 : node.x - pillWidth / 2}
            {@const ly = isVert ? node.y - 15 + bi * 36 : node.y - NODE_RADIUS - 42 - bi * 36}
            {@const tx = isVert ? lx + pillWidth / 2 : node.x}
            <rect
              x={lx}
              y={ly}
              width={pillWidth}
              height={30}
              rx={8}
              fill={isHeadBranch ? '#22d3ee' : color}
              opacity={isHeadBranch ? 0.95 : 0.85}
            />
            <text
              x={tx}
              y={ly + 21}
              text-anchor="middle"
              font-family="monospace"
              font-size="18"
              fill="#0d1117"
              font-weight={isHeadBranch ? 'bold' : 'normal'}>{label}</text
            >
          {/each}

          <!-- Detached HEAD label -->
          {#if node.isHEAD && !headBranch}
            {@const pillWidth = 4 * 10.5 + 28}
            {@const lx = isVert ? node.x + NODE_RADIUS + 8 : node.x - pillWidth / 2}
            {@const ly = isVert
              ? node.y - 15 - 36
              : node.y - NODE_RADIUS - 42 - node.branches.length * 36 - 18}
            {@const tx = isVert ? lx + pillWidth / 2 : node.x}
            <rect
              x={lx}
              y={ly}
              width={pillWidth}
              height={30}
              rx={8}
              fill="none"
              stroke="#22d3ee"
              stroke-width="2"
              stroke-dasharray="4 3"
            />
            <text
              x={tx}
              y={ly + 21}
              text-anchor="middle"
              font-family="monospace"
              font-size="18"
              font-weight="bold"
              fill="#22d3ee">HEAD</text
            >
          {/if}

          <!-- Tag labels -->
          {#each node.tags ?? [] as tag, ti (tag)}
            {@const tagWidth = Math.max(tag.length * 9 + 20, 64)}
            {@const lx = isVert ? node.x + NODE_RADIUS + 8 : node.x - tagWidth / 2}
            {@const ly = isVert
              ? node.y - 15 + (node.branches.length + ti) * 36 + (node.branches.length > 0 ? 6 : 0)
              : node.y + NODE_RADIUS + 8 + ti * 36}
            {@const tx = isVert ? lx + tagWidth / 2 : node.x}
            <rect x={lx} y={ly} width={tagWidth} height={28} rx={7} fill="#f59e0b" opacity="0.85" />
            <text
              x={tx}
              y={ly + 19}
              text-anchor="middle"
              font-family="monospace"
              font-size="16"
              fill="#0d1117">{tag}</text
            >
          {/each}

          <!-- Commit circle -->
          {#if node.type === 'phantom'}
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill="transparent"
              stroke="#484f58"
              stroke-width="2"
              stroke-dasharray="6 3"
            />
          {:else}
            {@const cIdx = commitNodeIndex.get(node) ?? 0}
            {#if graphFocused && cIdx === tabStopIndex}
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS + 4}
                fill="none"
                stroke="#ffffff"
                stroke-width="2"
                pointer-events="none"
              />
            {/if}
            <circle
              id={`commit-node-${cIdx}`}
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill={color}
              stroke={node.isHEAD ? '#22d3ee' : color}
              stroke-width={node.isHEAD ? 3 : 1.5}
              style="cursor: pointer;"
              onclick={() => selectNode(node)}
              role="button"
              tabindex={cIdx === tabStopIndex ? 0 : -1}
              aria-label={`Commit ${node.label ?? node.hash}: ${node.message}. Activate to prefill git checkout.`}
              onkeydown={(e) => onNodeKeydown(e, node, cIdx)}
            />

            <!-- Friendly label inside circle -->
            <text
              x={node.x}
              y={node.y + 5}
              text-anchor="middle"
              font-family="monospace"
              font-size="14"
              fill="#0d1117"
              pointer-events="none">{node.label ?? node.hash.slice(0, 4)}</text
            >
          {/if}
        {/each}
      </g>
    </svg>
  {/if}

  {#if selectedNode}
    <CommitDetail node={selectedNode} onclose={() => (selectedHash = null)} />
  {/if}

  <div class="absolute bottom-3 right-3 z-20 flex flex-col gap-1">
    <button
      type="button"
      class="w-9 h-9 rounded bg-terminal-bg/90 border border-terminal-dim/40 text-terminal-fg text-lg leading-none hover:border-terminal-green focus-visible:ring-2 focus-visible:ring-terminal-green"
      aria-label="Zoom in"
      onclick={() => zoomButton(ZOOM_STEP_BTN)}>+</button
    >
    <button
      type="button"
      class="w-9 h-9 rounded bg-terminal-bg/90 border border-terminal-dim/40 text-terminal-fg text-lg leading-none hover:border-terminal-green focus-visible:ring-2 focus-visible:ring-terminal-green"
      aria-label="Zoom out"
      onclick={() => zoomButton(1 / ZOOM_STEP_BTN)}>−</button
    >
    <button
      type="button"
      aria-label={followHead
        ? 'Recenter on HEAD (currently following)'
        : 'Recenter on HEAD and resume following'}
      class={`w-9 h-9 rounded border text-base leading-none focus-visible:ring-2 focus-visible:ring-terminal-green ${followHead ? 'border-[#22d3ee] text-[#22d3ee] bg-[#22d3ee]/10' : 'border-terminal-dim/40 text-terminal-fg bg-terminal-bg/90 hover:border-terminal-green'}`}
      onclick={recenter}>◎</button
    >
    <button
      type="button"
      class="w-9 h-9 rounded bg-terminal-bg/90 border border-terminal-dim/40 text-terminal-fg text-xs leading-none hover:border-terminal-green focus-visible:ring-2 focus-visible:ring-terminal-green"
      aria-label="Fit graph to view"
      onclick={fit}>fit</button
    >
  </div>
</div>
