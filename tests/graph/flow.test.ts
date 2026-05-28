import { describe, it, expect } from 'vitest';
import { buildActiveFlow, cubicSegment } from '$graph/flow';
import type { GraphNode } from '$graph/types';

function makeNode(hash: string, parents: string[], overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    hash,
    type: 'commit' as const,
    parents,
    message: `commit ${hash}`,
    branches: [],
    tags: [],
    isHEAD: false,
    lane: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe('cubicSegment', () => {
  it('horizontal: control points at mid-X', () => {
    expect(cubicSegment(0, 0, 100, 40, 'horizontal')).toBe('C 50 0, 50 40, 100 40');
  });

  it('vertical: control points at mid-Y', () => {
    expect(cubicSegment(0, 0, 40, 100, 'vertical')).toBe('C 0 50, 40 50, 40 100');
  });
});

describe('buildActiveFlow', () => {
  it('returns null when head hash is empty', () => {
    const nodes = [makeNode('a', [], { x: 10, y: 10 })];
    expect(buildActiveFlow(nodes, '', 'horizontal')).toBeNull();
  });

  it('returns null when head hash is not found', () => {
    const nodes = [makeNode('a', [], { x: 10, y: 10 })];
    expect(buildActiveFlow(nodes, 'zzz', 'horizontal')).toBeNull();
  });

  it('returns null for a single-node chain (root == head)', () => {
    const nodes = [makeNode('a', [], { x: 10, y: 10 })];
    expect(buildActiveFlow(nodes, 'a', 'horizontal')).toBeNull();
  });

  it('builds an ordered root -> head path for linear history', () => {
    // a (root) <- b <- c (head)
    const nodes = [
      makeNode('a', [], { x: 100, y: 50 }),
      makeNode('b', ['a'], { x: 200, y: 50 }),
      makeNode('c', ['b'], { x: 300, y: 50, isHEAD: true }),
    ];
    const flow = buildActiveFlow(nodes, 'c', 'horizontal');
    expect(flow).not.toBeNull();
    expect(flow!.segmentCount).toBe(2);
    // starts at the root (a), ends at the head (c)
    expect(flow!.d.startsWith('M 100 50')).toBe(true);
    expect(flow!.d.endsWith('300 50')).toBe(true);
  });

  it('follows first parent only at a merge commit', () => {
    // mainline: a <- b <- m(head); feature: a <- f; m merges b (first) + f (second)
    const nodes = [
      makeNode('a', [], { x: 100, y: 50 }),
      makeNode('b', ['a'], { x: 200, y: 50 }),
      makeNode('f', ['a'], { x: 200, y: 150 }),
      makeNode('m', ['b', 'f'], { x: 300, y: 50, isHEAD: true }),
    ];
    const flow = buildActiveFlow(nodes, 'm', 'horizontal');
    expect(flow).not.toBeNull();
    // chain is a -> b -> m (3 nodes, 2 hops); the second parent f is excluded
    expect(flow!.segmentCount).toBe(2);
    expect(flow!.d).not.toContain('200 150'); // f's position (x=200, y=150) never appears as a node endpoint
  });

  it('handles detached HEAD ending at an interior commit', () => {
    const nodes = [
      makeNode('a', [], { x: 100, y: 50 }),
      makeNode('b', ['a'], { x: 200, y: 50, isHEAD: true }),
      makeNode('c', ['b'], { x: 300, y: 50 }),
    ];
    const flow = buildActiveFlow(nodes, 'b', 'horizontal');
    expect(flow).not.toBeNull();
    expect(flow!.segmentCount).toBe(1); // a -> b only
    expect(flow!.d.endsWith('200 50')).toBe(true);
  });

  it('ignores phantom nodes', () => {
    const nodes = [makeNode('', [], { type: 'phantom', x: 168, y: 112 })];
    expect(buildActiveFlow(nodes, '', 'horizontal')).toBeNull();
  });
});
