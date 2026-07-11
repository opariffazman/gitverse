<script lang="ts">
  import { fileTree } from '$store/files';
  import type { FileStatus, TreeEntry } from '$store/files';
  import { explorerOpen, prefillTerminal, toggleExplorer } from '$store/ui';
  import { SvelteSet } from 'svelte/reactivity';
  import { get } from 'svelte/store';
  import { engine, executeCommand } from '$store/engine';
  import { exampleFileCommands, simulateChangeCommands } from '$store/actions';

  // Per-dir collapse is throwaway view state — component-local, not persisted.
  // SvelteSet is deeply reactive on its own; no $state wrapper needed.
  let collapsedDirs = new SvelteSet<string>();

  function toggleDir(name: string) {
    if (collapsedDirs.has(name)) {
      collapsedDirs.delete(name);
    } else {
      collapsedDirs.add(name);
    }
  }

  const BADGE: Record<
    Exclude<FileStatus, 'clean'>,
    { label: string; cls: string; title: string }
  > = {
    untracked: {
      label: 'U',
      cls: 'text-terminal-green',
      title: 'untracked — new file; stage it with git add',
    },
    modified: {
      label: 'M',
      cls: 'text-terminal-yellow',
      title: 'modified — changed since last commit; stage it with git add',
    },
    staged: { label: '●', cls: 'text-terminal-blue', title: 'staged — ready for git commit' },
    deleted: {
      label: 'D',
      cls: 'text-terminal-red',
      title: 'deleted — removed from the working directory',
    },
  };

  const hasFiles = $derived(
    $fileTree.rootFiles.length > 0 || $fileTree.dirs.some((d) => d.files.length > 0),
  );

  const hasTracked = $derived(
    [...$fileTree.rootFiles, ...$fileTree.dirs.flatMap((d) => d.files)].some(
      (f) => f.status !== 'untracked' && f.status !== 'deleted',
    ),
  );

  function createExamples() {
    for (const cmd of exampleFileCommands(get(engine))) executeCommand(cmd);
  }

  function simulateChanges() {
    for (const cmd of simulateChangeCommands(get(engine))) executeCommand(cmd);
  }
</script>

{#snippet fileRow(f: TreeEntry, indented: boolean)}
  <button
    class="flex w-full items-center justify-between rounded bg-transparent px-1.5 py-0.5 text-left hover:bg-terminal-dim/15 transition-colors {indented
      ? 'pl-6'
      : ''}"
    data-status={f.status}
    disabled={f.status === 'deleted'}
    onclick={() => prefillTerminal(`cat ${f.path}`)}
    title={f.status === 'clean' ? 'unchanged since last commit' : BADGE[f.status].title}
  >
    <span
      class="truncate {f.status === 'deleted'
        ? 'line-through text-terminal-dim'
        : f.status === 'clean'
          ? 'text-terminal-dim'
          : 'text-terminal-fg'}">{f.name}</span
    >
    {#if f.status !== 'clean'}
      <span class="shrink-0 pl-2 {BADGE[f.status].cls}">{BADGE[f.status].label}</span>
    {/if}
  </button>
{/snippet}

{#if $explorerOpen}
  <aside
    class="flex h-full w-[230px] shrink-0 flex-col border-r border-terminal-dim/30 bg-terminal-bg font-mono text-xs max-sm:absolute max-sm:inset-y-0 max-sm:left-0 max-sm:z-30 max-sm:shadow-2xl"
    aria-label="File explorer"
  >
    <div class="flex items-center justify-between px-3 py-2 select-none">
      <span class="tracking-widest text-terminal-dim">EXPLORER</span>
      <button
        class="rounded bg-transparent px-1 text-terminal-dim hover:text-terminal-fg transition-colors"
        onclick={toggleExplorer}
        aria-label="Collapse file explorer">«</button
      >
    </div>

    <div class="flex flex-col gap-1 px-2 pb-2">
      <button
        class="rounded border border-terminal-dim/40 bg-transparent px-2 py-1 text-terminal-fg hover:border-terminal-dim/70 hover:bg-terminal-dim/10 transition-colors"
        onclick={createExamples}
        title="create README.md, index.html and src/app.js via touch/mkdir">＋ Example files</button
      >
      <button
        class="rounded border border-terminal-dim/40 bg-transparent px-2 py-1 text-terminal-fg hover:border-terminal-dim/70 hover:bg-terminal-dim/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onclick={simulateChanges}
        disabled={!hasTracked}
        title={hasTracked
          ? 'append a line to tracked files so there is something to git add'
          : 'commit a file first — nothing is tracked yet'}>✎ Simulate changes</button
      >
    </div>

    <div class="flex-1 overflow-y-auto px-2 pb-2">
      {#if !hasFiles}
        <p class="px-1.5 py-4 text-terminal-dim">
          No files yet — click ＋ Example files, or type <code class="text-terminal-fg"
            >touch &lt;name&gt;</code
          > in the terminal.
        </p>
      {:else}
        {#each $fileTree.dirs as d (d.name)}
          <button
            class="flex w-full items-center rounded bg-transparent px-1.5 py-0.5 text-left text-terminal-fg hover:bg-terminal-dim/15 transition-colors"
            onclick={() => toggleDir(d.name)}
            aria-expanded={!collapsedDirs.has(d.name)}
          >
            <span class="pr-1 text-terminal-dim">{collapsedDirs.has(d.name) ? '▸' : '▾'}</span>
            {d.name}/
          </button>
          {#if !collapsedDirs.has(d.name)}
            {#each d.files as f (f.path)}
              {@render fileRow(f, true)}
            {/each}
          {/if}
        {/each}
        {#each $fileTree.rootFiles as f (f.path)}
          {@render fileRow(f, false)}
        {/each}
      {/if}
    </div>

    <div
      class="border-t border-terminal-dim/30 px-3 py-2 text-[10px] text-terminal-dim select-none"
    >
      <span class="text-terminal-green">U</span> new ·
      <span class="text-terminal-yellow">M</span> modified ·
      <span class="text-terminal-blue">●</span> staged ·
      <span class="text-terminal-red">D</span> deleted
    </div>
  </aside>
{:else}
  <div
    class="flex h-full w-9 shrink-0 flex-col items-center border-r border-terminal-dim/30 bg-terminal-bg pt-2 max-sm:hidden"
  >
    <button
      class="rounded bg-transparent px-1 font-mono text-terminal-dim hover:text-terminal-fg transition-colors"
      onclick={toggleExplorer}
      aria-label="Expand file explorer">»</button
    >
  </div>
{/if}
