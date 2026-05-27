<script lang="ts">
  import Terminal from './Terminal.svelte';
  import Graph from './Graph.svelte';
</script>

<div class="relative w-full h-full overflow-hidden bg-terminal-bg">
  <div class="absolute inset-0 overflow-auto">
    <Graph />
  </div>
  <div class="absolute bottom-0 left-0 right-0" style="height: 30%; background-color: rgba(13, 17, 23, 0.95);">
    <div class="h-full overflow-hidden border-t border-terminal-dim/30">
      <Terminal />
    </div>
  </div>
</div>
