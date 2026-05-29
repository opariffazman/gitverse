# Gitverse — `echo` File Simulation & Onboarding Tips

**Date:** 2026-05-29
**Repo:** `opariffazman/gitverse`
**Status:** Draft
**Branch:** `feat/a11y-usability-pass` (PR #13) — version stays `0.7.0-rc.0`

---

## 1. Overview

Makes the full git loop demonstrable and discoverable in the sandbox:

```
touch f  →  git add f  →  git commit -m  →  echo "x" >> f  →  git commit -am
```

Today `touch` is the only file mutation and `touch <existing>` is a no-op (correct
`touch` semantics), so there is **no way to modify a tracked file's content** — which
is why `git commit -am` appears broken (it correctly stages only tracked
modifications, of which there are none). This adds `echo` redirection to create
modifications, fixes a misleading "nothing to commit" message, and replaces the
verbose persistent empty-graph guide with two minimal, well-timed one-time tips.

### Decisions (from brainstorming)

- **Keep git-accurate `-a`** — `commit -a`/`-am` never stages new untracked files.
  The fix is messaging + content-simulation, not changing `-a` semantics.
- **`echo` with `>` / `>>`** is the file-modification mechanism (shell-familiar,
  the write counterpart to `cat`). Kept minimal — not full shell emulation.
- **Two one-time tips**, each fired at the moment its lesson is relevant: a
  create-flow tip on `git init`, a modify-flow tip on the first (root) commit.
  Both via the existing `hint?` dim-line mechanism. No persistence / seen-flag.

### Non-Goals

- Full shell: no pipes, globs, multiple redirects, or command substitution.
- Changing `-a` to stage untracked files.
- Persisted/dismissible tip state.

---

## 2. `echo` builtin with `>` / `>>`

**Parser** (`src/shell/parser.ts`): add `'echo'` to the `BUILTINS` set. Builtin
tokenization stays the simple `split(/\s+/)`; `echo` parses its own args.

**Builtin** (`src/shell/builtins.ts`): new `case 'echo'`.

Argument parsing (args = tokens after `echo`):
1. Find the redirect: the first token equal to `>` or `>>`, **or** a token starting
   with `>`/`>>` (glued form like `>file` / `>>file`).
2. `content` = the tokens **before** the redirect joined by a single space. Strip
   one matching pair of leading/trailing double-quotes from the joined string (so
   `echo "hello world" > f` writes `hello world`).
3. `target` = the token **after** the redirect (or the glued remainder).

Behavior:
- **No redirect** → `{ output: content, exitCode: 0 }` (prints the text).
- **`>` (overwrite)** → `vfs.createFile(target, content)` (createFile overwrites).
  `echo > f` (no text) writes an empty file.
- **`>>` (append)** → if `target` exists, new content = `existing === '' ? content
  : existing + '\n' + content`; if it does not exist, create it with `content`.
- **Missing target after redirect** → `{ output: 'echo: missing redirect target',
  exitCode: 1 }`.
- **Directory check** — reuse `touch`'s rule: if `target` contains a `/`, the
  parent dir must exist, else `echo: cannot create '<target>': No such file or
  directory` (exitCode 1). (Flat + 1-level VFS.)

**Help** (`src/shell/builtins.ts` help text): add under file builtins:
```
    echo <text> > <file>   — write text to a file (overwrite)
    echo <text> >> <file>  — append text (use this to modify tracked files!)
```

---

## 3. Post-init tip (create flow)

In `src/engine/index.ts` `execute()`, the `init` case: on success
(`result.exitCode === 0`), set
```ts
result.hint = "create a file with 'touch <name>', then 'git add' and 'git commit'";
```
Renders as a dim `hint: …` line (existing mechanism) once per `git init`.

---

## 4. Post-first-commit tip (modify flow)

In `src/engine/commands/commit.ts`, on a successful commit that is the **root
commit** (`parents.length === 0`), set the result `hint`:
```ts
hint: "modify a tracked file with 'echo text >> <file>', then 'git commit -am'";
```
Fires once per repo (only the root commit has no parents). No seen-flag.

---

## 5. Context-aware "nothing to commit"

`cmdCommit` currently always returns `nothing to commit, working tree clean` when
nothing is staged — misleading when untracked files exist (the `touch` → `commit
-am` trap). Make it aware of untracked files.

- **Signature**: add an `untracked: string[]` parameter to `cmdCommit`
  (`src/engine/commands/commit.ts`). The engine's `commit` case passes
  `this.getUntrackedFiles()` (already exists).
- **Nothing-staged branch**:
  - `untracked.length > 0` →
    ```
    output: `On branch ${branchLabel}\nnothing added to commit but untracked files present`
    hint:   "use 'git add <file>' to track new files — commit -am only re-commits already-tracked files"
    ```
  - else →
    ```
    output: `On branch ${branchLabel}\nnothing to commit, working tree clean`
    (no hint, or the existing generic hint removed — see below)
    ```
- The existing `hint: 'create or modify a file with touch, then git add'` on the
  truly-clean path is **removed** (superseded by the untracked-aware hint and the
  post-init tip); the truly-clean case gets no hint (a genuinely clean tree needs
  no nudge).

`branchLabel` is the existing `head.attached ? head.target : 'HEAD (detached)'`.

---

## 6. Revert empty-graph guide + de-touch placeholder

**Graph** (`src/ui/Graph.svelte`): replace the 3-step `<pre>` guide with the
original bare paragraph:
```svelte
<p class="font-mono text-terminal-dim text-sm select-none">No commits yet</p>
```
Keep the `commitNodes.length === 0` condition and the conditional `aria-label`
(`'Commit graph area — no commits yet'`) — both still accurate.

**Terminal** (`src/ui/Terminal.svelte`): change the *initialized* placeholder from
`type a command — try 'touch readme.md' or 'help'` to
`type a command — try 'help'`. Pre-init placeholder (`try 'git init'`) unchanged.
(Touch guidance now lives in the one-time tips.)

---

## 7. Testing

### Engine / shell units

- **echo** (`tests/shell/builtins.test.ts` or new `tests/shell/echo.test.ts`):
  `echo hi` prints `hi`; `echo hi > f` overwrites; `echo a >> f` appends a new
  line; `echo b >> new` creates `new`; quoted `echo "x y" > f` writes `x y`;
  missing target errors; bad directory errors.
- **echo → modify → commit -am** (engine): `touch f` (commit it), `echo "more" >>
  f`, `git commit -am "m"` creates a commit with the modification (the loop works
  end-to-end).
- **Context-aware commit message** (`tests/engine/hints.test.ts` or commit tests):
  after `touch f` (untracked) with nothing staged, `git commit -m "x"` →
  `nothing added to commit but untracked files present` + the `git add` hint;
  a truly clean repo → `nothing to commit, working tree clean` (no hint).
- **Tips** (`tests/engine/hints.test.ts`): `git init` result `hint` contains
  `touch`; the root commit result `hint` contains `echo`; a non-root (second)
  commit has no echo tip.

### E2E (Playwright, existing harness)

- Empty-graph panel shows bare "No commits yet" (no 3-step guide).
- Initialized placeholder reads `…try 'help'` (no `touch`).
- (Optional) the post-init `hint:` dim line appears after `git init`.

---

## 8. Out of Scope / Future

- Quote-aware tokenization beyond stripping one outer pair.
- `simulate` auto-mutation command/button.
- Persisted/dismissible tips; modified-but-unstaged commit message nuance.
