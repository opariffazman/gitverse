/**
 * Diff generation utility.
 *
 * Produces a simplified unified diff format compatible with git diff output.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Hunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[]; // lines prefixed with ' ', '-', or '+'
};

// ---------------------------------------------------------------------------
// LCS-based diff algorithm
// ---------------------------------------------------------------------------

/**
 * Compute the longest common subsequence of two string arrays.
 * Returns a table of LCS lengths.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

type DiffLine = { type: 'context' | 'removed' | 'added'; content: string };

/**
 * Backtrack through the LCS table to produce diff lines.
 */
function backtrack(dp: number[][], a: string[], b: string[], i: number, j: number): DiffLine[] {
  if (i === 0 && j === 0) return [];
  if (i === 0) {
    return [...backtrack(dp, a, b, i, j - 1), { type: 'added', content: b[j - 1] }];
  }
  if (j === 0) {
    return [...backtrack(dp, a, b, i - 1, j), { type: 'removed', content: a[i - 1] }];
  }
  if (a[i - 1] === b[j - 1]) {
    return [...backtrack(dp, a, b, i - 1, j - 1), { type: 'context', content: a[i - 1] }];
  }
  if (dp[i][j - 1] >= dp[i - 1][j]) {
    return [...backtrack(dp, a, b, i, j - 1), { type: 'added', content: b[j - 1] }];
  }
  return [...backtrack(dp, a, b, i - 1, j), { type: 'removed', content: a[i - 1] }];
}

// ---------------------------------------------------------------------------
// Hunk building
// ---------------------------------------------------------------------------

const CONTEXT_LINES = 3;

/**
 * Groups diff lines into hunks, each with CONTEXT_LINES of surrounding context.
 */
function buildHunks(diffLines: DiffLine[]): Hunk[] {
  const hunks: Hunk[] = [];
  let oldLine = 1;
  let newLine = 1;

  // Track positions: for each diff line, record (oldLine, newLine) before processing
  type PositionedLine = DiffLine & { oldPos: number; newPos: number };
  const positioned: PositionedLine[] = [];

  let ol = 1;
  let nl = 1;
  for (const dl of diffLines) {
    positioned.push({ ...dl, oldPos: ol, newPos: nl });
    if (dl.type === 'context') {
      ol++;
      nl++;
    } else if (dl.type === 'removed') {
      ol++;
    } else {
      nl++;
    }
  }

  // Find indices of changed lines
  const changedIndices: number[] = [];
  for (let i = 0; i < positioned.length; i++) {
    if (positioned[i].type !== 'context') {
      changedIndices.push(i);
    }
  }

  if (changedIndices.length === 0) return [];

  // Group changed indices into hunk ranges (with context)
  const hunkRanges: Array<[number, number]> = [];
  let start = Math.max(0, changedIndices[0] - CONTEXT_LINES);
  let end = Math.min(positioned.length - 1, changedIndices[0] + CONTEXT_LINES);

  for (let k = 1; k < changedIndices.length; k++) {
    const ci = changedIndices[k];
    const newStart = Math.max(0, ci - CONTEXT_LINES);
    if (newStart <= end + 1) {
      // Extend current range
      end = Math.min(positioned.length - 1, ci + CONTEXT_LINES);
    } else {
      hunkRanges.push([start, end]);
      start = newStart;
      end = Math.min(positioned.length - 1, ci + CONTEXT_LINES);
    }
  }
  hunkRanges.push([start, end]);

  // Build each hunk
  for (const [hStart, hEnd] of hunkRanges) {
    void oldLine;
    void newLine; // suppress unused warning
    const slice = positioned.slice(hStart, hEnd + 1);

    const hunkOldStart = slice[0].oldPos;
    const hunkNewStart = slice[0].newPos;
    let hunkOldCount = 0;
    let hunkNewCount = 0;
    const lines: string[] = [];

    for (const pl of slice) {
      if (pl.type === 'context') {
        lines.push(` ${pl.content}`);
        hunkOldCount++;
        hunkNewCount++;
      } else if (pl.type === 'removed') {
        lines.push(`-${pl.content}`);
        hunkOldCount++;
      } else {
        lines.push(`+${pl.content}`);
        hunkNewCount++;
      }
    }

    hunks.push({
      oldStart: hunkOldStart,
      oldCount: hunkOldCount,
      newStart: hunkNewStart,
      newCount: hunkNewCount,
      lines,
    });
  }

  return hunks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a simplified unified diff between oldContent and newContent.
 *
 * Returns an empty string when the contents are identical.
 *
 * Output format:
 * ```
 * diff --git a/<path> b/<path>
 * --- a/<path>
 * +++ b/<path>
 * @@ -oldStart,oldCount +newStart,newCount @@
 *  context line
 * -removed line
 * +added line
 * ```
 */
export function generateDiff(path: string, oldContent: string, newContent: string): string {
  if (oldContent === newContent) return '';

  // Split into lines (preserve empty last lines by being explicit)
  const splitLines = (s: string): string[] => {
    if (s === '') return [];
    const lines = s.split('\n');
    // If the string ends with \n, split produces a trailing empty string — remove it
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines;
  };

  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);

  const dp = lcsTable(oldLines, newLines);
  const diffLines = backtrack(dp, oldLines, newLines, oldLines.length, newLines.length);

  const hunks = buildHunks(diffLines);
  if (hunks.length === 0) return '';

  const parts: string[] = [`diff --git a/${path} b/${path}`, `--- a/${path}`, `+++ b/${path}`];

  for (const hunk of hunks) {
    const oldRange = hunk.oldCount === 1 ? `${hunk.oldStart}` : `${hunk.oldStart},${hunk.oldCount}`;
    const newRange = hunk.newCount === 1 ? `${hunk.newStart}` : `${hunk.newStart},${hunk.newCount}`;
    parts.push(`@@ -${oldRange} +${newRange} @@`);
    for (const line of hunk.lines) {
      parts.push(line);
    }
  }

  return parts.join('\n') + '\n';
}
