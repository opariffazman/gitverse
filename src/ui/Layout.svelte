<script lang="ts">
  import Terminal from './Terminal.svelte';
  import Graph from './Graph.svelte';
  import ResetButton from './ResetButton.svelte';
  import GithubLink from './GithubLink.svelte';
  import FileTree from './FileTree.svelte';
  import { explorerOpen, toggleExplorer } from '$store/ui';
  import { onMount } from 'svelte';

  onMount(() => {
    if (window.matchMedia('(max-width: 639px)').matches) {
      explorerOpen.set(false);
    }
  });
</script>

<div class="flex w-full h-full bg-terminal-bg">
  <div class="h-full max-sm:contents">
    <FileTree />
  </div>

  <div class="relative flex flex-col flex-1 min-w-0 h-full">
    <!-- Reset: top-left. GitHub link: top-right corner. Logo sits between them
         (just left of the link on desktop / top-center on mobile). -->
    <div class="absolute top-3 left-4 z-20 max-sm:z-40 flex items-center gap-2">
      <ResetButton />
      <button
        class="sm:hidden rounded-lg border border-terminal-dim/40 bg-terminal-bg/80 px-3 py-1.5 font-mono text-xs text-terminal-dim hover:text-terminal-fg hover:border-terminal-dim/70 transition-colors backdrop-blur"
        onclick={toggleExplorer}
        aria-label="Toggle file explorer">📁</button
      >
    </div>

    <!-- GitHub source link: top-right corner, above the decorative logo -->
    <div class="absolute top-3 right-4 z-20">
      <GithubLink />
    </div>

    <!-- Desktop: top-right, offset left so it clears the GitHub link button -->
    <pre
      class="absolute top-3 right-16 z-10 font-mono text-terminal-dim/80 text-xs leading-tight select-none pointer-events-none max-sm:hidden">{` ██████╗ ██╗████████╗██╗   ██╗███████╗██████╗ ███████╗███████╗
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
</div>
