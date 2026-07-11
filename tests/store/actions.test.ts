import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { ShellRouter } from '$shell/router';
import { exampleFileCommands, simulateChangeCommands } from '$store/actions';

let engine: GitEngine;
let router: ShellRouter;

function run(cmd: string) {
  const r = router.execute(cmd);
  expect(r.exitCode, `command failed: ${cmd} → ${r.output}`).toBe(0);
}

beforeEach(() => {
  engine = new GitEngine();
  router = new ShellRouter(engine);
  engine.execute('git init');
});

describe('exampleFileCommands', () => {
  it('plans the full starter set on an empty VFS', () => {
    expect(exampleFileCommands(engine)).toEqual([
      'mkdir src',
      'touch README.md',
      'touch index.html',
      'touch src/app.js',
    ]);
  });

  it('planned commands all execute successfully through the router', () => {
    for (const cmd of exampleFileCommands(engine)) run(cmd);
    expect(engine.getVFS().allFilePaths()).toEqual(['README.md', 'index.html', 'src/app.js'].sort());
  });

  it('is idempotent — skips whatever already exists', () => {
    for (const cmd of exampleFileCommands(engine)) run(cmd);
    expect(exampleFileCommands(engine)).toEqual([]);
  });

  it('skips only the existing pieces', () => {
    run('mkdir src');
    run('touch README.md');
    expect(exampleFileCommands(engine)).toEqual(['touch index.html', 'touch src/app.js']);
  });
});

describe('simulateChangeCommands', () => {
  it('returns [] when nothing is tracked', () => {
    engine.getVFS().createFile('a.txt', 'hi'); // untracked
    expect(simulateChangeCommands(engine)).toEqual([]);
  });

  it('targets the first two tracked files alphabetically', () => {
    for (const f of ['b.txt', 'a.txt', 'c.txt']) {
      run(`touch ${f}`);
      run(`git add ${f}`);
    }
    run('git commit -m "seed"');
    const cmds = simulateChangeCommands(engine);
    expect(cmds).toHaveLength(2);
    expect(cmds[0]).toMatch(/^echo ".+" >> a\.txt$/);
    expect(cmds[1]).toMatch(/^echo ".+" >> b\.txt$/);
  });

  it('includes staged-but-uncommitted files as tracked', () => {
    run('touch a.txt');
    run('git add a.txt');
    expect(simulateChangeCommands(engine)).toHaveLength(1);
  });

  it('skips tracked files deleted from the VFS', () => {
    run('touch a.txt');
    run('git add a.txt');
    run('git commit -m "seed"');
    engine.getVFS().deleteFile('a.txt');
    expect(simulateChangeCommands(engine)).toEqual([]);
  });

  it('planned commands execute and dirty the file', () => {
    run('touch a.txt');
    run('git add a.txt');
    run('git commit -m "seed"');
    for (const cmd of simulateChangeCommands(engine)) run(cmd);
    expect(engine.getModifiedFiles()).toEqual(['a.txt']);
  });
});
