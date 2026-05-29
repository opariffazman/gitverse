<script lang="ts">
  import Terminal from './Terminal.svelte';
  import Graph from './Graph.svelte';
  import ResetButton from './ResetButton.svelte';
</script>

<div class="relative flex flex-col w-full h-full bg-terminal-bg">
  <!-- Reset: top-left (logo sits top-right on desktop / top-center on mobile) -->
  <div class="absolute top-3 left-4 z-20">
    <ResetButton />
  </div>

  <!-- Desktop: top-right -->
  <pre
    class="absolute top-3 right-4 z-10 font-mono text-terminal-dim/80 text-xs leading-tight select-none pointer-events-none max-sm:hidden">{` ██████╗ ██╗████████╗██╗   ██╗███████╗██████╗ ███████╗███████╗
██╔════╝ ██║╚══██╔══╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
██║  ███╗██║   ██║   ██║   ██║█████╗  ██████╔╝███████╗█████╗
██║   ██║██║   ██║   ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝
╚██████╔╝██║   ██║    ╚████╔╝ ███████╗██║  ██║███████║███████╗
 ╚═════╝ ╚═╝   ╚═╝     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝`}</pre>
  <!-- Mobile: centered -->
  <pre
    class="absolute top-2 left-1/2 -translate-x-1/2 z-10 font-mono text-terminal-dim/80 text-[5px] leading-tight select-none pointer-events-none sm:hidden">{` ██████╗ ██╗████████╗██╗   ██╗███████╗██████╗ ███████╗███████╗
██╔════╝ ██║╚══██╔══╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
██║  ███╗██║   ██║   ██║   ██║█████╗  ██████╔╝███████╗█████╗
██║   ██║██║   ██║   ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝
╚██████╔╝██║   ██║    ╚████╔╝ ███████╗██║  ██║███████║███████╗
 ╚═════╝ ╚═╝   ╚═╝     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝`}</pre>

  <!-- Graph: top section -->
  <div class="flex-1 min-h-0 overflow-hidden">
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
