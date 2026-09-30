<script lang="ts">
  // Persisted preferences with optimistic versioning.
  import type { AppError } from "../ipc/types";
  import { AUTO_FETCH_MINUTES } from "../sync/auto-fetch";

  interface Props {
    fontScale: number;
    autoFetchMinutes: number;
    loading: boolean;
    version: number | null;
    busy: boolean;
    error: AppError | null;
    onScale: (value: number) => void;
    onAutoFetch: (value: number) => void;
    onRetry: () => void;
    onSave: () => void;
    onClose: () => void;
  }

  let { fontScale, autoFetchMinutes, loading, version, busy, error, onScale, onAutoFetch, onRetry, onSave, onClose }: Props = $props();

  function keyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && !busy) onClose();
  }

  const percent = $derived(Math.round(fontScale * 100));
</script>

<svelte:window onkeydown={keyDown} />

<div class="gd-modal-backdrop">
  <div class="gd-modal" role="dialog" aria-modal="true" aria-label="Settings">
    <h2>Settings</h2>
    {#if loading}<p class="gd-muted" role="status">Loading settings…</p>{/if}
    {#if error}
      <p class="gd-error" role="alert">{error.code}: {error.message}</p>
      <button type="button" onclick={onRetry} disabled={loading || busy}>Reload settings</button>
    {/if}
    <label class="gd-field">
      <span>Interface font size ({percent}%)</span>
      <input
        type="range"
        disabled={loading || busy || version === null}
        min={87.5}
        max={125}
        step={2.5}
        value={fontScale * 100}
        oninput={(e) => onScale(Number(e.currentTarget.value) / 100)}
        aria-label="Interface font size"
      />
    </label>
    <label class="gd-field">
      <span>Auto fetch</span>
      <select value={autoFetchMinutes} disabled={loading || busy || version === null}
        onchange={(event) => onAutoFetch(Number(event.currentTarget.value))} aria-label="Auto fetch interval">
        {#each AUTO_FETCH_MINUTES as minutes}<option value={minutes}>{minutes === 0 ? "Off" : `Every ${minutes} ${minutes === 1 ? "minute" : "minutes"}`}</option>{/each}
      </select>
    </label>
    <p class="gd-muted">Fetches the selected repository while Octopus is open. Pauses during Git operations or when offline. Does not pull or change your files.</p>
    <p class="gd-muted">Save to apply auto fetch and keep your preferences across restarts.</p>
    <div class="gd-modal-foot">
      <button type="button" onclick={onClose} disabled={busy}>Close</button>
      <button type="button" class="gd-primary" disabled={busy || loading || version === null} onclick={onSave}>
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  </div>
</div>

<style>
  .gd-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 40;
  }
  .gd-modal {
    background: var(--gd-panel);
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
    padding: var(--gd-space-4);
    min-width: 380px;
    max-width: 480px;
  }
  .gd-modal h2 {
    margin: 0 0 var(--gd-space-3);
    font-size: 15px;
  }
  .gd-error {
    color: var(--gd-danger);
    font-size: var(--gd-font-size-small);
  }
  .gd-muted {
    color: var(--gd-text-secondary);
    font-size: var(--gd-font-size-small);
  }
  .gd-field {
    display: flex;
    flex-direction: column;
    gap: var(--gd-space-2);
    margin: var(--gd-space-2) 0;
    font-size: var(--gd-font-size-small);
  }
  .gd-modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: var(--gd-space-2);
    margin-top: var(--gd-space-3);
  }
  select { padding: 6px 8px; border: 1px solid var(--gd-border); border-radius: var(--gd-radius-control); color: var(--gd-text); background: var(--gd-canvas); }
  .gd-primary {
    padding: 6px 14px;
    cursor: pointer;
  }
</style>
