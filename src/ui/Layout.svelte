<script lang="ts">
  import Terminal from './Terminal.svelte';
  import Graph from './Graph.svelte';
</script>

<div class="relative flex flex-col w-full h-full bg-terminal-bg">
  <pre
    class="absolute top-3 right-4 z-10 font-mono text-terminal-dim/40 text-xs leading-tight select-none pointer-events-none max-sm:hidden">{`
   ██████╗ ██╗████████╗██╗   ██╗███████╗██████╗ ███████╗███████╗
  ██╔════╝ ██║╚══██╔══╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
  ██║  ███╗██║   ██║   ██║   ██║█████╗  ██████╔╝███████╗█████╗
  ██║   ██║██║   ██║   ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝
  ╚██████╔╝██║   ██║    ╚████╔╝ ███████╗██║  ██║███████║███████╗
   ╚═════╝ ╚═╝   ╚═╝     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝`.trim()}</pre>

  <!-- Graph: top section -->
  <div class="flex-1 min-h-0 overflow-auto">
    <Graph />
  </div>

  <!-- Terminal: bottom section -->
  <div
    class="h-[40vh] max-sm:h-[45vh] shrink-0 border-t border-terminal-dim/30 overflow-hidden"
    style="background-color: rgba(13, 17, 23, 0.95);"
  >
    <Terminal />
  </div>
</div>
