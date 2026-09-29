import { describe, expect, it } from "vitest";
import { branchTipPlacement, primaryBadge, refBadge, refItemForBadge, type RefBadge } from "../../src/lib/history/refs";
import type { RefItem } from "../../src/lib/ipc/types";

const refs: RefItem[] = [
  {
    refId: "refs/heads/feature",
    fullName: "refs/heads/feature",
    label: "feature",
    kind: "local",
    oid: "aaa",
    current: false,
    checkedOutElsewhere: false
  },
  {
    refId: "refs/remotes/origin/feature",
    fullName: "refs/remotes/origin/feature",
    label: "origin/feature",
    kind: "remote",
    oid: "aaa",
    current: false,
    checkedOutElsewhere: false
  }
];

describe("refItemForBadge", () => {
  it("resolves the graph badge back to its sidebar RefItem", () => {
    expect(refItemForBadge(refs, { id: "refs/heads/feature" })?.label).toBe("feature");
    expect(refItemForBadge(refs, { id: "refs/remotes/origin/feature" })?.kind).toBe("remote");
  });

  it("returns null for unknown or stale badge ids", () => {
    expect(refItemForBadge(refs, { id: "refs/heads/gone" })).toBeNull();
    expect(refItemForBadge([], { id: "refs/heads/feature" })).toBeNull();
  });
});

describe("refBadge", () => {
  it("marks the checked-out branch so the graph can fill it", () => {
    const current = refBadge({ ...refs[0], current: true });
    expect(current.current).toBe(true);
    expect(refBadge(refs[0]).current).toBe(false);
    expect(refBadge(refs[1]).current).toBe(false);
  });
});

describe("primaryBadge", () => {
  function badge(overrides: Partial<RefBadge> = {}): RefBadge {
    return {
      id: "refs/heads/main",
      name: "main",
      source: "local",
      kind: "local",
      fullName: "refs/heads/main",
      current: false,
      ...overrides
    };
  }

  it("shows the local badge when a commit carries local and remote twins", () => {
    const local = badge({ current: true });
    const origin = badge({ id: "refs/remotes/origin/main", name: "main", source: "origin", kind: "remote", fullName: "refs/remotes/origin/main" });
    expect(primaryBadge([local, origin])).toBe(local);
    expect(primaryBadge([origin, local])).toBe(local);
  });

  it("prefers locals over remotes, origin over other remotes, remotes over tags", () => {
    const upstream = badge({ id: "r-up", name: "main", source: "upstream", kind: "remote", fullName: "refs/remotes/upstream/main" });
    const origin = badge({ id: "r-or", name: "main", source: "origin", kind: "remote", fullName: "refs/remotes/origin/main" });
    const local = badge();
    const tag = badge({ id: "t", name: "v1", source: "tag", kind: "tag", fullName: "refs/tags/v1" });
    expect(primaryBadge([local, upstream])).toBe(local);
    expect(primaryBadge([upstream, origin])).toBe(origin);
    expect(primaryBadge([tag, upstream])).toBe(upstream);
    expect(primaryBadge([tag])).toBe(tag);
  });

  it("returns null with no badges", () => {
    expect(primaryBadge([])).toBeNull();
  });
});

describe("branchTipPlacement", () => {
  it("drops below the pill and clamps to the viewport", () => {
    expect(branchTipPlacement({ left: 100, top: 100, bottom: 120 }, 1440, 800)).toEqual({ x: 100, y: 124, above: false });
    expect(branchTipPlacement({ left: 1400, top: 100, bottom: 120 }, 1440, 800).x).toBeLessThan(1400);
  });

  it("flips above the pill near the bottom edge", () => {
    const at = branchTipPlacement({ left: 100, top: 780, bottom: 798 }, 1440, 800);
    expect(at.above).toBe(true);
    expect(at.y).toBe(776);
  });
});
