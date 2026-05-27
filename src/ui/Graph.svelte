<script lang="ts">
  import { engine, engineVersion } from '$store/engine';
  import { computeLayout } from '$graph/layout';
  import type { Orientation } from '$graph/layout';
  import type { GraphNode, GraphEdge } from '$graph/types';
  import CommitDetail from './CommitDetail.svelte';

  const LANE_COLORS = ['#4ade80', '#60a5fa', '#c084fc', '#f87171', '#facc15', '#22d3ee'];
  const NODE_RADIUS = 18;
  const GRAPH_PADDING = 60;

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

  const orientation: Orientation = $derived(isMobile ? 'vertical' : 'horizontal');

  const layout = $derived.by(() => {
    const eng = $engine;
    void $engineVersion;
    const allCommits = eng.allCommits();
    if (allCommits.length === 0) {
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
      parents: c.parents,
      message: c.message,
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

  let selectedNode = $state<GraphNode | null>(null);

  function selectNode(node: GraphNode) {
    selectedNode = selectedNode?.hash === node.hash ? null : node;
  }

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

  function laneColor(lane: number): string {
    return LANE_COLORS[((lane % LANE_COLORS.length) + LANE_COLORS.length) % LANE_COLORS.length];
  }

  function edgePath(edge: GraphEdge): string {
    if (orientation === 'horizontal') {
      const midX = (edge.fromX + edge.toX) / 2;
      return `M ${edge.fromX} ${edge.fromY} C ${midX} ${edge.fromY}, ${midX} ${edge.toY}, ${edge.toX} ${edge.toY}`;
    }
    const midY = (edge.fromY + edge.toY) / 2;
    return `M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${midY}, ${edge.toX} ${midY}, ${edge.toX} ${edge.toY}`;
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
            stroke-width="2.5"
            opacity="0.6"
          />
        {/each}

        <!-- Nodes -->
        {#each layout.nodes as node (node.hash)}
          {@const color = laneColor(node.lane)}
          {@const isVert = orientation === 'vertical'}

          <!-- HEAD glow ring -->
          {#if node.isHEAD}
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS + 6}
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

          <!-- Branch labels -->
          {#each node.branches as branch, bi (branch)}
            {@const isHeadBranch = node.isHEAD && headBranch === branch}
            {@const label = isHeadBranch ? `HEAD → ${branch}` : branch}
            {@const pillWidth = Math.max(label.length * 7.5 + 20, 48)}
            {@const lx = isVert ? node.x + NODE_RADIUS + 6 : node.x - pillWidth / 2}
            {@const ly = isVert ? node.y - 11 + bi * 26 : node.y - NODE_RADIUS - 30 - bi * 26}
            {@const tx = isVert ? lx + pillWidth / 2 : node.x}
            <rect
              x={lx}
              y={ly}
              width={pillWidth}
              height={22}
              rx={6}
              fill={isHeadBranch ? '#22d3ee' : color}
              opacity={isHeadBranch ? 0.95 : 0.85}
            />
            <text
              x={tx}
              y={ly + 15}
              text-anchor="middle"
              font-family="monospace"
              font-size="14"
              fill="#0d1117"
              font-weight={isHeadBranch ? 'bold' : 'normal'}>{label}</text
            >
          {/each}

          <!-- Detached HEAD label -->
          {#if node.isHEAD && !headBranch}
            {@const pillWidth = 4 * 7.5 + 20}
            {@const lx = isVert ? node.x + NODE_RADIUS + 6 : node.x - pillWidth / 2}
            {@const ly = isVert
              ? node.y - 11 - 26
              : node.y - NODE_RADIUS - 30 - node.branches.length * 26 - 13}
            {@const tx = isVert ? lx + pillWidth / 2 : node.x}
            <rect
              x={lx}
              y={ly}
              width={pillWidth}
              height={22}
              rx={6}
              fill="none"
              stroke="#22d3ee"
              stroke-width="1.5"
              stroke-dasharray="3 2"
            />
            <text
              x={tx}
              y={ly + 15}
              text-anchor="middle"
              font-family="monospace"
              font-size="14"
              font-weight="bold"
              fill="#22d3ee">HEAD</text
            >
          {/if}

          <!-- Tag labels -->
          {#each node.tags ?? [] as tag, ti (tag)}
            {@const tagWidth = Math.max(tag.length * 6.5 + 14, 48)}
            {@const lx = isVert ? node.x + NODE_RADIUS + 6 : node.x - tagWidth / 2}
            {@const ly = isVert
              ? node.y - 11 + (node.branches.length + ti) * 26 + (node.branches.length > 0 ? 4 : 0)
              : node.y + NODE_RADIUS + 6 + ti * 26}
            {@const tx = isVert ? lx + tagWidth / 2 : node.x}
            <rect x={lx} y={ly} width={tagWidth} height={20} rx={5} fill="#f59e0b" opacity="0.85" />
            <text
              x={tx}
              y={ly + 14}
              text-anchor="middle"
              font-family="monospace"
              font-size="12"
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
            font-size="10"
            fill="#0d1117"
            pointer-events="none">{node.hash.slice(0, 4)}</text
          >
        {/each}
      </g>
    </svg>
  {/if}

  {#if selectedNode}
    <CommitDetail node={selectedNode} onclose={() => (selectedNode = null)} />
  {/if}
</div>
