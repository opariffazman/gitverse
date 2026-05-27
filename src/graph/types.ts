export type GraphNode = {
  hash: string;
  type: 'commit' | 'phantom';
  parents: string[];
  message: string;
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
