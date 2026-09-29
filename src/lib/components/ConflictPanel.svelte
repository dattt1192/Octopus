<script lang="ts">
  // Conflict inspector panel (T13): file list, base/current/incoming
  // preview, whole-file accept behind confirmation, mark resolved
  // (working file or confirmed deletion), complete and abort.
  import FileChangeRow from "./FileChangeRow.svelte";
  import { neighborRowIndex } from "./file-row-nav";
  import type { AppError, ConflictFile, ConflictPreview } from "../ipc/types";

  interface AcceptConfirm {
    side: string;
    summary: string;
    token: string;
  }

  interface Props {
    mergeBanner: string | null;
    files: ConflictFile[];
    filesLoading: boolean;
    filesError: AppError | null;
    selectedPathId: string | null;
    preview: ConflictPreview | null;
    previewLoading: boolean;
    previewError: AppError | null;
    busy: string | null;
    actionError: AppError | null;
    notice: string | null;
    mergeSubject: string;
    reviewedStaged: boolean;
    canComplete: boolean;
    canAbort: boolean;
    abortReason: string | null;
    abortConfirm: string | null;
    acceptConfirm: AcceptConfirm | null;
    trustBlocked: boolean;
    onSelectFile: (pathId: string) => void;
    onReload: () => void;
    onAskAccept: (side: string) => void;
    onConfirmAccept: () => void;
    onCancelAccept: () => void;
    onMarkWorking: () => void;
    onMarkDeletion: () => void;
    onMergeSubject: (value: string) => void;
    onComplete: () => void;
    onAskAbort: () => void;
    onConfirmAbort: () => void;
    onCancelAbort: () => void;
    onBack: () => void;
  }

  let {
    mergeBanner,
    files,
    filesLoading,
    filesError,
    selectedPathId,
    preview,
    previewLoading,
    previewError,
    busy,
    actionError,
    notice,
    mergeSubject,
    reviewedStaged,
    canComplete,
    canAbort,
    abortReason,
    abortConfirm,
    acceptConfirm,
    trustBlocked,
    onSelectFile,
    onReload,
    onAskAccept,
    onConfirmAccept,
    onCancelAccept,
    onMarkWorking,
    onMarkDeletion,
    onMergeSubject,
    onComplete,
    onAskAbort,
    onConfirmAbort,
    onCancelAbort
  }: Props = $props();

  let collapsed = $state(false);
  function fileListKey(event: KeyboardEvent): void {
    const list = event.currentTarget as HTMLElement;
    const rows = [...list.querySelectorAll<HTMLButtonElement>(".gd-file")];
    const current = rows.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    const next = neighborRowIndex(rows.length, current, event.key);
    if (next === null) return;
    event.preventDefault();
    rows[next].focus();
    rows[next].click();
  }

  function errorText(e: AppError): string {
    return `${e.code}: ${e.message}`;
  }

  function kindLabel(kind: string): string {
    if (kind === "text") return "Text conflict";
    if (kind === "addAdd") return "Added on both sides";
    if (kind === "modifyDelete") return "Modified here, deleted there";
    if (kind === "binary") return "Binary conflict";
    if (kind === "symlink") return "Symlink conflict";
    if (kind === "submodule") return "Submodule conflict";
    return "Unsupported conflict";
  }
</script>

<div class="gd-inspector-body">
  <div class="gd-conflict-heading"><span aria-hidden="true">⚠</span><strong>{files.length ? "Merge conflicts detected" : "Conflict resolution"}</strong></div>
  {#if preview}
    <p class="gd-merging">Merging <span>{preview.incomingLabel}</span> into <span>{preview.currentLabel}</span></p>
  {:else if mergeBanner}<p class="gd-banner">{mergeBanner}</p>{/if}
  {#if actionError}
    <p class="gd-error" role="alert">{errorText(actionError)}</p>
  {/if}
  {#if notice}
    <p class="gd-notice" role="status">{notice}</p>
  {/if}

  <div class="gd-work-head">
    <button class="gd-group-toggle" aria-expanded={!collapsed} onclick={() => collapsed = !collapsed}><span aria-hidden="true">{collapsed ? "▸" : "▾"}</span> Conflicted Files <span class="gd-count">{files.length}</span></button>
    <button type="button" class="gd-back" onclick={onReload} disabled={filesLoading || busy !== null} title="Re-read the unmerged index">
      {filesLoading ? "Loading…" : "Refresh"}
    </button>
  </div>
  {#if filesError}
    <p class="gd-error" role="alert">{errorText(filesError)}</p>
  {:else if filesLoading && files.length === 0}
    <p class="gd-muted" role="status">Loading conflicts…</p>
  {:else if files.length === 0}
    <p class="gd-muted">
      {#if canComplete}
        No unmerged files. Review the staged result, then complete the merge below.
      {:else}
        No unmerged files and no merge in progress.
      {/if}
    </p>
  {:else}
    {#if !collapsed}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions: delegates navigation between existing file buttons -->
      <ul class="gd-conflict-list" aria-label="Conflicted files" onkeydown={fileListKey}>
        {#each files as file (file.pathId)}
          <FileChangeRow path={file.displayPath} status="U" selected={selectedPathId === file.pathId} onOpen={() => onSelectFile(file.pathId)} />
        {/each}
      </ul>
    {/if}
  {/if}

  {#if previewLoading}
    <p class="gd-muted" role="status">Loading preview…</p>
  {:else if previewError}
    <p class="gd-error" role="alert">{errorText(previewError)}</p>
  {:else if preview}
    <section aria-label="Conflict preview">
      <h3 class="gd-selected-path" title={preview.displayPath}>{preview.displayPath}</h3>
      <p class="gd-muted">{kindLabel(files.find((file) => file.pathId === selectedPathId)?.kind ?? "unknown")}</p>
      {#if !preview.supportedActions.length && preview.supportReason}
        <p class="gd-muted">{preview.supportReason}</p>
      {/if}
      {#if preview.supportedActions.length > 0}
        <div class="gd-conflict-actions">
          {#if preview.supportedActions.includes("current")}
            <button type="button" disabled={busy !== null || trustBlocked} onclick={() => onAskAccept("current")} title="Overwrite the working file with the current version (asks confirmation)">
              {busy === "accept-current" ? "Working…" : `Use current (${preview.currentLabel})`}
            </button>
          {/if}
          {#if preview.supportedActions.includes("incoming")}
            <button type="button" disabled={busy !== null || trustBlocked} onclick={() => onAskAccept("incoming")} title="Overwrite the working file with the incoming version (asks confirmation)">
              {busy === "accept-incoming" ? "Working…" : `Use incoming (${preview.incomingLabel})`}
            </button>
          {/if}
        </div>
        {#if acceptConfirm}
          <section aria-label="Confirm accept">
            <pre class="gd-summary">{acceptConfirm.summary}</pre>
            <div class="gd-conflict-actions">
              <button type="button" disabled={busy !== null} onclick={onConfirmAccept}>Confirm overwrite</button>
              <button type="button" onclick={onCancelAccept}>Cancel</button>
            </div>
          </section>
        {/if}
        <div class="gd-conflict-actions">
          <button type="button" disabled={busy !== null || trustBlocked} onclick={onMarkWorking} title="Stage the working file as resolved (only this file)">
            {busy === "resolve" ? "Staging…" : "Mark resolved (working file)"}
          </button>
          <button type="button" disabled={busy !== null || trustBlocked} onclick={onMarkDeletion} title="Stage the deletion (the file must already be removed)">
            Mark resolved (deletion)
          </button>
        </div>
      {:else if preview.supportReason}
        <div class="gd-conflict-actions">
          <button type="button" disabled={busy !== null || trustBlocked} onclick={onMarkWorking} title="Stage after resolving outside the app">
            Mark resolved (working file)
          </button>
          <button type="button" disabled={busy !== null || trustBlocked} onclick={onMarkDeletion} title="Stage the deletion (the file must already be removed)">
            Mark resolved (deletion)
          </button>
        </div>
      {/if}
    </section>
  {/if}

  {#if canComplete}
    <section aria-label="Complete merge">
      <h3>Complete merge</h3>
      <label class="gd-field">
        <span>Subject</span>
        <input
          type="text"
          value={mergeSubject}
          maxlength={500}
          placeholder="Merge feature into main"
          oninput={(e) => onMergeSubject(e.currentTarget.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy !== null || trustBlocked || !reviewedStaged || mergeSubject.trim() === ""}
        title={trustBlocked
          ? "Trust the repository first"
          : !reviewedStaged
            ? "Loading the conflict list counts as review"
            : mergeSubject.trim() === ""
              ? "Write a merge subject first"
              : "Create the merge commit (must have two parents)"}
        onclick={onComplete}
      >
        {busy === "complete" ? "Completing…" : "Complete merge"}
      </button>
    </section>
  {/if}

  {#if canAbort}
    {#if abortConfirm}
      <section aria-label="Confirm abort">
        <pre class="gd-summary">{abortConfirm}</pre>
        <div class="gd-conflict-actions">
          <button type="button" disabled={busy !== null} onclick={onConfirmAbort}>Confirm abort</button>
          <button type="button" onclick={onCancelAbort}>Cancel</button>
        </div>
      </section>
    {:else}
      <button type="button" disabled={busy !== null || trustBlocked} onclick={onAskAbort} title="Abort the app-started merge and return to the pre-merge HEAD (asks confirmation)">
        Abort merge
      </button>
    {/if}
  {:else if abortReason}
    <p class="gd-muted">{abortReason}</p>
  {/if}
</div>

<style>
  .gd-inspector-body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 8px;
  }
  .gd-inspector-body h3 {
    margin: var(--gd-space-3) 0 var(--gd-space-1);
    font-size: 13px;
  }

  .gd-banner {
    background: var(--gd-surface-raised);
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
    padding: var(--gd-space-2) var(--gd-space-3);
    font-size: var(--gd-font-size-small);
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
  .gd-work-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gd-space-2);
  }
  .gd-conflict-list {
    list-style: none;
    margin: 4px 0 12px;
    padding: 0;
    max-height: 250px;
    min-height: 100px;
    overflow-y: auto;
  }

  .gd-conflict-actions {
    display: flex;
    gap: var(--gd-space-2);
    margin: var(--gd-space-2) 0;
    flex-wrap: wrap;
  }
  .gd-summary {
    background: var(--gd-canvas);
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
    padding: var(--gd-space-2);
    white-space: pre-wrap;
    font-size: var(--gd-font-size-small);
  }
  .gd-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: var(--gd-space-2);
    font-size: var(--gd-font-size-small);
  }
  .gd-field input {
    background: var(--gd-background);
    border: 1px solid var(--gd-border);
    border-radius: var(--gd-radius-control);
    color: var(--gd-text);
    padding: 6px 8px;
  }
  .gd-conflict-heading { display: flex; justify-content: center; gap: 8px; padding: 10px 4px; color: var(--gd-warning); border-bottom: 1px solid var(--gd-border); }
  .gd-merging { text-align: center; font-size: var(--gd-font-size-small); color: var(--gd-text-secondary); padding: 10px 0; }
  .gd-merging span { padding: 2px 5px; background: var(--gd-surface-raised); border-radius: 3px; color: var(--gd-focus); }
  .gd-work-head { padding: 6px 4px; border-bottom: 1px solid var(--gd-border); }
  .gd-group-toggle { display: flex; align-items: center; gap: 6px; border: 0; background: transparent; padding: 0; font: 600 12px var(--gd-font-ui); color: var(--gd-text); cursor: pointer; }
  .gd-count { border-radius: 3px; padding: 1px 5px; background: var(--gd-surface-raised); color: var(--gd-text-secondary); font-size: 10px; }
  .gd-selected-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button { padding: 5px 8px; background: transparent; border: 1px solid var(--gd-border); border-radius: 4px; color: var(--gd-text); cursor: pointer; font-size: var(--gd-font-size-small); }
  button:disabled { opacity: .5; cursor: not-allowed; }
  button:hover:not(:disabled) { background: var(--gd-surface-hover); }
  button:focus-visible { outline: 2px solid var(--gd-focus); }
</style>
