/**
 * IndexedDB-backed persistence via idb-keyval.
 *
 * Key format:
 *   gitverse:autosave           – auto-save slot
 *   gitverse:sandbox:<name>     – named sandbox slot
 *   gitverse:history            – serialized command history
 */

import { get, set, del, keys } from 'idb-keyval';

const PREFIX = 'gitverse';
const AUTOSAVE_KEY = `${PREFIX}:autosave`;
const HISTORY_KEY = `${PREFIX}:history`;
const SANDBOX_PREFIX = `${PREFIX}:sandbox:`;

// ---------------------------------------------------------------------------
// Auto-save
// ---------------------------------------------------------------------------

/**
 * Persist the current engine state JSON to the auto-save slot.
 * Errors are swallowed so that a storage failure never breaks the UI.
 */
export async function autoSave(stateJson: string): Promise<void> {
  try {
    await set(AUTOSAVE_KEY, stateJson);
  } catch {
    // storage unavailable – silently ignore
  }
}

/**
 * Load the previously auto-saved engine state JSON.
 * Returns null if no auto-save exists or storage is unavailable.
 */
export async function autoLoad(): Promise<string | null> {
  try {
    const value = await get<string>(AUTOSAVE_KEY);
    return value ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Named sandboxes
// ---------------------------------------------------------------------------

/**
 * Save engine state JSON under a named sandbox slot.
 */
export async function saveSandbox(name: string, stateJson: string): Promise<void> {
  await set(`${SANDBOX_PREFIX}${name}`, stateJson);
}

/**
 * Load a named sandbox. Returns null if not found.
 */
export async function loadSandbox(name: string): Promise<string | null> {
  const value = await get<string>(`${SANDBOX_PREFIX}${name}`);
  return value ?? null;
}

/**
 * Delete a named sandbox.
 */
export async function deleteSandbox(name: string): Promise<void> {
  await del(`${SANDBOX_PREFIX}${name}`);
}

/**
 * List all saved sandbox names (without the key prefix).
 */
export async function listSandboxes(): Promise<string[]> {
  const allKeys = await keys<string>();
  return allKeys
    .filter((k) => k.startsWith(SANDBOX_PREFIX))
    .map((k) => k.slice(SANDBOX_PREFIX.length))
    .sort();
}

// ---------------------------------------------------------------------------
// Command history
// ---------------------------------------------------------------------------

/**
 * Persist the command history array.
 * Errors are swallowed so that a storage failure never breaks the UI.
 */
export async function saveHistory(entries: string[]): Promise<void> {
  try {
    await set(HISTORY_KEY, entries);
  } catch {
    // storage unavailable – silently ignore
  }
}

/**
 * Load the command history array. Returns [] if not found or unavailable.
 */
export async function loadHistory(): Promise<string[]> {
  try {
    const value = await get<string[]>(HISTORY_KEY);
    return value ?? [];
  } catch {
    return [];
  }
}
