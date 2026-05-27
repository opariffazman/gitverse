<script lang="ts">
  import type { PromptSegment } from '$shell/prompt';

  let { segments }: { segments: PromptSegment[] } = $props();

  const colorClassMap: Record<PromptSegment['color'], string> = {
    dim: 'text-terminal-dim',
    green: 'text-terminal-green',
    yellow: 'text-terminal-yellow',
    red: 'text-terminal-red',
    blue: 'text-terminal-blue',
    grey: 'text-terminal-grey',
    fg: 'text-terminal-fg',
    cyan: 'text-cyan-400',
  };
</script>

<span class="font-mono"
  >{#each segments as seg, i (i)}<span class={colorClassMap[seg.color]}>{seg.text}</span
    >{/each}</span
>
