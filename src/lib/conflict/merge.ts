import type { MergeBlockPick, MergePickedLine, MergeSegment } from "../ipc/types";

/** Per-block picks in result order. Missing = unresolved; [] = take an empty side. */
export type MergePicks = Record<string, MergePickedLine[]>;

/** Suggestions fill only untouched blocks, including explicit empty-side picks. */
export function applyAutoPicks(segments: MergeSegment[], picks: MergePicks, suggestions: MergeBlockPick[]) {
  const next = { ...picks };
  const known = new Set(segments.filter((segment) => segment.kind === "conflict").map((segment) => segment.hunkId));
  for (const suggestion of suggestions) {
    if (known.has(suggestion.hunkId) && next[suggestion.hunkId] === undefined) next[suggestion.hunkId] = suggestion.lines;
  }
  const before = countResolved(segments, picks);
  const after = countResolved(segments, next);
  return { picks: next, added: after.resolved - before.resolved, remaining: after.remaining };
}

export interface MergeSourceRow {
  text: string;
  lineNumber: number | null;
  conflict: { hunkId: string; blockNumber: number; index: number | null; empty: boolean } | null;
}

/** Full file views share clean context and align unequal conflict sides with unnumbered rows. */
export function buildMergeSourceRows(
  segments: MergeSegment[],
  side: "current" | "incoming"
): MergeSourceRow[] {
  const rows: MergeSourceRow[] = [];
  let lineNumber = 0;
  let blockNumber = 0;
  for (const segment of segments) {
    if (segment.kind === "clean") {
      for (const text of segment.lines) rows.push({ text, lineNumber: ++lineNumber, conflict: null });
      continue;
    }
    blockNumber += 1;
    const lines = segment[side];
    const height = Math.max(1, segment.current.length, segment.incoming.length);
    for (let index = 0; index < height; index += 1) {
      const hasLine = index < lines.length;
      rows.push({
        text: hasLine ? lines[index] : "",
        lineNumber: hasLine ? ++lineNumber : null,
        conflict: {
          hunkId: segment.hunkId,
          blockNumber,
          index: hasLine ? index : null,
          empty: lines.length === 0 && index === 0
        }
      });
    }
  }
  return rows;
}

export interface MergePreviewLine {
  text: string;
  origin: "clean" | "current" | "incoming" | "marker";
  hunkId?: string;
}

function splitRaw(raw: string): string[] {
  const lines = raw.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((line) => line.endsWith("\r") ? line.slice(0, -1) : line);
}

/**
 * Compose the result preview: clean lines pass through, picked blocks
 * splice chosen lines in pick order, unpicked blocks keep their marker
 * text so the user sees what Apply would leave behind. Display only —
 * the backend rebuilds bytes from live markers at Apply time.
 */
export function buildMergePreview(segments: MergeSegment[], picks: MergePicks): MergePreviewLine[] {
  const out: MergePreviewLine[] = [];
  for (const segment of segments) {
    if (segment.kind === "clean") {
      for (const text of segment.lines) out.push({ text, origin: "clean" });
      continue;
    }
    const chosen = picks[segment.hunkId];
    if (chosen === undefined) {
      for (const text of splitRaw(segment.raw)) out.push({ text, origin: "marker", hunkId: segment.hunkId });
      continue;
    }
    for (const pick of chosen) {
      const pool = pick.side === "current" ? segment.current : segment.incoming;
      out.push({ text: pool[pick.index] ?? "", origin: pick.side, hunkId: segment.hunkId });
    }
  }
  return out;
}

export function countResolved(
  segments: MergeSegment[],
  picks: MergePicks
): { resolved: number; remaining: number } {
  let resolved = 0;
  let remaining = 0;
  for (const segment of segments) {
    if (segment.kind !== "conflict") continue;
    if (picks[segment.hunkId] !== undefined) resolved += 1;
    else remaining += 1;
  }
  return { resolved, remaining };
}

/** Whole-block pick: every line of one side, in document order. */
export function takeSide(
  segment: Extract<MergeSegment, { kind: "conflict" }>,
  side: "current" | "incoming"
): MergePickedLine[] {
  return segment[side].map((_, index) => ({ side, index }));
}

/** Add a line pick, or remove it when already picked; others keep order. */
export function toggleLine(
  picks: MergePicks,
  hunkId: string,
  side: "current" | "incoming",
  index: number
): MergePicks {
  const current = picks[hunkId] ?? [];
  const at = current.findIndex((p) => p.side === side && p.index === index);
  const next =
    at === -1
      ? [...current, { side, index }]
      : [...current.slice(0, at), ...current.slice(at + 1)];
  const result = { ...picks };
  if (next.length === 0) delete result[hunkId];
  else result[hunkId] = next;
  return result;
}

/** Textareas use LF internally; keep a CRLF document's newline convention on save. */
export function serializeMergeText(text: string, original: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  return original.includes("\r\n") && !/(?<!\r)\n/.test(original)
    ? normalized.replace(/\n/g, "\r\n")
    : normalized;
}

export function editableMergeText(doc: { segments: MergeSegment[]; workingText: string }, picks: MergePicks): string {
  if (Object.keys(picks).length === 0) return doc.workingText.replace(/\r\n/g, "\n");
  return doc.segments.map((segment, index) => {
    if (segment.kind === "clean") {
      const terminated = index < doc.segments.length - 1 || doc.workingText.endsWith("\n");
      return segment.lines.join("\n") + (segment.lines.length && terminated ? "\n" : "");
    }
    const chosen = picks[segment.hunkId];
    if (chosen === undefined) return segment.raw.replace(/\r\n/g, "\n");
    // A source line ends before the next marker, so its newline survives even
    // when the closing marker itself was the final unterminated line.
    return chosen.map((pick) => `${segment[pick.side][pick.index] ?? ""}\n`).join("");
  }).join("");
}

/** Bounded DOM window shared by both source panes and the editable overlay. */
export function mergeRowWindow(total: number, scrollTop: number, height: number, overscan = 12) {
  const start = Math.max(0, Math.floor(scrollTop / 22) - overscan);
  const end = Math.min(total, Math.ceil((scrollTop + height) / 22) + overscan);
  return { start: Math.min(start, total), end, before: Math.min(start, total) * 22, after: Math.max(0, total - end) * 22 };
}
