import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { ShellRouter } from '$shell/router';

let engine: GitEngine;
let router: ShellRouter;

beforeEach(() => {
  engine = new GitEngine();
  engine.execute('git init');
  router = new ShellRouter(engine);
});

describe('echo builtin', () => {
  it('prints text when there is no redirect', () => {
    expect(router.execute('echo hello world').output).toBe('hello world');
  });
  it('echo > file overwrites content', () => {
    router.execute('echo first > f.txt');
    router.execute('echo second > f.txt');
    expect(engine.getVFS().readFile('f.txt')).toBe('second');
  });
  it('echo >> file appends on a new line', () => {
    router.execute('echo line1 > f.txt');
    router.execute('echo line2 >> f.txt');
    expect(engine.getVFS().readFile('f.txt')).toBe('line1\nline2');
  });
  it('echo >> creates the file if missing', () => {
    router.execute('echo only >> new.txt');
    expect(engine.getVFS().readFile('new.txt')).toBe('only');
  });
  it('strips one outer pair of double quotes', () => {
    router.execute('echo "hello world" > q.txt');
    expect(engine.getVFS().readFile('q.txt')).toBe('hello world');
  });
  it('echo > file with no text writes an empty file', () => {
    router.execute('echo > empty.txt');
    expect(engine.getVFS().readFile('empty.txt')).toBe('');
  });
  it('errors with no redirect target', () => {
    const res = router.execute('echo hi >');
    expect(res.exitCode).not.toBe(0);
    expect(res.output).toContain('missing redirect target');
  });

  it('strips quotes even across multiple quoted tokens', () => {
    router.execute('echo "a" "b" > m.txt');
    expect(engine.getVFS().readFile('m.txt')).toBe('a b');
  });

  it('overwrite after append resets the file', () => {
    router.execute('echo one >> f.txt');
    router.execute('echo two >> f.txt');
    router.execute('echo fresh > f.txt');
    expect(engine.getVFS().readFile('f.txt')).toBe('fresh');
  });

  it('no-redirect print strips quotes too', () => {
    expect(router.execute('echo "hi there"').output).toBe('hi there');
  });
});
