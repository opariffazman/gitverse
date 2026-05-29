<script lang="ts">
  import { tick } from 'svelte';
  import { terminalLines, prompt, history, executeCommand } from '$store/engine';
  import { getCompletions } from '$shell/complete';
  import { engine } from '$store/engine';
  import { pendingInput } from '$store/ui';
  import { get } from 'svelte/store';
  import Prompt from './Prompt.svelte';

  let inputValue = $state('');
  let cursorPos = $state(0);
  let inputEl: HTMLInputElement;
  let scrollEl: HTMLDivElement;

  $effect(() => {
    const cmd = $pendingInput;
    if (cmd === null) return;
    inputValue = cmd;
    cursorPos = cmd.length;
    pendingInput.set(null); // re-arm so re-selecting the same node works again
    tick().then(() => {
      inputEl?.focus();
      inputEl?.setSelectionRange(cursorPos, cursorPos);
    });
  });

  const ghostText = $derived.by(() => {
    if (!inputValue) return '';
    const eng = $engine;
    const completions = getCompletions(inputValue, eng);
    if (completions.length === 0) return '';
    const best = completions[0];
    if (best.startsWith(inputValue) && best !== inputValue) {
      return best.slice(inputValue.length);
    }
    return '';
  });

  function scrollToBottom() {
    tick().then(() => {
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    });
  }

  function focusInput() {
    inputEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    const hist = get(history);

    if (e.key === 'Enter') {
      const cmd = inputValue;
      inputValue = '';
      cursorPos = 0;
      executeCommand(cmd);
      hist.reset();
      scrollToBottom();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = hist.up();
      if (prev !== null) {
        inputValue = prev;
        cursorPos = prev.length;
        tick().then(() => {
          if (inputEl) {
            inputEl.setSelectionRange(cursorPos, cursorPos);
          }
        });
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = hist.down();
      if (next !== null) {
        inputValue = next;
        cursorPos = next.length;
        tick().then(() => {
          if (inputEl) {
            inputEl.setSelectionRange(cursorPos, cursorPos);
          }
        });
      }
      return;
    }

    if (e.ctrlKey) {
      switch (e.key) {
        case 'l':
          e.preventDefault();
          executeCommand('clear');
          return;

        case 'c':
          e.preventDefault();
          inputValue = '';
          cursorPos = 0;
          return;

        case 'a':
          e.preventDefault();
          cursorPos = 0;
          tick().then(() => {
            if (inputEl) inputEl.setSelectionRange(0, 0);
          });
          return;

        case 'e':
          e.preventDefault();
          cursorPos = inputValue.length;
          tick().then(() => {
            if (inputEl) inputEl.setSelectionRange(cursorPos, cursorPos);
          });
          return;

        case 'u': {
          e.preventDefault();
          const pos = inputEl?.selectionStart ?? cursorPos;
          inputValue = inputValue.slice(pos);
          cursorPos = 0;
          tick().then(() => {
            if (inputEl) inputEl.setSelectionRange(0, 0);
          });
          return;
        }

        case 'k': {
          e.preventDefault();
          const pos = inputEl?.selectionStart ?? cursorPos;
          inputValue = inputValue.slice(0, pos);
          cursorPos = pos;
          return;
        }
      }
    }

    if (e.altKey && e.key === 'Backspace') {
      e.preventDefault();
      const pos = inputEl?.selectionStart ?? cursorPos;
      const before = inputValue.slice(0, pos);
      const after = inputValue.slice(pos);
      // Delete last word before cursor
      const trimmed = before.trimEnd();
      const lastSpace = trimmed.lastIndexOf(' ');
      const newBefore = lastSpace === -1 ? '' : trimmed.slice(0, lastSpace + 1);
      inputValue = newBefore + after;
      cursorPos = newBefore.length;
      tick().then(() => {
        if (inputEl) inputEl.setSelectionRange(cursorPos, cursorPos);
      });
      return;
    }

    if (
      e.key === 'ArrowRight' &&
      ghostText &&
      (inputEl?.selectionStart ?? cursorPos) === inputValue.length
    ) {
      e.preventDefault();
      inputValue = inputValue + ghostText;
      cursorPos = inputValue.length;
      tick().then(() => {
        if (inputEl) inputEl.setSelectionRange(cursorPos, cursorPos);
      });
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const atEnd = (inputEl?.selectionStart ?? cursorPos) === inputValue.length;
      if (ghostText && atEnd) {
        inputValue = inputValue + ghostText;
        cursorPos = inputValue.length;
        tick().then(() => {
          if (inputEl) inputEl.setSelectionRange(cursorPos, cursorPos);
        });
        return;
      }
      const eng = get(engine);
      const completions = getCompletions(inputValue, eng);
      if (completions.length === 1) {
        inputValue = completions[0];
        cursorPos = inputValue.length;
        tick().then(() => {
          if (inputEl) inputEl.setSelectionRange(cursorPos, cursorPos);
        });
      }
      return;
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    inputValue = target.value;
    cursorPos = target.selectionStart ?? inputValue.length;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={scrollEl}
  class="h-full overflow-y-auto p-3 space-y-0.5 font-mono text-sm"
  onclick={focusInput}
>
  {#each $terminalLines as line (line.id)}
    {#if line.prompt !== undefined}
      <div class="flex flex-wrap items-baseline leading-6">
        <Prompt segments={line.prompt} />
        <span class="text-terminal-fg ml-1">{line.input ?? ''}</span>
      </div>
    {:else if line.output !== undefined && line.output !== ''}
      <div
        class="leading-6 whitespace-pre-wrap break-all"
        class:text-cyan-400={line.color === 'cyan'}
        class:text-terminal-dim={line.color === 'dim'}
        class:text-terminal-red={line.isError && !line.color}
        class:text-terminal-fg={!line.isError && !line.color}
      >
        {line.output}
      </div>
    {/if}
  {/each}
  <div class="flex items-baseline leading-6">
    <Prompt segments={$prompt} />
    <div class="relative flex-1 ml-1">
      <input
        bind:this={inputEl}
        type="text"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck={false}
        class="w-full bg-transparent outline-none border-none text-terminal-fg caret-terminal-green font-mono text-sm"
        value={inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
      />
      {#if ghostText}
        <span
          class="absolute top-0 left-0 pointer-events-none font-mono text-sm whitespace-pre"
          aria-hidden="true"
          ><span class="invisible">{inputValue}</span><span class="text-terminal-dim/40"
            >{ghostText}</span
          ></span
        >
      {/if}
    </div>
  </div>
</div>
