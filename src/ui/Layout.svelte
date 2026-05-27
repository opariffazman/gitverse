<script lang="ts">
  import { focusMode, toggleFocus, terminalOpacity } from '$store/ui';
  import Terminal from './Terminal.svelte';
  import FilePanel from './FilePanel.svelte';
  import MobileToolbar from './MobileToolbar.svelte';
  import Graph from './Graph.svelte';

  const isTerminalFocused = $derived($focusMode === 'terminal');
</script>

<div class="relative w-full h-full overflow-hidden bg-terminal-bg">
  <!-- Background: graph layer -->
  <div class="absolute inset-0 overflow-auto">
    <Graph />
  </div>

  <!-- Foreground: terminal panel -->
  <div
    class="absolute terminal-panel flex flex-col transition-all duration-300 ease-in-out"
    class:terminal-focused={isTerminalFocused}
    class:graph-focused={!isTerminalFocused}
    style="background-color: rgba(13, 17, 23, {$terminalOpacity})"
  >
    <!-- Terminal title bar -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-terminal-dim/30">
      <span class="font-mono text-xs text-terminal-dim select-none">terminal</span>
      <div class="flex items-center gap-2">
        <input
          type="range"
          min="0.3"
          max="1"
          step="0.05"
          value={$terminalOpacity}
          oninput={(e) => terminalOpacity.set(parseFloat((e.target as HTMLInputElement).value))}
          class="w-16 h-1 appearance-none bg-terminal-dim/40 rounded cursor-pointer"
          style="accent-color: #58a6ff"
          title="Terminal opacity ({Math.round($terminalOpacity * 100)}%)"
        />
        <button
          class="font-mono text-xs text-terminal-grey hover:text-terminal-fg transition-colors px-2 py-0.5 rounded hover:bg-terminal-dim/20"
          onclick={toggleFocus}
          title={isTerminalFocused ? 'Focus graph' : 'Focus terminal'}
        >
          {isTerminalFocused ? '⇱ graph' : '⇲ terminal'}
        </button>
      </div>
    </div>

    <!-- File status panel -->
    <FilePanel />

    <!-- Mobile toolbar (hidden on md+) -->
    <MobileToolbar />

    <!-- Terminal content -->
    <div class="flex-1 overflow-hidden">
      <Terminal />
    </div>
  </div>
</div>

<style>
  /* Desktop: terminal focused — large centered panel */
  .terminal-focused {
    top: 15%;
    left: 15%;
    right: 15%;
    bottom: 15%;
  }

  /* Desktop: graph focused — compact bottom-right corner */
  .graph-focused {
    bottom: 1rem;
    right: 1rem;
    width: 24rem;
    height: 14rem;
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .terminal-focused {
      top: 2%;
      left: 5%;
      right: 5%;
      bottom: 2%;
    }

    .graph-focused {
      bottom: 0;
      right: 0;
      left: 0;
      width: 100%;
      height: 3.5rem;
      border-radius: 0;
    }
  }
</style>
