import { describe, it, expect } from 'vitest';
import { parseInput } from '$shell/parser';

describe('parseInput – empty', () => {
  it('empty string → empty', () => {
    expect(parseInput('')).toEqual({ type: 'empty' });
  });

  it('whitespace-only → empty', () => {
    expect(parseInput('   ')).toEqual({ type: 'empty' });
    expect(parseInput('\t\n')).toEqual({ type: 'empty' });
  });
});

describe('parseInput – git commands', () => {
  it('"git" alone → git', () => {
    expect(parseInput('git')).toEqual({ type: 'git', raw: 'git' });
  });

  it('"git status" → git', () => {
    expect(parseInput('git status')).toEqual({ type: 'git', raw: 'git status' });
  });

  it('"git commit -m "hello world"" → git', () => {
    const r = parseInput('git commit -m "hello world"');
    expect(r.type).toBe('git');
  });

  it('leading/trailing whitespace is stripped', () => {
    const r = parseInput('  git log  ');
    expect(r).toEqual({ type: 'git', raw: 'git log' });
  });
});

describe('parseInput – builtins', () => {
  it('ls with no args', () => {
    expect(parseInput('ls')).toEqual({ type: 'builtin', command: 'ls', args: [] });
  });

  it('ls with dir arg', () => {
    expect(parseInput('ls src')).toEqual({ type: 'builtin', command: 'ls', args: ['src'] });
  });

  it('cat with file arg', () => {
    expect(parseInput('cat readme.txt')).toEqual({
      type: 'builtin',
      command: 'cat',
      args: ['readme.txt'],
    });
  });

  it('touch with file arg', () => {
    expect(parseInput('touch newfile.txt')).toEqual({
      type: 'builtin',
      command: 'touch',
      args: ['newfile.txt'],
    });
  });

  it('rm with file arg', () => {
    expect(parseInput('rm file.txt')).toEqual({
      type: 'builtin',
      command: 'rm',
      args: ['file.txt'],
    });
  });

  it('mv with src and dst', () => {
    expect(parseInput('mv a.txt b.txt')).toEqual({
      type: 'builtin',
      command: 'mv',
      args: ['a.txt', 'b.txt'],
    });
  });

  it('clear with no args', () => {
    expect(parseInput('clear')).toEqual({ type: 'builtin', command: 'clear', args: [] });
  });

  it('help with no args', () => {
    expect(parseInput('help')).toEqual({ type: 'builtin', command: 'help', args: [] });
  });

  it('sim is now unknown', () => {
    expect(parseInput('sim change readme.txt')).toEqual({
      type: 'unknown',
      command: 'sim',
    });
  });

  it('extra spaces between args are handled', () => {
    const r = parseInput('mv  a.txt  b.txt');
    expect(r.type).toBe('builtin');
    if (r.type === 'builtin') {
      expect(r.command).toBe('mv');
      expect(r.args).toEqual(['a.txt', 'b.txt']);
    }
  });
});

describe('parseInput – unknown', () => {
  it('unknown command', () => {
    expect(parseInput('vim file.txt')).toEqual({ type: 'unknown', command: 'vim' });
  });

  it('nano → unknown', () => {
    expect(parseInput('nano')).toEqual({ type: 'unknown', command: 'nano' });
  });

  it('echo → builtin', () => {
    expect(parseInput('echo hello')).toEqual({
      type: 'builtin',
      command: 'echo',
      args: ['hello'],
    });
  });

  it('classifies mkdir as a builtin', () => {
    const p = parseInput('mkdir src');
    expect(p).toEqual({ type: 'builtin', command: 'mkdir', args: ['src'] });
  });
});
