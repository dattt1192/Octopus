<script lang="ts">
  import type { AppError, CommitDetails, CommitFileChange, DiffTarget, RefItem } from "../ipc/types";
  import { refBadge } from "../history/refs";
  import FileChangeRow from "./FileChangeRow.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import { pointFromContextEvent, type ContextMenuItem } from "../context-menu/model";
  let { details, loading, error, refs, selectedTarget, onOpen, onParentChange, onParentCommit, onRetry }: {
    details: CommitDetails | null; loading: boolean; error: AppError | null; refs: RefItem[]; selectedTarget: DiffTarget | null;
    onOpen: (id: string) => void; onParentChange: (index: number | null) => void; onParentCommit: (oid: string) => void; onRetry: () => void; onBack: () => void;
  } = $props();
  let query = $state("");
  let copyState = $state("");
  let fileMenu = $state<{ file: CommitFileChange; x: number; y: number } | null>(null);
  const files = $derived(details?.files.filter(f => `${f.path}\n${f.oldPath ?? ""}`.toLowerCase().includes(query.toLowerCase())) ?? []);
  const badges = $derived(refs.filter(r => r.oid === details?.oid).map(refBadge));
  const parent = $derived(details && details.parents.length ? details.parents[details.parentIndex ?? 0] : null);
  $effect(() => { details?.oid; query = ""; copyState = ""; });
  function formattedDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  async function copyOid(): Promise<void> {
    const oid = details?.oid;
    if (!oid) return;
    try {
      await navigator.clipboard.writeText(oid);
      if (details?.oid === oid) copyState = "Copied";
    } catch { if (details?.oid === oid) copyState = "Copy failed — select the hash to copy it."; }
  }
  function openFileMenu(event: MouseEvent | KeyboardEvent, file: CommitFileChange): void {
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromContextEvent(event);
    fileMenu = { file, x:point.left, y:point.top };
  }
  function fileMenuItems(file: CommitFileChange): ContextMenuItem[] {
    const items: ContextMenuItem[] = [
      { id:"open", label:"Open diff", action:() => onOpen(file.pathId) },
      { id:"copy-path", label:"Copy relative path", separatorBefore:true, action:() => navigator.clipboard.writeText(file.path) }
    ];
    if (file.oldPath) items.push({ id:"copy-original", label:"Copy original path", action:() => navigator.clipboard.writeText(file.oldPath ?? "") });
    return items;
  }
</script>

<div class="gd-details-content">
  {#if loading}<p class="gd-empty" role="status">Loading commit details…</p>
  {:else if error}<div class="gd-error" role="alert"><p>{error.message}</p><button class="gd-text-action" onclick={onRetry}>Retry</button></div>
  {:else if details}
    <header class="gd-commit-head">
      <span class="gd-eyebrow">Commit</span>
      <h2>{details.subject}</h2>
      <div class="gd-id-row">
        <code class="gd-oid" title={details.oid}>{details.oid.slice(0, 12)}</code>
        <button class="gd-copy" onclick={() => void copyOid()} aria-label="Copy full commit ID">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>
          {copyState === "Copied" ? "Copied" : "Copy"}
        </button>
      </div>
      {#if copyState && copyState !== "Copied"}<span class="gd-copy-status" role="status">{copyState}</span>{/if}
      {#if badges.length}<div class="gd-commit-refs">{#each badges as badge (badge.id)}<span class:remote={badge.kind === "remote"} title={badge.fullName}>{badge.source}<strong>{badge.name}</strong></span>{/each}</div>{/if}
    </header>
    <div class="gd-author-row">
      <span class="gd-avatar" aria-hidden="true">{details.authorName.trim().slice(0, 1).toUpperCase() || "?"}</span>
      <strong>{details.authorName}</strong>
      <time datetime={details.committedAt} title={details.committedAt}>{formattedDate(details.committedAt)}</time>
    </div>
    {#if details.body}<p class="gd-message">{details.body}</p>{/if}
    <div class="gd-compare-bar" aria-label="Parent comparison">
      <span class="gd-compare-label">Compare</span>
      {#if details.parents.length > 1}
        <select value={details.parentIndex ?? 0} onchange={e => onParentChange(Number(e.currentTarget.value))} aria-label="Compare to parent">
          {#each details.parents as p, i (p)}<option value={i}>Parent {i + 1}</option>{/each}
        </select>
        <span class="gd-compare-kind">Merge</span>
      {:else if details.parents.length === 0}
        <span class="gd-muted">Root commit · empty tree</span>
      {:else}
        <span class="gd-muted">1 parent</span>
      {/if}
      {#if parent}
        <button class="gd-parent-link" onclick={() => parent && onParentCommit(parent)} title={`View parent ${parent}`}>
          <code>{parent.slice(0, 8)}</code><span aria-hidden="true">→</span>
        </button>
      {/if}
    </div>
    <section class="gd-files" aria-label="Changed files">
      <div class="gd-section-heading"><h3>Changed files <span class="gd-count">{details.files.length}</span></h3><span>Click to view diff</span></div>
      {#if details.files.length}
        <input class="gd-file-search" type="search" aria-label="Filter changed files" placeholder="Filter files…" bind:value={query} />
        {#if files.length}<ul>{#each files as file (file.pathId)}
          <FileChangeRow path={file.path} oldPath={file.oldPath} status={file.status}
            selected={selectedTarget?.kind === "commit" && selectedTarget.pathId === file.pathId}
            contexted={fileMenu?.file.pathId === file.pathId}
            onOpen={() => onOpen(file.pathId)} onContextMenu={(event) => openFileMenu(event, file)} />
        {/each}</ul>{:else}<p class="gd-empty">No files match “{query}”.</p>{/if}
      {:else}<p class="gd-empty">No file changes for this comparison.</p>{/if}
    </section>
  {:else}<div class="gd-empty"><strong>Explore a commit</strong><p>Select a row in history to see its message, author and changed files.</p></div>{/if}
</div>
{#if fileMenu}<ContextMenu x={fileMenu.x} y={fileMenu.y} items={fileMenuItems(fileMenu.file)}
  label={`File actions for ${fileMenu.file.path}`} onClose={() => (fileMenu = null)} />{/if}

<style>
  .gd-details-content { flex: 1; min-height: 0; padding: 12px 14px 16px; overflow-y: auto; font-size: var(--gd-font-size); }
  .gd-commit-head { padding-bottom: 10px; border-bottom: 1px solid var(--gd-border); }
  .gd-eyebrow { font-size: var(--gd-font-size-small); color: var(--gd-text-secondary); }
  h2 { font-size: 15px; font-weight: 600; line-height: 1.45; margin: 6px 0 8px; overflow-wrap: anywhere; }
  .gd-id-row { display: flex; align-items: center; gap: var(--gd-space-2); }
  .gd-oid { color: var(--gd-text-secondary); font: 11px var(--gd-font-code); user-select: all; }
  .gd-copy { display: inline-flex; align-items: center; gap: 5px; background: transparent; color: var(--gd-text-secondary); border: 1px solid var(--gd-border); border-radius: var(--gd-radius-control); padding: 3px 8px; font-size: var(--gd-font-size-small); cursor: pointer; }
  .gd-copy:hover { color: var(--gd-accent); border-color: var(--gd-accent); }
  .gd-copy-status { display: block; color: var(--gd-warning); font-size: var(--gd-font-size-small); margin-top: 6px; }
  .gd-commit-refs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .gd-commit-refs>span { padding: 2px 7px; border: 1px solid var(--gd-border); border-radius: var(--gd-radius-control); font-size: var(--gd-font-size-small); color: var(--gd-accent); overflow-wrap: anywhere; }
  .gd-commit-refs .remote { color: var(--gd-lane-2); }
  .gd-commit-refs strong { margin-left: 6px; font-weight: 500; }
  .gd-author-row { display: flex; align-items: center; gap: 8px; margin: 12px 0; min-width: 0; }
  .gd-avatar { display: grid; place-items: center; width: 26px; height: 26px; flex: 0 0 auto; border-radius: var(--gd-radius-control); background: var(--gd-surface-raised); color: var(--gd-accent); font-size: var(--gd-font-size-small); }
  .gd-author-row strong { font-size: var(--gd-font-size); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gd-author-row time { margin-left: auto; flex: 0 0 auto; color: var(--gd-text-secondary); font-size: var(--gd-font-size-small); }
  .gd-message { font-size: var(--gd-font-size); color: var(--gd-text-secondary); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; margin: 0 0 12px; }
  .gd-compare-bar { display: flex; align-items: center; gap: var(--gd-space-2); padding: 9px 10px; background: var(--gd-canvas); border: 1px solid var(--gd-border); border-radius: var(--gd-radius-control); margin-bottom: 14px; }
  .gd-compare-label { font-size: var(--gd-font-size-small); font-weight: 600; }
  .gd-compare-bar select { flex: 0 1 auto; min-width: 0; border: 1px solid var(--gd-border); border-radius: var(--gd-radius-control); background: var(--gd-panel); color: var(--gd-text); font-size: var(--gd-font-size-small); padding: 4px 6px; }
  .gd-compare-kind { font-size: var(--gd-font-size-small); color: var(--gd-warning); }
  .gd-muted { font-size: var(--gd-font-size-small); color: var(--gd-text-secondary); }
  .gd-parent-link { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; background: transparent; border: 0; font-size: var(--gd-font-size-small); color: var(--gd-text-secondary); cursor: pointer; padding: 2px 0 2px 6px; white-space: nowrap; }
  .gd-parent-link:hover { color: var(--gd-accent); }
  .gd-parent-link code { color: var(--gd-accent); font-family: var(--gd-font-code); }
  .gd-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 8px; }
  .gd-section-heading h3 { margin: 0; font-size: var(--gd-font-size); font-weight: 600; }
  .gd-section-heading>span { font-size: var(--gd-font-size-small); color: var(--gd-text-secondary); }
  .gd-count { margin-left: 4px; color: var(--gd-text-secondary); font-weight: 400; }
  .gd-file-search { width: 100%; border: 1px solid var(--gd-border); border-radius: var(--gd-radius-control); background: var(--gd-canvas); color: var(--gd-text); font-size: var(--gd-font-size); padding: 6px 9px; margin-bottom: 8px; }
  ul { list-style: none; margin: 0 -6px; padding: 0; }
  .gd-empty { padding: 12px 0; color: var(--gd-text-secondary); font-size: var(--gd-font-size); line-height: 1.6; }
  .gd-error { color: var(--gd-danger); font-size: var(--gd-font-size); line-height: 1.5; }
  .gd-text-action { background: transparent; border: 0; color: var(--gd-accent); font-size: var(--gd-font-size); padding: 4px 0; cursor: pointer; }
  button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--gd-focus); outline-offset: 2px; }
</style>
