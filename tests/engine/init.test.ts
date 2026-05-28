import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';

describe('GitEngine – git init', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
  });

  it('fresh engine is uninitialized', () => {
    expect(engine.isInitialized()).toBe(false);
  });

  it('has no branches before init', () => {
    expect(engine.allBranches().size).toBe(0);
  });

  it('git init initializes repository', () => {
    const result = engine.execute('git init');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Initialized empty Git repository');
    expect(engine.isInitialized()).toBe(true);
  });

  it('creates main branch on init', () => {
    engine.execute('git init');
    const head = engine.getHEAD();
    expect(head.attached).toBe(true);
    expect(head.target).toBe('main');
    expect(engine.allBranches().has('main')).toBe(true);
  });

  it('creates .git/ directory on init', () => {
    engine.execute('git init');
    expect(engine.getVFS().exists('.git/')).toBe(true);
  });

  it('returns "Reinitialized" on double init', () => {
    engine.execute('git init');
    const result = engine.execute('git init');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Reinitialized');
  });

  it('gates git commands before init', () => {
    const result = engine.execute('git add .');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('fatal: not a git repository');
  });

  it('allows git commands after init', () => {
    engine.execute('git init');
    engine.getVFS().createFile('test.txt', 'hello');
    const result = engine.execute('git add test.txt');
    expect(result.exitCode).toBe(0);
  });
});
