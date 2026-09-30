import { describe, expect, it } from "vitest";
import { mockAdapter } from "../../src/lib/ipc/mock";

describe("settings adapter (T14 demo surface)", () => {
  it("returns default settings v1", async () => {
    const settings = await mockAdapter.settingsGet();
    expect(settings.version).toBeGreaterThan(0);
    expect(settings.fontScale).toBe(1);
    expect(settings.autoFetchMinutes).toBe(5);
  });

  it("updates the font scale with version match and bumps the version", async () => {
    const before = await mockAdapter.settingsGet();
    const next = await mockAdapter.settingsUpdate(before.version, 1.125);
    expect(next.fontScale).toBe(1.125);
    expect(next.version).toBe(before.version + 1);
  });

  it("rejects stale versions and out-of-range scales", async () => {
    const current = await mockAdapter.settingsGet();
    await expect(mockAdapter.settingsUpdate(current.version - 1, 1.0)).rejects.toMatchObject({
      code: "STALE_STATE"
    });
    await expect(mockAdapter.settingsUpdate(current.version, 2.0)).rejects.toMatchObject({
      code: "INVALID_ARGUMENT"
    });
  });

  it("saves auto fetch independently, preserves the font and validates intervals", async () => {
    const before = await mockAdapter.settingsGet();
    const next = await mockAdapter.settingsUpdate(before.version, null, 0);
    expect(next).toEqual({ ...before, version: before.version + 1, autoFetchMinutes: 0 });
    expect(await mockAdapter.settingsGet()).toEqual(next);
    for (const value of [-1, 0.5, 2, 60, NaN]) {
      await expect(mockAdapter.settingsUpdate(next.version, null, value)).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    }
    const fontOnly = await mockAdapter.settingsUpdate(next.version, 1);
    expect(fontOnly.autoFetchMinutes).toBe(0);
    await expect(mockAdapter.settingsUpdate(fontOnly.version, null)).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });
});
