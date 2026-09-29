import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutoFetchScheduler, type AutoFetchState } from "../../src/lib/sync/auto-fetch";
import { demoSession } from "../../src/mocks/demoSession";

describe("automatic fetch scheduling", () => {
  let state: AutoFetchState;
  let scheduler: AutoFetchScheduler;
  const fetch = vi.fn<() => Promise<void>>();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T00:00:00Z"));
    state = { minutes: 5, active: true, online: true, busy: false,
      session: { ...demoSession, trust: "trusted", state: "normal", activeOperation: null },
      remote: { remoteName: "origin", url: "https://example.com/repo.git", upstreamRef: null, ahead: null, behind: null, lastFetchAt: null } };
    fetch.mockReset().mockResolvedValue(undefined);
    scheduler = new AutoFetchScheduler(() => state, fetch);
    scheduler.start();
  });
  afterEach(() => { scheduler.stop(); vi.useRealTimers(); });

  it("fetches after startup and then at the saved interval without duplicate timers", async () => {
    scheduler.start();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(290_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["off", "invalid", "inactive", "offline", "busy", "untrusted", "missing", "merging", "external", "no-remote"])("waits while %s, then resumes once eligible", async condition => {
    const ready = structuredClone(state);
    if (condition === "off") state.minutes = 0;
    if (condition === "invalid") state.minutes = NaN;
    if (condition === "inactive") state.active = false;
    if (condition === "offline") state.online = false;
    if (condition === "busy") state.busy = true;
    if (condition === "untrusted") state.session!.trust = "readOnly";
    if (condition === "missing") state.session = null;
    if (condition === "merging") state.session!.state = "merging";
    if (condition === "external") state.session!.activeOperation = "another-job";
    if (condition === "no-remote") state.remote!.remoteName = null;
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetch).not.toHaveBeenCalled();
    state = ready;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not overlap a slow request or a running native job", async () => {
    let release!: () => void;
    fetch.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    state.busy = true;
    release();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    scheduler.finished(false);
    state.busy = false;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("respects recent fetches, manual attempts and live interval changes", async () => {
    state.remote!.lastFetchAt = new Date().toISOString();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).not.toHaveBeenCalled();
    scheduler.attempted();
    state.minutes = 1;
    await vi.advanceTimersByTimeAsync(50_000);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    state.minutes = 0;
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("backs off failures up to 30 minutes and resets after success", async () => {
    await vi.advanceTimersByTimeAsync(10_000);
    for (const delay of [600_000, 1_200_000, 1_800_000, 1_800_000]) {
      scheduler.finished(true);
      const calls = fetch.mock.calls.length;
      await vi.advanceTimersByTimeAsync(delay - 10_000);
      expect(fetch).toHaveBeenCalledTimes(calls);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetch).toHaveBeenCalledTimes(calls + 1);
    }
    scheduler.finished(false);
    const calls = fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(fetch).toHaveBeenCalledTimes(calls + 1);
  });

  it("handles a rejected request and stops completely on disposal", async () => {
    fetch.mockRejectedValueOnce(new Error("offline"));
    await vi.advanceTimersByTimeAsync(300_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    scheduler.stop();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches only once when waking after several missed intervals", async () => {
    vi.setSystemTime(new Date("2026-09-30T00:00:00Z"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
