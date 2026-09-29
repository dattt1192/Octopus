import { describe, expect, it } from "vitest";
import { activeRefHighlight, scopeAfterRefDelete } from "../../src/lib/refs/history-scope";
import type { HistoryScope } from "../../src/lib/ipc/types";

describe("scopeAfterRefDelete", () => {
  it("falls back to allRefs when the scoped ref is deleted", () => {
    expect(scopeAfterRefDelete({ type: "ref", refId: "feature" }, "feature")).toEqual({
      type: "allRefs"
    });
  });

  it("keeps a scope pinned to a surviving ref", () => {
    const scope: HistoryScope = { type: "ref", refId: "main" };
    expect(scopeAfterRefDelete(scope, "feature")).toBe(scope);
  });

  it("keeps allRefs and head scopes untouched", () => {
    const all: HistoryScope = { type: "allRefs" };
    const head: HistoryScope = { type: "head" };
    expect(scopeAfterRefDelete(all, "feature")).toBe(all);
    expect(scopeAfterRefDelete(head, "feature")).toBe(head);
  });
});

describe("activeRefHighlight", () => {
  it("highlights the filtered ref when the graph is narrowed", () => {
    expect(activeRefHighlight({ type: "ref", refId: "a" }, "b")).toBe("a");
  });

  it("highlights the sidebar selection without narrowing the graph", () => {
    expect(activeRefHighlight({ type: "allRefs" }, "b")).toBe("b");
    expect(activeRefHighlight({ type: "head" }, "b")).toBe("b");
  });

  it("highlights nothing with no filter and no selection", () => {
    expect(activeRefHighlight({ type: "allRefs" }, null)).toBeNull();
  });
});
