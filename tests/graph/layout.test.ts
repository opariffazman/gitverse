import { describe, it, expect } from 'vitest';
import { computeLayout, NODE_SPACING_X, LANE_SPACING_Y } from '$graph/layout';
import type { Orientation } from '$graph/layout';
import type { GraphNode } from '$graph/types';

function makeNode(hash: string, parents: string[], overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    hash,
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

describe('computeLayout – empty', () => {
  it('returns empty result for empty input', () => {
    const { nodes, edges, width, height } = computeLayout([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
    expect(width).toBe(0);
    expect(height).toBe(0);
  });
});

describe('computeLayout – single commit', () => {
  it('positions at first slot', () => {
    const nodes = [makeNode('aaa', [])];
    const { nodes: out } = computeLayout(nodes);
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(NODE_SPACING_X);
  });

  it('assigns lane 0 to root', () => {
    const nodes = [makeNode('aaa', [])];
    const { nodes: out } = computeLayout(nodes);
    expect(out[0].lane).toBe(0);
  });

  it('no edges for single commit', () => {
    const { edges } = computeLayout([makeNode('aaa', [])]);
    expect(edges).toHaveLength(0);
  });
});

describe('computeLayout – linear chain', () => {
  const root = makeNode('root', []);
  const A = makeNode('A', ['root']);
  const B = makeNode('B', ['A']);

  it('orders left-to-right', () => {
    const { nodes } = computeLayout([root, A, B]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.x).toBeLessThan(byHash.get('A')!.x);
    expect(byHash.get('A')!.x).toBeLessThan(byHash.get('B')!.x);
  });

  it('all share lane 0', () => {
    const { nodes } = computeLayout([root, A, B]);
    for (const n of nodes) expect(n.lane).toBe(0);
  });

  it('generates correct edges', () => {
    const { edges } = computeLayout([root, A, B]);
    const pairs = edges.map((e) => `${e.from}→${e.to}`).sort();
    expect(pairs).toContain('A→root');
    expect(pairs).toContain('B→A');
  });
});

describe('computeLayout – alternating branch lanes', () => {
  it('first branch goes to lane -1 (below main)', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root'], { branches: ['main'] });
    const B = makeNode('B', ['root'], { branches: ['feat1'] });
    const { nodes } = computeLayout([root, A, B]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.lane).toBe(0);
    expect(byHash.get('A')!.lane).toBe(0);
    expect(byHash.get('B')!.lane).toBe(-1);
  });

  it('second branch goes to lane +1 (above main)', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A'], { branches: ['main'] });
    const C = makeNode('C', ['A'], { branches: ['feat1'] });
    const D = makeNode('D', ['A'], { branches: ['feat2'] });
    const { nodes } = computeLayout([root, A, B, C, D]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('C')!.lane).toBe(-1);
    expect(byHash.get('D')!.lane).toBe(1);
  });

  it('third branch goes to lane -2', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root'], { branches: ['main'] });
    const B = makeNode('B', ['root'], { branches: ['feat1'] });
    const C = makeNode('C', ['root'], { branches: ['feat2'] });
    const D = makeNode('D', ['root'], { branches: ['feat3'] });
    const { nodes } = computeLayout([root, A, B, C, D]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('B')!.lane).toBe(-1);
    expect(byHash.get('C')!.lane).toBe(1);
    expect(byHash.get('D')!.lane).toBe(-2);
  });
});

describe('computeLayout – merge commit', () => {
  it('generates edges from merge to both parents', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['root']);
    const merge = makeNode('merge', ['A', 'B']);
    const { edges } = computeLayout([root, A, B, merge]);
    const pairs = new Set(edges.map((e) => `${e.from}→${e.to}`));
    expect(pairs.has('merge→A')).toBe(true);
    expect(pairs.has('merge→B')).toBe(true);
  });

  it('merge appears after both parents in X', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['root']);
    const merge = makeNode('merge', ['A', 'B']);
    const { nodes } = computeLayout([root, A, B, merge]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('merge')!.x).toBeGreaterThan(byHash.get('A')!.x);
    expect(byHash.get('merge')!.x).toBeGreaterThan(byHash.get('B')!.x);
  });
});

describe('computeLayout – edge coordinates', () => {
  it('edge coords match node positions', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const { nodes, edges } = computeLayout([root, A]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    const edge = edges.find((e) => e.from === 'A' && e.to === 'root')!;
    expect(edge.fromX).toBe(byHash.get('A')!.x);
    expect(edge.fromY).toBe(byHash.get('A')!.y);
    expect(edge.toX).toBe(byHash.get('root')!.x);
    expect(edge.toY).toBe(byHash.get('root')!.y);
  });
});

describe('computeLayout – main keeps lane 0', () => {
  it('main branch commits stay on lane 0', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A']);
    const C = makeNode('C', ['B'], { branches: ['main'] });
    const D = makeNode('D', ['B'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B, C, D]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.lane).toBe(0);
    expect(byHash.get('A')!.lane).toBe(0);
    expect(byHash.get('B')!.lane).toBe(0);
    expect(byHash.get('C')!.lane).toBe(0);
    expect(byHash.get('D')!.lane).not.toBe(0);
  });
});

describe('computeLayout – merge across branches', () => {
  it('merge commit rejoins the main lane', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A']);
    const C = makeNode('C', ['B']);
    const D = makeNode('D', ['A'], { branches: ['feat'] });
    const M = makeNode('M', ['C', 'D'], { branches: ['main'] });
    const { nodes, edges } = computeLayout([root, A, B, C, D, M]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('M')!.lane).toBe(byHash.get('root')!.lane);
    expect(byHash.get('D')!.lane).not.toBe(byHash.get('root')!.lane);
    const pairs = new Set(edges.map((e) => `${e.from}→${e.to}`));
    expect(pairs.has('M→C')).toBe(true);
    expect(pairs.has('M→D')).toBe(true);
  });
});

describe('computeLayout – vertical orientation', () => {
  const vert: Orientation = 'vertical';

  it('commits stack top-to-bottom, lanes go left-to-right', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const { nodes } = computeLayout([root, A], vert);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.y).toBeLessThan(byHash.get('A')!.y);
    expect(byHash.get('root')!.x).toBe(byHash.get('A')!.x);
  });

  it('branches go left-to-right in vertical mode', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root'], { branches: ['main'] });
    const B = makeNode('B', ['root'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B], vert);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('A')!.x).not.toBe(byHash.get('B')!.x);
  });

  it('returns orientation in result', () => {
    const { orientation } = computeLayout([makeNode('a', [])], vert);
    expect(orientation).toBe('vertical');
  });

  it('returns horizontal orientation by default', () => {
    const { orientation } = computeLayout([makeNode('a', [])]);
    expect(orientation).toBe('horizontal');
  });
});
