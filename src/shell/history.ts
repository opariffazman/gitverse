const MAX_HISTORY = 100;

/**
 * Manages command history with navigation (up/down) and search.
 *
 * - Deduplicates consecutive identical entries.
 * - Capped at MAX_HISTORY (100) entries, oldest discarded first.
 * - Navigation cursor starts "after the last entry" (pointing at index = length).
 *   up() moves backward; down() moves forward, returning '' at the "current" position.
 */
export class CommandHistory {
  private entries: string[] = [];
  /** Current cursor position; entries.length means "current input" (not yet in history). */
  private cursor: number;

  constructor() {
    this.cursor = 0;
  }

  /**
   * Add a command to history.
   * - Skips empty strings.
   * - Deduplicates consecutive identical entries.
   * - Caps history at MAX_HISTORY.
   */
  push(command: string): void {
    if (!command) return;
    // Dedup consecutive
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === command) {
      this.cursor = this.entries.length;
      return;
    }
    this.entries.push(command);
    // Trim to max
    if (this.entries.length > MAX_HISTORY) {
      this.entries.shift();
    }
    this.cursor = this.entries.length;
  }

  /**
   * Navigate backward (toward older entries).
   * Returns the entry at the new cursor, or null if already at oldest.
   */
  up(): string | null {
    if (this.entries.length === 0) return null;
    if (this.cursor === 0) return this.entries[0]; // already at oldest
    this.cursor--;
    return this.entries[this.cursor];
  }

  /**
   * Navigate forward (toward newer entries).
   * Returns the entry at the new cursor, or '' when at the "current input" position.
   * Returns null if there's no history.
   */
  down(): string | null {
    if (this.entries.length === 0) return null;
    if (this.cursor >= this.entries.length) {
      // Already at "current input" position
      return '';
    }
    this.cursor++;
    if (this.cursor >= this.entries.length) {
      return '';
    }
    return this.entries[this.cursor];
  }

  /**
   * Find the most recent entry that contains the query string (case-sensitive prefix match
   * or substring match — we do substring for usability).
   * Returns null if nothing matches.
   */
  search(query: string): string | null {
    if (!query) return null;
    // Search from newest to oldest
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].includes(query)) {
        return this.entries[i];
      }
    }
    return null;
  }

  /**
   * Reset the navigation cursor to the "current input" position (end of history).
   */
  reset(): void {
    this.cursor = this.entries.length;
  }

  /**
   * Return all entries (for persistence).
   */
  getEntries(): string[] {
    return [...this.entries];
  }

  /**
   * Restore entries from persistence.
   * Resets cursor to end.
   */
  restore(entries: string[]): void {
    // Take at most MAX_HISTORY entries from the end
    this.entries = entries.slice(-MAX_HISTORY);
    this.cursor = this.entries.length;
  }
}
