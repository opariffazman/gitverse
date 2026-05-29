import { describe, it, expect } from 'vitest';
import { parseGitCommand } from '$engine/index';

describe('parseGitCommand — clustered short flags', () => {
  it('splits -am into -a and -m, value binds to the last', () => {
    const { command, opts } = parseGitCommand('git commit -am "hello world"');
    expect(command).toBe('commit');
    expect(opts.has('-a')).toBe(true);
    expect(opts.get('-a')).toEqual([]);
    expect(opts.get('-m')).toEqual(['hello world']);
  });

  it('leaves long flags untouched', () => {
    const { opts } = parseGitCommand('git reset --hard HEAD');
    expect(opts.has('--hard')).toBe(true);
    expect(opts.has('-h')).toBe(false);
    expect(opts.has('-a')).toBe(false);
  });

  it('leaves single short flags untouched', () => {
    const { opts } = parseGitCommand('git checkout -b feature');
    expect(opts.get('-b')).toEqual(['feature']);
  });

  it('splits a 3-letter cluster, value binds to the last', () => {
    const { opts } = parseGitCommand('git commit -nam "x"');
    expect(opts.has('-n')).toBe(true);
    expect(opts.has('-a')).toBe(true);
    expect(opts.get('-m')).toEqual(['x']);
  });
});
