import type { GitEngine } from '$engine/index';

export type PromptSegment = {
  text: string;
  color: 'dim' | 'green' | 'yellow' | 'red' | 'blue' | 'grey' | 'fg' | 'cyan';
};

export function generatePrompt(engine: GitEngine): PromptSegment[] {
  const head = engine.getHEAD();
  const dirty = engine.isDirty();
  const staged = engine.getStagedFiles();
  const modified = engine.getModifiedFiles();
  const untracked = engine.getUntrackedFiles();

  const segments: PromptSegment[] = [];

  // Repo name
  segments.push({ text: 'gitverse ', color: 'dim' });

  // Branch icon (Nerd Font U+E0A0)
  segments.push({ text: ' ', color: 'cyan' });

  // Branch name or detached hash
  if (!head.attached) {
    segments.push({ text: head.target.slice(0, 7), color: 'red' });
  } else {
    segments.push({ text: head.target, color: dirty ? 'yellow' : 'green' });
  }

  // Staged count
  if (staged.length > 0) {
    segments.push({ text: ' +' + staged.length, color: 'green' });
  }

  // Modified count
  if (modified.length > 0) {
    segments.push({ text: ' ~' + modified.length, color: 'yellow' });
  }

  // Untracked count
  if (untracked.length > 0) {
    segments.push({ text: ' ?' + untracked.length, color: 'dim' });
  }

  // Cursor
  segments.push({ text: ' ❯ ', color: 'cyan' });

  return segments;
}
