import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { ShellRouter } from '$shell/router';

let engine: GitEngine;
let router: ShellRouter;

beforeEach(() => {
  engine = new GitEngine();
  router = new ShellRouter(engine);
});

describe('ShellRouter – empty input', () => {
  it('empty string → exit 0, empty output', () => {
    const r = router.execute('');
    expect(r.exitCode).toBe(0);
    expect(r.output).toBe('');
  });

  it('whitespace-only → exit 0', () => {
    const r = router.execute('   ');
    expect(r.exitCode).toBe(0);
  });
});

describe('ShellRouter – git commands', () => {
  it('routes "git status" to engine', () => {
    const r = router.execute('git status');
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('nothing to commit');
  });

  it('routes "git add" after creating a file', () => {
    engine.getVFS().createFile('hello.txt', 'hello');
    const r = router.execute('git add hello.txt');
    expect(r.exitCode).toBe(0);
  });

  it('routes "git log" and returns empty when no commits', () => {
    const r = router.execute('git log');
    expect(r.exitCode).toBe(0);
  });

  it('routes invalid git subcommand and returns error', () => {
    const r = router.execute('git frobnicate');
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('not a git command');
  });
});

describe('ShellRouter – builtins', () => {
  it('routes "ls" to builtin', () => {
    engine.getVFS().createFile('file.txt', 'content');
    const r = router.execute('ls');
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('file.txt');
  });

  it('routes "cat <file>" to builtin', () => {
    engine.getVFS().createFile('readme.txt', 'readme content');
    const r = router.execute('cat readme.txt');
    expect(r.exitCode).toBe(0);
    expect(r.output).toBe('readme content');
  });

  it('routes "touch <file>" to builtin', () => {
    const r = router.execute('touch newfile.ts');
    expect(r.exitCode).toBe(0);
    expect(engine.getVFS().exists('newfile.ts')).toBe(true);
  });

  it('routes "clear" to builtin and returns escape marker', () => {
    const r = router.execute('clear');
    expect(r.exitCode).toBe(0);
    expect(r.output).toBe('\x1b[CLEAR]');
  });

  it('routes "help" to builtin', () => {
    const r = router.execute('help');
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('git');
  });
});

describe('ShellRouter – unknown commands', () => {
  it('returns command not found for unknown command', () => {
    const r = router.execute('vim file.txt');
    expect(r.exitCode).toBe(127);
    expect(r.output).toContain('command not found');
  });

  it('unknown command name is included in error', () => {
    const r = router.execute('bash');
    expect(r.output).toContain('bash');
  });
});

describe('ShellRouter – integration: git workflow', () => {
  it('add + commit via router', () => {
    engine.getVFS().createFile('app.js', 'console.log("hi")');
    expect(router.execute('git add app.js').exitCode).toBe(0);
    expect(router.execute('git commit -m "init"').exitCode).toBe(0);
    const log = router.execute('git log');
    expect(log.exitCode).toBe(0);
    expect(log.output).toContain('init');
  });

  it('touch creates file visible to git add', () => {
    router.execute('touch data.txt');
    expect(engine.getVFS().exists('data.txt')).toBe(true);
    const r = router.execute('git add data.txt');
    expect(r.exitCode).toBe(0);
  });
});
