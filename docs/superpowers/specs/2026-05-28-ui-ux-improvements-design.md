# UI/UX Improvements — Design Spec

**Date:** 2026-05-28
**Branch:** `feat/ui-ux-improvements`

## Goal

Three UI/UX improvements to make the Gitverse sandbox easier to read and operate:

1. **Friendly commit labels** — display commits as `C1`, `C2`, … instead of hashes, everywhere they appear.
2. **Click-to-checkout** — clicking a commit node in the graph checks it out.
3. **Reset button** — a one-click way to wipe the sandbox back to a clean slate.

## Non-Goals

- No change to the underlying object model — commits keep their real FNV-1a hashes internally; C-labels are a presentation/addressing layer on top.
- No remote operations, no new git commands.
- No renumbering of existing commits when new ones are created (labels are stable).

---

## Feature 1: Commit labels (C1, C2, …)

### Numbering rule

A commit's label is `C{n}` where `n` is its **1-based position in creation order**.

- Creation order = `ObjectStore` commit insertion order. This order survives
  save/load: `serialize()` writes `engine.allCommits()` (insertion order) and
  `deserialize()` restores them in that same order via `_restoreCommit`.
- A commit's label is **permanent** — making new commits never renumbers
  existing ones.
- Orphaned commits (e.g. left behind by rebase) keep their ordinal. This can
  leave gaps in the visible sequence (e.g. C1, C2, C5), which is acceptable
  because orphaned commits are not drawn.
- After a **Reset**, a fresh `GitEngine` is created, so numbering restarts at C1.

### Source of truth

Add to `src/engine/objects.ts`:

```ts
/** 1-based creation-order index for a commit hash, or null if unknown. */
commitOrdinal(hash: string): number | null
```

Implementation: index of `hash` within `[...this.commits.keys()]`, plus 1. Returns
`null` if not present.

Add to `src/engine/index.ts` (GitEngine):

```ts
/** Friendly label for a commit hash, e.g. "C3". Falls back to short hash. */
commitLabel(hash: string): string
/** Resolve a label like "C3" (case-insensitive) to a commit hash, or null. */
resolveCommitLabel(label: string): string | null
```

- `commitLabel(hash)` → `C${ordinal}` when the ordinal is known; otherwise the
  7-char short hash (defensive fallback only — should not happen for real commits).
- `resolveCommitLabel(label)` → matches `/^C(\d+)$/i`, finds the commit whose
  ordinal equals the captured number, returns its hash or `null`.

### "Everywhere" — where labels appear

| Location                                    | Before                     | After                                            |
| ------------------------------------------- | -------------------------- | ------------------------------------------------ |
| Graph node circle                           | `node.hash.slice(0, 4)`    | `C3`                                             |
| Detail panel headline                       | `node.hash.slice(0, 7)`    | `C3` (with short hash shown small for reference) |
| Detail panel parents                        | `parent.slice(0, 7)`       | `C1, C2`                                         |
| `git log` (full)                            | `commit <full hash>`       | `commit C3`                                      |
| `git log --oneline`                         | `<shortHash> <msg>`        | `C3 <msg>`                                       |
| `commit` message                            | `[main 1a2b3c4] msg`       | `[main C3] msg`                                  |
| `checkout` message                          | `HEAD is now at 1a2b3c4 …` | `HEAD is now at C3 …`                            |
| `reset` message                             | short hash                 | `C3`                                             |
| `revert` / `cherry-pick` / `merge` messages | short hash                 | `C3`                                             |

The graph node and detail headline need the label without an engine round-trip
per render. The `Graph.svelte` layout builder will attach a `label` field to each
`GraphNode` (computed once via `eng.commitLabel(c.hash)` while mapping commits),
and pass it through to `CommitDetail`.

### Input coherence — accept C-labels as refs

Because the terminal now shows `C3` instead of a hash, the user must be able to
type `git checkout C3`, `git reset C3`, etc. The engine resolves C-labels to
hashes **only at commit-ish argument positions**, so it never hijacks
new-name arguments (e.g. `git branch C3` still creates a branch named `C3` if the
user really wants — branch/tag _creation_ names are not label-expanded).

Approach: a single helper `GitEngine.expandCommitish(token: string): string` that
returns the resolved hash if `token` is a C-label that resolves, else returns
`token` unchanged. It is applied inside the commands that consume a commit-ish:

- `checkout` / `switch` — the checkout target (not the `-b <newname>` value).
- `reset` — the target.
- `merge` — the branch/commit to merge.
- `cherry-pick` — the commit(s).
- `revert` — the commit(s).
- `log` — a start ref argument, if present.
- `branch <name> <start-point>` / `tag <name> <commit>` — the _start-point/target_
  arg only, never the new name.

Real short/long hashes continue to work everywhere they did before; label
expansion is additive.

### Tests

- `objects.test`: `commitOrdinal` returns stable 1-based order; survives a
  serialize→deserialize round-trip; returns `null` for unknown hash.
- `engine`/labels: `commitLabel` / `resolveCommitLabel` round-trip; case
  insensitivity; unknown label → null.
- Command tests updated to expect `C{n}` in output (log, checkout, reset, etc.).
- New tests: `git checkout C2` and `git reset C1` resolve correctly; `git branch
C3` is **not** label-expanded (creates branch named `C3`).

---

## Feature 2: Click-to-checkout (smart, keeps detail open)

### Behavior

Clicking a commit node:

1. Determines the checkout target:
   - If one or more branches point at that commit → check out a branch
     (`git checkout <branch>`), so HEAD attaches. Pick the node's first branch
     (graph already lists `node.branches`; prefer the HEAD branch if present,
     else the first).
   - Otherwise → `git checkout C{n}` (detached HEAD at the commit).
2. Runs the checkout **through `executeCommand`** (in `store/engine.ts`), so the
   action is logged to the terminal, persisted via autosave, and bumps
   `engineVersion` — identical to typing it.
3. Keeps/opens the detail popup for that node so the user sees what they checked
   out. (Today click toggles the popup; new behavior: click always selects +
   checks out + shows detail.)
4. Dirty-working-tree errors are produced by the existing checkout command and
   appear in the terminal as normal — no special handling.

### Implementation notes

- `Graph.svelte` `selectNode(node)` becomes: set `selectedHash = node.hash`, then
  build the checkout command string and call `executeCommand(cmd)`.
- Skip checkout for `phantom` nodes (no commit yet) and for clicking the node
  that is already current HEAD (avoid a redundant no-op command in the terminal —
  still show its detail).
- Keyboard: Enter on a focused node does the same as click.

### Tests

- E2E (Playwright): create a couple of commits + a branch, click an older node →
  terminal shows a checkout line and HEAD glow moves. Clicking a branch-tip node
  attaches (prompt shows branch name); clicking a non-tip node detaches.

---

## Feature 3: Reset button (full wipe + confirm)

### Behavior

A small button in the **top-left** corner (the logo occupies top-right on desktop
/ top-center on mobile, so top-left is free).

1. Click → inline styled confirmation replaces the button label:
   `Reset sandbox? this wipes everything` with `Yes` / `Cancel`. (Inline confirm,
   not native `window.confirm`, to match the app's look.)
2. `Cancel` → revert to the normal button.
3. `Yes` → call `resetSession()`:
   - Replace the engine store value with a `new GitEngine()`.
   - `engineVersion += 1`.
   - Reset `terminalLines` to the welcome banner (`createInitialLines()`).
   - Reset command `history` to a fresh `CommandHistory()`.
   - Clear IndexedDB: `clearAutoSave()` + `clearHistory()`.

### Implementation notes

- `src/persistence/storage.ts`: add `clearAutoSave()` (`del(AUTOSAVE_KEY)`) and
  `clearHistory()` (`del(HISTORY_KEY)`), each error-swallowing like the existing
  helpers.
- `src/store/engine.ts`: add `resetSession(): void`. Reuses `createInitialLines()`
  (extract `lineIdCounter` reset as needed so a fresh banner id is issued).
- New component `src/ui/ResetButton.svelte` holding the confirm toggle state,
  mounted from `Layout.svelte` at top-left (`absolute top-3 left-4 z-20`).

### Tests

- E2E: run a few commands, click Reset → Yes, confirm graph shows "No commits
  yet" / welcome banner returns and a page reload stays clean (IndexedDB cleared).
- Unit: `clearAutoSave` / `clearHistory` remove their keys.

---

## File change summary

| File                                       | Change                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `src/engine/objects.ts`                    | `commitOrdinal(hash)`                                                                        |
| `src/engine/index.ts`                      | `commitLabel`, `resolveCommitLabel`, `expandCommitish`; apply expansion in dispatch/commands |
| `src/engine/commands/log.ts`               | headline uses label                                                                          |
| `src/engine/commands/checkout.ts`          | message uses label; expand target                                                            |
| `src/engine/commands/reset.ts`             | message uses label; expand target                                                            |
| `src/engine/commands/commit.ts`            | message uses label (if it prints a hash)                                                     |
| `src/engine/commands/merge.ts`             | message + expand target                                                                      |
| `src/engine/commands/cherry-pick.ts`       | message + expand target                                                                      |
| `src/engine/commands/revert.ts`            | message + expand target                                                                      |
| `src/engine/commands/branch.ts` / `tag.ts` | expand start-point/target arg only                                                           |
| `src/graph/types.ts`                       | `GraphNode.label?: string`                                                                   |
| `src/ui/Graph.svelte`                      | render label in node; click → checkout via `executeCommand`; pass label to detail            |
| `src/ui/CommitDetail.svelte`               | show label headline + parents as labels; keep short hash small                               |
| `src/ui/ResetButton.svelte`                | **new** — confirm + reset                                                                    |
| `src/ui/Layout.svelte`                     | mount `ResetButton` top-left                                                                 |
| `src/store/engine.ts`                      | `resetSession()`                                                                             |
| `src/persistence/storage.ts`               | `clearAutoSave()`, `clearHistory()`                                                          |

## Risks / tradeoffs

- **Realism:** `git log` showing `commit C3` instead of a real hash diverges from
  real git output. This is the explicit "easier to understand" tradeoff the user
  chose. Real hashes remain valid input, and the detail panel still surfaces the
  short hash, so the learning value of "commits are content-addressed" is not
  fully lost.
- **Label expansion scope:** expansion is applied only at commit-ish positions to
  avoid clobbering new-name args. The one deliberate carve-out is that
  branch/tag _names_ are never expanded.
- **Orphan gaps:** rebase can leave numbering gaps in the visible graph. Accepted
  as low-impact for a sandbox.
