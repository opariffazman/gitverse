import type { CommandResult, ExpandFn } from './types';
import type { RefStore } from '../refs';
import type { ObjectStore } from '../objects';

/**
 * git tag           — list all tags
 * git tag <name>    — create lightweight tag at HEAD
 * git tag <name> <commit>  — create lightweight tag at specific commit
 */
export function cmdTag(
  args: string[],
  _opts: Map<string, string[]>,
  refs: RefStore,
  objects: ObjectStore,
  expand: ExpandFn,
): CommandResult {
  // List tags
  if (args.length === 0) {
    const tags = refs.listTags();
    return {
      output: tags.join('\n'),
      exitCode: 0,
    };
  }

  const tagName = args[0];
  let targetHash: string;

  if (args.length >= 2) {
    // Tag at specific commit / ref (the target, not the tag name, may be a C-label)
    const ref = expand(args[1]);
    if (objects.hasCommit(ref)) {
      targetHash = ref;
    } else {
      const resolved = refs.resolveRef(ref);
      if (resolved && objects.hasCommit(resolved)) {
        targetHash = resolved;
      } else {
        return {
          output: `fatal: not a valid object name: '${ref}'`,
          exitCode: 128,
        };
      }
    }
  } else {
    // Tag at HEAD
    const headHash = refs.resolveHEAD();
    if (!headHash || !objects.hasCommit(headHash)) {
      return {
        output: `fatal: Failed to resolve HEAD as a valid ref`,
        exitCode: 128,
      };
    }
    targetHash = headHash;
  }

  try {
    refs.createTag(tagName, targetHash);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('already exists')) {
      return {
        output: `fatal: tag '${tagName}' already exists`,
        exitCode: 128,
      };
    }
    return { output: `fatal: ${msg}`, exitCode: 128 };
  }

  return { output: '', exitCode: 0 };
}
