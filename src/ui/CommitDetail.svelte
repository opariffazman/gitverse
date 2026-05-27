<script lang="ts">
  import type { GraphNode } from '$graph/types';

  let { node, onclose }: { node: GraphNode; onclose: () => void } = $props();
</script>

<div
  class="fixed bottom-4 left-4 z-50 min-w-48 max-w-64 rounded-lg border border-terminal-dim/40 bg-terminal-bg/95 p-3 font-mono text-xs shadow-lg backdrop-blur"
  role="dialog"
  aria-modal="true"
  aria-label="Commit details"
>
  <!-- Close button -->
  <button
    class="absolute right-2 top-2 text-terminal-dim hover:text-terminal-fg transition-colors"
    onclick={onclose}
    aria-label="Close"
  >✕</button>

  <!-- Hash -->
  <div class="mb-2 text-yellow-400 font-bold text-sm">
    {node.hash.slice(0, 7)}
  </div>

  <!-- Message -->
  <div class="mb-2 text-terminal-fg leading-relaxed break-words">
    {node.message}
  </div>

  <!-- Branch names -->
  {#if node.branches.length > 0}
    <div class="mb-1">
      {#each node.branches as branch (branch)}
        <span class="mr-1 inline-block rounded px-1 py-0.5 text-green-400 bg-green-400/10">
          {branch}
        </span>
      {/each}
    </div>
  {/if}

  <!-- Tag names -->
  {#if node.tags && node.tags.length > 0}
    <div class="mb-1">
      {#each node.tags as tag (tag)}
        <span class="mr-1 inline-block rounded px-1 py-0.5 text-yellow-400 bg-yellow-400/10">
          {tag}
        </span>
      {/each}
    </div>
  {/if}

  <!-- Parent hashes -->
  {#if node.parents.length > 0}
    <div class="mt-2 text-terminal-dim">
      <span class="opacity-60">parents: </span>
      {#each node.parents as parent, i (parent)}
        <span class="opacity-50">{parent.slice(0, 7)}{i < node.parents.length - 1 ? ', ' : ''}</span>
      {/each}
    </div>
  {/if}
</div>
