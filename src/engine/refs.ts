export type HEAD = {
  attached: boolean;
  target: string; // branch name (attached) or commit hash (detached)
};

export type Ref = {
  name: string;
  target: string; // commit hash
  type: 'branch' | 'tag';
};

export class RefStore {
  private head: HEAD;
  private branches: Map<string, string>; // name -> commit hash
  private tags: Map<string, string>; // name -> commit hash

  constructor() {
    this.head = { attached: true, target: 'main' };
    this.branches = new Map([['main', '']]);
    this.tags = new Map();
  }

  // --- HEAD ---

  getHEAD(): HEAD {
    return { ...this.head };
  }

  resolveHEAD(): string {
    if (this.head.attached) {
      return this.resolveBranch(this.head.target);
    }
    return this.head.target;
  }

  attachHEAD(branchName: string): void {
    this.head = { attached: true, target: branchName };
  }

  detachHEAD(commitHash: string): void {
    this.head = { attached: false, target: commitHash };
  }

  // --- Branches ---

  createBranch(name: string, target: string): void {
    if (this.branches.has(name)) {
      throw new Error(`Branch '${name}' already exists`);
    }
    this.branches.set(name, target);
  }

  resolveBranch(name: string): string {
    const target = this.branches.get(name);
    if (target === undefined) {
      throw new Error(`Branch '${name}' not found`);
    }
    return target;
  }

  updateBranch(name: string, target: string): void {
    if (!this.branches.has(name)) {
      throw new Error(`Branch '${name}' not found`);
    }
    this.branches.set(name, target);
  }

  deleteBranch(name: string): void {
    if (this.head.attached && this.head.target === name) {
      throw new Error(`Cannot delete branch '${name}': it is the current branch`);
    }
    this.branches.delete(name);
  }

  hasBranch(name: string): boolean {
    return this.branches.has(name);
  }

  listBranches(): string[] {
    return Array.from(this.branches.keys()).sort();
  }

  // --- Tags ---

  createTag(name: string, target: string): void {
    if (this.tags.has(name)) {
      throw new Error(`Tag '${name}' already exists`);
    }
    this.tags.set(name, target);
  }

  resolveTag(name: string): string {
    const target = this.tags.get(name);
    if (target === undefined) {
      throw new Error(`Tag '${name}' not found`);
    }
    return target;
  }

  deleteTag(name: string): void {
    this.tags.delete(name);
  }

  hasTag(name: string): boolean {
    return this.tags.has(name);
  }

  listTags(): string[] {
    return Array.from(this.tags.keys()).sort();
  }

  // --- Generic ref resolution ---

  resolveRef(name: string): string | null {
    if (this.branches.has(name)) {
      return this.branches.get(name)!;
    }
    if (this.tags.has(name)) {
      return this.tags.get(name)!;
    }
    return null;
  }
}
