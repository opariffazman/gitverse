<script lang="ts">
  import { engine, engineVersion, executeCommand } from '$store/engine';
  import { computeLayout, NODE_SPACING_X, LANE_SPACING_Y } from '$graph/layout';
  import type { Orientation } from '$graph/layout';
  import { buildActiveFlow, cubicSegment } from '$graph/flow';
  import type { GraphNode, GraphEdge } from '$graph/types';
  import CommitDetail from './CommitDetail.svelte';

  const LANE_COLORS = ['#4ade80', '#60a5fa', '#c084fc', '#f87171', '#facc15', '#22d3ee'];
  const NODE_RADIUS = 25;
  const GRAPH_PADDING = 80;
  const FLOW_COLOR = '#22d3ee';
  const FLOW_PER_SEGMENT_SEC = 0.6;

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

  const svgWidth = $derived(layout.width + GRAPH_PADDING * 2);
  const svgHeight = $derived(layout.height + GRAPH_PADDING * 2);

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

  const activeFlow = $derived(buildActiveFlow(layout.nodes, headCommitHash, orientation));
  const flowDur = $derived(activeFlow ? activeFlow.segmentCount * FLOW_PER_SEGMENT_SEC : 0);
  const flowDots = $derived(activeFlow ? activeFlow.segmentCount : 0);

  function selectNode(node: GraphNode) {
    if (node.type === 'phantom') return;

    // Always show this node's detail.
    selectedHash = node.hash;

    // Clicking the commit HEAD already points at is a no-op checkout — just show detail.
    if (node.hash === headCommitHash) return;

    let command: string;
    if (node.branches.length > 0) {
      // Attach to a branch at this commit; prefer the HEAD branch if it lives here.
      const branch =
        headBranch && node.branches.includes(headBranch) ? headBranch : node.branches[0];
      command = `git checkout ${branch}`;
    } else {
      // Detach HEAD at the commit, addressed by its friendly label.
      command = `git checkout ${node.label ?? node.hash}`;
    }
    executeCommand(command);
  }

  function laneColor(lane: number): string {
    return LANE_COLORS[((lane % LANE_COLORS.length) + LANE_COLORS.length) % LANE_COLORS.length];
  }

  function edgePath(edge: GraphEdge): string {
    return `M ${edge.fromX} ${edge.fromY} ${cubicSegment(edge.fromX, edge.fromY, edge.toX, edge.toY, orientation)}`;
  }
</script>

<div class="relative w-full h-full overflow-auto bg-terminal-bg">
  {#if layout.nodes.length === 0}
    <div class="flex items-center justify-center w-full h-full">
      <p class="font-mono text-terminal-dim text-sm select-none">No commits yet</p>
    </div>
  {:else}
    <svg
      width={svgWidth}
      height={svgHeight}
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
              <animate
                attributeName="opacity"
                values="0.3;0.7;0.3"
                dur="2s"
                repeatCount="indefinite"
              />
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
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill={color}
              stroke={node.isHEAD ? '#22d3ee' : color}
              stroke-width={node.isHEAD ? 3 : 1.5}
              style="cursor: pointer;"
              onclick={() => selectNode(node)}
              role="button"
              tabindex="0"
              aria-label={`Commit ${node.label ?? node.hash}: ${node.message}`}
              onkeydown={(e) => e.key === 'Enter' && selectNode(node)}
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
</div>
