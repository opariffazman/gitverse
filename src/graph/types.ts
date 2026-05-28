export type GraphNode = {
  hash: string;
  type: 'commit' | 'phantom';
  parents: string[];
  message: string;
  /** Friendly creation-order label (e.g. "C3"). Absent for phantom nodes. */
  label?: string;
  branches: string[];
  tags?: string[];
  isHEAD: boolean;
  lane: number;
  x: number;
  y: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};
