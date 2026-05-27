export type FileEntry = {
  content: string;
  type: 'file' | 'dir';
};

export class VirtualFileSystem {
  private store: Map<string, FileEntry> = new Map();

  /**
   * Creates (or overwrites) a file at the given path.
   * If path contains a '/', the directory component must already exist.
   */
  createFile(path: string, content: string): void {
    const slashIdx = path.indexOf('/');
    if (slashIdx !== -1) {
      const dir = path.substring(0, slashIdx);
      const dirKey = dir + '/';
      if (!this.store.has(dirKey) || this.store.get(dirKey)!.type !== 'dir') {
        throw new Error(`Directory "${dir}" does not exist`);
      }
    }
    this.store.set(path, { content, type: 'file' });
  }

  /**
   * Reads the content of the file at path.
   * Throws if not found.
   */
  readFile(path: string): string {
    const entry = this.store.get(path);
    if (entry === undefined || entry.type !== 'file') {
      throw new Error(`File not found: "${path}"`);
    }
    return entry.content;
  }

  /**
   * Returns true if a file or directory entry exists at path.
   */
  exists(path: string): boolean {
    return this.store.has(path);
  }

  /**
   * Deletes the file at path.
   * Throws if not found.
   */
  deleteFile(path: string): void {
    if (!this.store.has(path)) {
      throw new Error(`File not found: "${path}"`);
    }
    this.store.delete(path);
  }

  /**
   * Moves a file from src to dst.
   * Throws if src not found. If dst has a '/', the directory must already exist.
   */
  moveFile(src: string, dst: string): void {
    const entry = this.store.get(src);
    if (entry === undefined || entry.type !== 'file') {
      throw new Error(`Source file not found: "${src}"`);
    }

    // Validate destination directory if needed
    const slashIdx = dst.indexOf('/');
    if (slashIdx !== -1) {
      const dir = dst.substring(0, slashIdx);
      const dirKey = dir + '/';
      if (!this.store.has(dirKey) || this.store.get(dirKey)!.type !== 'dir') {
        throw new Error(`Directory "${dir}" does not exist`);
      }
    }

    this.store.delete(src);
    this.store.set(dst, { content: entry.content, type: 'file' });
  }

  /**
   * Creates a directory entry. Name must NOT contain '/' (max 1 level nesting).
   */
  createDir(name: string): void {
    if (name.includes('/')) {
      throw new Error(`Directory name must not contain '/': "${name}"`);
    }
    this.store.set(name + '/', { content: '', type: 'dir' });
  }

  /**
   * Lists entries in a directory.
   * - No arg (root): returns root-level file names + directory markers (e.g. "src/"), sorted.
   * - With dir name: returns file names inside that directory (without prefix), sorted.
   *   Returns empty array if the directory doesn't exist.
   */
  listDir(dir?: string): string[] {
    const results: string[] = [];

    if (dir === undefined) {
      // Root listing: files without '/' in path, plus dir markers like "src/"
      for (const [key, entry] of this.store) {
        if (entry.type === 'dir') {
          results.push(key); // already ends with '/'
        } else if (entry.type === 'file' && !key.includes('/')) {
          results.push(key);
        }
      }
    } else {
      // Subdirectory listing: files whose path starts with "dir/"
      const prefix = dir + '/';
      for (const [key, entry] of this.store) {
        if (entry.type === 'file' && key.startsWith(prefix)) {
          results.push(key.substring(prefix.length));
        }
      }
    }

    return results.sort();
  }

  /**
   * Returns a deep clone of all entries.
   */
  snapshot(): Map<string, FileEntry> {
    const clone = new Map<string, FileEntry>();
    for (const [key, entry] of this.store) {
      clone.set(key, { ...entry });
    }
    return clone;
  }

  /**
   * Replaces all entries with those from the snapshot.
   */
  restore(snap: Map<string, FileEntry>): void {
    this.store.clear();
    for (const [key, entry] of snap) {
      this.store.set(key, { ...entry });
    }
  }

  /**
   * Returns sorted list of all file paths (not directory entries).
   */
  allFilePaths(): string[] {
    const paths: string[] = [];
    for (const [key, entry] of this.store) {
      if (entry.type === 'file') {
        paths.push(key);
      }
    }
    return paths.sort();
  }
}
