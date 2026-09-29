import { describe, expect, it } from "vitest";
import { createMockAdapter, mockAdapter, resetMockBranches, resetMockWorktree } from "../../src/lib/ipc/mock";
import { demoSession } from "../../src/mocks/demoSession";

describe("amend commit", () => {
  it("replaces HEAD, preserves its parents and author, and keeps unstaged changes", async () => {
    const adapter = createMockAdapter();
    const before = await adapter.repoOpen("");
    if (before.head.kind === "unborn") throw new Error("Expected HEAD");
    const old = await adapter.commitDetails(before.repoId, before.head.oid, null);
    const result = await adapter.commitCreate(before.repoId, before.version, "Amended summary", "Amended body", old.oid);
    expect(result.oid).not.toBe(old.oid);
    expect(result.snapshot.head).toMatchObject({ oid: result.oid });
    const amended = await adapter.commitDetails(before.repoId, result.oid, null);
    expect(amended).toMatchObject({ subject: "Amended summary", body: "Amended body", parents: old.parents, authorName: old.authorName, authoredAt: old.authoredAt });
    const status = await adapter.repoStatus(before.repoId);
    expect(status.files.some(file => file.displayPath === "src/app/App.svelte" && file.worktreeStatus === "M")).toBe(true);
    expect(result.snapshot.stagedCount).toBe(0);
    const history = await adapter.historyPage(before.repoId, { type: "head" }, null, 100);
    expect(history.rows[0].oid).toBe(result.oid);
  });

  it("allows message-only amend and rejects an outdated target without consuming staged files", async () => {
    const adapter = createMockAdapter();
    const before = await adapter.repoOpen("");
    if (before.head.kind === "unborn") throw new Error("Expected HEAD");
    const files = await adapter.repoStatus(before.repoId);
    await adapter.indexUnstage(before.repoId, before.version, files.files.map(file => file.pathId));
    const result = await adapter.commitCreate(before.repoId, before.version, "New message", "", before.head.oid);
    const next = await adapter.commitCreate(before.repoId, result.snapshot.version, "Another message", "", result.oid);
    const history = await adapter.historyPage(before.repoId, { type: "allRefs" }, null, 100);
    expect(history.rows.some(row => row.oid === result.oid)).toBe(false);
    expect(history.rows[0].oid).toBe(next.oid);
    const rows = await adapter.repoStatus(before.repoId);
    await adapter.indexStage(before.repoId, next.snapshot.version, [rows.files[0].pathId]);
    const staged = await adapter.repoStatus(before.repoId);
    await expect(adapter.commitCreate(before.repoId, next.snapshot.version, "stale", "", before.head.oid)).rejects.toMatchObject({ code: "STALE_STATE" });
    await expect(adapter.commitCreate(before.repoId, before.version, "stale", "", next.oid)).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(await adapter.repoStatus(before.repoId)).toEqual(staged);
  });

  it("blocks amend before the first commit and during a merge", async () => {
    const unborn = createMockAdapter({ ...demoSession, head: { kind: "unborn", name: "main" } });
    await expect(unborn.commitCreate(demoSession.repoId, demoSession.version, "message", "", "a".repeat(40))).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    const merging = createMockAdapter({ ...demoSession, state: "merging" });
    const before = await merging.repoOpen("");
    if (before.head.kind === "unborn") throw new Error("Expected HEAD");
    await expect(merging.commitCreate(before.repoId, before.version, "message", "", before.head.oid)).rejects.toMatchObject({ code: "CONFLICTS_PRESENT" });
  });
});

describe("mock commit flow (T10)", () => {
  it("commits exactly the index and keeps the draft contract", async () => {
    resetMockWorktree("commit-repo");
    const before = await mockAdapter.repoStatus("commit-repo");
    const noteId = before.files.find((f) => f.displayPath === "new notes.txt")?.pathId ?? "";
    await mockAdapter.indexStage("commit-repo", 1, [noteId]);

    const result = await mockAdapter.commitCreate("commit-repo", 1, "Demo commit", "");
    expect(result.oid).toMatch(/^[0-9a-f]{40}$/);
    // Staged-only rows vanish; nothing unstaged is swept in.
    const after = await mockAdapter.repoStatus("commit-repo");
    expect(after.files.find((f) => f.displayPath === "new notes.txt")).toBeUndefined();
    expect(after.files.find((f) => f.displayPath === "src/app/App.svelte")?.worktreeStatus).toBe("M");

    // Empty subject refuses before touching the index.
    await expect(mockAdapter.commitCreate("commit-repo", 1, "   ", "")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT"
    });
    // Drain the index, then the commit refuses with EMPTY_INDEX.
    const drained = await mockAdapter.repoStatus("commit-repo");
    await mockAdapter.indexUnstage(
      "commit-repo",
      1,
      drained.files.map((f) => f.pathId)
    );
    await expect(mockAdapter.commitCreate("commit-repo", 1, "x", "")).rejects.toMatchObject({
      code: "EMPTY_INDEX"
    });
    resetMockWorktree("commit-repo");
  });

  it("reads an effective identity without secrets", async () => {
    const identity = await mockAdapter.identityRead("commit-repo");
    expect(identity.name).toBeTruthy();
    expect(identity.email).toContain("@");
    expect(identity.scope).toBe("local");
    expect(JSON.stringify(identity)).not.toMatch(/token|secret|key/i);
  });
});

describe("mock branch workflow (T10)", () => {
  it("creates, switches, confirms, and safely deletes", async () => {
    resetMockBranches();
    const refs = await mockAdapter.repoRefs();
    const head = refs.find((r) => r.current) ?? refs[0];

    const created = await mockAdapter.branchCreate("b-repo", 1, "demo/next", head.oid, true);
    expect(created.switched).toBe(true);
    const afterCreate = await mockAdapter.repoRefs();
    expect(afterCreate.find((r) => r.refId === "refs/heads/demo/next")?.current).toBe(true);

    await mockAdapter.branchSwitch("b-repo", 1, "refs/heads/main", null);
    const afterSwitch = await mockAdapter.repoRefs();
    expect(afterSwitch.find((r) => r.refId === "refs/heads/main")?.current).toBe(true);

    // Unmerged branch: summary warns, delete refuses, token is consumed.
    const prepare = await mockAdapter.confirmationPrepare("b-repo", 1, "branch_delete", [
      "refs/heads/feature/ui"
    ]);
    expect(prepare.summary).toMatch(/NOT merged/);
    await expect(
      mockAdapter.branchDelete("b-repo", 1, "refs/heads/feature/ui", prepare.confirmationToken)
    ).rejects.toMatchObject({ code: "REF_INVALID" });
    await expect(
      mockAdapter.branchDelete("b-repo", 1, "refs/heads/feature/ui", prepare.confirmationToken)
    ).rejects.toMatchObject({ code: "STALE_STATE" });

    // Duplicate names and unknown refs fail instead of guessing.
    await expect(
      mockAdapter.branchCreate("b-repo", 1, "main", head.oid, false)
    ).rejects.toMatchObject({ code: "STALE_STATE" });
    resetMockBranches();
  });
});
