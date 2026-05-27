<script lang="ts">
  import { engine, executeCommand } from '$store/engine';

  type FileStatus = { path: string; status: 'staged' | 'modified' | 'untracked' | 'deleted' };

  const fileStatuses = $derived.by(() => {
    const eng = $engine;
    const result: FileStatus[] = [];

    const staged = eng.getStagedFiles();
    const modified = eng.getModifiedFiles();
    const untracked = eng.getUntrackedFiles();

    // Committed files no longer in VFS are deleted
    const committedTree = eng.getCommittedTree();
    const vfs = eng.getVFS();
    for (const [path] of committedTree) {
      if (!vfs.exists(path)) {
        result.push({ path, status: 'deleted' });
      }
    }

    for (const path of staged) {
      result.push({ path, status: 'staged' });
    }
    for (const path of modified) {
      // Avoid duplicating files already listed as staged
      if (!staged.includes(path)) {
        result.push({ path, status: 'modified' });
      }
    }
    for (const path of untracked) {
      result.push({ path, status: 'untracked' });
    }

    return result;
  });

  function statusIcon(status: FileStatus['status']): string {
    switch (status) {
      case 'staged': return '✓';
      case 'modified': return '●';
      case 'untracked': return '○';
      case 'deleted': return '✗';
    }
  }

  function chipClass(status: FileStatus['status']): string {
    const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-mono shrink-0';
    switch (status) {
      case 'staged':
        return `${base} bg-terminal-green/20 text-terminal-green border-terminal-green/40`;
      case 'modified':
        return `${base} bg-terminal-red/20 text-terminal-red border-terminal-red/40`;
      case 'untracked':
        return `${base} bg-terminal-dim/20 text-terminal-grey border-terminal-dim/40`;
      case 'deleted':
        return `${base} bg-terminal-red/20 text-terminal-red border-terminal-red/40`;
    }
  }

  function handleNewFile() {
    const name = prompt('New file name:');
    if (name && name.trim()) {
      executeCommand(`touch ${name.trim()}`);
    }
  }

  function handleSimChange() {
    const eng = $engine;
    // Pick first tracked (committed) file available in VFS
    const committedTree = eng.getCommittedTree();
    const vfs = eng.getVFS();
    for (const [path] of committedTree) {
      if (vfs.exists(path)) {
        executeCommand(`sim change ${path}`);
        return;
      }
    }
    // Fall back to first untracked file
    const untracked = eng.getUntrackedFiles();
    if (untracked.length > 0) {
      executeCommand(`sim change ${untracked[0]}`);
    }
  }
</script>

<div class="flex items-center gap-2 px-3 py-1.5 border-b border-terminal-dim/30 overflow-x-auto">
  <!-- Label -->
  <span class="font-mono text-xs text-terminal-dim select-none shrink-0">FILES</span>

  <!-- File chips -->
  {#each fileStatuses as file (file.path + file.status)}
    <span class={chipClass(file.status)}>
      <span>{statusIcon(file.status)}</span>
      <span class="max-w-32 truncate">{file.path}</span>
    </span>
  {/each}

  {#if fileStatuses.length === 0}
    <span class="font-mono text-xs text-terminal-dim/60 select-none shrink-0">no changes</span>
  {/if}

  <!-- Spacer -->
  <div class="flex-1"></div>

  <!-- Action buttons -->
  <button
    class="shrink-0 font-mono text-xs px-2 py-0.5 rounded bg-terminal-dim/20 text-terminal-grey hover:text-terminal-fg hover:bg-terminal-dim/30 transition-colors border border-terminal-dim/30"
    onclick={handleNewFile}
    title="Create a new file"
  >
    + New
  </button>
  <button
    class="shrink-0 font-mono text-xs px-2 py-0.5 rounded bg-terminal-dim/20 text-terminal-grey hover:text-terminal-fg hover:bg-terminal-dim/30 transition-colors border border-terminal-dim/30"
    onclick={handleSimChange}
    title="Simulate a file change"
  >
    ~ Changes
  </button>
</div>
