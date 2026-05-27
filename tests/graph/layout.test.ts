import { describe, it, expect } from 'vitest';
import { computeLayout, NODE_SPACING_X, LANE_SPACING_Y } from '$graph/layout';
import type { GraphNode } from '$graph/types';

// Helper to build a minimal GraphNode
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

describe('computeLayout – single commit', () => {
  it('positions the only commit at (1*NODE_SPACING_X, 1*LANE_SPACING_Y)', () => {
    const nodes = [makeNode('aaa', [])];
    const { nodes: out } = computeLayout(nodes);
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(NODE_SPACING_X);
    expect(out[0].y).toBe(LANE_SPACING_Y);
  });

  it('assigns lane 0 to the root commit', () => {
    const nodes = [makeNode('aaa', [])];
    const { nodes: out } = computeLayout(nodes);
    expect(out[0].lane).toBe(0);
  });

  it('returns no edges for a single commit', () => {
    const nodes = [makeNode('aaa', [])];
    const { edges } = computeLayout(nodes);
    expect(edges).toHaveLength(0);
  });
});

describe('computeLayout – linear chain', () => {
  // root → A → B (B is newest)
  const root = makeNode('root', []);
  const A = makeNode('A', ['root']);
  const B = makeNode('B', ['A']);

  it('orders commits left-to-right: root, A, B', () => {
    const { nodes } = computeLayout([root, A, B]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.x).toBeLessThan(byHash.get('A')!.x);
    expect(byHash.get('A')!.x).toBeLessThan(byHash.get('B')!.x);
  });

  it('all linear commits share lane 0', () => {
    const { nodes } = computeLayout([root, A, B]);
    for (const n of nodes) {
      expect(n.lane).toBe(0);
    }
  });

  it('X spacing equals NODE_SPACING_X between adjacent commits', () => {
    const { nodes } = computeLayout([root, A, B]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('A')!.x - byHash.get('root')!.x).toBe(NODE_SPACING_X);
    expect(byHash.get('B')!.x - byHash.get('A')!.x).toBe(NODE_SPACING_X);
  });

  it('generates edges root→A and A→B', () => {
    const { edges } = computeLayout([root, A, B]);
    const pairs = edges.map((e) => `${e.from}→${e.to}`).sort();
    expect(pairs).toContain('A→root');
    expect(pairs).toContain('B→A');
  });
});

describe('computeLayout – branching', () => {
  // root → A (main) and root → C (feature branch from root)
  const root = makeNode('root', []);
  const A = makeNode('A', ['root']); // main continues
  const C = makeNode('C', ['root']); // branch off root

  it('assigns different lanes to branching commits', () => {
    const { nodes } = computeLayout([root, A, C]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    // A and C both branch from root, they should be on different lanes
    expect(byHash.get('A')!.lane).not.toBe(byHash.get('C')!.lane);
  });

  it('root gets lane 0', () => {
    const { nodes } = computeLayout([root, A, C]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.lane).toBe(0);
  });

  it('branch commits get distinct Y positions', () => {
    const { nodes } = computeLayout([root, A, C]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('A')!.y).not.toBe(byHash.get('C')!.y);
  });

  it('generates edges A→root and C→root', () => {
    const { edges } = computeLayout([root, A, C]);
    const pairs = edges.map((e) => `${e.from}→${e.to}`).sort();
    expect(pairs).toContain('A→root');
    expect(pairs).toContain('C→root');
  });
});

describe('computeLayout – merge commit', () => {
  // root → A → merge; root → B → merge
  const root = makeNode('root', []);
  const A = makeNode('A', ['root']);
  const B = makeNode('B', ['root']);
  const merge = makeNode('merge', ['A', 'B']);

  it('generates edges from merge to both parents', () => {
    const { edges } = computeLayout([root, A, B, merge]);
    const pairs = new Set(edges.map((e) => `${e.from}→${e.to}`));
    expect(pairs.has('merge→A')).toBe(true);
    expect(pairs.has('merge→B')).toBe(true);
  });

  it('merge commit appears after both parents in X', () => {
    const { nodes } = computeLayout([root, A, B, merge]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('merge')!.x).toBeGreaterThan(byHash.get('A')!.x);
    expect(byHash.get('merge')!.x).toBeGreaterThan(byHash.get('B')!.x);
  });
});

describe('computeLayout – edge coordinates', () => {
  it('edge fromX/fromY match source node position', () => {
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

describe('computeLayout – empty input', () => {
  it('returns empty result for empty input', () => {
    const { nodes, edges, width, height } = computeLayout([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
    expect(width).toBe(0);
    expect(height).toBe(0);
  });
});

describe('computeLayout – branch divergence with named branches', () => {
  it('feat branch from main tip gets a different lane', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root'], { branches: ['main'] });
    const B = makeNode('B', ['A'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.lane).toBe(byHash.get('A')!.lane);
    expect(byHash.get('B')!.lane).not.toBe(byHash.get('A')!.lane);
  });

  it('main branch keeps lane 0 while feat gets lane 1', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A'], { branches: ['main'] });
    const C = makeNode('C', ['A'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B, C]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get('root')!.lane).toBe(0);
    expect(byHash.get('A')!.lane).toBe(0);
    expect(byHash.get('B')!.lane).toBe(0);
    expect(byHash.get('C')!.lane).not.toBe(0);
  });
});

describe('computeLayout – parallel branches', () => {
  it('long main and feat branches stay on separate lanes', () => {
    const root = makeNode('root', []);
    const A = makeNode('A', ['root']);
    const B = makeNode('B', ['A']);
    const C = makeNode('C', ['B'], { branches: ['main'] });
    const D = makeNode('D', ['B'], { branches: ['feat'] });
    const { nodes } = computeLayout([root, A, B, C, D]);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    const mainLane = byHash.get('root')!.lane;
    expect(byHash.get('A')!.lane).toBe(mainLane);
    expect(byHash.get('B')!.lane).toBe(mainLane);
    expect(byHash.get('C')!.lane).toBe(mainLane);
    expect(byHash.get('D')!.lane).not.toBe(mainLane);
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
