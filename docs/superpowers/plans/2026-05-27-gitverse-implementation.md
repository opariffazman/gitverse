# Gitverse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a realistic browser-based git sandbox with live DAG visualization, deployed as a PWA on Cloudflare Workers.

**Architecture:** Three-module separation — pure TypeScript git engine (zero DOM deps), shell layer (command routing + builtins), Svelte 5 renderer (terminal UI + SVG graph). Engine emits state via subscribe pattern, shell dispatches commands, renderer reads state reactively.

**Tech Stack:** Svelte 5.55.9, TypeScript 6.0.3, Vite 8.0.14, UnoCSS 66.7.0, d3-dag 1.2.1, idb-keyval 6.2.4, vite-plugin-pwa 1.3.0, Vitest 4.1.7, Playwright 1.60.0, Wrangler 4.95.0

**Design Spec:** `docs/specs/2026-05-27-gitverse-design.md`

---

## File Map

### New Files (by task)

**Task 1 — Project Scaffold:**
- `package.json` — dependencies, scripts
- `tsconfig.json` — strict TypeScript config
- `vite.config.ts` — Vite + Svelte + PWA + UnoCSS
- `uno.config.ts` — UnoCSS presets and terminal theme
- `eslint.config.js` — ESLint flat config with Svelte
- `.prettierrc` — Prettier config
- `.gitignore` — Node/Vite/Wrangler ignores
- `wrangler.jsonc` — Cloudflare Workers config
- `src/main.ts` — app entry point
- `src/App.svelte` — root component (placeholder)
- `src/app.css` — global reset/base styles
- `index.html` — Vite HTML entry
- `.github/workflows/ci.yml` — lint + typecheck + test
- `.github/workflows/deploy.yml` — build + deploy on v* tag

**Task 2 — Virtual File System:**
- `src/engine/vfs.ts` — VFS class
- `tests/engine/vfs.test.ts` — VFS tests

**Task 3 — Git Object Store + Hashing:**
- `src/engine/objects.ts` — types + ObjectStore class
- `tests/engine/objects.test.ts` — object store tests

**Task 4 — Refs + HEAD:**
- `src/engine/refs.ts` — RefStore class
- `tests/engine/refs.test.ts` — ref tests

**Task 5 — GitEngine Core (init, add, commit, status):**
- `src/engine/commands/init.ts`
- `src/engine/commands/add.ts`
- `src/engine/commands/commit.ts`
- `src/engine/commands/status.ts`
- `src/engine/index.ts` — GitEngine orchestrator
- `tests/engine/core.test.ts` — init/add/commit/status integration tests

**Task 6 — Branch + Checkout + Switch:**
- `src/engine/commands/branch.ts`
- `src/engine/commands/checkout.ts`
- `tests/engine/branch-checkout.test.ts`

**Task 7 — Log + Diff:**
- `src/engine/commands/log.ts`
- `src/engine/diff.ts` — diff generation utility
- `src/engine/commands/diff.ts` — diff command
- `tests/engine/log-diff.test.ts`

**Task 8 — Merge:**
- `src/engine/commands/merge.ts`
- `tests/engine/merge.test.ts`

**Task 9 — Rebase + Cherry-pick + Revert:**
- `src/engine/commands/rebase.ts`
- `src/engine/commands/cherry-pick.ts`
- `src/engine/commands/revert.ts`
- `tests/engine/rebase.test.ts`

**Task 10 — Reset + Stash + Tag + Rm + Mv:**
- `src/engine/commands/reset.ts`
- `src/engine/commands/stash.ts`
- `src/engine/commands/tag.ts`
- `src/engine/commands/rm.ts`
- `src/engine/commands/mv.ts`
- `tests/engine/reset-stash-tag.test.ts`

**Task 11 — Shell Layer:**
- `src/shell/parser.ts`
- `src/shell/router.ts`
- `src/shell/builtins.ts`
- `src/shell/history.ts`
- `src/shell/complete.ts`
- `src/shell/prompt.ts`
- `tests/shell/parser.test.ts`
- `tests/shell/router.test.ts`
- `tests/shell/builtins.test.ts`

**Task 12 — Svelte Stores + Terminal UI:**
- `src/store/engine.ts`
- `src/store/ui.ts`
- `src/ui/Prompt.svelte`
- `src/ui/Terminal.svelte`
- `src/ui/Layout.svelte`

**Task 13 — Graph Visualization:**
- `src/graph/types.ts`
- `src/graph/layout.ts`
- `src/ui/Graph.svelte`
- `src/ui/CommitDetail.svelte`
- `tests/graph/layout.test.ts`

**Task 14 — File Panel + Mobile Toolbar:**
- `src/ui/FilePanel.svelte`
- `src/ui/MobileToolbar.svelte`

**Task 15 — Persistence:**
- `src/persistence/serializer.ts`
- `src/persistence/storage.ts`
- `tests/persistence/serializer.test.ts`

**Task 16 — PWA + Final Polish:**
- `public/favicon.svg`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

---

### Task 1: Project Scaffold + CI/CD

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `uno.config.ts`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `wrangler.jsonc`, `index.html`, `src/main.ts`, `src/App.svelte`, `src/app.css`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Initialize package.json with pinned dependencies**

```json
{
  "name": "gitverse",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "svelte-check --tsconfig ./tsconfig.json",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "svelte": "5.55.9",
    "d3-dag": "1.2.1",
    "d3-hierarchy": "3.1.2",
    "idb-keyval": "6.2.4"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "7.1.2",
    "vite": "8.0.14",
    "typescript": "6.0.3",
    "vitest": "4.1.7",
    "@playwright/test": "1.60.0",
    "eslint": "10.4.0",
    "eslint-plugin-svelte": "3.17.1",
    "prettier": "3.8.3",
    "prettier-plugin-svelte": "4.0.1",
    "svelte-check": "4.2.1",
    "unocss": "66.7.0",
    "vite-plugin-pwa": "1.3.0",
    "wrangler": "4.95.0",
    "workbox-precaching": "7.4.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "$engine/*": ["src/engine/*"],
      "$shell/*": ["src/shell/*"],
      "$ui/*": ["src/ui/*"],
      "$graph/*": ["src/graph/*"],
      "$store/*": ["src/store/*"],
      "$persistence/*": ["src/persistence/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import UnoCSS from 'unocss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    UnoCSS(),
    svelte(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'Gitverse',
        short_name: 'Gitverse',
        description: 'Realistic browser-based git sandbox with live DAG visualization',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      $engine: '/src/engine',
      $shell: '/src/shell',
      $ui: '/src/ui',
      $graph: '/src/graph',
      $store: '/src/store',
      $persistence: '/src/persistence',
    },
  },
});
```

- [ ] **Step 4: Create uno.config.ts**

```typescript
import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
  presets: [presetUno(), presetIcons()],
  theme: {
    colors: {
      terminal: {
        bg: '#0d1117',
        fg: '#c9d1d9',
        dim: '#484f58',
        green: '#3fb950',
        red: '#f85149',
        yellow: '#d29922',
        blue: '#58a6ff',
        purple: '#bc8cff',
        cyan: '#39d353',
        grey: '#8b949e',
      },
    },
    fontFamily: {
      mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
    },
  },
  shortcuts: {
    'terminal-panel':
      'bg-terminal-bg/85 backdrop-blur-8 rounded-lg border border-terminal-dim/30',
  },
});
```

- [ ] **Step 5: Create eslint.config.js**

```javascript
import eslintPluginSvelte from 'eslint-plugin-svelte';

export default [
  ...eslintPluginSvelte.configs['flat/recommended'],
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.svelte-kit/'],
  },
];
```

- [ ] **Step 6: Create .prettierrc**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
}
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
dist/
.wrangler/
*.local
.env
.env.*
!.env.example
```

- [ ] **Step 8: Create wrangler.jsonc**

```jsonc
{
  "name": "gitverse",
  "compatibility_date": "2026-05-27",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- [ ] **Step 9: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0d1117" />
    <title>Gitverse</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 10: Create src/app.css**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

body {
  background: #0d1117;
  color: #c9d1d9;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 11: Create src/main.ts**

```typescript
import 'virtual:uno.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
```

- [ ] **Step 12: Create src/App.svelte (placeholder)**

```svelte
<script lang="ts">
</script>

<main class="h-full w-full flex items-center justify-center">
  <p class="font-mono text-terminal-fg text-lg">gitverse</p>
</main>
```

- [ ] **Step 13: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: ['*']
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
      - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
```

- [ ] **Step 14: Create .github/workflows/deploy.yml**

```yaml
name: Deploy

on:
  push:
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
      - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
      - uses: cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0 # v4.0.0
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

- [ ] **Step 15: Install dependencies and verify build**

Run: `npm install && npm run build`
Expected: Clean install, successful Vite build producing `dist/` directory.

- [ ] **Step 16: Run dev server to verify placeholder works**

Run: `npm run dev`
Expected: Vite dev server starts, page shows "gitverse" text on dark background.

- [ ] **Step 17: Commit scaffold**

```bash
git add package.json tsconfig.json vite.config.ts uno.config.ts eslint.config.js .prettierrc .gitignore wrangler.jsonc index.html src/main.ts src/App.svelte src/app.css .github/
git commit -m "feat: scaffold project with Svelte 5, Vite, UnoCSS, CI/CD"
```

---

### Task 2: Virtual File System (VFS)

**Files:**
- Create: `src/engine/vfs.ts`
- Create: `tests/engine/vfs.test.ts`

- [ ] **Step 1: Write failing VFS tests**

```typescript
// tests/engine/vfs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualFileSystem } from '$engine/vfs';

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem();
  });

  it('creates and reads a file', () => {
    vfs.createFile('readme.md', 'hello world');
    expect(vfs.readFile('readme.md')).toBe('hello world');
  });

  it('checks file existence', () => {
    expect(vfs.exists('readme.md')).toBe(false);
    vfs.createFile('readme.md', 'content');
    expect(vfs.exists('readme.md')).toBe(true);
  });

  it('deletes a file', () => {
    vfs.createFile('readme.md', 'content');
    vfs.deleteFile('readme.md');
    expect(vfs.exists('readme.md')).toBe(false);
  });

  it('moves a file', () => {
    vfs.createFile('old.txt', 'content');
    vfs.moveFile('old.txt', 'new.txt');
    expect(vfs.exists('old.txt')).toBe(false);
    expect(vfs.readFile('new.txt')).toBe('content');
  });

  it('lists root directory', () => {
    vfs.createFile('a.txt', '');
    vfs.createFile('b.txt', '');
    vfs.createDir('src');
    expect(vfs.listDir()).toEqual(['a.txt', 'b.txt', 'src/']);
  });

  it('creates a directory and lists its contents', () => {
    vfs.createDir('src');
    vfs.createFile('src/index.js', 'code');
    expect(vfs.listDir('src')).toEqual(['index.js']);
  });

  it('enforces max one level of nesting', () => {
    vfs.createDir('src');
    expect(() => vfs.createDir('src/deep')).toThrow('Maximum directory depth is 1');
  });

  it('throws on read of nonexistent file', () => {
    expect(() => vfs.readFile('nope.txt')).toThrow('File not found: nope.txt');
  });

  it('throws on delete of nonexistent file', () => {
    expect(() => vfs.deleteFile('nope.txt')).toThrow('File not found: nope.txt');
  });

  it('moves file into a directory', () => {
    vfs.createFile('readme.md', 'content');
    vfs.createDir('docs');
    vfs.moveFile('readme.md', 'docs/readme.md');
    expect(vfs.exists('docs/readme.md')).toBe(true);
    expect(vfs.exists('readme.md')).toBe(false);
  });

  it('returns a snapshot of all files', () => {
    vfs.createFile('a.txt', 'aaa');
    vfs.createDir('src');
    vfs.createFile('src/b.ts', 'bbb');
    const snap = vfs.snapshot();
    expect(snap).toEqual(
      new Map([
        ['a.txt', { content: 'aaa', type: 'file' }],
        ['src/', { content: '', type: 'dir' }],
        ['src/b.ts', { content: 'bbb', type: 'file' }],
      ]),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/vfs.test.ts`
Expected: FAIL — module `$engine/vfs` not found.

- [ ] **Step 3: Implement VFS**

```typescript
// src/engine/vfs.ts
export type FileEntry = {
  content: string;
  type: 'file' | 'dir';
};

export class VirtualFileSystem {
  private files = new Map<string, FileEntry>();

  createFile(path: string, content: string): void {
    this.validatePath(path);
    this.files.set(path, { content, type: 'file' });
  }

  readFile(path: string): string {
    const entry = this.files.get(path);
    if (!entry || entry.type !== 'file') throw new Error(`File not found: ${path}`);
    return entry.content;
  }

  exists(path: string): boolean {
    return this.files.has(path);
  }

  deleteFile(path: string): void {
    if (!this.files.has(path)) throw new Error(`File not found: ${path}`);
    this.files.delete(path);
  }

  moveFile(src: string, dst: string): void {
    const entry = this.files.get(src);
    if (!entry) throw new Error(`File not found: ${src}`);
    this.validatePath(dst);
    this.files.delete(src);
    this.files.set(dst, entry);
  }

  createDir(name: string): void {
    if (name.includes('/')) throw new Error('Maximum directory depth is 1');
    this.files.set(`${name}/`, { content: '', type: 'dir' });
  }

  listDir(dir?: string): string[] {
    const prefix = dir ? `${dir}/` : '';
    const results: string[] = [];

    for (const [path, entry] of this.files) {
      if (dir) {
        if (path.startsWith(prefix) && path !== `${dir}/`) {
          results.push(path.slice(prefix.length));
        }
      } else {
        if (!path.includes('/')) {
          results.push(path);
        } else if (entry.type === 'dir') {
          results.push(path);
        }
      }
    }
    return results.sort();
  }

  snapshot(): Map<string, FileEntry> {
    return new Map(this.files);
  }

  restore(snap: Map<string, FileEntry>): void {
    this.files = new Map(snap);
  }

  allFilePaths(): string[] {
    return [...this.files.entries()]
      .filter(([_, e]) => e.type === 'file')
      .map(([p]) => p)
      .sort();
  }

  private validatePath(path: string): void {
    const parts = path.split('/');
    if (parts.length > 2) throw new Error('Maximum directory depth is 1');
    if (parts.length === 2 && !this.files.has(`${parts[0]}/`)) {
      throw new Error(`Directory not found: ${parts[0]}`);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/vfs.test.ts`
Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/vfs.ts tests/engine/vfs.test.ts
git commit -m "feat(engine): add virtual file system with flat+1 depth"
```

---

### Task 3: Git Object Store + Hashing

**Files:**
- Create: `src/engine/objects.ts`
- Create: `tests/engine/objects.test.ts`

- [ ] **Step 1: Write failing object store tests**

```typescript
// tests/engine/objects.test.ts
import { describe, it, expect } from 'vitest';
import { ObjectStore, hashContent } from '$engine/objects';

describe('hashContent', () => {
  it('produces a 7-char hex string', () => {
    const h = hashContent('hello world');
    expect(h).toMatch(/^[0-9a-f]{7}$/);
  });

  it('is deterministic', () => {
    expect(hashContent('same')).toBe(hashContent('same'));
  });

  it('differs for different content', () => {
    expect(hashContent('aaa')).not.toBe(hashContent('bbb'));
  });
});

describe('ObjectStore', () => {
  it('stores and retrieves a blob', () => {
    const store = new ObjectStore();
    const hash = store.writeBlob('file content');
    expect(store.readBlob(hash)).toBe('file content');
  });

  it('stores and retrieves a tree', () => {
    const store = new ObjectStore();
    const blobHash = store.writeBlob('content');
    const entries = new Map([['file.txt', blobHash]]);
    const treeHash = store.writeTree(entries);
    expect(store.readTree(treeHash)).toEqual(entries);
  });

  it('stores and retrieves a commit', () => {
    const store = new ObjectStore();
    const treeHash = store.writeTree(new Map());
    const commit = {
      tree: treeHash,
      parents: [] as string[],
      message: 'initial commit',
      timestamp: 1000,
    };
    const hash = store.writeCommit(commit);
    const retrieved = store.readCommit(hash);
    expect(retrieved.message).toBe('initial commit');
    expect(retrieved.tree).toBe(treeHash);
    expect(retrieved.parents).toEqual([]);
    expect(retrieved.hash).toBe(hash);
  });

  it('commit with parent', () => {
    const store = new ObjectStore();
    const tree1 = store.writeTree(new Map());
    const c1 = store.writeCommit({ tree: tree1, parents: [], message: 'first', timestamp: 1 });
    const tree2 = store.writeTree(new Map([['a.txt', 'abc1234']]));
    const c2 = store.writeCommit({ tree: tree2, parents: [c1], message: 'second', timestamp: 2 });
    expect(store.readCommit(c2).parents).toEqual([c1]);
  });

  it('throws on missing object', () => {
    const store = new ObjectStore();
    expect(() => store.readBlob('0000000')).toThrow();
    expect(() => store.readTree('0000000')).toThrow();
    expect(() => store.readCommit('0000000')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/objects.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement object store**

```typescript
// src/engine/objects.ts
export function hashContent(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(7, '0').slice(0, 7);
}

export type Blob = { hash: string; content: string };
export type Tree = { hash: string; entries: Map<string, string> };
export type Commit = {
  hash: string;
  tree: string;
  parents: string[];
  message: string;
  timestamp: number;
};

type WriteCommitInput = Omit<Commit, 'hash'>;

export class ObjectStore {
  private blobs = new Map<string, string>();
  private trees = new Map<string, Map<string, string>>();
  private commits = new Map<string, Commit>();
  private counter = 0;

  writeBlob(content: string): string {
    const hash = this.makeHash(`blob:${content}`);
    this.blobs.set(hash, content);
    return hash;
  }

  readBlob(hash: string): string {
    const blob = this.blobs.get(hash);
    if (blob === undefined) throw new Error(`Object not found: ${hash}`);
    return blob;
  }

  writeTree(entries: Map<string, string>): string {
    const serialized = [...entries.entries()].sort().map(([k, v]) => `${k}:${v}`).join(',');
    const hash = this.makeHash(`tree:${serialized}`);
    this.trees.set(hash, new Map(entries));
    return hash;
  }

  readTree(hash: string): Map<string, string> {
    const tree = this.trees.get(hash);
    if (!tree) throw new Error(`Object not found: ${hash}`);
    return new Map(tree);
  }

  writeCommit(input: WriteCommitInput): string {
    const serialized = `commit:${input.tree}:${input.parents.join(',')}:${input.message}:${input.timestamp}`;
    const hash = this.makeHash(serialized);
    const commit: Commit = { ...input, hash };
    this.commits.set(hash, commit);
    return hash;
  }

  readCommit(hash: string): Commit {
    const commit = this.commits.get(hash);
    if (!commit) throw new Error(`Object not found: ${hash}`);
    return { ...commit };
  }

  hasCommit(hash: string): boolean {
    return this.commits.has(hash);
  }

  allCommits(): Commit[] {
    return [...this.commits.values()].map((c) => ({ ...c }));
  }

  private makeHash(content: string): string {
    const unique = `${content}:${this.counter++}`;
    return hashContent(unique);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/objects.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/objects.ts tests/engine/objects.test.ts
git commit -m "feat(engine): add content-addressable object store with blob/tree/commit"
```

---

### Task 4: Refs + HEAD Management

**Files:**
- Create: `src/engine/refs.ts`
- Create: `tests/engine/refs.test.ts`

- [ ] **Step 1: Write failing ref tests**

```typescript
// tests/engine/refs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RefStore } from '$engine/refs';

describe('RefStore', () => {
  let refs: RefStore;

  beforeEach(() => {
    refs = new RefStore();
  });

  it('initializes HEAD attached to main', () => {
    expect(refs.getHEAD()).toEqual({ attached: true, target: 'main' });
  });

  it('creates and resolves a branch', () => {
    refs.createBranch('main', 'abc1234');
    expect(refs.resolveBranch('main')).toBe('abc1234');
  });

  it('lists branches', () => {
    refs.createBranch('main', 'abc1234');
    refs.createBranch('feat', 'def5678');
    expect(refs.listBranches()).toEqual(['feat', 'main']);
  });

  it('deletes a branch', () => {
    refs.createBranch('main', 'abc1234');
    refs.createBranch('feat', 'def5678');
    refs.deleteBranch('feat');
    expect(refs.listBranches()).toEqual(['main']);
  });

  it('refuses to delete current branch', () => {
    refs.createBranch('main', 'abc1234');
    expect(() => refs.deleteBranch('main')).toThrow();
  });

  it('updates branch target', () => {
    refs.createBranch('main', 'abc1234');
    refs.updateBranch('main', 'new1234');
    expect(refs.resolveBranch('main')).toBe('new1234');
  });

  it('detaches HEAD', () => {
    refs.detachHEAD('abc1234');
    expect(refs.getHEAD()).toEqual({ attached: false, target: 'abc1234' });
  });

  it('attaches HEAD to branch', () => {
    refs.detachHEAD('abc1234');
    refs.attachHEAD('main');
    expect(refs.getHEAD()).toEqual({ attached: true, target: 'main' });
  });

  it('creates and resolves a tag', () => {
    refs.createTag('v1.0', 'abc1234');
    expect(refs.resolveTag('v1.0')).toBe('abc1234');
  });

  it('lists tags', () => {
    refs.createTag('v1.0', 'abc1234');
    refs.createTag('v2.0', 'def5678');
    expect(refs.listTags()).toEqual(['v1.0', 'v2.0']);
  });

  it('throws on duplicate branch', () => {
    refs.createBranch('main', 'abc1234');
    expect(() => refs.createBranch('main', 'def5678')).toThrow();
  });

  it('throws on duplicate tag', () => {
    refs.createTag('v1', 'abc1234');
    expect(() => refs.createTag('v1', 'def5678')).toThrow();
  });

  it('resolves HEAD to commit hash', () => {
    refs.createBranch('main', 'abc1234');
    expect(refs.resolveHEAD()).toBe('abc1234');
  });

  it('resolves detached HEAD to commit hash', () => {
    refs.detachHEAD('abc1234');
    expect(refs.resolveHEAD()).toBe('abc1234');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/refs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement RefStore**

```typescript
// src/engine/refs.ts
export type HEAD = {
  attached: boolean;
  target: string;
};

export type Ref = {
  name: string;
  target: string;
  type: 'branch' | 'tag';
};

export class RefStore {
  private branches = new Map<string, string>();
  private tags = new Map<string, string>();
  private head: HEAD = { attached: true, target: 'main' };

  getHEAD(): HEAD {
    return { ...this.head };
  }

  resolveHEAD(): string {
    if (this.head.attached) {
      return this.resolveBranch(this.head.target);
    }
    return this.head.target;
  }

  attachHEAD(branchName: string): void {
    this.head = { attached: true, target: branchName };
  }

  detachHEAD(commitHash: string): void {
    this.head = { attached: false, target: commitHash };
  }

  createBranch(name: string, target: string): void {
    if (this.branches.has(name)) throw new Error(`Branch already exists: ${name}`);
    this.branches.set(name, target);
  }

  resolveBranch(name: string): string {
    const target = this.branches.get(name);
    if (!target) throw new Error(`Branch not found: ${name}`);
    return target;
  }

  updateBranch(name: string, target: string): void {
    if (!this.branches.has(name)) throw new Error(`Branch not found: ${name}`);
    this.branches.set(name, target);
  }

  deleteBranch(name: string): void {
    if (this.head.attached && this.head.target === name) {
      throw new Error(`Cannot delete checked-out branch: ${name}`);
    }
    if (!this.branches.has(name)) throw new Error(`Branch not found: ${name}`);
    this.branches.delete(name);
  }

  hasBranch(name: string): boolean {
    return this.branches.has(name);
  }

  listBranches(): string[] {
    return [...this.branches.keys()].sort();
  }

  createTag(name: string, target: string): void {
    if (this.tags.has(name)) throw new Error(`Tag already exists: ${name}`);
    this.tags.set(name, target);
  }

  resolveTag(name: string): string {
    const target = this.tags.get(name);
    if (!target) throw new Error(`Tag not found: ${name}`);
    return target;
  }

  deleteTag(name: string): void {
    if (!this.tags.has(name)) throw new Error(`Tag not found: ${name}`);
    this.tags.delete(name);
  }

  hasTag(name: string): boolean {
    return this.tags.has(name);
  }

  listTags(): string[] {
    return [...this.tags.keys()].sort();
  }

  resolveRef(name: string): string | null {
    if (this.branches.has(name)) return this.branches.get(name)!;
    if (this.tags.has(name)) return this.tags.get(name)!;
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/refs.test.ts`
Expected: All 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/refs.ts tests/engine/refs.test.ts
git commit -m "feat(engine): add ref store with branch/tag/HEAD management"
```

---

### Task 5: GitEngine Core — init, add, commit, status

**Files:**
- Create: `src/engine/commands/init.ts`
- Create: `src/engine/commands/add.ts`
- Create: `src/engine/commands/commit.ts`
- Create: `src/engine/commands/status.ts`
- Create: `src/engine/index.ts`
- Create: `tests/engine/core.test.ts`

- [ ] **Step 1: Write failing integration tests for init/add/commit/status**

```typescript
// tests/engine/core.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';

describe('GitEngine core', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
  });

  describe('init', () => {
    it('starts with main branch and no commits', () => {
      const head = engine.getHEAD();
      expect(head.attached).toBe(true);
      expect(head.target).toBe('main');
      expect(engine.log()).toEqual([]);
    });
  });

  describe('add + commit', () => {
    it('stages and commits a file', () => {
      engine.vfs.createFile('readme.md', 'hello');
      const addResult = engine.execute('git add readme.md');
      expect(addResult.exitCode).toBe(0);

      const commitResult = engine.execute('git commit -m "initial commit"');
      expect(commitResult.exitCode).toBe(0);
      expect(commitResult.output).toContain('initial commit');

      const commits = engine.log();
      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe('initial commit');
    });

    it('git add . stages all untracked and modified files', () => {
      engine.vfs.createFile('a.txt', 'aaa');
      engine.vfs.createFile('b.txt', 'bbb');
      engine.execute('git add .');
      const status = engine.execute('git status');
      expect(status.output).toContain('a.txt');
      expect(status.output).toContain('b.txt');
      expect(status.output).toContain('new file');
    });

    it('fails to commit with nothing staged', () => {
      const result = engine.execute('git commit -m "empty"');
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('nothing to commit');
    });

    it('fails to commit without -m flag', () => {
      engine.vfs.createFile('a.txt', 'aaa');
      engine.execute('git add a.txt');
      const result = engine.execute('git commit');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('status', () => {
    it('shows untracked files', () => {
      engine.vfs.createFile('readme.md', 'hello');
      const result = engine.execute('git status');
      expect(result.output).toContain('readme.md');
      expect(result.output).toContain('Untracked');
    });

    it('shows staged files', () => {
      engine.vfs.createFile('readme.md', 'hello');
      engine.execute('git add readme.md');
      const result = engine.execute('git status');
      expect(result.output).toContain('new file');
      expect(result.output).toContain('readme.md');
    });

    it('shows modified files after commit and change', () => {
      engine.vfs.createFile('readme.md', 'v1');
      engine.execute('git add .');
      engine.execute('git commit -m "init"');
      engine.vfs.createFile('readme.md', 'v2');
      const result = engine.execute('git status');
      expect(result.output).toContain('modified');
      expect(result.output).toContain('readme.md');
    });

    it('shows clean status after commit', () => {
      engine.vfs.createFile('readme.md', 'hello');
      engine.execute('git add .');
      engine.execute('git commit -m "init"');
      const result = engine.execute('git status');
      expect(result.output).toContain('nothing to commit');
    });
  });

  describe('state subscription', () => {
    it('notifies on state change', () => {
      const states: number[] = [];
      engine.subscribe(() => states.push(states.length));
      engine.vfs.createFile('a.txt', 'content');
      engine.execute('git add a.txt');
      engine.execute('git commit -m "test"');
      expect(states.length).toBeGreaterThanOrEqual(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement command files**

Create `src/engine/commands/init.ts`:
```typescript
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function init(engine: GitEngine): CommandResult {
  engine.refs.createBranch('main', '');
  return { output: 'Initialized empty Git repository', exitCode: 0 };
}
```

Create `src/engine/commands/types.ts`:
```typescript
export type CommandResult = {
  output: string;
  exitCode: number;
};
```

Create `src/engine/commands/add.ts`:
```typescript
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function add(engine: GitEngine, args: string[]): CommandResult {
  if (args.length === 0) {
    return { output: 'Nothing specified, nothing added.', exitCode: 1 };
  }

  const paths = args[0] === '.' ? engine.vfs.allFilePaths() : args;
  let count = 0;

  for (const path of paths) {
    if (!engine.vfs.exists(path)) {
      return { output: `fatal: pathspec '${path}' did not match any files`, exitCode: 1 };
    }
    const content = engine.vfs.readFile(path);
    const blobHash = engine.objects.writeBlob(content);
    engine.index.set(path, blobHash);
    count++;
  }

  return { output: '', exitCode: 0 };
}
```

Create `src/engine/commands/commit.ts`:
```typescript
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function commit(engine: GitEngine, _args: string[], opts: Map<string, string[]>): CommandResult {
  const messages = opts.get('-m');
  if (!messages || messages.length === 0) {
    return { output: 'error: switch `m\' requires a value', exitCode: 1 };
  }

  if (engine.index.size === 0) {
    const hasDirtyFiles = engine.getUntrackedFiles().length > 0 || engine.getModifiedFiles().length > 0;
    if (hasDirtyFiles) {
      return { output: 'nothing added to commit but untracked files present', exitCode: 1 };
    }
    return { output: 'nothing to commit, working tree clean', exitCode: 0 };
  }

  const treeEntries = new Map(engine.index);
  const treeHash = engine.objects.writeTree(treeEntries);

  const parents: string[] = [];
  try {
    const headCommit = engine.refs.resolveHEAD();
    if (headCommit) parents.push(headCommit);
  } catch {
    // first commit — no parent
  }

  const commitHash = engine.objects.writeCommit({
    tree: treeHash,
    parents,
    message: messages[0],
    timestamp: Date.now(),
  });

  const head = engine.refs.getHEAD();
  if (head.attached) {
    try {
      engine.refs.updateBranch(head.target, commitHash);
    } catch {
      engine.refs.deleteBranch(head.target);
      engine.refs.createBranch(head.target, commitHash);
    }
  } else {
    engine.refs.detachHEAD(commitHash);
  }

  const shortHash = commitHash.slice(0, 7);
  const branch = head.attached ? head.target : `(${shortHash})`;
  const fileCount = treeEntries.size;
  return {
    output: `[${branch} ${shortHash}] ${messages[0]}\n ${fileCount} file(s) changed`,
    exitCode: 0,
  };
}
```

Create `src/engine/commands/status.ts`:
```typescript
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function status(engine: GitEngine): CommandResult {
  const lines: string[] = [];
  const head = engine.refs.getHEAD();

  if (head.attached) {
    lines.push(`On branch ${head.target}`);
  } else {
    lines.push(`HEAD detached at ${head.target.slice(0, 7)}`);
  }

  const staged = engine.getStagedFiles();
  const modified = engine.getModifiedFiles();
  const untracked = engine.getUntrackedFiles();

  if (staged.length === 0 && modified.length === 0 && untracked.length === 0) {
    lines.push('nothing to commit, working tree clean');
    return { output: lines.join('\n'), exitCode: 0 };
  }

  if (staged.length > 0) {
    lines.push('', 'Changes to be committed:');
    for (const f of staged) {
      lines.push(`  new file:   ${f.path}`);
    }
  }

  if (modified.length > 0) {
    lines.push('', 'Changes not staged for commit:');
    for (const f of modified) {
      lines.push(`  modified:   ${f}`);
    }
  }

  if (untracked.length > 0) {
    lines.push('', 'Untracked files:');
    for (const f of untracked) {
      lines.push(`  ${f}`);
    }
  }

  return { output: lines.join('\n'), exitCode: 0 };
}
```

- [ ] **Step 4: Implement GitEngine orchestrator**

```typescript
// src/engine/index.ts
import { VirtualFileSystem } from '$engine/vfs';
import { ObjectStore } from '$engine/objects';
import { RefStore } from '$engine/refs';
import type { CommandResult } from '$engine/commands/types';
import { add } from '$engine/commands/add';
import { commit } from '$engine/commands/commit';
import { status } from '$engine/commands/status';

type Listener = () => void;

export class GitEngine {
  readonly vfs = new VirtualFileSystem();
  readonly objects = new ObjectStore();
  readonly refs = new RefStore();
  readonly index = new Map<string, string>();
  private listeners: Listener[] = [];

  constructor() {
    // HEAD starts attached to 'main', branch created on first commit
  }

  execute(input: string): CommandResult {
    const { command, args, opts } = this.parse(input);
    let result: CommandResult;

    switch (command) {
      case 'add':
        result = add(this, args);
        break;
      case 'commit':
        result = commit(this, args, opts);
        break;
      case 'status':
        result = status(this);
        break;
      default:
        result = { output: `git: '${command}' is not a git command.`, exitCode: 1 };
    }

    this.notify();
    return result;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getHEAD() {
    return this.refs.getHEAD();
  }

  log() {
    return this.objects.allCommits().sort((a, b) => b.timestamp - a.timestamp);
  }

  getUntrackedFiles(): string[] {
    const committed = this.getCommittedTree();
    return this.vfs.allFilePaths().filter(
      (p) => !this.index.has(p) && !committed.has(p),
    );
  }

  getModifiedFiles(): string[] {
    const committed = this.getCommittedTree();
    const result: string[] = [];
    for (const path of this.vfs.allFilePaths()) {
      const currentContent = this.vfs.readFile(path);
      const currentHash = this.objects.writeBlob(currentContent);
      const indexHash = this.index.get(path);
      const committedHash = committed.get(path);
      const trackedHash = indexHash ?? committedHash;
      if (trackedHash && trackedHash !== currentHash) {
        result.push(path);
      }
    }
    return result;
  }

  getStagedFiles(): Array<{ path: string; status: string }> {
    const committed = this.getCommittedTree();
    const staged: Array<{ path: string; status: string }> = [];
    for (const [path, blobHash] of this.index) {
      const committedHash = committed.get(path);
      if (!committedHash) {
        staged.push({ path, status: 'new file' });
      } else if (committedHash !== blobHash) {
        staged.push({ path, status: 'modified' });
      }
    }
    return staged;
  }

  getCommittedTree(): Map<string, string> {
    try {
      const headHash = this.refs.resolveHEAD();
      if (!headHash) return new Map();
      const headCommit = this.objects.readCommit(headHash);
      return this.objects.readTree(headCommit.tree);
    } catch {
      return new Map();
    }
  }

  isDirty(): boolean {
    return (
      this.getUntrackedFiles().length > 0 ||
      this.getModifiedFiles().length > 0 ||
      this.getStagedFiles().length > 0
    );
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private parse(input: string): {
    command: string;
    args: string[];
    opts: Map<string, string[]>;
  } {
    const stripped = input.replace(/^git\s+/, '');
    const tokens = this.tokenize(stripped);
    const command = tokens[0] || '';
    const args: string[] = [];
    const opts = new Map<string, string[]>();

    let i = 1;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token.startsWith('-')) {
        const values: string[] = [];
        i++;
        while (i < tokens.length && !tokens[i].startsWith('-')) {
          values.push(tokens[i]);
          i++;
        }
        opts.set(token, values);
      } else {
        args.push(token);
        i++;
      }
    }

    return { command, args, opts };
  }

  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null;

    for (const ch of input) {
      if (inQuote) {
        if (ch === inQuote) {
          inQuote = null;
        } else {
          current += ch;
        }
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ' ') {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += ch;
      }
    }
    if (current) tokens.push(current);
    return tokens;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/core.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/index.ts src/engine/commands/ tests/engine/core.test.ts
git commit -m "feat(engine): add git init/add/commit/status with three-area model"
```

---

### Task 6: Branch + Checkout + Switch

**Files:**
- Create: `src/engine/commands/branch.ts`
- Create: `src/engine/commands/checkout.ts`
- Modify: `src/engine/index.ts` (add branch/checkout to switch)
- Create: `tests/engine/branch-checkout.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/branch-checkout.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';

function setup(): GitEngine {
  const engine = new GitEngine();
  engine.vfs.createFile('readme.md', 'init');
  engine.execute('git add .');
  engine.execute('git commit -m "initial"');
  return engine;
}

describe('branch', () => {
  it('creates a branch', () => {
    const engine = setup();
    const result = engine.execute('git branch feat');
    expect(result.exitCode).toBe(0);
    expect(engine.refs.hasBranch('feat')).toBe(true);
  });

  it('lists branches with current marked', () => {
    const engine = setup();
    engine.execute('git branch feat');
    const result = engine.execute('git branch');
    expect(result.output).toContain('* main');
    expect(result.output).toContain('  feat');
  });

  it('deletes a branch with -d', () => {
    const engine = setup();
    engine.execute('git branch feat');
    const result = engine.execute('git branch -d feat');
    expect(result.exitCode).toBe(0);
    expect(engine.refs.hasBranch('feat')).toBe(false);
  });

  it('refuses to delete current branch', () => {
    const engine = setup();
    const result = engine.execute('git branch -d main');
    expect(result.exitCode).toBe(1);
  });
});

describe('checkout', () => {
  it('switches to existing branch', () => {
    const engine = setup();
    engine.execute('git branch feat');
    const result = engine.execute('git checkout feat');
    expect(result.exitCode).toBe(0);
    expect(engine.getHEAD()).toEqual({ attached: true, target: 'feat' });
  });

  it('creates and switches with -b', () => {
    const engine = setup();
    const result = engine.execute('git checkout -b feat');
    expect(result.exitCode).toBe(0);
    expect(engine.getHEAD()).toEqual({ attached: true, target: 'feat' });
    expect(engine.refs.hasBranch('feat')).toBe(true);
  });

  it('detaches HEAD on commit hash', () => {
    const engine = setup();
    const commits = engine.log();
    const hash = commits[0].hash;
    const result = engine.execute(`git checkout ${hash}`);
    expect(result.exitCode).toBe(0);
    expect(engine.getHEAD().attached).toBe(false);
  });

  it('restores working directory on checkout', () => {
    const engine = setup();
    engine.execute('git checkout -b feat');
    engine.vfs.createFile('feat.txt', 'feat content');
    engine.execute('git add .');
    engine.execute('git commit -m "feat commit"');
    engine.execute('git checkout main');
    expect(engine.vfs.exists('feat.txt')).toBe(false);
  });

  it('git switch works like checkout', () => {
    const engine = setup();
    engine.execute('git branch feat');
    const result = engine.execute('git switch feat');
    expect(result.exitCode).toBe(0);
    expect(engine.getHEAD()).toEqual({ attached: true, target: 'feat' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/branch-checkout.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement branch command**

```typescript
// src/engine/commands/branch.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function branch(engine: GitEngine, args: string[], opts: Map<string, string[]>): CommandResult {
  const deleteFlag = opts.has('-d') || opts.has('-D');

  if (deleteFlag) {
    const name = opts.get('-d')?.[0] ?? opts.get('-D')?.[0] ?? args[0];
    if (!name) return { output: 'fatal: branch name required', exitCode: 1 };
    try {
      engine.refs.deleteBranch(name);
      return { output: `Deleted branch ${name}`, exitCode: 0 };
    } catch (e) {
      return { output: `error: ${(e as Error).message}`, exitCode: 1 };
    }
  }

  if (args.length === 0) {
    const branches = engine.refs.listBranches();
    const head = engine.refs.getHEAD();
    const lines = branches.map((b) => {
      const prefix = head.attached && head.target === b ? '* ' : '  ';
      return `${prefix}${b}`;
    });
    return { output: lines.join('\n'), exitCode: 0 };
  }

  const name = args[0];
  try {
    const headCommit = engine.refs.resolveHEAD();
    engine.refs.createBranch(name, headCommit);
    return { output: '', exitCode: 0 };
  } catch (e) {
    return { output: `fatal: ${(e as Error).message}`, exitCode: 1 };
  }
}
```

- [ ] **Step 4: Implement checkout command**

```typescript
// src/engine/commands/checkout.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function checkout(engine: GitEngine, args: string[], opts: Map<string, string[]>): CommandResult {
  const createBranch = opts.has('-b');

  if (createBranch) {
    const name = opts.get('-b')?.[0] ?? args[0];
    if (!name) return { output: 'fatal: branch name required', exitCode: 1 };
    try {
      const headCommit = engine.refs.resolveHEAD();
      engine.refs.createBranch(name, headCommit);
      engine.refs.attachHEAD(name);
      return { output: `Switched to a new branch '${name}'`, exitCode: 0 };
    } catch (e) {
      return { output: `fatal: ${(e as Error).message}`, exitCode: 1 };
    }
  }

  const target = args[0];
  if (!target) return { output: 'fatal: no branch or commit specified', exitCode: 1 };

  if (engine.refs.hasBranch(target)) {
    engine.refs.attachHEAD(target);
    restoreWorkingDirectory(engine);
    return { output: `Switched to branch '${target}'`, exitCode: 0 };
  }

  if (engine.objects.hasCommit(target)) {
    engine.refs.detachHEAD(target);
    restoreWorkingDirectory(engine);
    return { output: `HEAD is now at ${target.slice(0, 7)}`, exitCode: 0 };
  }

  return { output: `error: pathspec '${target}' did not match any branch or commit`, exitCode: 1 };
}

function restoreWorkingDirectory(engine: GitEngine): void {
  const tree = engine.getCommittedTree();
  const snapshot = new Map<string, { content: string; type: 'file' | 'dir' }>();

  const dirs = new Set<string>();
  for (const path of tree.keys()) {
    const slashIdx = path.indexOf('/');
    if (slashIdx !== -1) {
      dirs.add(path.slice(0, slashIdx));
    }
  }
  for (const dir of dirs) {
    snapshot.set(`${dir}/`, { content: '', type: 'dir' });
  }

  for (const [path, blobHash] of tree) {
    const content = engine.objects.readBlob(blobHash);
    snapshot.set(path, { content, type: 'file' });
  }

  engine.vfs.restore(snapshot);
  engine.index.clear();
  for (const [path, blobHash] of tree) {
    engine.index.set(path, blobHash);
  }
}
```

- [ ] **Step 5: Add branch/checkout/switch to GitEngine.execute()**

Add to the switch statement in `src/engine/index.ts`:

```typescript
import { branch } from '$engine/commands/branch';
import { checkout } from '$engine/commands/checkout';

// In execute() switch:
case 'branch':
  result = branch(this, args, opts);
  break;
case 'checkout':
  result = checkout(this, args, opts);
  break;
case 'switch':
  result = checkout(this, args, opts);
  break;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/engine/branch-checkout.test.ts`
Expected: All 9 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/commands/branch.ts src/engine/commands/checkout.ts src/engine/index.ts tests/engine/branch-checkout.test.ts
git commit -m "feat(engine): add branch, checkout, switch commands"
```

---

### Task 7: Log + Diff

**Files:**
- Create: `src/engine/commands/log.ts`
- Create: `src/engine/diff.ts`
- Create: `src/engine/commands/diff.ts`
- Modify: `src/engine/index.ts`
- Create: `tests/engine/log-diff.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/log-diff.test.ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

function setup(): GitEngine {
  const engine = new GitEngine();
  engine.vfs.createFile('a.txt', 'aaa');
  engine.execute('git add .');
  engine.execute('git commit -m "first"');
  engine.vfs.createFile('b.txt', 'bbb');
  engine.execute('git add .');
  engine.execute('git commit -m "second"');
  return engine;
}

describe('log', () => {
  it('shows commits newest first', () => {
    const engine = setup();
    const result = engine.execute('git log');
    const lines = result.output.split('\n');
    const commitLines = lines.filter((l) => l.startsWith('commit'));
    expect(commitLines).toHaveLength(2);
    expect(result.output.indexOf('second')).toBeLessThan(result.output.indexOf('first'));
  });

  it('--oneline shows short format', () => {
    const engine = setup();
    const result = engine.execute('git log --oneline');
    const lines = result.output.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('second');
    expect(lines[0].length).toBeLessThan(80);
  });

  it('shows empty log message for no commits', () => {
    const engine = new GitEngine();
    const result = engine.execute('git log');
    expect(result.output).toContain('no commits');
  });
});

describe('diff', () => {
  it('shows diff for modified file', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'line1');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    engine.vfs.createFile('a.txt', 'line1-changed');
    const result = engine.execute('git diff');
    expect(result.output).toContain('a.txt');
    expect(result.output).toContain('line1');
  });

  it('shows nothing when clean', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'line1');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    const result = engine.execute('git diff');
    expect(result.output).toBe('');
  });

  it('--staged shows index vs HEAD', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'v1');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    engine.vfs.createFile('a.txt', 'v2');
    engine.execute('git add .');
    const result = engine.execute('git diff --staged');
    expect(result.output).toContain('a.txt');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/log-diff.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement diff utility**

```typescript
// src/engine/diff.ts
export function generateDiff(path: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const lines: string[] = [];

  lines.push(`diff --git a/${path} b/${path}`);
  lines.push(`--- a/${path}`);
  lines.push(`+++ b/${path}`);

  const maxLen = Math.max(oldLines.length, newLines.length);
  let hunkStart = -1;
  const hunkLines: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine !== newLine) {
      if (hunkStart === -1) hunkStart = i + 1;
      if (oldLine !== undefined) hunkLines.push(`-${oldLine}`);
      if (newLine !== undefined) hunkLines.push(`+${newLine}`);
    } else if (oldLine !== undefined) {
      hunkLines.push(` ${oldLine}`);
    }
  }

  if (hunkLines.length > 0) {
    lines.push(`@@ -${hunkStart},${oldLines.length} +${hunkStart},${newLines.length} @@`);
    lines.push(...hunkLines);
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Implement log and diff commands**

```typescript
// src/engine/commands/log.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function log(engine: GitEngine, _args: string[], opts: Map<string, string[]>): CommandResult {
  const commits = engine.log();
  if (commits.length === 0) {
    return { output: 'fatal: your current branch has no commits yet', exitCode: 0 };
  }

  const oneline = opts.has('--oneline');
  const head = engine.refs.getHEAD();
  const branches = engine.refs.listBranches();
  const branchMap = new Map<string, string[]>();
  for (const b of branches) {
    const target = engine.refs.resolveBranch(b);
    if (!branchMap.has(target)) branchMap.set(target, []);
    branchMap.get(target)!.push(b);
  }

  const lines: string[] = [];
  for (const c of commits) {
    const refs = branchMap.get(c.hash) ?? [];
    const refStr = refs.length > 0 ? ` (${refs.join(', ')})` : '';
    const isHead = (head.attached && refs.includes(head.target)) || (!head.attached && head.target === c.hash);
    const headStr = isHead ? 'HEAD -> ' : '';

    if (oneline) {
      const decoration = refs.length > 0 || isHead ? ` (${headStr}${refs.join(', ')})` : '';
      lines.push(`${c.hash.slice(0, 7)}${decoration} ${c.message}`);
    } else {
      lines.push(`commit ${c.hash}${refStr ? ` (${headStr}${refs.join(', ')})` : ''}`);
      lines.push(`    ${c.message}`);
      lines.push('');
    }
  }

  return { output: lines.join('\n').trimEnd(), exitCode: 0 };
}
```

```typescript
// src/engine/commands/diff.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';
import { generateDiff } from '$engine/diff';

export function diff(engine: GitEngine, _args: string[], opts: Map<string, string[]>): CommandResult {
  const staged = opts.has('--staged') || opts.has('--cached');
  const committed = engine.getCommittedTree();
  const diffs: string[] = [];

  if (staged) {
    for (const [path, blobHash] of engine.index) {
      const committedHash = committed.get(path);
      if (committedHash !== blobHash) {
        const oldContent = committedHash ? engine.objects.readBlob(committedHash) : '';
        const newContent = engine.objects.readBlob(blobHash);
        diffs.push(generateDiff(path, oldContent, newContent));
      }
    }
  } else {
    for (const path of engine.vfs.allFilePaths()) {
      const currentContent = engine.vfs.readFile(path);
      const indexHash = engine.index.get(path);
      const committedHash = committed.get(path);
      const trackedHash = indexHash ?? committedHash;
      if (trackedHash) {
        const trackedContent = engine.objects.readBlob(trackedHash);
        if (trackedContent !== currentContent) {
          diffs.push(generateDiff(path, trackedContent, currentContent));
        }
      }
    }
  }

  return { output: diffs.join('\n'), exitCode: 0 };
}
```

- [ ] **Step 5: Add log/diff to GitEngine.execute()**

Add to switch in `src/engine/index.ts`:

```typescript
import { log as logCmd } from '$engine/commands/log';
import { diff as diffCmd } from '$engine/commands/diff';

case 'log':
  result = logCmd(this, args, opts);
  break;
case 'diff':
  result = diffCmd(this, args, opts);
  break;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/engine/log-diff.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/diff.ts src/engine/commands/log.ts src/engine/commands/diff.ts src/engine/index.ts tests/engine/log-diff.test.ts
git commit -m "feat(engine): add git log and git diff with simulated diffs"
```

---

### Task 8: Merge

**Files:**
- Create: `src/engine/commands/merge.ts`
- Modify: `src/engine/index.ts`
- Create: `tests/engine/merge.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/merge.test.ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

function setupBranches(): GitEngine {
  const engine = new GitEngine();
  engine.vfs.createFile('base.txt', 'base');
  engine.execute('git add .');
  engine.execute('git commit -m "base"');
  engine.execute('git branch feat');
  engine.execute('git checkout feat');
  engine.vfs.createFile('feat.txt', 'feature');
  engine.execute('git add .');
  engine.execute('git commit -m "feat work"');
  engine.execute('git checkout main');
  return engine;
}

describe('merge', () => {
  it('fast-forward merge when no divergence', () => {
    const engine = setupBranches();
    const result = engine.execute('git merge feat');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Fast-forward');
    expect(engine.vfs.exists('feat.txt')).toBe(true);
  });

  it('three-way merge creates merge commit', () => {
    const engine = setupBranches();
    engine.vfs.createFile('main.txt', 'main work');
    engine.execute('git add .');
    engine.execute('git commit -m "main work"');
    const result = engine.execute('git merge feat');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Merge');
    const commits = engine.log();
    const mergeCommit = commits[0];
    expect(mergeCommit.parents).toHaveLength(2);
  });

  it('fails on nonexistent branch', () => {
    const engine = setupBranches();
    const result = engine.execute('git merge nope');
    expect(result.exitCode).toBe(1);
  });

  it('no-op when already up to date', () => {
    const engine = setupBranches();
    engine.execute('git merge feat');
    const result = engine.execute('git merge feat');
    expect(result.output).toContain('Already up to date');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/merge.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement merge command**

```typescript
// src/engine/commands/merge.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function merge(engine: GitEngine, args: string[]): CommandResult {
  const targetName = args[0];
  if (!targetName) return { output: 'fatal: no branch specified', exitCode: 1 };

  let targetHash: string;
  try {
    targetHash = engine.refs.resolveBranch(targetName);
  } catch {
    return { output: `merge: ${targetName} - not something we can merge`, exitCode: 1 };
  }

  let headHash: string;
  try {
    headHash = engine.refs.resolveHEAD();
  } catch {
    return { output: 'fatal: no commits yet', exitCode: 1 };
  }

  if (headHash === targetHash) {
    return { output: 'Already up to date.', exitCode: 0 };
  }

  if (isAncestor(engine, headHash, targetHash)) {
    return { output: 'Already up to date.', exitCode: 0 };
  }

  if (isAncestor(engine, targetHash, headHash)) {
    const head = engine.refs.getHEAD();
    if (head.attached) {
      engine.refs.updateBranch(head.target, targetHash);
    } else {
      engine.refs.detachHEAD(targetHash);
    }

    const targetTree = engine.objects.readTree(engine.objects.readCommit(targetHash).tree);
    restoreFromTree(engine, targetTree);
    return { output: `Updating..Fast-forward`, exitCode: 0 };
  }

  const headTree = engine.objects.readTree(engine.objects.readCommit(headHash).tree);
  const targetTree = engine.objects.readTree(engine.objects.readCommit(targetHash).tree);
  const mergedEntries = new Map(headTree);
  for (const [path, blobHash] of targetTree) {
    if (!mergedEntries.has(path)) {
      mergedEntries.set(path, blobHash);
    }
  }

  const mergedTreeHash = engine.objects.writeTree(mergedEntries);
  const mergeHash = engine.objects.writeCommit({
    tree: mergedTreeHash,
    parents: [headHash, targetHash],
    message: `Merge branch '${targetName}'`,
    timestamp: Date.now(),
  });

  const head = engine.refs.getHEAD();
  if (head.attached) {
    engine.refs.updateBranch(head.target, mergeHash);
  } else {
    engine.refs.detachHEAD(mergeHash);
  }

  restoreFromTree(engine, mergedEntries);
  return { output: `Merge made by the 'ort' strategy.`, exitCode: 0 };
}

function isAncestor(engine: GitEngine, candidateHash: string, descendantHash: string): boolean {
  const visited = new Set<string>();
  const queue = [descendantHash];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === candidateHash) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    try {
      const commit = engine.objects.readCommit(current);
      queue.push(...commit.parents);
    } catch {
      continue;
    }
  }
  return false;
}

function restoreFromTree(engine: GitEngine, tree: Map<string, string>): void {
  const snapshot = new Map<string, { content: string; type: 'file' | 'dir' }>();
  const dirs = new Set<string>();
  for (const path of tree.keys()) {
    const slashIdx = path.indexOf('/');
    if (slashIdx !== -1) dirs.add(path.slice(0, slashIdx));
  }
  for (const dir of dirs) {
    snapshot.set(`${dir}/`, { content: '', type: 'dir' });
  }
  for (const [path, blobHash] of tree) {
    snapshot.set(path, { content: engine.objects.readBlob(blobHash), type: 'file' });
  }
  engine.vfs.restore(snapshot);
  engine.index.clear();
  for (const [path, blobHash] of tree) {
    engine.index.set(path, blobHash);
  }
}
```

- [ ] **Step 4: Add merge to GitEngine.execute()**

Add to switch in `src/engine/index.ts`:

```typescript
import { merge as mergeCmd } from '$engine/commands/merge';

case 'merge':
  result = mergeCmd(this, args);
  break;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/merge.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/commands/merge.ts src/engine/index.ts tests/engine/merge.test.ts
git commit -m "feat(engine): add git merge with fast-forward and three-way"
```

---

### Task 9: Rebase + Cherry-pick + Revert

**Files:**
- Create: `src/engine/commands/rebase.ts`
- Create: `src/engine/commands/cherry-pick.ts`
- Create: `src/engine/commands/revert.ts`
- Modify: `src/engine/index.ts`
- Create: `tests/engine/rebase.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/rebase.test.ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

function setupDiverged(): GitEngine {
  const engine = new GitEngine();
  engine.vfs.createFile('base.txt', 'base');
  engine.execute('git add .');
  engine.execute('git commit -m "base"');

  engine.execute('git checkout -b feat');
  engine.vfs.createFile('feat.txt', 'feat1');
  engine.execute('git add .');
  engine.execute('git commit -m "feat1"');
  engine.vfs.createFile('feat2.txt', 'feat2');
  engine.execute('git add .');
  engine.execute('git commit -m "feat2"');

  engine.execute('git checkout main');
  engine.vfs.createFile('main.txt', 'main work');
  engine.execute('git add .');
  engine.execute('git commit -m "main work"');

  return engine;
}

describe('rebase', () => {
  it('replays commits onto target', () => {
    const engine = setupDiverged();
    engine.execute('git checkout feat');
    const result = engine.execute('git rebase main');
    expect(result.exitCode).toBe(0);

    const commits = engine.log();
    const featCommits = commits.filter((c) => c.message.startsWith('feat'));
    expect(featCommits).toHaveLength(2);
    for (const c of featCommits) {
      expect(c.parents).toHaveLength(1);
    }
  });

  it('no-op when already up to date', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'a');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    const result = engine.execute('git rebase main');
    expect(result.output).toContain('up to date');
  });
});

describe('cherry-pick', () => {
  it('applies a single commit', () => {
    const engine = setupDiverged();
    const featCommits = engine.objects.allCommits().filter((c) => c.message === 'feat1');
    const hash = featCommits[0].hash;
    const result = engine.execute(`git cherry-pick ${hash}`);
    expect(result.exitCode).toBe(0);
    const headCommit = engine.objects.readCommit(engine.refs.resolveHEAD());
    expect(headCommit.message).toBe('feat1');
  });
});

describe('revert', () => {
  it('creates an inverse commit', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'original');
    engine.execute('git add .');
    engine.execute('git commit -m "add a"');
    engine.vfs.createFile('b.txt', 'added');
    engine.execute('git add .');
    engine.execute('git commit -m "add b"');

    const commits = engine.log();
    const result = engine.execute(`git revert ${commits[0].hash}`);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Revert');
    expect(engine.vfs.exists('b.txt')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/rebase.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement rebase**

```typescript
// src/engine/commands/rebase.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function rebase(engine: GitEngine, args: string[]): CommandResult {
  const targetName = args[0];
  if (!targetName) return { output: 'fatal: no upstream specified', exitCode: 1 };

  let targetHash: string;
  try {
    targetHash = engine.refs.hasBranch(targetName)
      ? engine.refs.resolveBranch(targetName)
      : targetName;
    engine.objects.readCommit(targetHash);
  } catch {
    return { output: `fatal: invalid upstream '${targetName}'`, exitCode: 1 };
  }

  const headHash = engine.refs.resolveHEAD();
  if (headHash === targetHash) {
    return { output: 'Current branch is up to date.', exitCode: 0 };
  }

  const targetAncestors = getAncestors(engine, targetHash);
  if (targetAncestors.has(headHash)) {
    return { output: 'Current branch is up to date.', exitCode: 0 };
  }

  const toReplay: string[] = [];
  const queue = [headHash];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current) || targetAncestors.has(current) || current === targetHash) continue;
    visited.add(current);
    toReplay.push(current);
    const commit = engine.objects.readCommit(current);
    queue.push(...commit.parents);
  }

  toReplay.reverse();

  let currentBase = targetHash;
  for (const hash of toReplay) {
    const original = engine.objects.readCommit(hash);
    const newTree = engine.objects.readTree(original.tree);
    const newTreeHash = engine.objects.writeTree(newTree);
    currentBase = engine.objects.writeCommit({
      tree: newTreeHash,
      parents: [currentBase],
      message: original.message,
      timestamp: Date.now(),
    });
  }

  const head = engine.refs.getHEAD();
  if (head.attached) {
    engine.refs.updateBranch(head.target, currentBase);
  } else {
    engine.refs.detachHEAD(currentBase);
  }

  const finalTree = engine.objects.readTree(engine.objects.readCommit(currentBase).tree);
  const snapshot = new Map<string, { content: string; type: 'file' | 'dir' }>();
  for (const [path, blobHash] of finalTree) {
    snapshot.set(path, { content: engine.objects.readBlob(blobHash), type: 'file' });
  }
  engine.vfs.restore(snapshot);
  engine.index.clear();
  for (const [path, blobHash] of finalTree) {
    engine.index.set(path, blobHash);
  }

  return { output: `Successfully rebased and updated.`, exitCode: 0 };
}

function getAncestors(engine: GitEngine, hash: string): Set<string> {
  const ancestors = new Set<string>();
  const queue = [hash];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (ancestors.has(current)) continue;
    ancestors.add(current);
    try {
      const commit = engine.objects.readCommit(current);
      queue.push(...commit.parents);
    } catch {
      continue;
    }
  }
  return ancestors;
}
```

- [ ] **Step 4: Implement cherry-pick**

```typescript
// src/engine/commands/cherry-pick.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function cherryPick(engine: GitEngine, args: string[]): CommandResult {
  const targetHash = args[0];
  if (!targetHash) return { output: 'fatal: no commit specified', exitCode: 1 };

  let targetCommit;
  try {
    targetCommit = engine.objects.readCommit(targetHash);
  } catch {
    return { output: `fatal: bad object ${targetHash}`, exitCode: 1 };
  }

  const targetTree = engine.objects.readTree(targetCommit.tree);
  const headHash = engine.refs.resolveHEAD();
  const headTree = engine.getCommittedTree();

  const merged = new Map(headTree);
  for (const [path, blobHash] of targetTree) {
    merged.set(path, blobHash);
  }

  const newTreeHash = engine.objects.writeTree(merged);
  const newHash = engine.objects.writeCommit({
    tree: newTreeHash,
    parents: [headHash],
    message: targetCommit.message,
    timestamp: Date.now(),
  });

  const head = engine.refs.getHEAD();
  if (head.attached) {
    engine.refs.updateBranch(head.target, newHash);
  } else {
    engine.refs.detachHEAD(newHash);
  }

  const snapshot = new Map<string, { content: string; type: 'file' | 'dir' }>();
  for (const [path, blobHash] of merged) {
    snapshot.set(path, { content: engine.objects.readBlob(blobHash), type: 'file' });
  }
  engine.vfs.restore(snapshot);
  engine.index.clear();
  for (const [path, blobHash] of merged) {
    engine.index.set(path, blobHash);
  }

  return { output: `[${head.attached ? head.target : newHash.slice(0, 7)} ${newHash.slice(0, 7)}] ${targetCommit.message}`, exitCode: 0 };
}
```

- [ ] **Step 5: Implement revert**

```typescript
// src/engine/commands/revert.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function revert(engine: GitEngine, args: string[]): CommandResult {
  const targetHash = args[0];
  if (!targetHash) return { output: 'fatal: no commit specified', exitCode: 1 };

  let targetCommit;
  try {
    targetCommit = engine.objects.readCommit(targetHash);
  } catch {
    return { output: `fatal: bad object ${targetHash}`, exitCode: 1 };
  }

  const targetTree = engine.objects.readTree(targetCommit.tree);
  const parentTree = targetCommit.parents.length > 0
    ? engine.objects.readTree(engine.objects.readCommit(targetCommit.parents[0]).tree)
    : new Map<string, string>();

  const headHash = engine.refs.resolveHEAD();
  const headTree = engine.getCommittedTree();

  const addedInTarget = new Set<string>();
  for (const path of targetTree.keys()) {
    if (!parentTree.has(path)) addedInTarget.add(path);
  }

  const reverted = new Map(headTree);
  for (const path of addedInTarget) {
    reverted.delete(path);
  }
  for (const [path, blobHash] of parentTree) {
    if (targetTree.get(path) !== blobHash) {
      reverted.set(path, blobHash);
    }
  }

  const newTreeHash = engine.objects.writeTree(reverted);
  const newHash = engine.objects.writeCommit({
    tree: newTreeHash,
    parents: [headHash],
    message: `Revert "${targetCommit.message}"`,
    timestamp: Date.now(),
  });

  const head = engine.refs.getHEAD();
  if (head.attached) {
    engine.refs.updateBranch(head.target, newHash);
  } else {
    engine.refs.detachHEAD(newHash);
  }

  const snapshot = new Map<string, { content: string; type: 'file' | 'dir' }>();
  for (const [path, blobHash] of reverted) {
    snapshot.set(path, { content: engine.objects.readBlob(blobHash), type: 'file' });
  }
  engine.vfs.restore(snapshot);
  engine.index.clear();
  for (const [path, blobHash] of reverted) {
    engine.index.set(path, blobHash);
  }

  return { output: `[${head.attached ? head.target : newHash.slice(0, 7)} ${newHash.slice(0, 7)}] Revert "${targetCommit.message}"`, exitCode: 0 };
}
```

- [ ] **Step 6: Add rebase/cherry-pick/revert to GitEngine.execute()**

Add to switch in `src/engine/index.ts`:

```typescript
import { rebase as rebaseCmd } from '$engine/commands/rebase';
import { cherryPick } from '$engine/commands/cherry-pick';
import { revert as revertCmd } from '$engine/commands/revert';

case 'rebase':
  result = rebaseCmd(this, args);
  break;
case 'cherry-pick':
  result = cherryPick(this, args);
  break;
case 'revert':
  result = revertCmd(this, args);
  break;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/engine/rebase.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/commands/rebase.ts src/engine/commands/cherry-pick.ts src/engine/commands/revert.ts src/engine/index.ts tests/engine/rebase.test.ts
git commit -m "feat(engine): add git rebase, cherry-pick, revert"
```

---

### Task 10: Reset + Stash + Tag + Rm + Mv

**Files:**
- Create: `src/engine/commands/reset.ts`
- Create: `src/engine/commands/stash.ts`
- Create: `src/engine/commands/tag.ts`
- Create: `src/engine/commands/rm.ts`
- Create: `src/engine/commands/mv.ts`
- Modify: `src/engine/index.ts`
- Create: `tests/engine/reset-stash-tag.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/reset-stash-tag.test.ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';

function setup(): GitEngine {
  const engine = new GitEngine();
  engine.vfs.createFile('a.txt', 'aaa');
  engine.execute('git add .');
  engine.execute('git commit -m "first"');
  engine.vfs.createFile('b.txt', 'bbb');
  engine.execute('git add .');
  engine.execute('git commit -m "second"');
  return engine;
}

describe('reset', () => {
  it('--soft moves HEAD but keeps index and working dir', () => {
    const engine = setup();
    const commits = engine.log();
    engine.execute(`git reset --soft ${commits[1].hash}`);
    expect(engine.refs.resolveHEAD()).toBe(commits[1].hash);
    expect(engine.vfs.exists('b.txt')).toBe(true);
    expect(engine.index.has('b.txt')).toBe(true);
  });

  it('--mixed moves HEAD and resets index but keeps working dir', () => {
    const engine = setup();
    const commits = engine.log();
    engine.execute(`git reset --mixed ${commits[1].hash}`);
    expect(engine.refs.resolveHEAD()).toBe(commits[1].hash);
    expect(engine.vfs.exists('b.txt')).toBe(true);
  });

  it('--hard moves HEAD, resets index and working dir', () => {
    const engine = setup();
    const commits = engine.log();
    engine.execute(`git reset --hard ${commits[1].hash}`);
    expect(engine.refs.resolveHEAD()).toBe(commits[1].hash);
    expect(engine.vfs.exists('b.txt')).toBe(false);
  });
});

describe('stash', () => {
  it('saves and restores working changes', () => {
    const engine = setup();
    engine.vfs.createFile('c.txt', 'ccc');
    engine.execute('git stash');
    expect(engine.vfs.exists('c.txt')).toBe(false);
    engine.execute('git stash pop');
    expect(engine.vfs.exists('c.txt')).toBe(true);
  });

  it('stash list shows entries', () => {
    const engine = setup();
    engine.vfs.createFile('c.txt', 'ccc');
    engine.execute('git stash');
    const result = engine.execute('git stash list');
    expect(result.output).toContain('stash@{0}');
  });

  it('stash drop removes entry', () => {
    const engine = setup();
    engine.vfs.createFile('c.txt', 'ccc');
    engine.execute('git stash');
    engine.execute('git stash drop');
    const result = engine.execute('git stash list');
    expect(result.output).toBe('');
  });
});

describe('tag', () => {
  it('creates a tag', () => {
    const engine = setup();
    const result = engine.execute('git tag v1.0');
    expect(result.exitCode).toBe(0);
    expect(engine.refs.hasTag('v1.0')).toBe(true);
  });

  it('lists tags', () => {
    const engine = setup();
    engine.execute('git tag v1.0');
    engine.execute('git tag v2.0');
    const result = engine.execute('git tag');
    expect(result.output).toContain('v1.0');
    expect(result.output).toContain('v2.0');
  });

  it('tags a specific commit', () => {
    const engine = setup();
    const commits = engine.log();
    engine.execute(`git tag v0.1 ${commits[1].hash}`);
    expect(engine.refs.resolveTag('v0.1')).toBe(commits[1].hash);
  });
});

describe('rm', () => {
  it('removes file from working dir and index', () => {
    const engine = setup();
    const result = engine.execute('git rm b.txt');
    expect(result.exitCode).toBe(0);
    expect(engine.vfs.exists('b.txt')).toBe(false);
    expect(engine.index.has('b.txt')).toBe(false);
  });
});

describe('mv', () => {
  it('renames file in working dir and index', () => {
    const engine = setup();
    const result = engine.execute('git mv a.txt renamed.txt');
    expect(result.exitCode).toBe(0);
    expect(engine.vfs.exists('a.txt')).toBe(false);
    expect(engine.vfs.exists('renamed.txt')).toBe(true);
    expect(engine.index.has('renamed.txt')).toBe(true);
    expect(engine.index.has('a.txt')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/reset-stash-tag.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement reset**

```typescript
// src/engine/commands/reset.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function reset(engine: GitEngine, args: string[], opts: Map<string, string[]>): CommandResult {
  const soft = opts.has('--soft');
  const hard = opts.has('--hard');
  const mixed = opts.has('--mixed') || (!soft && !hard);

  const targetHash = args[0] ?? opts.get('--soft')?.[0] ?? opts.get('--hard')?.[0] ?? opts.get('--mixed')?.[0];
  if (!targetHash) return { output: 'fatal: no commit specified', exitCode: 1 };

  try {
    engine.objects.readCommit(targetHash);
  } catch {
    return { output: `fatal: invalid reference: ${targetHash}`, exitCode: 1 };
  }

  const head = engine.refs.getHEAD();
  if (head.attached) {
    engine.refs.updateBranch(head.target, targetHash);
  } else {
    engine.refs.detachHEAD(targetHash);
  }

  if (mixed || hard) {
    const tree = engine.objects.readTree(engine.objects.readCommit(targetHash).tree);
    engine.index.clear();
    for (const [path, blobHash] of tree) {
      engine.index.set(path, blobHash);
    }
  }

  if (hard) {
    const tree = engine.objects.readTree(engine.objects.readCommit(targetHash).tree);
    const snapshot = new Map<string, { content: string; type: 'file' | 'dir' }>();
    for (const [path, blobHash] of tree) {
      snapshot.set(path, { content: engine.objects.readBlob(blobHash), type: 'file' });
    }
    engine.vfs.restore(snapshot);
  }

  return { output: `HEAD is now at ${targetHash.slice(0, 7)}`, exitCode: 0 };
}
```

- [ ] **Step 4: Implement stash**

```typescript
// src/engine/commands/stash.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';
import type { FileEntry } from '$engine/vfs';

type StashEntry = {
  vfsSnapshot: Map<string, FileEntry>;
  indexSnapshot: Map<string, string>;
  message: string;
};

const stashStack: StashEntry[] = [];

export function stash(engine: GitEngine, args: string[]): CommandResult {
  const subcommand = args[0] ?? 'push';

  switch (subcommand) {
    case 'push':
    case 'save': {
      const vfsSnap = engine.vfs.snapshot();
      const indexSnap = new Map(engine.index);
      const head = engine.refs.getHEAD();
      stashStack.unshift({
        vfsSnapshot: vfsSnap,
        indexSnapshot: indexSnap,
        message: `WIP on ${head.attached ? head.target : head.target.slice(0, 7)}`,
      });

      const committed = engine.getCommittedTree();
      const snapshot = new Map<string, FileEntry>();
      for (const [path, blobHash] of committed) {
        snapshot.set(path, { content: engine.objects.readBlob(blobHash), type: 'file' });
      }
      engine.vfs.restore(snapshot);
      engine.index.clear();
      for (const [path, blobHash] of committed) {
        engine.index.set(path, blobHash);
      }
      return { output: `Saved working directory and index state ${stashStack[0].message}`, exitCode: 0 };
    }

    case 'pop': {
      if (stashStack.length === 0) return { output: 'No stash entries found.', exitCode: 1 };
      const entry = stashStack.shift()!;
      engine.vfs.restore(entry.vfsSnapshot);
      engine.index.clear();
      for (const [k, v] of entry.indexSnapshot) engine.index.set(k, v);
      return { output: `Dropped stash@{0}`, exitCode: 0 };
    }

    case 'list': {
      const lines = stashStack.map((e, i) => `stash@{${i}}: ${e.message}`);
      return { output: lines.join('\n'), exitCode: 0 };
    }

    case 'drop': {
      if (stashStack.length === 0) return { output: 'No stash entries found.', exitCode: 1 };
      stashStack.shift();
      return { output: 'Dropped stash@{0}', exitCode: 0 };
    }

    default:
      return { output: `error: unknown subcommand: ${subcommand}`, exitCode: 1 };
  }
}
```

- [ ] **Step 5: Implement tag, rm, mv commands**

```typescript
// src/engine/commands/tag.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function tag(engine: GitEngine, args: string[]): CommandResult {
  if (args.length === 0) {
    const tags = engine.refs.listTags();
    return { output: tags.join('\n'), exitCode: 0 };
  }

  const name = args[0];
  const targetHash = args[1] ?? engine.refs.resolveHEAD();

  try {
    engine.refs.createTag(name, targetHash);
    return { output: '', exitCode: 0 };
  } catch (e) {
    return { output: `fatal: ${(e as Error).message}`, exitCode: 1 };
  }
}
```

```typescript
// src/engine/commands/rm.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function rm(engine: GitEngine, args: string[]): CommandResult {
  const path = args[0];
  if (!path) return { output: 'fatal: no pathspec given', exitCode: 1 };

  try {
    if (engine.vfs.exists(path)) engine.vfs.deleteFile(path);
    engine.index.delete(path);
    return { output: `rm '${path}'`, exitCode: 0 };
  } catch (e) {
    return { output: `fatal: ${(e as Error).message}`, exitCode: 1 };
  }
}
```

```typescript
// src/engine/commands/mv.ts
import type { GitEngine } from '$engine/index';
import type { CommandResult } from '$engine/commands/types';

export function mv(engine: GitEngine, args: string[]): CommandResult {
  const [src, dst] = args;
  if (!src || !dst) return { output: 'fatal: usage: git mv <source> <destination>', exitCode: 1 };

  try {
    const oldBlobHash = engine.index.get(src);
    engine.vfs.moveFile(src, dst);
    engine.index.delete(src);
    if (oldBlobHash) {
      engine.index.set(dst, oldBlobHash);
    } else {
      const content = engine.vfs.readFile(dst);
      const blobHash = engine.objects.writeBlob(content);
      engine.index.set(dst, blobHash);
    }
    return { output: '', exitCode: 0 };
  } catch (e) {
    return { output: `fatal: ${(e as Error).message}`, exitCode: 1 };
  }
}
```

- [ ] **Step 6: Add all new commands to GitEngine.execute()**

Add to switch in `src/engine/index.ts`:

```typescript
import { reset as resetCmd } from '$engine/commands/reset';
import { stash as stashCmd } from '$engine/commands/stash';
import { tag as tagCmd } from '$engine/commands/tag';
import { rm as rmCmd } from '$engine/commands/rm';
import { mv as mvCmd } from '$engine/commands/mv';

case 'reset':
  result = resetCmd(this, args, opts);
  break;
case 'stash':
  result = stashCmd(this, args);
  break;
case 'tag':
  result = tagCmd(this, args);
  break;
case 'rm':
  result = rmCmd(this, args);
  break;
case 'mv':
  result = mvCmd(this, args);
  break;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/engine/reset-stash-tag.test.ts`
Expected: All 11 tests PASS.

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All engine tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/engine/commands/reset.ts src/engine/commands/stash.ts src/engine/commands/tag.ts src/engine/commands/rm.ts src/engine/commands/mv.ts src/engine/index.ts tests/engine/reset-stash-tag.test.ts
git commit -m "feat(engine): add reset, stash, tag, rm, mv commands"
```

---

### Task 11: Shell Layer

**Files:**
- Create: `src/shell/parser.ts`
- Create: `src/shell/router.ts`
- Create: `src/shell/builtins.ts`
- Create: `src/shell/history.ts`
- Create: `src/shell/complete.ts`
- Create: `src/shell/prompt.ts`
- Create: `tests/shell/parser.test.ts`
- Create: `tests/shell/router.test.ts`
- Create: `tests/shell/builtins.test.ts`

- [ ] **Step 1: Write failing parser tests**

```typescript
// tests/shell/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseInput } from '$shell/parser';

describe('parseInput', () => {
  it('identifies git commands', () => {
    const result = parseInput('git commit -m "hello"');
    expect(result.type).toBe('git');
    expect(result.raw).toBe('git commit -m "hello"');
  });

  it('identifies builtins', () => {
    expect(parseInput('ls').type).toBe('builtin');
    expect(parseInput('cat file.txt').type).toBe('builtin');
    expect(parseInput('touch new.txt').type).toBe('builtin');
    expect(parseInput('rm old.txt').type).toBe('builtin');
    expect(parseInput('mv a b').type).toBe('builtin');
    expect(parseInput('clear').type).toBe('builtin');
    expect(parseInput('help').type).toBe('builtin');
    expect(parseInput('sim change').type).toBe('builtin');
  });

  it('identifies unknown commands', () => {
    const result = parseInput('foo bar');
    expect(result.type).toBe('unknown');
    expect(result.command).toBe('foo');
  });

  it('handles empty input', () => {
    const result = parseInput('');
    expect(result.type).toBe('empty');
  });

  it('trims whitespace', () => {
    const result = parseInput('  git status  ');
    expect(result.type).toBe('git');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/shell/parser.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement parser**

```typescript
// src/shell/parser.ts
const BUILTINS = new Set(['ls', 'cat', 'touch', 'rm', 'mv', 'clear', 'help', 'sim']);

export type ParsedInput =
  | { type: 'git'; raw: string }
  | { type: 'builtin'; command: string; args: string[] }
  | { type: 'unknown'; command: string }
  | { type: 'empty' };

export function parseInput(raw: string): ParsedInput {
  const trimmed = raw.trim();
  if (!trimmed) return { type: 'empty' };

  if (trimmed.startsWith('git ') || trimmed === 'git') {
    return { type: 'git', raw: trimmed };
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0];

  if (BUILTINS.has(command)) {
    return { type: 'builtin', command, args: parts.slice(1) };
  }

  return { type: 'unknown', command };
}
```

- [ ] **Step 4: Write failing router tests**

```typescript
// tests/shell/router.test.ts
import { describe, it, expect } from 'vitest';
import { ShellRouter } from '$shell/router';
import { GitEngine } from '$engine/index';

describe('ShellRouter', () => {
  it('routes git commands to engine', () => {
    const engine = new GitEngine();
    const router = new ShellRouter(engine);
    engine.vfs.createFile('a.txt', 'content');
    const result = router.execute('git add a.txt');
    expect(result.exitCode).toBe(0);
  });

  it('routes builtins', () => {
    const engine = new GitEngine();
    const router = new ShellRouter(engine);
    const result = router.execute('help');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('git');
  });

  it('returns error for unknown commands', () => {
    const engine = new GitEngine();
    const router = new ShellRouter(engine);
    const result = router.execute('unknown_cmd');
    expect(result.exitCode).toBe(127);
    expect(result.output).toContain('command not found');
  });

  it('handles empty input', () => {
    const engine = new GitEngine();
    const router = new ShellRouter(engine);
    const result = router.execute('');
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('');
  });
});
```

- [ ] **Step 5: Implement router**

```typescript
// src/shell/router.ts
import type { GitEngine } from '$engine/index';
import { parseInput } from '$shell/parser';
import { executeBuiltin } from '$shell/builtins';

export type ShellResult = {
  output: string;
  exitCode: number;
};

export class ShellRouter {
  constructor(private engine: GitEngine) {}

  execute(raw: string): ShellResult {
    const parsed = parseInput(raw);

    switch (parsed.type) {
      case 'empty':
        return { output: '', exitCode: 0 };
      case 'git':
        return this.engine.execute(parsed.raw);
      case 'builtin':
        return executeBuiltin(this.engine, parsed.command, parsed.args);
      case 'unknown':
        return { output: `command not found: ${parsed.command}`, exitCode: 127 };
    }
  }
}
```

- [ ] **Step 6: Write failing builtins tests**

```typescript
// tests/shell/builtins.test.ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';
import { executeBuiltin } from '$shell/builtins';

describe('builtins', () => {
  it('ls lists files', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', '');
    engine.vfs.createFile('b.txt', '');
    const result = executeBuiltin(engine, 'ls', []);
    expect(result.output).toContain('a.txt');
    expect(result.output).toContain('b.txt');
  });

  it('cat prints file content', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'hello world');
    const result = executeBuiltin(engine, 'cat', ['a.txt']);
    expect(result.output).toBe('hello world');
  });

  it('cat errors on missing file', () => {
    const engine = new GitEngine();
    const result = executeBuiltin(engine, 'cat', ['nope.txt']);
    expect(result.exitCode).toBe(1);
  });

  it('touch creates a file', () => {
    const engine = new GitEngine();
    executeBuiltin(engine, 'touch', ['new.txt']);
    expect(engine.vfs.exists('new.txt')).toBe(true);
  });

  it('rm deletes a file', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', '');
    executeBuiltin(engine, 'rm', ['a.txt']);
    expect(engine.vfs.exists('a.txt')).toBe(false);
  });

  it('mv renames a file', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'content');
    executeBuiltin(engine, 'mv', ['a.txt', 'b.txt']);
    expect(engine.vfs.exists('a.txt')).toBe(false);
    expect(engine.vfs.exists('b.txt')).toBe(true);
  });

  it('help lists commands', () => {
    const engine = new GitEngine();
    const result = executeBuiltin(engine, 'help', []);
    expect(result.output).toContain('git');
    expect(result.output).toContain('ls');
    expect(result.output).toContain('touch');
  });

  it('sim change modifies a tracked file', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'original');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    const result = executeBuiltin(engine, 'sim', ['change']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('modified');
    const content = engine.vfs.readFile('a.txt');
    expect(content).not.toBe('original');
  });
});
```

- [ ] **Step 7: Implement builtins**

```typescript
// src/shell/builtins.ts
import type { GitEngine } from '$engine/index';
import type { ShellResult } from '$shell/router';

const HELP_TEXT = `Available commands:
  git <command>       Git commands (add, commit, status, log, diff, branch, checkout, merge, rebase, reset, stash, tag, rm, mv, cherry-pick, revert, switch)
  ls [dir]            List files
  cat <file>          Show file contents
  touch <file>        Create a file
  rm <file>           Delete a file
  mv <src> <dst>      Move/rename a file
  sim change [file]   Simulate file modifications
  clear               Clear terminal
  help                Show this help`;

export function executeBuiltin(engine: GitEngine, command: string, args: string[]): ShellResult {
  switch (command) {
    case 'ls': {
      const dir = args[0];
      try {
        const entries = engine.vfs.listDir(dir);
        return { output: entries.join('  '), exitCode: 0 };
      } catch (e) {
        return { output: (e as Error).message, exitCode: 1 };
      }
    }

    case 'cat': {
      if (!args[0]) return { output: 'cat: missing operand', exitCode: 1 };
      try {
        return { output: engine.vfs.readFile(args[0]), exitCode: 0 };
      } catch (e) {
        return { output: `cat: ${args[0]}: No such file or directory`, exitCode: 1 };
      }
    }

    case 'touch': {
      if (!args[0]) return { output: 'touch: missing operand', exitCode: 1 };
      const filename = args[0];
      const lines = [
        `// ${filename}`,
        `// Auto-generated file`,
        `export default {};`,
      ];
      engine.vfs.createFile(filename, lines.join('\n'));
      return { output: '', exitCode: 0 };
    }

    case 'rm': {
      if (!args[0]) return { output: 'rm: missing operand', exitCode: 1 };
      try {
        engine.vfs.deleteFile(args[0]);
        return { output: '', exitCode: 0 };
      } catch (e) {
        return { output: `rm: cannot remove '${args[0]}': No such file or directory`, exitCode: 1 };
      }
    }

    case 'mv': {
      if (args.length < 2) return { output: 'mv: missing operand', exitCode: 1 };
      try {
        engine.vfs.moveFile(args[0], args[1]);
        return { output: '', exitCode: 0 };
      } catch (e) {
        return { output: (e as Error).message, exitCode: 1 };
      }
    }

    case 'clear':
      return { output: '\x1b[CLEAR]', exitCode: 0 };

    case 'help':
      return { output: HELP_TEXT, exitCode: 0 };

    case 'sim':
      return simChange(engine, args.slice(1));

    default:
      return { output: `command not found: ${command}`, exitCode: 127 };
  }
}

function simChange(engine: GitEngine, args: string[]): ShellResult {
  const committed = engine.getCommittedTree();
  const trackedFiles = [...committed.keys()];

  if (trackedFiles.length === 0) {
    return { output: 'No tracked files to modify.', exitCode: 1 };
  }

  const target = args[0] ?? trackedFiles[Math.floor(Math.random() * trackedFiles.length)];
  if (!committed.has(target)) {
    return { output: `File not tracked: ${target}`, exitCode: 1 };
  }

  const oldContent = engine.vfs.readFile(target);
  const lines = oldContent.split('\n');
  const changeType = Math.random();
  let description: string;

  if (changeType < 0.33 && lines.length > 1) {
    const idx = Math.floor(Math.random() * lines.length);
    lines.splice(idx, 1);
    description = `line ${idx + 1} removed`;
  } else if (changeType < 0.66) {
    const idx = Math.floor(Math.random() * (lines.length + 1));
    lines.splice(idx, 0, `// modified at ${Date.now()}`);
    description = `line added at position ${idx + 1}`;
  } else {
    const idx = Math.floor(Math.random() * lines.length);
    lines[idx] = `${lines[idx]} // changed`;
    description = `line ${idx + 1} modified`;
  }

  engine.vfs.createFile(target, lines.join('\n'));
  return { output: `modified: ${target} (${description})`, exitCode: 0 };
}
```

- [ ] **Step 8: Implement history**

```typescript
// src/shell/history.ts
const MAX_HISTORY = 100;

export class CommandHistory {
  private entries: string[] = [];
  private cursor = -1;

  push(command: string): void {
    if (command.trim() && this.entries[0] !== command) {
      this.entries.unshift(command);
      if (this.entries.length > MAX_HISTORY) this.entries.pop();
    }
    this.cursor = -1;
  }

  up(): string | null {
    if (this.cursor < this.entries.length - 1) {
      this.cursor++;
      return this.entries[this.cursor];
    }
    return null;
  }

  down(): string | null {
    if (this.cursor > 0) {
      this.cursor--;
      return this.entries[this.cursor];
    }
    this.cursor = -1;
    return '';
  }

  search(query: string): string | null {
    return this.entries.find((e) => e.includes(query)) ?? null;
  }

  reset(): void {
    this.cursor = -1;
  }

  getEntries(): string[] {
    return [...this.entries];
  }

  restore(entries: string[]): void {
    this.entries = entries.slice(0, MAX_HISTORY);
  }
}
```

- [ ] **Step 9: Implement autocomplete**

```typescript
// src/shell/complete.ts
import type { GitEngine } from '$engine/index';

const GIT_COMMANDS = [
  'add', 'branch', 'checkout', 'cherry-pick', 'commit', 'diff',
  'log', 'merge', 'mv', 'rebase', 'reset', 'revert', 'rm',
  'stash', 'status', 'switch', 'tag',
];

export function getCompletions(input: string, engine: GitEngine): string[] {
  const trimmed = input.trimStart();

  if (trimmed === 'git' || trimmed === 'git ') {
    return GIT_COMMANDS.map((c) => `git ${c}`);
  }

  if (trimmed.startsWith('git ')) {
    const afterGit = trimmed.slice(4);
    const parts = afterGit.split(/\s+/);

    if (parts.length === 1) {
      const partial = parts[0];
      return GIT_COMMANDS.filter((c) => c.startsWith(partial)).map((c) => `git ${c}`);
    }

    const subCmd = parts[0];
    const lastPart = parts[parts.length - 1];

    if (['checkout', 'switch', 'merge', 'rebase'].includes(subCmd)) {
      return engine.refs.listBranches()
        .filter((b) => b.startsWith(lastPart))
        .map((b) => trimmed.slice(0, trimmed.lastIndexOf(lastPart)) + b);
    }

    if (['add', 'rm', 'mv', 'diff'].includes(subCmd)) {
      return engine.vfs.allFilePaths()
        .filter((p) => p.startsWith(lastPart))
        .map((p) => trimmed.slice(0, trimmed.lastIndexOf(lastPart)) + p);
    }
  }

  return [];
}
```

- [ ] **Step 10: Implement prompt generator**

```typescript
// src/shell/prompt.ts
import type { GitEngine } from '$engine/index';

export type PromptSegment = {
  text: string;
  color: 'dim' | 'green' | 'yellow' | 'red' | 'blue' | 'grey' | 'fg';
};

export function generatePrompt(engine: GitEngine): PromptSegment[] {
  const segments: PromptSegment[] = [];
  const head = engine.refs.getHEAD();

  segments.push({ text: '~/gitverse ', color: 'dim' });
  segments.push({ text: ' ', color: 'fg' });

  if (head.attached) {
    const dirty = engine.isDirty();
    const color = dirty ? 'yellow' : 'green';
    segments.push({ text: head.target, color });

    if (dirty) {
      segments.push({ text: ' ✗', color: 'red' });
      const counts = getFileCounts(engine);
      if (counts.length > 0) {
        segments.push({ text: ` [${counts}]`, color: 'fg' });
      }
    } else {
      try {
        engine.refs.resolveHEAD();
        segments.push({ text: ' ✓', color: 'green' });
      } catch {
        // no commits yet
      }
    }
  } else {
    segments.push({ text: `(${head.target.slice(0, 7)})`, color: 'red' });
  }

  segments.push({ text: ' $ ', color: 'fg' });
  return segments;
}

function getFileCounts(engine: GitEngine): string {
  const staged = engine.getStagedFiles().length;
  const modified = engine.getModifiedFiles().length;
  const untracked = engine.getUntrackedFiles().length;
  const parts: string[] = [];
  if (staged > 0) parts.push(`${staged}A`);
  if (modified > 0) parts.push(`${modified}M`);
  if (untracked > 0) parts.push(`${untracked}?`);
  return parts.join(' ');
}
```

- [ ] **Step 11: Run all shell tests**

Run: `npx vitest run tests/shell/`
Expected: All tests PASS.

- [ ] **Step 12: Commit**

```bash
git add src/shell/ tests/shell/
git commit -m "feat(shell): add parser, router, builtins, history, autocomplete, prompt"
```

---

### Task 12: Svelte Stores + Terminal UI

**Files:**
- Create: `src/store/engine.ts`
- Create: `src/store/ui.ts`
- Create: `src/ui/Prompt.svelte`
- Create: `src/ui/Terminal.svelte`
- Create: `src/ui/Layout.svelte`
- Modify: `src/App.svelte`

- [ ] **Step 1: Create Svelte stores**

```typescript
// src/store/engine.ts
import { writable, derived } from 'svelte/store';
import { GitEngine } from '$engine/index';
import { ShellRouter } from '$shell/router';
import { CommandHistory } from '$shell/history';
import { generatePrompt, type PromptSegment } from '$shell/prompt';

export const engine = writable(new GitEngine());
export const history = writable(new CommandHistory());

export const shellRouter = derived(engine, ($engine) => new ShellRouter($engine));
export const prompt = derived(engine, ($engine) => generatePrompt($engine));

export type TerminalLine = {
  id: number;
  prompt?: PromptSegment[];
  input?: string;
  output?: string;
  isError?: boolean;
};

export const terminalLines = writable<TerminalLine[]>([]);

let lineId = 0;

export function executeCommand(command: string): void {
  engine.update(($engine) => {
    const router = new ShellRouter($engine);
    const currentPrompt = generatePrompt($engine);

    const result = router.execute(command);

    history.update(($history) => {
      $history.push(command);
      return $history;
    });

    terminalLines.update(($lines) => {
      $lines.push({
        id: lineId++,
        prompt: currentPrompt,
        input: command,
      });

      if (result.output && result.output !== '\x1b[CLEAR]') {
        $lines.push({
          id: lineId++,
          output: result.output,
          isError: result.exitCode !== 0,
        });
      }

      if (result.output === '\x1b[CLEAR]') {
        return [];
      }

      return $lines;
    });

    return $engine;
  });
}
```

```typescript
// src/store/ui.ts
import { writable } from 'svelte/store';

export type FocusMode = 'terminal' | 'graph';

export const focusMode = writable<FocusMode>('terminal');

export function toggleFocus(): void {
  focusMode.update((mode) => (mode === 'terminal' ? 'graph' : 'terminal'));
}
```

- [ ] **Step 2: Create Prompt component**

```svelte
<!-- src/ui/Prompt.svelte -->
<script lang="ts">
  import type { PromptSegment } from '$shell/prompt';

  let { segments }: { segments: PromptSegment[] } = $props();

  const colorMap: Record<string, string> = {
    dim: 'text-terminal-dim',
    green: 'text-terminal-green',
    yellow: 'text-terminal-yellow',
    red: 'text-terminal-red',
    blue: 'text-terminal-blue',
    grey: 'text-terminal-grey',
    fg: 'text-terminal-fg',
  };
</script>

<span class="prompt inline">
  {#each segments as seg}
    <span class={colorMap[seg.color]}>{seg.text}</span>
  {/each}
</span>
```

- [ ] **Step 3: Create Terminal component**

```svelte
<!-- src/ui/Terminal.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import Prompt from './Prompt.svelte';
  import { terminalLines, executeCommand, prompt, history } from '$store/engine';
  import { getCompletions } from '$shell/complete';
  import { get } from 'svelte/store';

  let inputValue = $state('');
  let inputEl: HTMLInputElement;
  let scrollContainer: HTMLDivElement;

  const lines = $derived($terminalLines);
  const currentPrompt = $derived($prompt);
  const commandHistory = $derived($history);

  function handleSubmit() {
    if (!inputValue.trim() && inputValue === '') return;
    executeCommand(inputValue);
    inputValue = '';
    scrollToBottom();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = commandHistory.up();
      if (prev !== null) inputValue = prev;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = commandHistory.down();
      if (next !== null) inputValue = next;
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const engine = get((await import('$store/engine')).engine);
      const completions = getCompletions(inputValue, engine);
      if (completions.length === 1) inputValue = completions[0];
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      terminalLines.set([]);
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      inputValue = '';
      commandHistory.reset();
    } else if (e.key === 'a' && e.ctrlKey) {
      e.preventDefault();
      inputEl.setSelectionRange(0, 0);
    } else if (e.key === 'e' && e.ctrlKey) {
      e.preventDefault();
      inputEl.setSelectionRange(inputValue.length, inputValue.length);
    } else if (e.key === 'u' && e.ctrlKey) {
      e.preventDefault();
      const pos = inputEl.selectionStart ?? 0;
      inputValue = inputValue.slice(pos);
    } else if (e.key === 'k' && e.ctrlKey) {
      e.preventDefault();
      const pos = inputEl.selectionStart ?? inputValue.length;
      inputValue = inputValue.slice(0, pos);
    } else if (e.key === 'Backspace' && e.altKey) {
      e.preventDefault();
      const pos = inputEl.selectionStart ?? inputValue.length;
      const before = inputValue.slice(0, pos);
      const after = inputValue.slice(pos);
      const trimmed = before.replace(/\S+\s*$/, '');
      inputValue = trimmed + after;
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });
  }

  function focusInput() {
    inputEl?.focus();
  }

  onMount(() => {
    focusInput();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="terminal flex flex-col h-full font-mono text-sm"
  onclick={focusInput}
>
  <div bind:this={scrollContainer} class="flex-1 overflow-y-auto p-3 space-y-1">
    {#each lines as line (line.id)}
      {#if line.prompt && line.input !== undefined}
        <div class="flex flex-wrap">
          <Prompt segments={line.prompt} />
          <span class="text-terminal-fg">{line.input}</span>
        </div>
      {/if}
      {#if line.output}
        <pre class="whitespace-pre-wrap {line.isError ? 'text-terminal-red' : 'text-terminal-fg'}">{line.output}</pre>
      {/if}
    {/each}

    <div class="flex items-center">
      <Prompt segments={currentPrompt} />
      <input
        bind:this={inputEl}
        bind:value={inputValue}
        onkeydown={handleKeydown}
        class="flex-1 bg-transparent outline-none text-terminal-fg caret-terminal-green"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
      />
    </div>
  </div>
</div>
```

- [ ] **Step 4: Create Layout component**

```svelte
<!-- src/ui/Layout.svelte -->
<script lang="ts">
  import Terminal from './Terminal.svelte';
  import { focusMode, toggleFocus } from '$store/ui';

  const mode = $derived($focusMode);
</script>

<div class="layout relative h-screen w-screen overflow-hidden bg-terminal-bg">
  <!-- Graph background placeholder -->
  <div
    class="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
    class:opacity-30={mode === 'terminal'}
    class:opacity-100={mode === 'graph'}
  >
    <p class="text-terminal-dim text-lg">Git Graph</p>
  </div>

  <!-- Terminal overlay -->
  <div
    class="absolute transition-all duration-300 ease-in-out"
    class:terminal-focused={mode === 'terminal'}
    class:terminal-compact={mode === 'graph'}
  >
    <div class="terminal-panel h-full flex flex-col">
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-terminal-dim/30">
        <span class="text-terminal-dim text-xs">terminal</span>
        <button
          onclick={toggleFocus}
          class="text-xs px-2 py-0.5 rounded bg-terminal-dim/20 text-terminal-fg hover:bg-terminal-dim/40 transition-colors"
        >
          {mode === 'terminal' ? 'Graph' : 'Terminal'}
        </button>
      </div>
      <div class="flex-1 overflow-hidden">
        <Terminal />
      </div>
    </div>
  </div>
</div>

<style>
  .terminal-focused {
    top: 15%;
    left: 15%;
    right: 15%;
    bottom: 10%;
  }

  .terminal-compact {
    bottom: 1rem;
    right: 1rem;
    width: 24rem;
    height: 14rem;
  }

  @media (max-width: 768px) {
    .terminal-focused {
      top: 5%;
      left: 2%;
      right: 2%;
      bottom: 2%;
    }

    .terminal-compact {
      bottom: 0.5rem;
      right: 0.5rem;
      left: 0.5rem;
      width: auto;
      height: 3rem;
    }
  }
</style>
```

- [ ] **Step 5: Update App.svelte**

```svelte
<!-- src/App.svelte -->
<script lang="ts">
  import Layout from '$ui/Layout.svelte';
</script>

<Layout />
```

- [ ] **Step 6: Run dev server and verify terminal works**

Run: `npm run dev`
Expected: Terminal renders with colored prompt, can type git commands, see output.

- [ ] **Step 7: Commit**

```bash
git add src/store/ src/ui/ src/App.svelte
git commit -m "feat(ui): add terminal UI with prompt, keyboard shortcuts, layout"
```

---

### Task 13: Graph Visualization

**Files:**
- Create: `src/graph/types.ts`
- Create: `src/graph/layout.ts`
- Create: `src/ui/Graph.svelte`
- Create: `src/ui/CommitDetail.svelte`
- Modify: `src/ui/Layout.svelte`
- Create: `tests/graph/layout.test.ts`

- [ ] **Step 1: Write failing layout tests**

```typescript
// tests/graph/layout.test.ts
import { describe, it, expect } from 'vitest';
import { computeLayout, type GraphNode, type GraphEdge } from '$graph/layout';

describe('computeLayout', () => {
  it('positions a single commit', () => {
    const nodes: GraphNode[] = [{ hash: 'a', parents: [], message: 'init', branches: ['main'], isHEAD: true, lane: 0, x: 0, y: 0 }];
    const result = computeLayout(nodes);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].x).toBeGreaterThanOrEqual(0);
  });

  it('positions linear commits left to right', () => {
    const nodes: GraphNode[] = [
      { hash: 'a', parents: [], message: 'first', branches: [], isHEAD: false, lane: 0, x: 0, y: 0 },
      { hash: 'b', parents: ['a'], message: 'second', branches: ['main'], isHEAD: true, lane: 0, x: 0, y: 0 },
    ];
    const result = computeLayout(nodes);
    expect(result.nodes[1].x).toBeGreaterThan(result.nodes[0].x);
  });

  it('assigns different lanes to branches', () => {
    const nodes: GraphNode[] = [
      { hash: 'a', parents: [], message: 'base', branches: [], isHEAD: false, lane: 0, x: 0, y: 0 },
      { hash: 'b', parents: ['a'], message: 'main', branches: ['main'], isHEAD: true, lane: 0, x: 0, y: 0 },
      { hash: 'c', parents: ['a'], message: 'feat', branches: ['feat'], isHEAD: false, lane: 0, x: 0, y: 0 },
    ];
    const result = computeLayout(nodes);
    const mainNode = result.nodes.find((n) => n.hash === 'b')!;
    const featNode = result.nodes.find((n) => n.hash === 'c')!;
    expect(mainNode.y).not.toBe(featNode.y);
  });

  it('generates edges', () => {
    const nodes: GraphNode[] = [
      { hash: 'a', parents: [], message: 'first', branches: [], isHEAD: false, lane: 0, x: 0, y: 0 },
      { hash: 'b', parents: ['a'], message: 'second', branches: ['main'], isHEAD: true, lane: 0, x: 0, y: 0 },
    ];
    const result = computeLayout(nodes);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from).toBe('a');
    expect(result.edges[0].to).toBe('b');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/graph/layout.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement graph types and layout**

```typescript
// src/graph/types.ts
export type GraphNode = {
  hash: string;
  parents: string[];
  message: string;
  branches: string[];
  tags?: string[];
  isHEAD: boolean;
  lane: number;
  x: number;
  y: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};
```

```typescript
// src/graph/layout.ts
export type { GraphNode, GraphEdge } from '$graph/types';
import type { GraphNode, GraphEdge } from '$graph/types';

const NODE_SPACING_X = 80;
const LANE_SPACING_Y = 50;

export type LayoutResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
};

export function computeLayout(inputNodes: GraphNode[]): LayoutResult {
  const nodes = inputNodes.map((n) => ({ ...n }));
  const nodeMap = new Map(nodes.map((n) => [n.hash, n]));

  const sorted = topologicalSort(nodes);

  const laneAssignment = new Map<string, number>();
  let nextLane = 0;
  const activeLanes = new Set<number>();

  for (const node of sorted) {
    if (node.parents.length === 0) {
      node.lane = nextLane++;
      activeLanes.add(node.lane);
    } else {
      const parentNode = nodeMap.get(node.parents[0]);
      if (parentNode && !hasOtherChildren(sorted, node.parents[0], node.hash)) {
        node.lane = parentNode.lane;
      } else {
        let lane = 0;
        while (activeLanes.has(lane)) lane++;
        node.lane = lane;
        activeLanes.add(lane);
      }
    }
    laneAssignment.set(node.hash, node.lane);
  }

  for (let i = 0; i < sorted.length; i++) {
    sorted[i].x = (i + 1) * NODE_SPACING_X;
    sorted[i].y = sorted[i].lane * LANE_SPACING_Y + LANE_SPACING_Y;
  }

  const edges: GraphEdge[] = [];
  for (const node of sorted) {
    for (const parentHash of node.parents) {
      const parent = nodeMap.get(parentHash);
      if (parent) {
        edges.push({
          from: parentHash,
          to: node.hash,
          fromX: parent.x,
          fromY: parent.y,
          toX: node.x,
          toY: node.y,
        });
      }
    }
  }

  const maxX = Math.max(...sorted.map((n) => n.x), 0) + NODE_SPACING_X;
  const maxY = Math.max(...sorted.map((n) => n.y), 0) + LANE_SPACING_Y;

  return { nodes: sorted, edges, width: maxX, height: maxY };
}

function topologicalSort(nodes: GraphNode[]): GraphNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.hash, n]));
  const visited = new Set<string>();
  const result: GraphNode[] = [];

  function visit(hash: string) {
    if (visited.has(hash)) return;
    visited.add(hash);
    const node = nodeMap.get(hash);
    if (!node) return;
    for (const parent of node.parents) visit(parent);
    result.push(node);
  }

  for (const node of nodes) visit(node.hash);
  return result;
}

function hasOtherChildren(nodes: GraphNode[], parentHash: string, excludeHash: string): boolean {
  return nodes.some((n) => n.hash !== excludeHash && n.parents.includes(parentHash));
}
```

- [ ] **Step 4: Create Graph.svelte component**

```svelte
<!-- src/ui/Graph.svelte -->
<script lang="ts">
  import { engine } from '$store/engine';
  import { computeLayout, type LayoutResult } from '$graph/layout';
  import type { GraphNode } from '$graph/types';
  import CommitDetail from './CommitDetail.svelte';

  const BRANCH_COLORS = ['#3fb950', '#58a6ff', '#bc8cff', '#f85149', '#d29922', '#39d353'];

  let selectedCommit = $state<GraphNode | null>(null);
  let popoverPos = $state({ x: 0, y: 0 });

  const layout = $derived.by((): LayoutResult => {
    const commits = $engine.objects.allCommits().sort((a, b) => a.timestamp - b.timestamp);
    const head = $engine.refs.getHEAD();
    const branches = $engine.refs.listBranches();
    const tags = $engine.refs.listTags();

    const branchMap = new Map<string, string[]>();
    for (const b of branches) {
      const target = $engine.refs.resolveBranch(b);
      if (!branchMap.has(target)) branchMap.set(target, []);
      branchMap.get(target)!.push(b);
    }
    const tagMap = new Map<string, string[]>();
    for (const t of tags) {
      const target = $engine.refs.resolveTag(t);
      if (!tagMap.has(target)) tagMap.set(target, []);
      tagMap.get(target)!.push(t);
    }

    let headHash: string | null = null;
    try { headHash = $engine.refs.resolveHEAD(); } catch {}

    const nodes: GraphNode[] = commits.map((c) => ({
      hash: c.hash,
      parents: c.parents,
      message: c.message,
      branches: branchMap.get(c.hash) ?? [],
      tags: tagMap.get(c.hash),
      isHEAD: c.hash === headHash,
      lane: 0, x: 0, y: 0,
    }));

    if (nodes.length === 0) return { nodes: [], edges: [], width: 200, height: 100 };
    return computeLayout(nodes);
  });

  function laneColor(lane: number): string {
    return BRANCH_COLORS[lane % BRANCH_COLORS.length];
  }

  function edgePath(e: { fromX: number; fromY: number; toX: number; toY: number }): string {
    const midX = (e.fromX + e.toX) / 2;
    return `M ${e.fromX} ${e.fromY} C ${midX} ${e.fromY}, ${midX} ${e.toY}, ${e.toX} ${e.toY}`;
  }

  function handleNodeClick(node: GraphNode, event: MouseEvent) {
    selectedCommit = selectedCommit?.hash === node.hash ? null : node;
    popoverPos = { x: event.clientX, y: event.clientY };
  }
</script>

<svg
  viewBox="0 0 {layout.width} {layout.height}"
  class="w-full h-full"
  preserveAspectRatio="xMidYMid meet"
>
  {#each layout.edges as edge}
    <path
      d={edgePath(edge)}
      fill="none"
      stroke={laneColor(layout.nodes.find(n => n.hash === edge.to)?.lane ?? 0)}
      stroke-width="2"
      class="transition-all duration-300"
    />
  {/each}

  {#each layout.nodes as node}
    <g
      transform="translate({node.x}, {node.y})"
      class="cursor-pointer"
      onclick={(e) => handleNodeClick(node, e)}
      role="button"
      tabindex="0"
    >
      <circle
        r="12"
        fill={laneColor(node.lane)}
        stroke={node.isHEAD ? '#ffffff' : 'none'}
        stroke-width={node.isHEAD ? 3 : 0}
        class="transition-all duration-300"
      />
      <text
        y="4"
        text-anchor="middle"
        fill="white"
        font-size="8"
        font-family="monospace"
      >
        {node.hash.slice(0, 4)}
      </text>

      {#each node.branches as branch, i}
        <g transform="translate(0, {-22 - i * 18})">
          <rect
            x={-branch.length * 3.5 - 6}
            y="-8"
            width={branch.length * 7 + 12}
            height="16"
            rx="8"
            fill={laneColor(node.lane)}
            opacity="0.85"
          />
          <text
            text-anchor="middle"
            y="4"
            fill="white"
            font-size="9"
            font-family="monospace"
          >
            {branch}
          </text>
        </g>
      {/each}

      {#if node.tags}
        {#each node.tags as tagName, i}
          <g transform="translate(0, {20 + i * 16})">
            <text
              text-anchor="middle"
              y="4"
              fill="#d29922"
              font-size="8"
              font-family="monospace"
            >
              🏷 {tagName}
            </text>
          </g>
        {/each}
      {/if}
    </g>
  {/each}
</svg>

{#if selectedCommit}
  <CommitDetail commit={selectedCommit} x={popoverPos.x} y={popoverPos.y} onclose={() => selectedCommit = null} />
{/if}
```

- [ ] **Step 5: Create CommitDetail component**

```svelte
<!-- src/ui/CommitDetail.svelte -->
<script lang="ts">
  import type { GraphNode } from '$graph/types';

  let { commit, x, y, onclose }: { commit: GraphNode; x: number; y: number; onclose: () => void } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed z-50 bg-terminal-bg border border-terminal-dim/50 rounded-lg p-3 shadow-lg font-mono text-xs max-w-xs"
  style="left: {Math.min(x, window.innerWidth - 280)}px; top: {Math.min(y + 10, window.innerHeight - 200)}px"
>
  <div class="flex justify-between items-center mb-2">
    <span class="text-terminal-yellow font-bold">{commit.hash.slice(0, 7)}</span>
    <button onclick={onclose} class="text-terminal-dim hover:text-terminal-fg">&times;</button>
  </div>
  <p class="text-terminal-fg mb-1">{commit.message}</p>
  {#if commit.branches.length > 0}
    <p class="text-terminal-green">Branches: {commit.branches.join(', ')}</p>
  {/if}
  {#if commit.parents.length > 0}
    <p class="text-terminal-dim">Parents: {commit.parents.map(p => p.slice(0, 7)).join(', ')}</p>
  {/if}
</div>
```

- [ ] **Step 6: Update Layout.svelte to include Graph**

Replace the graph placeholder in `src/ui/Layout.svelte`:

```svelte
import Graph from './Graph.svelte';

<!-- Replace the placeholder div -->
<div class="absolute inset-0 transition-opacity duration-300" ...>
  <Graph />
</div>
```

- [ ] **Step 7: Run tests and dev server**

Run: `npx vitest run tests/graph/ && npm run dev`
Expected: Layout tests pass. Dev server shows graph updating as commands run.

- [ ] **Step 8: Commit**

```bash
git add src/graph/ src/ui/Graph.svelte src/ui/CommitDetail.svelte src/ui/Layout.svelte tests/graph/
git commit -m "feat(ui): add SVG git graph visualization with commit detail popover"
```

---

### Task 14: File Panel + Mobile Toolbar

**Files:**
- Create: `src/ui/FilePanel.svelte`
- Create: `src/ui/MobileToolbar.svelte`
- Modify: `src/ui/Layout.svelte`

- [ ] **Step 1: Create FilePanel component**

```svelte
<!-- src/ui/FilePanel.svelte -->
<script lang="ts">
  import { engine, executeCommand } from '$store/engine';

  type FileStatus = { path: string; status: 'staged' | 'modified' | 'untracked' | 'deleted' };

  const files = $derived.by((): FileStatus[] => {
    const result: FileStatus[] = [];
    for (const f of $engine.getStagedFiles()) {
      result.push({ path: f.path, status: 'staged' });
    }
    for (const f of $engine.getModifiedFiles()) {
      if (!result.some(r => r.path === f)) {
        result.push({ path: f, status: 'modified' });
      }
    }
    for (const f of $engine.getUntrackedFiles()) {
      result.push({ path: f, status: 'untracked' });
    }
    return result;
  });

  const statusIcon: Record<string, string> = {
    staged: '✓',
    modified: '●',
    untracked: '○',
    deleted: '✗',
  };

  const statusColor: Record<string, string> = {
    staged: 'bg-terminal-green/20 text-terminal-green border-terminal-green/40',
    modified: 'bg-terminal-red/20 text-terminal-red border-terminal-red/40',
    untracked: 'bg-terminal-grey/20 text-terminal-grey border-terminal-grey/40',
    deleted: 'bg-terminal-red/20 text-terminal-red border-terminal-red/40',
  };

  function newFile() {
    const name = prompt('File name:');
    if (name) executeCommand(`touch ${name}`);
  }

  function simChanges() {
    executeCommand('sim change');
  }
</script>

<div class="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto border-b border-terminal-dim/30">
  <span class="text-terminal-dim text-xs shrink-0">FILES</span>

  {#each files as file}
    <span
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border {statusColor[file.status]} shrink-0"
      title="{file.status}: {file.path}"
    >
      <span>{statusIcon[file.status]}</span>
      <span>{file.path}</span>
    </span>
  {/each}

  <div class="flex gap-1 ml-auto shrink-0">
    <button
      onclick={newFile}
      class="text-xs px-2 py-0.5 rounded bg-terminal-dim/20 text-terminal-fg hover:bg-terminal-dim/40 transition-colors"
    >
      + New
    </button>
    <button
      onclick={simChanges}
      class="text-xs px-2 py-0.5 rounded bg-terminal-dim/20 text-terminal-fg hover:bg-terminal-dim/40 transition-colors"
    >
      ~ Changes
    </button>
  </div>
</div>
```

- [ ] **Step 2: Create MobileToolbar component**

```svelte
<!-- src/ui/MobileToolbar.svelte -->
<script lang="ts">
  import { executeCommand } from '$store/engine';

  function newFile() {
    const name = prompt('File name:');
    if (name) executeCommand(`touch ${name}`);
  }

  function simChanges() {
    executeCommand('sim change');
  }
</script>

<div class="flex gap-2 p-2 md:hidden">
  <button
    onclick={newFile}
    class="flex-1 text-xs py-2 rounded bg-terminal-dim/20 text-terminal-fg active:bg-terminal-dim/40"
  >
    + New File
  </button>
  <button
    onclick={simChanges}
    class="flex-1 text-xs py-2 rounded bg-terminal-dim/20 text-terminal-fg active:bg-terminal-dim/40"
  >
    ~ Simulate
  </button>
</div>
```

- [ ] **Step 3: Integrate into Layout**

Update `src/ui/Layout.svelte` terminal panel section to include FilePanel above Terminal and MobileToolbar:

```svelte
import FilePanel from './FilePanel.svelte';
import MobileToolbar from './MobileToolbar.svelte';

<!-- Inside the terminal-panel div, before Terminal -->
<FilePanel />
<MobileToolbar />
<div class="flex-1 overflow-hidden">
  <Terminal />
</div>
```

- [ ] **Step 4: Test on dev server**

Run: `npm run dev`
Expected: File chips appear above terminal, buttons create files and simulate changes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/FilePanel.svelte src/ui/MobileToolbar.svelte src/ui/Layout.svelte
git commit -m "feat(ui): add file panel with status chips and mobile toolbar"
```

---

### Task 15: Persistence (IndexedDB)

**Files:**
- Create: `src/persistence/serializer.ts`
- Create: `src/persistence/storage.ts`
- Modify: `src/store/engine.ts`
- Create: `tests/persistence/serializer.test.ts`

- [ ] **Step 1: Write failing serializer tests**

```typescript
// tests/persistence/serializer.test.ts
import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';
import { serialize, deserialize } from '$persistence/serializer';

describe('serializer', () => {
  it('round-trips a simple repo', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('readme.md', 'hello');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    engine.execute('git branch feat');

    const json = serialize(engine);
    const restored = deserialize(json);

    expect(restored.log()).toHaveLength(1);
    expect(restored.log()[0].message).toBe('init');
    expect(restored.vfs.readFile('readme.md')).toBe('hello');
    expect(restored.refs.hasBranch('feat')).toBe(true);
    expect(restored.getHEAD()).toEqual(engine.getHEAD());
  });

  it('round-trips with staged files', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'aaa');
    engine.execute('git add a.txt');

    const json = serialize(engine);
    const restored = deserialize(json);

    expect(restored.index.has('a.txt')).toBe(true);
  });

  it('produces valid JSON', () => {
    const engine = new GitEngine();
    engine.vfs.createFile('a.txt', 'content');
    engine.execute('git add .');
    engine.execute('git commit -m "test"');
    const json = serialize(engine);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/persistence/serializer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement serializer**

This requires exposing internals from GitEngine, ObjectStore, RefStore for serialization. Add `toJSON()`/`fromJSON()` methods to each.

```typescript
// src/persistence/serializer.ts
import { GitEngine } from '$engine/index';

export function serialize(engine: GitEngine): string {
  return JSON.stringify({
    vfs: [...engine.vfs.snapshot()].map(([k, v]) => [k, v]),
    objects: {
      blobs: [...engine.objects.allBlobs()],
      trees: [...engine.objects.allTrees()].map(([h, e]) => [h, [...e]]),
      commits: engine.objects.allCommits(),
    },
    refs: {
      branches: [...engine.refs.listBranches()].map((b) => [b, engine.refs.resolveBranch(b)]),
      tags: [...engine.refs.listTags()].map((t) => [t, engine.refs.resolveTag(t)]),
      head: engine.refs.getHEAD(),
    },
    index: [...engine.index],
  });
}

export function deserialize(json: string): GitEngine {
  const data = JSON.parse(json);
  const engine = new GitEngine();

  const vfsMap = new Map(data.vfs);
  engine.vfs.restore(vfsMap as Map<string, { content: string; type: 'file' | 'dir' }>);

  for (const [hash, content] of data.objects.blobs) {
    engine.objects.restoreBlob(hash, content);
  }
  for (const [hash, entries] of data.objects.trees) {
    engine.objects.restoreTree(hash, new Map(entries));
  }
  for (const commit of data.objects.commits) {
    engine.objects.restoreCommit(commit);
  }

  for (const [name, target] of data.refs.branches) {
    if (!engine.refs.hasBranch(name)) engine.refs.createBranch(name, target);
    else engine.refs.updateBranch(name, target);
  }
  for (const [name, target] of data.refs.tags) {
    if (!engine.refs.hasTag(name)) engine.refs.createTag(name, target);
  }
  if (data.refs.head.attached) {
    engine.refs.attachHEAD(data.refs.head.target);
  } else {
    engine.refs.detachHEAD(data.refs.head.target);
  }

  engine.index.clear();
  for (const [path, hash] of data.index) {
    engine.index.set(path, hash);
  }

  return engine;
}
```

Add `restoreBlob`, `restoreTree`, `restoreCommit`, `allBlobs`, `allTrees` methods to `ObjectStore`:

```typescript
// Add to src/engine/objects.ts:
allBlobs(): [string, string][] {
  return [...this.blobs.entries()];
}

allTrees(): [string, Map<string, string>][] {
  return [...this.trees.entries()].map(([h, e]) => [h, new Map(e)]);
}

restoreBlob(hash: string, content: string): void {
  this.blobs.set(hash, content);
}

restoreTree(hash: string, entries: Map<string, string>): void {
  this.trees.set(hash, entries);
}

restoreCommit(commit: Commit): void {
  this.commits.set(commit.hash, commit);
}
```

- [ ] **Step 4: Implement IndexedDB storage**

```typescript
// src/persistence/storage.ts
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';

const SANDBOX_PREFIX = 'gitverse:sandbox:';
const AUTOSAVE_KEY = 'gitverse:autosave';
const HISTORY_KEY = 'gitverse:history';

export async function autoSave(stateJson: string): Promise<void> {
  await idbSet(AUTOSAVE_KEY, stateJson);
}

export async function autoLoad(): Promise<string | null> {
  return (await idbGet<string>(AUTOSAVE_KEY)) ?? null;
}

export async function saveSandbox(name: string, stateJson: string): Promise<void> {
  await idbSet(`${SANDBOX_PREFIX}${name}`, stateJson);
}

export async function loadSandbox(name: string): Promise<string | null> {
  return (await idbGet<string>(`${SANDBOX_PREFIX}${name}`)) ?? null;
}

export async function deleteSandbox(name: string): Promise<void> {
  await idbDel(`${SANDBOX_PREFIX}${name}`);
}

export async function listSandboxes(): Promise<string[]> {
  const allKeys = await idbKeys();
  return allKeys
    .filter((k): k is string => typeof k === 'string' && k.startsWith(SANDBOX_PREFIX))
    .map((k) => k.slice(SANDBOX_PREFIX.length));
}

export async function saveHistory(entries: string[]): Promise<void> {
  await idbSet(HISTORY_KEY, entries);
}

export async function loadHistory(): Promise<string[]> {
  return (await idbGet<string[]>(HISTORY_KEY)) ?? [];
}
```

- [ ] **Step 5: Wire auto-save into engine store**

Add to `src/store/engine.ts`:

```typescript
import { serialize } from '$persistence/serializer';
import { autoSave } from '$persistence/storage';

// After executeCommand updates engine, auto-save:
export function executeCommand(command: string): void {
  engine.update(($engine) => {
    // ... existing logic ...
    // At end, trigger auto-save
    autoSave(serialize($engine));
    return $engine;
  });
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/persistence/`
Expected: All 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/persistence/ src/engine/objects.ts src/store/engine.ts tests/persistence/
git commit -m "feat(persistence): add IndexedDB auto-save with engine serialization"
```

---

### Task 16: PWA + Final Polish + Deploy Config

**Files:**
- Create: `public/favicon.svg`
- Create: `public/icons/icon-192.png` (placeholder)
- Create: `public/icons/icon-512.png` (placeholder)
- Verify: all configs correct

- [ ] **Step 1: Create favicon.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0d1117"/>
  <circle cx="10" cy="16" r="3" fill="#3fb950"/>
  <circle cx="22" cy="10" r="3" fill="#58a6ff"/>
  <circle cx="22" cy="22" r="3" fill="#bc8cff"/>
  <line x1="13" y1="16" x2="19" y2="10" stroke="#3fb950" stroke-width="2"/>
  <line x1="13" y1="16" x2="19" y2="22" stroke="#3fb950" stroke-width="2"/>
</svg>
```

Save to `public/favicon.svg`.

- [ ] **Step 2: Generate placeholder PWA icons**

Create simple SVG-based placeholder icons. These can be replaced with proper PNG icons later:

```bash
mkdir -p public/icons
# For now, copy favicon as icon placeholder — replace with proper PNG later
cp public/favicon.svg public/icons/icon-192.svg
cp public/favicon.svg public/icons/icon-512.svg
```

Update `vite.config.ts` manifest icons to reference SVG:
```typescript
icons: [
  { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
  { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
],
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No TypeScript errors.

- [ ] **Step 5: Run production build**

Run: `npm run build`
Expected: Clean build, `dist/` directory with hashed assets, service worker generated.

- [ ] **Step 6: Verify build output**

Run: `ls dist/`
Expected: `index.html`, `assets/`, service worker files, manifest.

- [ ] **Step 7: Commit final polish**

```bash
git add public/ vite.config.ts
git commit -m "feat(pwa): add icons, favicon, and service worker config"
```

- [ ] **Step 8: Push and verify CI**

```bash
git push origin main
```

Expected: GitHub Actions CI runs and passes.

- [ ] **Step 9: Tag and deploy**

```bash
git tag v0.1.0
git push origin v0.1.0
```

Expected: Deploy workflow triggers, builds, and deploys to Cloudflare Workers (requires `CLOUDFLARE_API_TOKEN` secret configured in repo settings).
