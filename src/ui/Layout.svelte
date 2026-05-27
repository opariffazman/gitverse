<script lang="ts">
  import Terminal from './Terminal.svelte';
  import Graph from './Graph.svelte';
</script>

<div class="flex flex-col w-full h-full bg-terminal-bg">
  <!-- Graph: top section -->
  <div class="flex-1 min-h-0 overflow-auto">
    <Graph />
  </div>

  <!-- Terminal: bottom section -->
  <div
    class="h-[30vh] max-sm:h-[40vh] shrink-0 border-t border-terminal-dim/30 overflow-hidden"
    style="background-color: rgba(13, 17, 23, 0.95);"
  >
    <Terminal />
  </div>
</div>
