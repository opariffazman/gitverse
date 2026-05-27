import type { GitEngine } from '$engine/index';

export type PromptSegment = {
  text: string;
  color: 'dim' | 'green' | 'yellow' | 'red' | 'blue' | 'grey' | 'fg';
};

/**
 * Generate a powerlevel10k-style prompt as an array of colored segments.
 *
 * Layout:
 *   ~/gitverse  <branch>[ ✓| ✗][file counts]  $
 *
 * - `~/gitverse ` — always shown in dim
 * - ` ` — spacer in fg
 * - branch name:
 *     green  = attached HEAD, working tree clean
 *     yellow = attached HEAD, working tree dirty
 *     red    = detached HEAD
 * - ` ✓` (green) or ` ✗` (red) — clean/dirty indicator
 * - `[1A 2M 3?]` — file counts segment in grey (omitted when counts are all zero)
 *   - A = staged (added)
 *   - M = modified
 *   - ? = untracked
 * - ` $ ` — prompt character in fg
 */
export function generatePrompt(engine: GitEngine): PromptSegment[] {
  const head = engine.getHEAD();
  const dirty = engine.isDirty();
  const staged = engine.getStagedFiles();
  const modified = engine.getModifiedFiles();
  const untracked = engine.getUntrackedFiles();

  // Determine branch display text and color
  let branchText: string;
  let branchColor: PromptSegment['color'];

  if (!head.attached) {
    // Detached HEAD — show short hash
    branchText = head.target.slice(0, 7);
    branchColor = 'red';
  } else {
    branchText = head.target;
    branchColor = dirty ? 'yellow' : 'green';
  }

  const segments: PromptSegment[] = [];

  // Directory segment
  segments.push({ text: '~/gitverse ', color: 'dim' });

  // Spacer
  segments.push({ text: ' ', color: 'fg' });

  // Branch name
  segments.push({ text: branchText, color: branchColor });

  // Clean/dirty indicator
  if (dirty) {
    segments.push({ text: ' ✗', color: 'red' });
  } else {
    segments.push({ text: ' ✓', color: 'green' });
  }

  // File counts — only shown when there is something to show
  const counts: string[] = [];
  if (staged.length > 0) counts.push(`${staged.length}A`);
  if (modified.length > 0) counts.push(`${modified.length}M`);
  if (untracked.length > 0) counts.push(`${untracked.length}?`);

  if (counts.length > 0) {
    segments.push({ text: ` [${counts.join(' ')}]`, color: 'grey' });
  }

  // Prompt character
  segments.push({ text: ' $ ', color: 'fg' });

  return segments;
}
