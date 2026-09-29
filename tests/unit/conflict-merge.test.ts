import { describe, expect, it } from "vitest";
import {
  applyAutoPicks,
  editableMergeText,
  serializeMergeText,
  mergeRowWindow,
  buildMergePreview,
  buildMergeSourceRows,
  countResolved,
  takeSide,
  toggleLine,
  type MergePicks
} from "../../src/lib/conflict/merge";
import type { MergeSegment } from "../../src/lib/ipc/types";

const segments: MergeSegment[] = [
  { kind: "clean", lines: ["top"] },
  {
    kind: "conflict",
    hunkId: "h1",
    current: ["c1", "c2"],
    incoming: ["i1"],
    base: [],
    raw: "<<<<<<< HEAD\nc1\nc2\n=======\ni1\n>>>>>>> f\n"
  },
  { kind: "clean", lines: ["bottom"] }
];

describe("buildMergePreview", () => {
  it("resolves an explicitly empty side without removing surrounding content", () => {
    expect(buildMergePreview(segments, { h1: [] }).map((line) => line.text)).toEqual(["top", "bottom"]);
    expect(countResolved(segments, { h1: [] })).toEqual({ resolved: 1, remaining: 0 });
  });

  it("shows CRLF conflict markers as lines without carriage returns or a phantom trailing line", () => {
    const block = segments[1];
    if (block.kind !== "conflict") throw new Error("fixture");
    const preview = buildMergePreview([{ ...block, raw: "<<<<<<< HEAD\r\nc1\r\n=======\r\ni1\r\n>>>>>>> f\r\n" }], {});
    expect(preview.map((line) => line.text)).toEqual(["<<<<<<< HEAD", "c1", "=======", "i1", ">>>>>>> f"]);
  });
  it("passes clean lines through and keeps markers for unpicked blocks", () => {
    const preview = buildMergePreview(segments, {});
    expect(preview.map((l) => l.text)).toEqual([
      "top",
      "<<<<<<< HEAD",
      "c1",
      "c2",
      "=======",
      "i1",
      ">>>>>>> f",
      "bottom"
    ]);
    expect(preview[1].origin).toBe("marker");
    expect(preview[0].origin).toBe("clean");
  });

  it("splices whole-block and mixed line picks in pick order", () => {
    const picks: MergePicks = {
      h1: [
        { side: "incoming", index: 0 },
        { side: "current", index: 1 }
      ]
    };
    const preview = buildMergePreview(segments, picks);
    expect(preview.map((l) => l.text)).toEqual(["top", "i1", "c2", "bottom"]);
    expect(preview.map((l) => l.origin)).toEqual(["clean", "incoming", "current", "clean"]);
  });

  it("ignores picks for unknown hunks", () => {
    const preview = buildMergePreview(segments, { nope: [{ side: "current", index: 0 }] });
    expect(preview.some((l) => l.origin === "marker")).toBe(true);
  });
});

describe("buildMergeSourceRows", () => {
  it("includes the entire file and numbers each side independently across unequal blocks", () => {
    const multi: MergeSegment[] = [...segments, {
      kind: "conflict", hunkId: "h2", current: ["c3"], incoming: ["i2", "i3"], base: [], raw: ""
    }, { kind: "clean", lines: ["", "tail"] }];
    const current = buildMergeSourceRows(multi, "current");
    const incoming = buildMergeSourceRows(multi, "incoming");
    expect(current.map((row) => row.text)).toEqual(["top", "c1", "c2", "bottom", "c3", "", "", "tail"]);
    expect(incoming.map((row) => row.text)).toEqual(["top", "i1", "", "bottom", "i2", "i3", "", "tail"]);
    expect(current.map((row) => row.lineNumber)).toEqual([1, 2, 3, 4, 5, null, 6, 7]);
    expect(incoming.map((row) => row.lineNumber)).toEqual([1, 2, null, 3, 4, 5, 6, 7]);
    expect(current[4].conflict).toEqual({ hunkId: "h2", blockNumber: 2, index: 0, empty: false });
    expect(incoming[2].conflict?.index).toBeNull();
    expect(current[6].conflict).toBeNull();
  });

  it("distinguishes an empty side from an actual blank line", () => {
    const deletion: MergeSegment[] = [{ kind: "conflict", hunkId: "empty", current: [], incoming: [""], base: [], raw: "" }];
    expect(buildMergeSourceRows(deletion, "current")[0]).toEqual({
      text: "", lineNumber: null, conflict: { hunkId: "empty", blockNumber: 1, index: null, empty: true }
    });
    expect(buildMergeSourceRows(deletion, "incoming")[0]).toEqual({
      text: "", lineNumber: 1, conflict: { hunkId: "empty", blockNumber: 1, index: 0, empty: false }
    });
  });

  it("handles an empty file and a file with no conflicts", () => {
    expect(buildMergeSourceRows([], "current")).toEqual([]);
    expect(buildMergeSourceRows([{ kind: "clean", lines: ["", "text"] }], "incoming")).toEqual([
      { text: "", lineNumber: 1, conflict: null }, { text: "text", lineNumber: 2, conflict: null }
    ]);
  });
});

describe("countResolved", () => {
  it("counts blocks with at least one picked line", () => {
    expect(countResolved(segments, {})).toEqual({ resolved: 0, remaining: 1 });
    expect(countResolved(segments, { h1: [{ side: "current", index: 0 }] })).toEqual({
      resolved: 1,
      remaining: 0
    });
  });
});

describe("takeSide", () => {
  it("picks every line of one side in order", () => {
    const block = segments[1];
    if (block.kind !== "conflict") throw new Error("fixture");
    expect(takeSide(block, "current")).toEqual([
      { side: "current", index: 0 },
      { side: "current", index: 1 }
    ]);
  });
});

describe("toggleLine", () => {
  it("restores unresolved markers when the last checkbox is unchecked", () => {
    const picks = toggleLine({ h1: [{ side: "incoming", index: 0 }] }, "h1", "incoming", 0);
    expect(picks).toEqual({});
    expect(countResolved(segments, picks)).toEqual({ resolved: 0, remaining: 1 });
    expect(buildMergePreview(segments, picks).some((line) => line.origin === "marker")).toBe(true);
  });
  it("adds and removes single lines keeping pick order", () => {
    let picks: MergePicks = {};
    picks = toggleLine(picks, "h1", "current", 1);
    picks = toggleLine(picks, "h1", "incoming", 0);
    expect(picks).toEqual({
      h1: [
        { side: "current", index: 1 },
        { side: "incoming", index: 0 }
      ]
    });
    picks = toggleLine(picks, "h1", "current", 1);
    expect(picks).toEqual({ h1: [{ side: "incoming", index: 0 }] });
  });
});


describe("editable merge results", () => {
  it("retains final-newline intent and CRLF when serializing manual edits", () => {
    expect(serializeMergeText("top\nchanged\n", "top\r\nold\r\n")).toBe("top\r\nchanged\r\n");
    expect(serializeMergeText("top\nchanged", "top\r\nold")).toBe("top\r\nchanged");
    expect(serializeMergeText("", "old\r\n")).toBe("");
    expect(serializeMergeText("changed\n", "old\n")).toBe("changed\n");
  });
  it("opens the exact working text before picks, including an empty file", () => {
    expect(editableMergeText({ segments: [], workingText: "x\r\n\r\n" }, {})).toBe("x\n\n");
    expect(editableMergeText({ segments: [], workingText: "" }, {})).toBe("");
    expect(editableMergeText({ segments, workingText: "top\nmarkers\nbottom" }, { h1: [] })).toBe("top\nbottom");
  });
  it("bounds rendered rows for a large file and keeps spacer height exact", () => {
    const window = mergeRowWindow(10000, 110000, 440);
    expect(window.end - window.start).toBeLessThanOrEqual(44);
    expect(window.before + (window.end - window.start) * 22 + window.after).toBe(220000);
    expect(mergeRowWindow(0, 100, 440)).toEqual({ start: 0, end: 0, before: 0, after: 0 });
    expect(mergeRowWindow(3, 9999, 440)).toEqual({ start: 3, end: 3, before: 66, after: 0 });
  });
  it("preserves picked blank lines and the newline before an unterminated final marker", () => {
    const block: MergeSegment = { kind: "conflict", hunkId: "last", current: [""], incoming: ["text"], base: [], raw: "<<<<<<< HEAD\n\n=======\ntext\n>>>>>>> feature" };
    const doc = { segments: [block], workingText: block.raw };
    expect(editableMergeText(doc, { last: takeSide(block, "current") })).toBe("\n");
    expect(editableMergeText(doc, { last: takeSide(block, "incoming") })).toBe("text\n");
    expect(editableMergeText(doc, { last: [] })).toBe("");
  });
});

describe("automatic resolution previews", () => {
  it("fills untouched blocks without replacing a user's choices", () => {
    const chosen: MergePicks = { h1: [{ side: "incoming", index: 0 }] };
    expect(applyAutoPicks(segments, chosen, [{ hunkId: "h1", lines: [{ side: "current", index: 0 }] }])).toEqual({ picks: chosen, added: 0, remaining: 0 });
    expect(applyAutoPicks(segments, {}, [{ hunkId: "h1", lines: [{ side: "current", index: 0 }] }])).toEqual({ picks: { h1: [{ side: "current", index: 0 }] }, added: 1, remaining: 0 });
  });
  it("preserves explicit deletion choices, accepts automatic deletion, and ignores stale blocks", () => {
    expect(applyAutoPicks(segments, { h1: [] }, [{ hunkId: "h1", lines: [{ side: "current", index: 0 }] }]).picks).toEqual({ h1: [] });
    expect(applyAutoPicks(segments, {}, [{ hunkId: "h1", lines: [] }]).picks).toEqual({ h1: [] });
    expect(applyAutoPicks(segments, {}, [{ hunkId: "stale", lines: [] }])).toEqual({ picks: {}, added: 0, remaining: 1 });
  });
});
