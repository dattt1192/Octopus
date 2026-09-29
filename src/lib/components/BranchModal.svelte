<script lang="ts">
  // Branches dialog: tabbed create / local / remote-tracking views with a
  // two-step safe delete behind a confirmation token. Delete defaults to
  // Cancel. Each remote row keeps its own local-name draft.
  import type { AppError, RefItem } from "../ipc/types";
  import { suggestedTrackName } from "../refs/filter";

  interface DeleteConfirm {
    refId: string;
    summary: string;
  }

  type Tab = "create" | "local" | "remote";

  interface Props {
    localRefs: RefItem[];
    remoteRefs: RefItem[];
    initialTab: "create" | "local";
    startOidShort: string | null;
    startSource: "HEAD" | "commit";
    newName: string;
    switchAfter: boolean;
    busy: boolean;
    error: AppError | string | null;
    deleteConfirm: DeleteConfirm | null;
    onName: (value: string) => void;
    onSwitchAfter: (value: boolean) => void;
    onCreate: () => void;
    onSwitch: (refId: string) => void;
    onAskDelete: (refId: string) => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
    onTrack: (refId: string, name: string) => void;
    onClose: () => void;
  }

  let {
    localRefs,
    remoteRefs,
    initialTab,
    startOidShort,
    startSource,
    newName,
    switchAfter,
    busy,
    error,
    deleteConfirm,
    onName,
    onSwitchAfter,
    onCreate,
    onSwitch,
    onAskDelete,
    onConfirmDelete,
    onCancelDelete,
    onTrack,
    onClose
  }: Props = $props();

  let tabOverride: Tab | null = $state(null);
  let tab = $derived<Tab>(tabOverride ?? initialTab);
  let trackDrafts: Record<string, string> = $state({});
  let nameInput: HTMLInputElement | undefined = $state();

  function draftFor(ref: RefItem): string {
    return trackDrafts[ref.refId] ?? suggestedTrackName(ref.label);
  }

  function selectTab(next: Tab): void {
    tabOverride = next;
    if (next === "create") requestAnimationFrame(() => nameInput?.focus());
  }

  function submitTrack(ref: RefItem): void {
    const name = draftFor(ref).trim();
    if (!busy && name !== "") onTrack(ref.refId, name);
  }

  function shortOid(oid: string): string {
    return oid.slice(0, 8);
  }

  function keyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      if (deleteConfirm) onCancelDelete();
      else onClose();
    }
  }

  function errorText(e: AppError | string): string {
    return typeof e === "string" ? e : `${e.code}: ${e.message}`;
  }
</script>

<svelte:window onkeydown={keyDown} />

<div class="gd-modal-backdrop">
  <div class="gd-modal" role="dialog" aria-modal="true" aria-label="Branches">
    <h2>Branches</h2>
    {#if error}
      <p class="gd-error" role="alert">{errorText(error)}</p>
    {/if}

    {#if deleteConfirm}
      <section aria-label="Confirm delete">
        <h3>Delete this branch?</h3>
        <pre class="gd-summary">{deleteConfirm.summary}</pre>
        <div class="gd-modal-foot">
          <button type="button" class="gd-ghost" onclick={onCancelDelete} disabled={busy}>Cancel</button>
          <button type="button" class="gd-danger-btn" onclick={onConfirmDelete} disabled={busy}>
            {busy ? "Deleting…" : "Delete branch"}
          </button>
        </div>
      </section>
    {:else}
      <div class="gd-tabs" role="group" aria-label="Branch views">
        <button
          type="button"
          class="gd-tab"
          aria-pressed={tab === "create"}
          onclick={() => selectTab("create")}
        >
          New branch
        </button>
        <button
          type="button"
          class="gd-tab"
          aria-pressed={tab === "local"}
          onclick={() => selectTab("local")}
        >
          Local ({localRefs.length})
        </button>
        {#if remoteRefs.length > 0}
          <button
            type="button"
            class="gd-tab"
            aria-pressed={tab === "remote"}
            onclick={() => selectTab("remote")}
          >
            Remote ({remoteRefs.length})
          </button>
        {/if}
      </div>

      {#if tab === "create"}
        <section aria-label="Create branch">
          {#if startOidShort}
            <p class="gd-source">
              From {startSource === "commit" ? "commit" : "HEAD"}
              <code>{startOidShort}</code>
            </p>
            <form
              onsubmit={(e) => {
                e.preventDefault();
                if (!busy && newName.trim() !== "") onCreate();
              }}
            >
              <label class="gd-field">
                <span>Branch name</span>
                <input
                  type="text"
                  bind:this={nameInput}
                  value={newName}
                  oninput={(e) => onName(e.currentTarget.value)}
                  placeholder="feature/name"
                  aria-label="New branch name"
                  autocomplete="off"
                  spellcheck={false}
                />
              </label>
              <label class="gd-check">
                <input
                  type="checkbox"
                  checked={switchAfter}
                  onchange={(e) => onSwitchAfter(e.currentTarget.checked)}
                />
                Switch to the new branch
              </label>
              <div class="gd-modal-foot">
                <button type="button" class="gd-ghost" onclick={onClose} disabled={busy}>Close</button>
                <button type="submit" class="gd-primary-btn" disabled={busy || newName.trim() === ""}>
                  {busy ? "Creating…" : "Create branch"}
                </button>
              </div>
            </form>
          {:else}
            <p class="gd-muted">No commits yet — create the first commit before branching.</p>
            <div class="gd-modal-foot">
              <button type="button" class="gd-ghost" onclick={onClose} disabled={busy}>Close</button>
            </div>
          {/if}
        </section>
      {:else if tab === "local"}
        <section aria-label="Local branches">
          {#if localRefs.length === 0}
            <p class="gd-muted">No local branches.</p>
          {:else}
            <ul class="gd-rows">
              {#each localRefs as ref (ref.refId)}
                <li class="gd-row">
                  <code class="gd-name">{ref.label}</code>
                  <span class="gd-oid">{shortOid(ref.oid)}</span>
                  {#if ref.current}
                    <span class="gd-badge">current</span>
                  {:else}
                    <span class="gd-spacer"></span>
                    <button type="button" class="gd-link" onclick={() => onSwitch(ref.refId)} disabled={busy}>
                      Switch
                    </button>
                    {#if ref.checkedOutElsewhere}
                      <span class="gd-muted" title="Checked out in another worktree">elsewhere</span>
                    {:else}
                      <button type="button" class="gd-link gd-danger" onclick={() => onAskDelete(ref.refId)} disabled={busy}>
                        Delete
                      </button>
                    {/if}
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
          <div class="gd-modal-foot">
            <button type="button" class="gd-ghost" onclick={onClose} disabled={busy}>Close</button>
          </div>
        </section>
      {:else}
        <section aria-label="Remote branches">
          <p class="gd-muted">Track creates a local branch from the remote.</p>
          <ul class="gd-rows">
            {#each remoteRefs as ref (ref.refId)}
              <li class="gd-row gd-remote-row">
                <div class="gd-remote-id">
                  <code class="gd-name">{ref.label}</code>
                  <span class="gd-oid">{shortOid(ref.oid)}</span>
                </div>
                <form
                  class="gd-track-form"
                  onsubmit={(e) => {
                    e.preventDefault();
                    submitTrack(ref);
                  }}
                >
                  <input
                    type="text"
                    value={draftFor(ref)}
                    oninput={(e) => (trackDrafts[ref.refId] = e.currentTarget.value)}
                    placeholder={suggestedTrackName(ref.label)}
                    aria-label={`Local name for ${ref.label}`}
                    autocomplete="off"
                    spellcheck={false}
                  />
                  <button type="submit" class="gd-link" disabled={busy || draftFor(ref).trim() === ""}>
                    Track
                  </button>
                </form>
              </li>
            {/each}
          </ul>
          <div class="gd-modal-foot">
            <button type="button" class="gd-ghost" onclick={onClose} disabled={busy}>Close</button>
          </div>
        </section>
      {/if}
    {/if}
  </div>
</div>

<style>
  .gd-modal-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    z-index: 20;
  }
  .gd-modal {
    width: 520px;
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 96px);
    overflow-y: auto;
    padding: var(--gd-space-4);
    background: var(--gd-panel);
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-panel);
  }
  .gd-modal h2 {
    margin: 0 0 var(--gd-space-2);
    font-size: var(--gd-font-size-title);
  }
  .gd-tabs {
    display: flex;
    gap: 2px;
    padding: 2px;
    margin-bottom: var(--gd-space-3);
    background: var(--gd-canvas);
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
  }
  .gd-tab {
    flex: 1;
    padding: 6px 8px;
    font-size: var(--gd-font-size-small);
    color: var(--gd-text-secondary);
    background: transparent;
    border: 0;
    border-radius: var(--gd-radius-control);
    cursor: pointer;
    white-space: nowrap;
  }
  .gd-tab[aria-pressed="true"] {
    color: var(--gd-text);
    background: var(--gd-surface-raised);
  }
  .gd-source {
    margin: 0 0 var(--gd-space-2);
    font-size: var(--gd-font-size-small);
    color: var(--gd-text-secondary);
  }
  .gd-field {
    display: flex;
    flex-direction: column;
    gap: var(--gd-space-1);
    font-size: var(--gd-font-size-small);
    margin-top: var(--gd-space-2);
  }
  .gd-check {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--gd-space-2);
    font-size: var(--gd-font-size-small);
    margin-top: var(--gd-space-2);
  }
  .gd-modal input[type="text"] {
    padding: 6px 10px;
    color: var(--gd-text);
    background: var(--gd-canvas);
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
  }
  .gd-modal input[type="text"]:focus {
    outline: none;
    border-color: var(--gd-focus);
  }
  .gd-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
  }
  .gd-row {
    display: flex;
    align-items: center;
    gap: var(--gd-space-2);
    padding: 6px 10px;
    font-size: var(--gd-font-size-small);
    border-bottom: 1px solid var(--gd-border);
  }
  .gd-row:last-child {
    border-bottom: 0;
  }
  .gd-row:hover {
    background: var(--gd-surface-hover);
  }
  .gd-name {
    font-family: var(--gd-font-code);
  }
  .gd-oid {
    color: var(--gd-text-secondary);
    font-family: var(--gd-font-code);
  }
  .gd-badge {
    padding: 1px 8px;
    font-size: var(--gd-font-size-small);
    color: var(--gd-on-accent);
    background: var(--gd-accent);
    border-radius: var(--gd-radius-control);
  }
  .gd-spacer {
    flex: 1;
  }
  .gd-remote-row {
    align-items: center;
  }
  .gd-remote-id {
    display: flex;
    align-items: baseline;
    gap: var(--gd-space-2);
    min-width: 0;
    flex: 1;
  }
  .gd-track-form {
    display: flex;
    align-items: center;
    gap: var(--gd-space-1);
  }
  .gd-track-form input {
    width: 140px;
  }
  .gd-link {
    color: var(--gd-accent);
    background: transparent;
    border: 0;
    cursor: pointer;
    padding: 2px 4px;
    white-space: nowrap;
  }
  .gd-link:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .gd-danger {
    color: var(--gd-danger);
  }
  .gd-summary {
    font-size: var(--gd-font-size-small);
    background: var(--gd-canvas);
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
    padding: var(--gd-space-2);
    white-space: pre-wrap;
  }
  .gd-muted {
    color: var(--gd-text-secondary);
    font-size: var(--gd-font-size-small);
  }
  .gd-error {
    color: var(--gd-danger);
    font-size: var(--gd-font-size-small);
  }
  .gd-modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: var(--gd-space-2);
    margin-top: var(--gd-space-3);
  }
  .gd-ghost {
    padding: 6px 14px;
    border-radius: var(--gd-radius-control);
    cursor: pointer;
    color: var(--gd-text);
    background: transparent;
    border: 1px solid var(--gd-border);
  }
  .gd-ghost:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .gd-primary-btn {
    padding: 6px 14px;
    font-weight: 600;
    border-radius: var(--gd-radius-control);
    cursor: pointer;
    color: var(--gd-on-accent);
    background: var(--gd-accent);
    border: 0;
  }
  .gd-primary-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .gd-danger-btn {
    padding: 6px 14px;
    font-weight: 600;
    border-radius: var(--gd-radius-control);
    cursor: pointer;
    color: white;
    background: var(--gd-danger);
    border: 0;
  }
  .gd-danger-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  code {
    font-family: var(--gd-font-code);
  }
</style>
