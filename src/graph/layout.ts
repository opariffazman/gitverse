import type { GraphNode, GraphEdge } from './types';

export const NODE_SPACING_X = 80;
export const LANE_SPACING_Y = 50;

export type LayoutResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
};

/**
 * Compute a left-to-right DAG layout for the given nodes.
 *
 * Expects nodes to arrive with hash/parents/message/branches/tags/isHEAD set.
 * The function assigns lane, x, and y then generates edges.
 *
 * Algorithm:
 * 1. Topological sort (parents before children via Kahn's algorithm on reversed edges).
 * 2. X position: (topoIndex + 1) * NODE_SPACING_X.
 * 3. Branch membership: walk backward from branch tips to assign commits
 *    to branches. Main/master gets priority.
 * 4. Lane assignment: inherit parent lane only when on the same branch.
 *    Different branch always gets a new lane.
 * 5. Y position: lane * LANE_SPACING_Y + LANE_SPACING_Y.
 * 6. Generate edges from each node to each of its parents.
 */
export function computeLayout(inputNodes: GraphNode[]): LayoutResult {
  if (inputNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // Build lookup map
  const nodeMap = new Map<string, GraphNode>();
  for (const n of inputNodes) {
    nodeMap.set(n.hash, { ...n });
  }

  // --- Topological sort (Kahn's algorithm) ---
  // "parents" in git means older commits. We want oldest → newest (left to right),
  // so we process parents before children.
  // In-degree: how many children (nodes whose parents list includes this hash) point to each node.
  const inDegree = new Map<string, number>();
  const childrenOf = new Map<string, string[]>(); // parent hash -> list of child hashes

  for (const n of nodeMap.values()) {
    if (!inDegree.has(n.hash)) inDegree.set(n.hash, 0);
    for (const p of n.parents) {
      if (!nodeMap.has(p)) continue; // skip refs to commits not in the set
      childrenOf.set(p, [...(childrenOf.get(p) ?? []), n.hash]);
      inDegree.set(p, inDegree.get(p) ?? 0); // ensure parent has an entry
    }
  }

  // For the topo sort we want: a node is ready when all its children have been placed.
  // Actually we want parents first. Use: a node is ready when it has no parents
  // (root commit) or all parents have been placed. Use child-count based in-degree.
  //
  // Redefine: in-degree here = number of parents (i.e., dependencies the node needs
  // to be resolved first).
  const dep = new Map<string, number>();
  for (const n of nodeMap.values()) {
    const validParents = n.parents.filter((p) => nodeMap.has(p));
    dep.set(n.hash, validParents.length);
  }

  const queue: string[] = [];
  for (const [hash, d] of dep) {
    if (d === 0) queue.push(hash);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const hash = queue.shift()!;
    topoOrder.push(hash);
    const children = childrenOf.get(hash) ?? [];
    for (const child of children) {
      const newDep = (dep.get(child) ?? 1) - 1;
      dep.set(child, newDep);
      if (newDep === 0) queue.push(child);
    }
  }

  // If there are nodes not in topoOrder (cycle or missing parents), append them
  for (const hash of nodeMap.keys()) {
    if (!topoOrder.includes(hash)) topoOrder.push(hash);
  }

  // --- Branch membership ---
  // Walk backward from each branch tip to assign commits to branches.
  // Main/master processed first so they claim the primary lane.
  const branchTips = new Map<string, string>();
  for (const n of nodeMap.values()) {
    for (const b of n.branches) {
      branchTips.set(b, n.hash);
    }
  }

  const branchOrder = [...branchTips.keys()].sort((a, b) => {
    if (a === 'main' || a === 'master') return -1;
    if (b === 'main' || b === 'master') return 1;
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

  // --- Lane assignment ---
  // Inherit parent lane only when on the same branch and parent hasn't
  // already given its lane to another child. Different branch = new lane.
  const childCountAssigned = new Map<string, number>();
  const laneOf = new Map<string, number>();
  let nextLane = 0;

  for (const hash of topoOrder) {
    const node = nodeMap.get(hash)!;
    const validParents = node.parents.filter((p) => nodeMap.has(p));
    const myBranch = commitBranch.get(hash);

    let assignedLane: number;

    if (validParents.length === 0) {
      assignedLane = nextLane++;
    } else {
      const firstParent = validParents[0];
      const parentLane = laneOf.get(firstParent);
      const parentBranch = commitBranch.get(firstParent);
      const parentChildCount = childCountAssigned.get(firstParent) ?? 0;
      const sameBranch = myBranch === parentBranch;

      if (parentChildCount === 0 && parentLane !== undefined && sameBranch) {
        assignedLane = parentLane;
      } else {
        assignedLane = nextLane++;
      }

      if (sameBranch) {
        childCountAssigned.set(firstParent, parentChildCount + 1);
      }

      for (let i = 1; i < validParents.length; i++) {
        const p = validParents[i];
        childCountAssigned.set(p, (childCountAssigned.get(p) ?? 0) + 1);
      }
    }

    laneOf.set(hash, assignedLane);
  }

  // --- Assign x, y positions ---
  const positioned: GraphNode[] = [];
  topoOrder.forEach((hash, index) => {
    const node = nodeMap.get(hash)!;
    const lane = laneOf.get(hash) ?? 0;
    const x = (index + 1) * NODE_SPACING_X;
    const y = lane * LANE_SPACING_Y + LANE_SPACING_Y;
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

  const maxX = positioned.reduce((m, n) => Math.max(m, n.x), 0) + NODE_SPACING_X;
  const maxY = positioned.reduce((m, n) => Math.max(m, n.y), 0) + LANE_SPACING_Y;

  return { nodes: positioned, edges, width: maxX, height: maxY };
}
