import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { realAdapter } from "../../src/lib/ipc/real";
import type { CommitCreateRequest } from "../../src/lib/ipc/types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("commit IPC", () => {
  it("sends an explicit amend target and defaults new commits to null", async () => {
    const requests: CommitCreateRequest[] = [];
    vi.mocked(invoke).mockImplementation(async (_command, args) => {
      const { request } = args as { request: CommitCreateRequest };
      requests.push(request);
      return { ok: true, requestId: request.requestId, data: { oid: "new", snapshot: {} } };
    });
    await realAdapter.commitCreate("repo", 7, "New", "Body");
    await realAdapter.commitCreate("repo", 7, "Amended", "Body", "a".repeat(40));
    expect(requests).toEqual([
      { requestId: expect.any(String), repoId: "repo", expectedVersion: 7, subject: "New", body: "Body", amendOid: null },
      { requestId: expect.any(String), repoId: "repo", expectedVersion: 7, subject: "Amended", body: "Body", amendOid: "a".repeat(40) }
    ]);
    expect(invoke).toHaveBeenCalledWith("commit_create", { request: requests[1] });
  });
});
