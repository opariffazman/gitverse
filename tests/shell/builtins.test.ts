import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { executeBuiltin } from '$shell/builtins';
import { ShellRouter } from '$shell/router';

let engine: GitEngine;

beforeEach(() => {
  engine = new GitEngine();
});

describe('ls', () => {
  it('returns empty string for empty VFS', () => {
    const r = executeBuiltin(engine, 'ls', []);
    expect(r.exitCode).toBe(0);
    expect(r.output).toBe('');
  });

  it('lists root files', () => {
    engine.getVFS().createFile('foo.txt', 'hello');
    engine.getVFS().createFile('bar.txt', 'world');
    const r = executeBuiltin(engine, 'ls', []);
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('foo.txt');
    expect(r.output).toContain('bar.txt');
  });

  it('lists a subdirectory', () => {
    engine.getVFS().createDir('src');
    engine.getVFS().createFile('src/main.ts', 'content');
    const r = executeBuiltin(engine, 'ls', ['src']);
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('main.ts');
  });

  it('returns empty for non-existent directory', () => {
    const r = executeBuiltin(engine, 'ls', ['nonexistent']);
    expect(r.exitCode).toBe(0);
    expect(r.output).toBe('');
  });
});

describe('cat', () => {
  it('errors with no args', () => {
    const r = executeBuiltin(engine, 'cat', []);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('missing operand');
  });

  it('errors for missing file', () => {
    const r = executeBuiltin(engine, 'cat', ['nope.txt']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('No such file');
  });

  it('returns file content', () => {
    engine.getVFS().createFile('hello.txt', 'Hello World');
    const r = executeBuiltin(engine, 'cat', ['hello.txt']);
    expect(r.exitCode).toBe(0);
    expect(r.output).toBe('Hello World');
  });
});

describe('touch', () => {
  it('errors with no args', () => {
    const r = executeBuiltin(engine, 'touch', []);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('missing operand');
  });

  it('creates a file with auto-generated content', () => {
    const r = executeBuiltin(engine, 'touch', ['new.txt']);
    expect(r.exitCode).toBe(0);
    expect(r.output).toBe('');
    expect(engine.getVFS().exists('new.txt')).toBe(true);
    const content = engine.getVFS().readFile('new.txt');
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(0);
  });

  it('no-ops if file already exists', () => {
    engine.getVFS().createFile('exists.txt', 'original');
    const r = executeBuiltin(engine, 'touch', ['exists.txt']);
    expect(r.exitCode).toBe(0);
    // Content should not change
    expect(engine.getVFS().readFile('exists.txt')).toBe('original');
  });

  it('errors for path in non-existent directory', () => {
    const r = executeBuiltin(engine, 'touch', ['nodir/file.txt']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('No such file or directory');
  });
});

describe('rm', () => {
  it('errors with no args', () => {
    const r = executeBuiltin(engine, 'rm', []);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('missing operand');
  });

  it('errors for missing file', () => {
    const r = executeBuiltin(engine, 'rm', ['ghost.txt']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('No such file');
  });

  it('deletes a file', () => {
    engine.getVFS().createFile('bye.txt', 'bye');
    const r = executeBuiltin(engine, 'rm', ['bye.txt']);
    expect(r.exitCode).toBe(0);
    expect(engine.getVFS().exists('bye.txt')).toBe(false);
  });
});

describe('mv', () => {
  it('errors with insufficient args', () => {
    const r = executeBuiltin(engine, 'mv', ['only.txt']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('missing destination');
  });

  it('errors when source missing', () => {
    const r = executeBuiltin(engine, 'mv', ['ghost.txt', 'dest.txt']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('No such file');
  });

  it('moves a file', () => {
    engine.getVFS().createFile('old.txt', 'content');
    const r = executeBuiltin(engine, 'mv', ['old.txt', 'new.txt']);
    expect(r.exitCode).toBe(0);
    expect(engine.getVFS().exists('old.txt')).toBe(false);
    expect(engine.getVFS().exists('new.txt')).toBe(true);
    expect(engine.getVFS().readFile('new.txt')).toBe('content');
  });
});

describe('clear', () => {
  it('returns the CLEAR escape marker', () => {
    const r = executeBuiltin(engine, 'clear', []);
    expect(r.exitCode).toBe(0);
    expect(r.output).toBe('\x1b[CLEAR]');
  });
});

describe('help', () => {
  it('returns help text with exit 0', () => {
    const r = executeBuiltin(engine, 'help', []);
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('git');
    expect(r.output).toContain('ls');
    expect(r.output).toContain('touch');
    expect(r.output).toContain('sim');
  });
});

describe('sim', () => {
  it('errors for unknown subcommand', () => {
    const r = executeBuiltin(engine, 'sim', ['foo']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('unknown subcommand');
  });

  it('errors with no subcommand', () => {
    const r = executeBuiltin(engine, 'sim', []);
    expect(r.exitCode).toBe(1);
  });

  it('errors for missing file operand', () => {
    const r = executeBuiltin(engine, 'sim', ['change']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('missing file operand');
  });

  it('errors for non-existent file', () => {
    const r = executeBuiltin(engine, 'sim', ['change', 'ghost.txt']);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('No such file');
  });

  it('mutates an existing file', () => {
    engine.getVFS().createFile('readme.txt', 'original content');
    const r = executeBuiltin(engine, 'sim', ['change', 'readme.txt']);
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('readme.txt');
    // File content should differ from original
    const newContent = engine.getVFS().readFile('readme.txt');
    expect(newContent).not.toBe('original content');
  });
});

describe('VFS-mutating builtins trigger status change', () => {
  it('rm on committed file makes engine dirty', () => {
    engine.getVFS().createFile('tracked.txt', 'content');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    expect(engine.isDirty()).toBe(false);

    const router = new ShellRouter(engine);
    router.execute('rm tracked.txt');
    expect(engine.isDirty()).toBe(true);
  });

  it('touch creates untracked file visible to engine', () => {
    const router = new ShellRouter(engine);
    router.execute('touch newfile.txt');
    expect(engine.getUntrackedFiles()).toContain('newfile.txt');
  });

  it('mv on committed file makes engine dirty', () => {
    engine.getVFS().createFile('a.txt', 'content');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');

    const router = new ShellRouter(engine);
    router.execute('mv a.txt b.txt');
    expect(engine.isDirty()).toBe(true);
  });
});

describe('unknown command', () => {
  it('returns command not found', () => {
    const r = executeBuiltin(engine, 'foobar', []);
    expect(r.exitCode).toBe(127);
    expect(r.output).toContain('command not found');
  });
});
