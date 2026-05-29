import type { GraphNode } from './types';
import type { Orientation } from './layout';

/**
 * One cubic-Bézier command (no leading `M`) from (fromX,fromY) to (toX,toY).
 * Mirrors the curve shape used by edges so the flow rides the same wires.
 */
export function cubicSegment(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  orientation: Orientation,
): string {
  if (orientation === 'horizontal') {
    const midX = (fromX + toX) / 2;
    return `C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  }
  const midY = (fromY + toY) / 2;
  return `C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}

/**
 * Builds the active-branch flow path: the first-parent chain from the root
 * commit to the HEAD commit, as a single connected SVG path string.
 * Returns null when there is no drawable flow (<2 real nodes).
 */
export function buildActiveFlow(
  nodes: GraphNode[],
  headCommitHash: string,
  orientation: Orientation,
): { d: string; segmentCount: number } | null {
  if (!headCommitHash) return null;

  const byHash = new Map<string, GraphNode>();
  for (const n of nodes) {
    if (n.type === 'phantom' || !n.hash) continue;
    byHash.set(n.hash, n);
  }

  let cur = byHash.get(headCommitHash);
  if (!cur) return null;

  // Walk first-parent ancestry HEAD -> root.
  const chain: GraphNode[] = [];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.hash)) {
    seen.add(cur.hash);
    chain.push(cur);
    const parent: string | undefined = cur.parents[0];
    cur = parent ? byHash.get(parent) : undefined;
  }

  chain.reverse(); // root -> HEAD
  if (chain.length < 2) return null;

  let d = `M ${chain[0].x} ${chain[0].y}`;
  for (let i = 1; i < chain.length; i++) {
    const from = chain[i - 1];
    const to = chain[i];
    d += ` ${cubicSegment(from.x, from.y, to.x, to.y, orientation)}`;
  }

  return { d, segmentCount: chain.length - 1 };
}
