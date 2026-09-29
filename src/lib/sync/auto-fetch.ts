import type { RemoteStatus, RepoSnapshot } from "../ipc/types";

export const AUTO_FETCH_MINUTES = [0, 1, 5, 10, 15] as const;
export const DEFAULT_AUTO_FETCH_MINUTES = 5;

export interface AutoFetchState {
  minutes: number;
  active: boolean;
  online: boolean;
  busy: boolean;
  session: RepoSnapshot | null;
  remote: RemoteStatus | null;
}

/** Scheduling only: the existing typed fetch command owns Git validation and locking. */
export class AutoFetchScheduler {
  private timer: ReturnType<typeof setInterval> | undefined;
  private pending = false;
  private lastAttempt: number | null = null;
  private failures = 0;

  constructor(private read: () => AutoFetchState, private fetch: () => Promise<void>) {}

  start(): void {
    if (this.timer !== undefined) return;
    // Give initial settings/snapshot reads time to finish. Also handles resume
    // after sleep without issuing a burst of missed fetches.
    this.timer = setInterval(() => { void this.tick(); }, 10_000);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Manual fetches share the same cadence, including failed/cancelled attempts. */
  attempted(): void {
    this.lastAttempt = Date.now();
  }

  finished(failed: boolean): void {
    this.lastAttempt = Date.now();
    this.failures = failed ? Math.min(this.failures + 1, 5) : 0;
  }

  private async tick(): Promise<void> {
    const state = this.read();
    if (this.pending || !AUTO_FETCH_MINUTES.some(value => value === state.minutes) || state.minutes === 0 ||
      !state.active || !state.online || state.busy || state.session?.trust !== "trusted" ||
      state.session.state !== "normal" || state.session.activeOperation || !state.remote?.remoteName) return;
    const interval = state.minutes * 60_000;
    const fetchedAt = Date.parse(state.remote.lastFetchAt ?? "");
    const last = Math.max(this.lastAttempt ?? -Infinity, Number.isFinite(fetchedAt) ? fetchedAt : -Infinity);
    const delay = Math.min(interval * 2 ** this.failures, 30 * 60_000);
    if (Date.now() - last < delay) return;
    this.pending = true;
    this.attempted();
    try {
      await this.fetch();
    } catch {
      // The caller displays the error; back off if it rejects before a job starts.
      this.finished(true);
    } finally {
      this.pending = false;
    }
  }
}
