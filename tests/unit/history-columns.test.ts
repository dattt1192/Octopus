import { describe, expect, it } from "vitest";
import { clampColumn, defaultColumns, restoreColumns } from "../../src/lib/history/columns";
import { formatDateTime } from "../../src/lib/format/date";
import { refBadge, refsByCommit } from "../../src/lib/history/refs";
import type { RefItem } from "../../src/lib/ipc/types";

describe("history column preferences", () => {
  it("restores explicit widths while leaving the default subject responsive", () => {
    expect(restoreColumns(null)).toEqual(defaultColumns());
    const resized = { branches: 170, graph: 110, subject: 360, author: 190 };
    expect(restoreColumns(JSON.stringify(resized))).toEqual({ ...resized, date: 170 });
    expect(restoreColumns(JSON.stringify({ ...resized, date: 200 }))).toMatchObject({ date: 200 });
    expect(restoreColumns('{"date":120}')).toMatchObject({ date: 160 });
  });
  it("bounds corrupted widths and ignores invalid storage", () => {
    for (const raw of ["invalid", "null", "7", "[]"]) expect(restoreColumns(raw)).toEqual(defaultColumns());
    expect(restoreColumns('{"branches": -20, "subject": 99999, "author":"wide"}')).toMatchObject({branches:110,subject:1400,author:140});
    expect(clampColumn("graph", Infinity)).toBe(84);
    expect(clampColumn("date", 10)).toBe(160);
    expect(clampColumn("date", 9999)).toBe(300);
  });
  it("formats timestamps with seconds in local time and preserves invalid input", () => {
    expect(formatDateTime("2026-09-29T14:05:09")).toBe("2026/09/29 14:05:09");
    expect(formatDateTime("2024-01-05T00:00:00")).toBe("2024/01/05 00:00:00");
    expect(formatDateTime(new Date(2026, 8, 29, 23, 4, 5).toISOString())).toBe("2026/09/29 23:04:05");
    expect(formatDateTime(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe("2026/01/02 03:04:05");
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime(NaN)).toBe("unknown time");
  });
});

const ref = (kind: "local" | "remote" | "tag", fullName: string, label: string): RefItem => ({refId:fullName, fullName, label, kind, oid:"tip", current:false, checkedOutElsewhere:false});
describe("branch decorations", () => {
  it("distinguishes local and origin names on the same commit without inferring ancestry", () => {
    const refs = [ref("remote", "refs/remotes/origin/feature/ui", "origin/feature/ui"), ref("local", "refs/heads/feature/ui", "feature/ui")];
    const grouped = refsByCommit(refs);
    expect(grouped.size).toBe(1);
    expect(grouped.get("tip")?.map(r => [r.source,r.name])).toEqual([["local","feature/ui"],["origin","feature/ui"]]);
    expect(grouped.get("ancestor")).toBeUndefined();
  });
  it("keeps the real remote name and tag type", () => {
    expect(refBadge(ref("remote","refs/remotes/upstream/release/v2","upstream/release/v2"))).toMatchObject({source:"upstream",name:"release/v2",kind:"remote"});
    expect(refBadge(ref("tag","refs/tags/v1","v1"))).toMatchObject({source:"tag",name:"v1"});
  });
});
