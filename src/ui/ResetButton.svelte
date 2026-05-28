<script lang="ts">
  import { resetSession } from '$store/engine';

  let confirming = $state(false);

  function confirmReset() {
    resetSession();
    confirming = false;
  }
</script>

{#if confirming}
  <div
    class="flex items-center gap-2 rounded-lg border border-terminal-red/50 bg-terminal-bg/95 px-3 py-1.5 font-mono text-xs shadow-lg backdrop-blur"
    role="alertdialog"
    aria-label="Confirm sandbox reset"
  >
    <span class="text-terminal-fg">Reset sandbox? this wipes everything</span>
    <button
      class="rounded px-2 py-0.5 text-terminal-red hover:bg-terminal-red/15 transition-colors"
      onclick={confirmReset}>Yes</button
    >
    <button
      class="rounded px-2 py-0.5 text-terminal-dim hover:text-terminal-fg transition-colors"
      onclick={() => (confirming = false)}>Cancel</button
    >
  </div>
{:else}
  <button
    class="rounded-lg border border-terminal-dim/40 bg-terminal-bg/80 px-3 py-1.5 font-mono text-xs text-terminal-dim hover:text-terminal-fg hover:border-terminal-dim/70 transition-colors backdrop-blur"
    onclick={() => (confirming = true)}
    aria-label="Reset sandbox">⟳ Reset</button
  >
{/if}
