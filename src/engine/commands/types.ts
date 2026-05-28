export type CommandResult = {
  output: string;
  exitCode: number;
};

/** Maps a commit hash to its friendly label (e.g. "C3"), or a short hash fallback. */
export type LabelFn = (hash: string) => string;

/** Resolves a C-label at a commit-ish position to a hash; returns the token unchanged otherwise. */
export type ExpandFn = (token: string) => string;
