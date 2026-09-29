import type { StashEntry } from "../ipc/types";

/**
 * Newest stash entry, the header quick-pop target. Both the backend and
 * the demo list newest-first (`git stash list` order), so this is the
 * head of the list; null when there is nothing to pop.
 */
export function latestStashEntry(entries: StashEntry[]): StashEntry | null {
  return entries.length > 0 ? entries[0] : null;
}
