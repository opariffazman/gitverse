# Git Init Requirement + Command Audit

**Date:** 2026-05-28
**Status:** Draft
**Scope:** Make `git init` a required first command, add `.git/` directory marker, enhance `ls` with flags, add phantom graph node, audit README commands.

## Problem

Engine auto-initializes with a `main` branch — `git init` is listed in README but doesn't exist as a command. This makes the sandbox less realistic. Users should experience the full git workflow starting from an empty directory.

## Design Decisions

| Decision               | Choice                                        | Rationale                                        |
| ---------------------- | --------------------------------------------- | ------------------------------------------------ |
| Init mechanism         | Engine-level `initialized` flag               | Single source of truth, explicit, testable       |
| Pre-init commands      | File builtins + `git init` + `help` + `clear` | Sandbox-friendly — set up files before init      |
| `.git/` representation | Directory marker in VFS                       | Visible with `ls -a`, can't explore contents     |
| Graph on init          | Hollow/dashed phantom node                    | Visual feedback that repo exists, no commits yet |
| Welcome UX             | ASCII banner + empty prompt                   | Guides new users, branded first impression       |
| `sim change` in README | Remove                                        | Not implemented, out of scope                    |

## 1. Engine State Change

### GitEngine (`src/engine/index.ts`)

Add `initialized: boolean = false` property.

**Constructor:** No changes to VFS/ObjectStore/Index. RefStore constructor changes:

```typescript
// Before
this.head = { attached: true, target: 'main' };
this.branches = new Map([['main', '']]);

// After
this.head = { attached: false, target: '' };
this.branches = new Map();
```

Add public accessor:

```typescript
isInitialized(): boolean { return this.initialized; }
```

### `git init` Command (`src/engine/commands/init.ts`)

New file. Handler:

```typescript
export function cmdInit(engine: GitEngine): CommandResult {
  if (engine.isInitialized()) {
    return { output: 'Reinitialized existing Git repository', exitCode: 0 };
  }

  // Inline — single call site, no reuse
  engine.setInitialized(true);
  engine.refs.createBranch('main', '');
  engine.refs.setHEAD({ attached: true, target: 'main' });
  engine.vfs.createDir('.git');

  return { output: 'Initialized empty Git repository', exitCode: 0 };
}
```

## 2. Command Gating

### Engine Execute (`src/engine/index.ts`)

Single gating point — add init check at top of `execute()`. If command is not `init` and not initialized, return error. No router changes needed (KISS — one check, one place).

```
Allowed pre-init:  git init, ls, cat, touch, rm, mv, clear, help
Blocked pre-init:  git add, git commit, git status, git log, git diff,
                   git branch, git checkout, git switch, git merge,
                   git rebase, git reset, git stash, git tag,
                   git cherry-pick, git revert, git rm, git mv
```

Error message for blocked commands:

```
fatal: not a git repository (or any of the parent directories): .git
```

Builtins bypass engine entirely (routed by shell), so they work pre-init by default.

## 3. Prompt Change

### Prompt (`src/shell/prompt.ts`)

When `!engine.isInitialized()`:

- No branch icon segment
- No branch name segment
- No status count segments
- Just: `gitverse` (dim) + `❯ ` (cyan)

When `engine.isInitialized()`:

- Current behavior unchanged (branch icon, name, status counts)

## 4. `.git/` Directory Marker

`git init` calls `vfs.createDir('.git')`. This makes `.git/` appear in VFS.

Behavior:

- `ls -a` shows `.git/` (hidden by default without `-a`)
- `ls .git` returns empty (no children in VFS)
- `cat .git` returns error (it's a directory)
- `touch .git/foo` — blocked (VFS doesn't allow nested files inside `.git/`)
- `rm .git` — blocked (protected directory, not user-deletable)

## 5. `ls` Flag Enhancement

### Current Behavior

`ls [dir]` returns space-separated entries. No flag support.

### New Behavior

Support `-a` and `-l` flags in any combination (`-la`, `-al`, `-a -l`, etc.). No `-h` — no file sizes to format (KISS).

**`-a` (all):** Show hidden files/directories (names starting with `.`). Without `-a`, filter out dotfiles.

**`-l` (long format):** One entry per line with type indicator:

```
drwxr-xr-x  .git/
drwxr-xr-x  src/
-rw-r--r--  readme.md
-rw-r--r--  index.js
```

Permissions are decorative (always `drwxr-xr-x` for dirs, `-rw-r--r--` for files). No size/date columns — simulated filesystem has no metadata.

**Without `-l`:** Space-separated (current behavior), respecting `-a` filter.

**Flag parsing:** Extract flags from args before interpreting remaining args as directory path.

## 6. Welcome Banner

On fresh load (uninitialized state), terminal shows:

```
┌─────────────────────────────────────┐
│         Welcome to Gitverse         │
│     A browser-based git sandbox     │
│                                     │
│     Type 'git init' to begin        │
│     Type 'help' for commands        │
└─────────────────────────────────────┘
```

Rendered as initial terminal lines in `src/store/engine.ts` (`createInitialLines()`). Only shown when no persisted state exists. If loading from saved state, skip banner.

## 7. Graph: Phantom Node

### GraphNode Type (`src/graph/types.ts`)

Add node type discriminator:

```typescript
type GraphNode = {
  id: string;
  type: 'commit' | 'phantom';
  // ... existing fields
};
```

### Graph Data Generation

When initialized but zero commits:

- Generate single phantom node: `{ id: 'phantom-main', type: 'phantom', ... }`
- Attach `main` branch label to it
- No parent edges

When first commit is created:

- Phantom node disappears, replaced by real commit node
- Standard graph behavior from here

### Graph Rendering (`src/ui/Graph.svelte`)

Phantom node styling:

- Hollow circle (no fill, or transparent fill)
- Dashed stroke
- No commit hash displayed
- Branch label displayed normally
- Same size as regular commit nodes

## 8. Persistence

### Serialization (`src/persistence/serializer.ts`)

Add `initialized` to `WireState`:

```typescript
type WireState = {
  initialized: boolean;
  vfs: ...;
  objects: ...;
  refs: ...;
  index: ...;
};
```

**Backwards compatibility:** On deserialization, if `initialized` field is missing (old saves), default to `true`. Old saves have commits and branches, so treating them as initialized is correct.

### Storage

No changes to storage layer. `initialized` flag serializes/deserializes with engine state.

## 9. Autocomplete

### Pre-init (`src/shell/complete.ts`)

When `!engine.isInitialized()`:

- Top-level completions: `git`, `ls`, `cat`, `touch`, `rm`, `mv`, `clear`, `help`
- Git subcommand completions: only `init`
- No branch completions
- File completions still work (for file builtins)

When initialized:

- Current behavior + `init` added to git subcommand list

## 10. README Command Audit

### Commands verified as implemented:

| Command           | Status           | Notes                           |
| ----------------- | ---------------- | ------------------------------- |
| `git init`        | **To implement** | This spec                       |
| `git add`         | Working          | Supports `.` and specific paths |
| `git commit`      | Working          | Requires `-m "message"`         |
| `git status`      | Working          | Shows three-area diff           |
| `git log`         | Working          | Supports `--oneline`            |
| `git diff`        | Working          | Supports `--staged`/`--cached`  |
| `git branch`      | Working          | Supports `-d`, `-D`             |
| `git checkout`    | Working          | Supports `-b`                   |
| `git switch`      | Working          | Alias of checkout               |
| `git merge`       | Working          | Fast-forward + three-way        |
| `git rebase`      | Working          | Replays commits                 |
| `git reset`       | Working          | `--soft`, `--mixed`, `--hard`   |
| `git stash`       | Working          | `push`, `pop`, `list`, `drop`   |
| `git tag`         | Working          | Lightweight tags                |
| `git cherry-pick` | Working          | Single commit                   |
| `git revert`      | Working          | Creates inverse commit          |
| `git rm`          | Working          | Removes from VFS + index        |
| `git mv`          | Working          | Moves in VFS + index            |

### Builtins verified:

| Builtin      | Status               | Notes                        |
| ------------ | -------------------- | ---------------------------- |
| `ls`         | Working, **enhance** | Add `-a`, `-l`, `-h` flags   |
| `cat`        | Working              | No changes                   |
| `touch`      | Working              | Auto-generates content       |
| `rm`         | Working              | No changes                   |
| `mv`         | Working              | No changes                   |
| `clear`      | Working              | No changes                   |
| `help`       | Working              | Update to include `git init` |
| `sim change` | **Not implemented**  | Remove from README           |

### README changes needed:

- Remove `sim change` from file builtins list
- `git init` already listed, no change needed
- Builtins count: 8 → 7 (drop `sim change`)

## 11. Test Impact

All existing engine tests start with `new GitEngine()` (uninitialized). Tests that run git commands need `git init` first.

**Strategy:** Add helper function:

```typescript
function initEngine(): GitEngine {
  const engine = new GitEngine();
  engine.execute('git init');
  return engine;
}
```

Update `beforeEach` in all engine test files. Add new test file `tests/engine/init.test.ts` covering:

- Fresh engine is uninitialized
- `git init` sets initialized flag
- `git init` creates `.git/` directory
- `git init` creates `main` branch
- Double `git init` returns "Reinitialized"
- Git commands fail pre-init with correct error
- File builtins work pre-init
- Prompt shows no branch pre-init
- Autocomplete only shows `init` pre-init

## Files Changed

| File                            | Change                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `src/engine/index.ts`           | Add `initialized` flag, `_initialize()`, init check in `execute()`, dispatch `git init` |
| `src/engine/refs.ts`            | Constructor starts empty (no branches, no HEAD target)                                  |
| `src/engine/commands/init.ts`   | **New file** — `cmdInit` handler                                                        |
| `src/shell/builtins.ts`         | Enhance `ls` with `-a`, `-l` flags, protect `.git/` from `rm`                           |
| `src/shell/prompt.ts`           | Handle uninitialized state (no branch segment)                                          |
| `src/shell/complete.ts`         | Filter completions pre-init                                                             |
| `src/graph/types.ts`            | Add `'phantom'` to node type                                                            |
| `src/graph/layout.ts`           | Handle phantom node generation                                                          |
| `src/ui/Graph.svelte`           | Render phantom node (hollow, dashed)                                                    |
| `src/store/engine.ts`           | Update welcome banner for uninitialized state                                           |
| `src/persistence/serializer.ts` | Add `initialized` to wire format, backwards compat                                      |
| `tests/engine/init.test.ts`     | **New file** — init-specific tests                                                      |
| `tests/engine/*.test.ts`        | Add `git init` to setup in all existing tests                                           |
| `tests/shell/builtins.test.ts`  | Add `ls` flag tests                                                                     |
| `tests/shell/prompt.test.ts`    | Add uninitialized prompt test                                                           |
| `README.md`                     | Remove `sim change`, update builtins count                                              |
| `CLAUDE.md`                     | Remove `sim` from builtins list                                                         |
