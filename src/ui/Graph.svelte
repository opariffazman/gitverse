<script lang="ts">
  import { engine } from '$store/engine';
  import { computeLayout } from '$graph/layout';
  import type { GraphNode, GraphEdge } from '$graph/types';
  import CommitDetail from './CommitDetail.svelte';

  // Lane colours cycling through 6 values
  const LANE_COLORS = ['#4ade80', '#60a5fa', '#c084fc', '#f87171', '#facc15', '#22d3ee'];
  const NODE_RADIUS = 12;

  // Derived layout from engine state
  const layout = $derived.by(() => {
    const eng = $engine;
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

    // Build commit → branches map
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const branchMap = new Map<string, string[]>();
    for (const [name, hash] of eng.allBranches()) {
      if (!hash) continue;
      branchMap.set(hash, [...(branchMap.get(hash) ?? []), name]);
    }

    // Build commit → tags map
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

  // Selected node for detail popover
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
      width={layout.width}
      height={layout.height}
      class="block"
      style="min-width: 100%; min-height: 100%;"
    >
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
          <rect
            x={node.x - 24}
            y={node.y - NODE_RADIUS - 22 - bi * 18}
            width={48}
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
    </svg>
  {/if}

  <!-- Commit detail popover -->
  {#if selectedNode}
    <CommitDetail node={selectedNode} onclose={() => (selectedNode = null)} />
  {/if}
</div>
