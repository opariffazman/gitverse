import type { GraphNode, GraphEdge } from './types';

export const NODE_SPACING_X = 120;
export const LANE_SPACING_Y = 80;

export type Orientation = 'horizontal' | 'vertical';

export type LayoutResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  orientation: Orientation;
};

function nextAlternatingLane(branchIndex: number): number {
  if (branchIndex === 0) return 0;
  const side = branchIndex % 2 === 1 ? -1 : 1;
  const magnitude = Math.ceil(branchIndex / 2);
  return side * magnitude;
}

export function computeLayout(
  inputNodes: GraphNode[],
  orientation: Orientation = 'horizontal',
): LayoutResult {
  if (inputNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0, orientation };
  }

  const nodeMap = new Map<string, GraphNode>();
  for (const n of inputNodes) {
    nodeMap.set(n.hash, { ...n });
  }

  // --- Topological sort (Kahn's algorithm) ---
  const childrenOf = new Map<string, string[]>();

  for (const n of nodeMap.values()) {
    for (const p of n.parents) {
      if (!nodeMap.has(p)) continue;
      childrenOf.set(p, [...(childrenOf.get(p) ?? []), n.hash]);
    }
  }

  const dep = new Map<string, number>();
  for (const n of nodeMap.values()) {
    dep.set(n.hash, n.parents.filter((p) => nodeMap.has(p)).length);
  }

  const queue: string[] = [];
  for (const [hash, d] of dep) {
    if (d === 0) queue.push(hash);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const hash = queue.shift()!;
    topoOrder.push(hash);
    for (const child of childrenOf.get(hash) ?? []) {
      const newDep = (dep.get(child) ?? 1) - 1;
      dep.set(child, newDep);
      if (newDep === 0) queue.push(child);
    }
  }

  for (const hash of nodeMap.keys()) {
    if (!topoOrder.includes(hash)) topoOrder.push(hash);
  }

  // --- Branch membership ---
  const branchTips = new Map<string, string>();
  for (const n of nodeMap.values()) {
    for (const b of n.branches) {
      branchTips.set(b, n.hash);
    }
  }

  const primaryBranch = (n: string) => (n === 'main' ? 0 : n === 'master' ? 1 : 2);
  const branchOrder = [...branchTips.keys()].sort((a, b) => {
    const pa = primaryBranch(a);
    const pb = primaryBranch(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  const commitBranch = new Map<string, string>();
  for (const branch of branchOrder) {
    let current: string | undefined = branchTips.get(branch);
    while (current && nodeMap.has(current) && !commitBranch.has(current)) {
      commitBranch.set(current, branch);
      current = nodeMap.get(current)!.parents[0];
    }
  }

  // --- Alternating lane assignment ---
  const childCountAssigned = new Map<string, number>();
  const laneOf = new Map<string, number>();
  let branchCount = 0;
  const branchLane = new Map<string, number>();

  for (const hash of topoOrder) {
    const node = nodeMap.get(hash)!;
    const validParents = node.parents.filter((p) => nodeMap.has(p));
    const myBranch = commitBranch.get(hash);

    let assignedLane: number;

    if (validParents.length === 0) {
      assignedLane = nextAlternatingLane(branchCount++);
      if (myBranch && !branchLane.has(myBranch)) {
        branchLane.set(myBranch, assignedLane);
      }
    } else {
      const firstParent = validParents[0];
      const parentLane = laneOf.get(firstParent);
      const parentBranch = commitBranch.get(firstParent);
      const parentChildCount = childCountAssigned.get(firstParent) ?? 0;
      const sameBranch = myBranch === parentBranch;

      if (parentChildCount === 0 && parentLane !== undefined && sameBranch) {
        assignedLane = parentLane;
      } else if (myBranch && branchLane.has(myBranch)) {
        assignedLane = branchLane.get(myBranch)!;
      } else {
        assignedLane = nextAlternatingLane(branchCount++);
        if (myBranch && !branchLane.has(myBranch)) {
          branchLane.set(myBranch, assignedLane);
        }
      }

      if (sameBranch) {
        childCountAssigned.set(firstParent, parentChildCount + 1);
      }

      for (let i = 1; i < validParents.length; i++) {
        childCountAssigned.set(validParents[i], (childCountAssigned.get(validParents[i]) ?? 0) + 1);
      }
    }

    laneOf.set(hash, assignedLane);
  }

  // --- Assign x, y positions ---
  const allLanes = [...laneOf.values()];
  const minLane = Math.min(...allLanes);

  const commitSpacing = orientation === 'horizontal' ? NODE_SPACING_X : 70;
  const laneSpacing = orientation === 'horizontal' ? LANE_SPACING_Y : 120;

  const laneOffset = -minLane;

  const positioned: GraphNode[] = [];
  topoOrder.forEach((hash, index) => {
    const node = nodeMap.get(hash)!;
    const lane = laneOf.get(hash) ?? 0;
    const adjustedLane = lane + laneOffset;
    const x =
      orientation === 'horizontal'
        ? (index + 1) * commitSpacing
        : adjustedLane * laneSpacing + laneSpacing;
    const y =
      orientation === 'horizontal'
        ? adjustedLane * laneSpacing + laneSpacing
        : (index + 1) * commitSpacing;
    positioned.push({ ...node, lane, x, y });
  });

  // --- Generate edges ---
  const edges: GraphEdge[] = [];
  const posMap = new Map<string, { x: number; y: number }>();
  for (const n of positioned) {
    posMap.set(n.hash, { x: n.x, y: n.y });
  }

  for (const n of positioned) {
    for (const parentHash of n.parents) {
      const parentPos = posMap.get(parentHash);
      if (!parentPos) continue;
      edges.push({
        from: n.hash,
        to: parentHash,
        fromX: n.x,
        fromY: n.y,
        toX: parentPos.x,
        toY: parentPos.y,
      });
    }
  }

  const maxX = positioned.reduce((m, n) => Math.max(m, n.x), 0);
  const maxY = positioned.reduce((m, n) => Math.max(m, n.y), 0);

  return {
    nodes: positioned,
    edges,
    width: maxX + (orientation === 'horizontal' ? commitSpacing : laneSpacing),
    height: maxY + (orientation === 'horizontal' ? laneSpacing : commitSpacing),
    orientation,
  };
}
