import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { realAdapter } from "../../src/lib/ipc/real";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("settings IPC", () => {
  it("sends the typed interval patch and leaves omitted preferences unchanged", async () => {
    vi.mocked(invoke).mockImplementation(async (_command, args) => {
      const { request } = args as { request: { requestId: string } };
      return { ok: true, requestId: request.requestId, data: { version: 8, fontScale: 1, autoFetchMinutes: 10 } };
    });
    await realAdapter.settingsUpdate(7, null, 10);
    expect(invoke).toHaveBeenLastCalledWith("settings_update", { request: {
      requestId: expect.any(String), settingsVersion: 7, patch: { fontScale: null, autoFetchMinutes: 10 }
    } });
    await realAdapter.settingsUpdate(8, 1.125);
    expect(invoke).toHaveBeenLastCalledWith("settings_update", { request: {
      requestId: expect.any(String), settingsVersion: 8, patch: { fontScale: 1.125, autoFetchMinutes: null }
    } });
  });
});
