<script lang="ts">
  // Stash dialog (T12): save (tracked-only default, explicit untracked opt-in)
  // plus apply/pop per entry. Entries identify by OID; indices re-resolve.
  import type { AppError, StashEntry } from "../ipc/types";

  interface Props {
    entries: StashEntry[];
    loading: boolean;
    error: AppError | string | null;
    notice: string | null;
    message: string;
    includeUntracked: boolean;
    saveBusy: boolean;
    busyEntry: string | null;
    saveDisabledReason: string | null;
    onMessage: (value: string) => void;
    onIncludeUntracked: (value: boolean) => void;
    onSave: () => void;
    onApply: (entry: StashEntry) => void;
    onPop: (entry: StashEntry) => void;
    onClose: () => void;
  }

  let {
    entries,
    loading,
    error,
    notice,
    message,
    includeUntracked,
    saveBusy,
    busyEntry,
    saveDisabledReason,
    onMessage,
    onIncludeUntracked,
    onSave,
    onApply,
    onPop,
    onClose
  }: Props = $props();

  let messageInput: HTMLInputElement | undefined = $state();
  $effect(() => {
    messageInput?.focus();
  });

  function keyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") onClose();
  }

  function errorText(e: AppError | string): string {
    return typeof e === "string" ? e : `${e.code}: ${e.message}`;
  }

  function createdLabel(createdAt: number): string {
    if (!createdAt) return "unknown time";
    return new Date(createdAt * 1000).toLocaleString();
  }
</script>

<svelte:window onkeydown={keyDown} />

<div class="gd-modal-backdrop">
  <div class="gd-modal gd-modal-wide" role="dialog" aria-modal="true" aria-label="Stash">
    <div class="gd-modal-head">
      <h2>Stash</h2>
      {#if entries.length > 0}
        <span class="gd-count">{entries.length}</span>
      {/if}
      <button
        type="button"
        class="gd-x"
        aria-label="Close stash dialog"
        title="Close (Esc)"
        onclick={onClose}
      >
        ×
      </button>
    </div>
    {#if error}
      <p class="gd-error" role="alert">{errorText(error)}</p>
    {/if}
    {#if notice}
      <p class="gd-notice" role="status">{notice}</p>
    {/if}

    <section aria-label="Save stash">
      <div class="gd-save-row">
        <input
          type="text"
          bind:this={messageInput}
          value={message}
          maxlength={500}
          placeholder="Message (optional)"
          aria-label="Stash message (optional)"
          oninput={(e) => onMessage(e.currentTarget.value)}
        />
        <button
          type="button"
          class="gd-primary"
          disabled={saveBusy || saveDisabledReason !== null}
          title={saveDisabledReason ?? "Stash current changes (apply without --index on restore)"}
          onclick={onSave}
        >
          {saveBusy ? "Stashing…" : "Stash"}
        </button>
      </div>
      <label class="gd-check" title="Ignored files are never stashed">
        <input
          type="checkbox"
          checked={includeUntracked}
          onchange={(e) => onIncludeUntracked(e.currentTarget.checked)}
        />
        Include untracked files
      </label>
    </section>

    <section aria-label="Stashed entries">
      <h3>Stashed</h3>
      {#if loading && entries.length === 0}
        <p class="gd-muted" role="status">Loading stash…</p>
      {:else if entries.length === 0}
        <p class="gd-muted">No stashed changes.</p>
      {:else}
        <ul class="gd-stash-list">
          {#each entries as entry (entry.stashId + entry.oid)}
            <li>
              <div class="gd-stash-top">
                <span class="gd-stash-id">{entry.stashId}</span>
                <span class="gd-stash-label" title={entry.label}>{entry.label}</span>
                <div class="gd-stash-actions">
                  <button
                    type="button"
                    disabled={busyEntry !== null}
                    title="Restore these changes, keep the entry"
                    onclick={() => onApply(entry)}
                  >
                    {busyEntry === `apply:${entry.stashId}` ? "Applying…" : "Apply"}
                  </button>
                  <button
                    type="button"
                    disabled={busyEntry !== null}
                    title="Restore these changes, drop the entry on success"
                    onclick={() => onPop(entry)}
                  >
                    {busyEntry === `pop:${entry.stashId}` ? "Popping…" : "Pop"}
                  </button>
                </div>
              </div>
              <div class="gd-muted">{entry.oid.slice(0, 8)} · {createdLabel(entry.createdAt)}</div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
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
    min-width: 420px;
    max-width: 640px;
    max-height: 80vh;
    overflow-y: auto;
  }
  .gd-modal-head {
    display: flex;
    align-items: center;
    gap: var(--gd-space-2);
    margin-bottom: var(--gd-space-3);
  }
  .gd-modal-head h2 {
    margin: 0;
    font-size: 15px;
  }
  .gd-count {
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
    color: var(--gd-accent);
    padding: 0 7px;
    font-size: var(--gd-font-size-small);
    line-height: 1.6;
  }
  .gd-x {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--gd-text-secondary);
    font-size: 18px;
    line-height: 1;
    padding: 2px 6px;
    cursor: pointer;
  }
  .gd-x:hover {
    color: var(--gd-text);
  }
  .gd-error {
    color: var(--gd-danger);
    font-size: var(--gd-font-size-small);
  }
  .gd-notice {
    color: var(--gd-warning);
    font-size: var(--gd-font-size-small);
  }
  .gd-muted {
    color: var(--gd-text-secondary);
    font-size: var(--gd-font-size-small);
  }
  .gd-modal h3 {
    margin: var(--gd-space-3) 0 var(--gd-space-2);
    font-size: 13px;
  }
  .gd-save-row {
    display: flex;
    gap: var(--gd-space-2);
  }
  .gd-save-row input {
    flex: 1;
    min-width: 0;
    background: var(--gd-background);
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
    color: var(--gd-text);
    padding: 6px 8px;
  }
  .gd-check {
    display: flex;
    gap: var(--gd-space-2);
    align-items: center;
    font-size: var(--gd-font-size-small);
    margin-top: var(--gd-space-2);
  }
  .gd-primary {
    padding: 6px 14px;
    cursor: pointer;
    white-space: nowrap;
  }
  .gd-stash-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .gd-stash-list li {
    padding: var(--gd-space-2) 0;
    border-top: 1px solid var(--gd-border);
  }
  .gd-stash-list li:last-child {
    border-bottom: 1px solid var(--gd-border);
  }
  .gd-stash-top {
    display: flex;
    gap: var(--gd-space-2);
    align-items: center;
  }
  .gd-stash-id {
    color: var(--gd-text-secondary);
    white-space: nowrap;
    font-size: var(--gd-font-size-small);
  }
  .gd-stash-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .gd-stash-actions {
    display: flex;
    gap: var(--gd-space-2);
    margin-left: auto;
  }
</style>
