<script lang="ts">
  import { engine, executeCommand } from '$store/engine';

  function handleNewFile() {
    const name = prompt('New file name:');
    if (name && name.trim()) {
      executeCommand(`touch ${name.trim()}`);
    }
  }

  function handleSimulate() {
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

<div class="flex gap-2 p-2 md:hidden">
  <button
    class="flex-1 text-xs py-2 rounded bg-terminal-dim/20 text-terminal-fg active:bg-terminal-dim/40 font-mono border border-terminal-dim/30"
    onclick={handleNewFile}
  >
    + New File
  </button>
  <button
    class="flex-1 text-xs py-2 rounded bg-terminal-dim/20 text-terminal-fg active:bg-terminal-dim/40 font-mono border border-terminal-dim/30"
    onclick={handleSimulate}
  >
    ~ Simulate
  </button>
</div>
