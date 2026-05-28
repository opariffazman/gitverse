<script lang="ts">
  import type { GraphNode } from '$graph/types';
  import { engine, engineVersion } from '$store/engine';

  let { node, onclose }: { node: GraphNode; onclose: () => void } = $props();

  const parentLabels = $derived.by(() => {
    const eng = $engine;
    void $engineVersion;
    return node.parents.map((hash) => eng.commitLabel(hash));
  });
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
    aria-label="Close">✕</button
  >

  <!-- Label + short hash for reference -->
  <div class="mb-2 flex items-baseline gap-2">
    <span class="text-yellow-400 font-bold text-sm">{node.label ?? node.hash.slice(0, 7)}</span>
    <span class="text-terminal-dim/60 text-[10px]">{node.hash.slice(0, 7)}</span>
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

  <!-- Parent labels -->
  {#if node.parents.length > 0}
    <div class="mt-2 text-terminal-dim">
      <span class="opacity-60">parents: </span>
      {#each parentLabels as parent, i (node.parents[i])}
        <span class="opacity-50">{parent}{i < parentLabels.length - 1 ? ', ' : ''}</span>
      {/each}
    </div>
  {/if}
</div>
