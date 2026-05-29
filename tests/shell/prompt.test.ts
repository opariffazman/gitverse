import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '$engine/index';
import { generatePrompt, type PromptSegment } from '$shell/prompt';

let engine: GitEngine;

function segmentText(segments: PromptSegment[]): string {
  return segments.map((s) => s.text).join('');
}

function segmentByText(segments: PromptSegment[], text: string): PromptSegment | undefined {
  return segments.find((s) => s.text.includes(text));
}

beforeEach(() => {
  engine = new GitEngine();
  engine.execute('git init');
});

describe('prompt — clean state', () => {
  it('shows repo name, branch icon, branch, and cursor', () => {
    const segs = generatePrompt(engine);
    const full = segmentText(segs);
    expect(full).toContain('gitverse');
    expect(full).toContain('');
    expect(full).toContain('main');
    expect(full).toContain('❯');
  });

  it('repo name is dim', () => {
    const segs = generatePrompt(engine);
    expect(segs[0].text).toBe('gitverse ');
    expect(segs[0].color).toBe('dim');
  });

  it('branch icon is cyan', () => {
    const segs = generatePrompt(engine);
    const icon = segmentByText(segs, '');
    expect(icon?.color).toBe('cyan');
  });

  it('branch name is green when clean', () => {
    const segs = generatePrompt(engine);
    const branch = segmentByText(segs, 'main');
    expect(branch?.color).toBe('green');
  });

  it('no +N ~N ?N segments when clean', () => {
    const segs = generatePrompt(engine);
    const full = segmentText(segs);
    expect(full).not.toMatch(/\+\d/);
    expect(full).not.toMatch(/~\d/);
    expect(full).not.toMatch(/\?\d/);
  });
});

describe('prompt — dirty state', () => {
  it('shows ?N for untracked files', () => {
    engine.getVFS().createFile('new.txt', 'content');
    const segs = generatePrompt(engine);
    const untracked = segmentByText(segs, '?1');
    expect(untracked).toBeDefined();
    expect(untracked?.color).toBe('dim');
  });

  it('shows +N for staged files in green', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.execute('git add a.txt');
    const segs = generatePrompt(engine);
    const staged = segmentByText(segs, '+1');
    expect(staged).toBeDefined();
    expect(staged?.color).toBe('green');
  });

  it('shows ~N for modified files in yellow', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    engine.getVFS().createFile('a.txt', 'modified');
    const segs = generatePrompt(engine);
    const modified = segmentByText(segs, '~1');
    expect(modified).toBeDefined();
    expect(modified?.color).toBe('yellow');
  });

  it('branch name is yellow when dirty', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    const segs = generatePrompt(engine);
    const branch = segmentByText(segs, 'main');
    expect(branch?.color).toBe('yellow');
  });
});

describe('prompt — detached HEAD (legacy checkout-by-hash)', () => {
  it('shows Cx label in red when detached via raw hash', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.execute('git add .');
    engine.execute('git commit -m "first"');
    const commitHash = engine.log()[0].hash;
    engine.execute('git checkout ' + commitHash);
    const segs = generatePrompt(engine);
    const label = segmentByText(segs, 'C1');
    expect(label).toBeDefined();
    expect(label?.color).toBe('red');
  });
});

describe('uninitialized state', () => {
  it('shows no branch segment when uninitialized', () => {
    const engine = new GitEngine();
    const segments = generatePrompt(engine);
    const text = segmentText(segments);
    expect(text).not.toContain('main');
    expect(text).toContain('gitverse');
    expect(text).toContain('❯');
  });

  it('shows branch after init', () => {
    const engine = new GitEngine();
    engine.execute('git init');
    const segments = generatePrompt(engine);
    const text = segmentText(segments);
    expect(text).toContain('main');
  });
});

describe('prompt — deleted files', () => {
  it('shows -N for deleted files in red', () => {
    engine.getVFS().createFile('a.txt', 'aaa');
    engine.execute('git add .');
    engine.execute('git commit -m "init"');
    engine.getVFS().deleteFile('a.txt');
    const segs = generatePrompt(engine);
    const deleted = segmentByText(segs, '-1');
    expect(deleted).toBeDefined();
    expect(deleted?.color).toBe('red');
  });
});

describe('prompt — detached HEAD', () => {
  it('shows the Cx label, not a raw hash', () => {
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "first"');
    engine.execute('git checkout C1'); // detach at C1

    const segs = generatePrompt(engine);
    expect(segmentByText(segs, 'C1')).toBeDefined();
    expect(segs.some((s) => /^[0-9a-f]{7}$/.test(s.text))).toBe(false);
  });

  it('detached label is red', () => {
    engine.getVFS().createFile('a.txt', 'a');
    engine.execute('git add a.txt');
    engine.execute('git commit -m "first"');
    engine.execute('git checkout C1');
    const segs = generatePrompt(engine);
    expect(segmentByText(segs, 'C1')?.color).toBe('red');
  });
});
