import type { HistoryScope } from "../ipc/types";

/**
 * Return the history scope to use after a ref is deleted. A scope pinned
 * to the deleted ref would make the next history load fail with
 * REF_INVALID ("Unknown ref"), so it falls back to all refs. Any other
 * scope survives untouched (same reference).
 */
export function scopeAfterRefDelete(scope: HistoryScope, deletedRefId: string): HistoryScope {
  if (scope.type === "ref" && scope.refId === deletedRefId) return { type: "allRefs" };
  return scope;
}

/**
 * Which sidebar row to highlight. An explicit history filter (the scope
 * dropdown) wins because it names what the graph shows; otherwise the
 * last sidebar selection highlights without narrowing the graph, so the
 * table keeps showing every branch.
 */
export function activeRefHighlight(scope: HistoryScope, selectedRefId: string | null): string | null {
  if (scope.type === "ref") return scope.refId ?? null;
  return selectedRefId;
}
