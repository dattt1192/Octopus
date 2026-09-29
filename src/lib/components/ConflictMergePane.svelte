<script lang="ts">
  import { highlightDiffLine } from "../diff/highlight";
  import MergeResultEditor from "./MergeResultEditor.svelte";
  import type { AppError, ConflictHunks } from "../ipc/types";
  import { buildMergePreview, buildMergeSourceRows, countResolved, editableMergeText, mergeRowWindow, type MergePicks } from "../conflict/merge";

  interface Props {
    doc: ConflictHunks | null;
    loading: boolean;
    error: AppError | null;
    picks: MergePicks;
    manualText: string | null;
    onEdit: (text: string | null) => void;
    applying: boolean;
    autoResolving: boolean;
    onAutoResolve: () => void;
    applyDisabled: boolean;
    applyDisabledReason: string | null;
    applyError: AppError | string | null;
    notice: string | null;
    onTakeSide: (hunkId: string, side: "current" | "incoming") => void;
    onToggleLine: (hunkId: string, side: "current" | "incoming", index: number) => void;
    onClearBlock: (hunkId: string) => void;
    onApply: () => void;
    onRetry: () => void;
    onClose: () => void;
  }

  let {
    doc, loading, error, picks, manualText, onEdit, applying, autoResolving, onAutoResolve, applyDisabled, applyDisabledReason,
    applyError, notice, onTakeSide, onToggleLine, onClearBlock, onApply, onRetry, onClose
  }: Props = $props();

  let sourceViewport = $state<HTMLDivElement>();
  let resultEditor = $state<MergeResultEditor>();
  let sourceTop = $state(0);
  let sourceHeight = $state(300);
  let scrollbarWidth = $state(0);
  let discardEdits = $state(false);
  let scrollFrame = 0;
  const horizontalElements = new Map<string, HTMLElement>();
  function horizontalPair(element: HTMLElement, key: string) {
    horizontalElements.set(key, element);
    const peerKey = key.endsWith(":bar") ? key.replace(":bar", ":code") : key.replace(":code", ":bar");
    function sync() {
      const peer = horizontalElements.get(peerKey);
      if (peer && peer.scrollLeft !== element.scrollLeft) peer.scrollLeft = element.scrollLeft;
    }
    element.addEventListener("scroll", sync, { passive: true });
    return { destroy() { element.removeEventListener("scroll", sync); horizontalElements.delete(key); } };
  }
  function measureSource(element: HTMLDivElement) {
    const observer = new ResizeObserver(() => { sourceHeight = element.clientHeight; scrollbarWidth = element.offsetWidth - element.clientWidth; });
    observer.observe(element);
    return { destroy() { observer.disconnect(); cancelAnimationFrame(scrollFrame); scrollFrame = 0; } };
  }
  let selectedHunk = $state<string | null>(null);
  const blocks = $derived(doc?.segments.filter((s) => s.kind === "conflict") ?? []);
  const activeIndex = $derived(Math.max(0, blocks.findIndex((b) => b.hunkId === selectedHunk)));
  const activeBlock = $derived(blocks[activeIndex]);
  const preview = $derived(doc ? buildMergePreview(doc.segments, picks) : []);
  const counts = $derived(doc ? countResolved(doc.segments, picks) : { resolved: 0, remaining: 0 });
  const resultText = $derived(doc ? (manualText ?? editableMergeText(doc, picks)) : "");
  const locked = $derived(applying || autoResolving || loading);
  const sourceLocked = $derived(locked || manualText !== null);
  const panes = $derived(doc ? [
    { side: "current" as const, label: doc.currentLabel, rows: buildMergeSourceRows(doc.segments, "current") },
    { side: "incoming" as const, label: doc.incomingLabel, rows: buildMergeSourceRows(doc.segments, "incoming") }
  ].map((pane) => ({ ...pane,
    rows: pane.rows.map((row) => ({ ...row, html: highlightDiffLine(row.text || " ", doc.displayPath) })),
    width: pane.rows.reduce((max, row) => Math.max(max, row.text.replace(/\t/g, "    ").length), 1)
  })) : []);
  const sourceWindow = $derived(mergeRowWindow(panes[0]?.rows.length ?? 0, sourceTop, sourceHeight));
  const pickOrders = $derived(Object.fromEntries(Object.entries(picks).map(([id, lines]) => [
    id, new Map(lines.map((line, index) => [`${line.side}:${line.index}`, index + 1]))
  ])));

  function goToBlock(index: number): void {
    const block = blocks[index];
    if (!block) return;
    selectedHunk = block.hunkId;
    const row = panes[0]?.rows.findIndex((row) => row.conflict?.hunkId === block.hunkId) ?? -1;
    if (row >= 0 && sourceViewport) { sourceViewport.scrollTop = Math.max(0, row * 22 - 44); sourceTop = sourceViewport.scrollTop; }
    if (manualText === null) {
      const resultLine = preview.findIndex((line) => line.hunkId === block.hunkId);
      if (resultLine >= 0) resultEditor?.revealLine(resultLine);
    }
  }

  function sourceScroll(): void {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { sourceTop = sourceViewport?.scrollTop ?? 0; scrollFrame = 0; });
  }

  function applyErrorText(e: AppError | string): string {
    return typeof e === "string" ? e : `${e.code}: ${e.message}`;
  }
</script>

<section class="gd-merge" aria-label="Conflict merge editor">
  <header class="gd-merge-head">
    <span class="gd-merge-title" title={doc?.displayPath}>Conflict{doc ? ` · ${doc.displayPath}` : ""}</span>
    <button type="button" class="gd-close" onclick={onClose} aria-label="Close merge editor" disabled={applying || autoResolving}>×</button>
  </header>

  {#if loading && !doc}
    <p class="gd-state" role="status">Loading conflict file…</p>
  {:else if error && !doc}
    <div class="gd-state" role="alert">
      <p>{error.message}</p>
      <button type="button" class="gd-mini" onclick={onRetry}>Retry</button>
    </div>
  {:else if doc}
    <div class="gd-conflict-nav" aria-label="Conflict navigation">
      <button type="button" class="gd-mini" aria-label="Previous conflict" disabled={locked || activeIndex === 0} onclick={() => goToBlock(activeIndex - 1)}>↑</button>
      <button type="button" class="gd-mini" aria-label="Next conflict" disabled={locked || activeIndex >= blocks.length - 1} onclick={() => goToBlock(activeIndex + 1)}>↓</button>
      <span>{blocks.length ? `Conflict ${activeIndex + 1} of ${blocks.length}` : "No conflict blocks"}</span>
      <button type="button" class="gd-mini gd-auto" disabled={sourceLocked || applyDisabled || counts.remaining === 0} title={manualText !== null ? "Save or discard manual edits before auto resolving" : "Merge identical or non-overlapping changes using the base"} onclick={onAutoResolve}>{autoResolving ? "Resolving…" : "Auto resolve"}</button>
      {#if activeBlock}
        <button type="button" class="gd-mini gd-clear" disabled={sourceLocked || picks[activeBlock.hunkId] === undefined} onclick={() => onClearBlock(activeBlock.hunkId)}>Clear block</button>
      {/if}
    </div>
    {#if loading}<p class="gd-inline-state" role="status">Refreshing conflict file…</p>{/if}
    {#if error}<p class="gd-inline-state gd-error" role="alert">{error.message} <button type="button" class="gd-mini" onclick={onRetry}>Reload and discard edits</button></p>{/if}
    {#if blocks.length === 0}<p class="gd-inline-state" role="status">No conflict markers remain. Review the file, then mark it resolved.</p>{/if}

    <div class="gd-source-heads">
      {#each panes as pane (pane.side)}
        <header class="gd-pane-head" class:gd-incoming={pane.side === "incoming"}>
          <span class="gd-side-badge" aria-hidden="true">{pane.side === "current" ? "A" : "B"}</span>
          <h3 title={pane.label}>{pane.side === "current" ? "Current" : "Incoming"} · {pane.label}</h3>
          {#if activeBlock}<button type="button" class="gd-mini" disabled={sourceLocked} title={`Take ${pane.side} for conflict ${activeIndex + 1}`} onclick={() => onTakeSide(activeBlock.hunkId, pane.side)}>Take {pane.side}</button>{/if}
        </header>
      {/each}
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex: shared native viewport supports keyboard scrolling -->
    <div class="gd-source-viewport" bind:this={sourceViewport} use:measureSource tabindex="0" role="region" aria-label="Conflict source files" onscroll={sourceScroll}>
    <div style:height={`${sourceWindow.before}px`}></div>
    <div class="gd-merge-cols gd-syntax">
      {#each panes as pane (pane.side)}
        <section class="gd-merge-pane" class:gd-incoming={pane.side === "incoming"} aria-label={`${pane.side === "current" ? "Current" : "Incoming"} · ${pane.label}`}>
          <div class="gd-source-scroll" use:horizontalPair={`${pane.side}:code`} role="region" aria-label={`${pane.side} file content`}>
            <ol class="gd-code-lines" style:min-width={`max(100%, calc(${pane.width}ch + 110px))`}>
              {#each pane.rows.slice(sourceWindow.start, sourceWindow.end) as row, rowIndex (sourceWindow.start + rowIndex)}
                {@const conflict = row.conflict}
                {@const order = conflict && conflict.index !== null ? (pickOrders[conflict.hunkId]?.get(`${pane.side}:${conflict.index}`) ?? null) : null}
                {@const emptyPicked = conflict?.empty && picks[conflict.hunkId]?.length === 0}
                <li class="gd-code-line" class:is-conflict={conflict !== null} class:is-picked={order !== null || emptyPicked} class:is-padding={row.lineNumber === null} data-hunk={conflict?.hunkId}>
                  <span class="gd-gutter">
                    {#if conflict && (conflict.index !== null || conflict.empty)}
                      <input
                        type="checkbox"
                        checked={order !== null || emptyPicked}
                        disabled={sourceLocked}
                        aria-label={conflict.empty ? `Take empty ${pane.side} side of conflict ${conflict.blockNumber}` : `Include ${pane.side} line ${row.lineNumber} of conflict ${conflict.blockNumber}`}
                        title={order !== null ? `Position ${order} in resolved block` : `Include in result · conflict ${conflict.blockNumber}`}
                        onchange={() => {
                          selectedHunk = conflict.hunkId;
                          if (conflict.index !== null) onToggleLine(conflict.hunkId, pane.side, conflict.index);
                          else if (emptyPicked) onClearBlock(conflict.hunkId);
                          else onTakeSide(conflict.hunkId, pane.side);
                        }}
                      />
                    {/if}
                    <span class="gd-line-no" aria-hidden="true">{row.lineNumber ?? ""}</span>
                  </span>
                  <code>{#if conflict?.empty}(empty side){:else}{@html row.html}{/if}</code>
                  {#if order !== null}<span class="gd-order" title={`Position ${order} in resolved block`}>{order}</span>{/if}
                </li>
              {/each}
            </ol>
            {#if pane.rows.length === 0}<p class="gd-state">Empty file</p>{/if}
          </div>
        </section>
      {/each}
    </div>
    <div style:height={`${sourceWindow.after}px`}></div>
    </div>
    <div class="gd-source-bars" style:padding-right={`${scrollbarWidth}px`}>
      {#each panes as pane (pane.side)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex: native horizontal scrollbar is keyboard accessible -->
        <div class="gd-source-bar" use:horizontalPair={`${pane.side}:bar`} tabindex="0" role="region" aria-label={`Scroll ${pane.side} file horizontally`}>
          <div style:width={`max(100%, calc(${pane.width}ch + 110px))`}></div>
        </div>
      {/each}
    </div>

    <section class="gd-merge-result" aria-label="Merge result preview">
      <header class="gd-result-head">
        <h3>Result</h3>
        {#if manualText !== null}
          <span class="gd-result-count" role="status">Manual edits</span>
          {#if discardEdits}
            <span>Discard manual edits?</span>
            <button class="gd-mini" disabled={locked} onclick={() => { onEdit(null); discardEdits = false; }}>Discard edits</button>
            <button class="gd-mini" onclick={() => discardEdits = false}>Cancel</button>
          {:else}<button class="gd-mini" disabled={locked} onclick={() => discardEdits = true}>Use selections</button>{/if}
        {:else}<span class="gd-result-count" role="status">{counts.resolved}/{counts.resolved + counts.remaining} resolved · Editable</span>{/if}
      </header>
      <MergeResultEditor bind:this={resultEditor} text={resultText} path={doc.displayPath} {preview} manual={manualText !== null} disabled={locked} onChange={onEdit} />
    </section>

    <footer class="gd-merge-foot">
      <div class="gd-merge-status">
        <span class="gd-hint">{manualText !== null ? "Save or discard manual edits to resume source selections." : "Select source lines or edit the result directly. Unresolved blocks keep markers."}</span>
        {#if notice}<span role="status">{notice}</span>{/if}
        {#if applyError}<span class="gd-error" role="alert">{applyErrorText(applyError)}</span>{/if}
      </div>
      <button type="button" class="gd-apply" disabled={locked || applyDisabled || (manualText === null && counts.resolved === 0)} title={applyDisabled ? (applyDisabledReason ?? "Resolve is unavailable") : "Write the result into the working file"} onclick={onApply}>
        {applying ? "Saving…" : manualText !== null ? "Save result" : `Apply (${counts.resolved}/${counts.resolved + counts.remaining})`}
      </button>
    </footer>
  {/if}
</section>

<style>
  .gd-merge { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; background: var(--gd-canvas); border-left: 1px solid var(--gd-border); font-size: var(--gd-font-size); }
  .gd-merge-head, .gd-conflict-nav, .gd-pane-head, .gd-result-head { display: flex; align-items: center; gap: 8px; flex-shrink: 0; min-height: 32px; padding: 4px 10px; background: var(--gd-panel); border-bottom: 1px solid var(--gd-border); }
  .gd-merge-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gd-close { margin-left: auto; background: transparent; border: 0; color: var(--gd-text-secondary); font-size: 16px; cursor: pointer; padding: 2px 6px; }
  .gd-close:hover { color: var(--gd-text); }
  .gd-conflict-nav { color: var(--gd-text-secondary); font-size: var(--gd-font-size-small); }
  .gd-auto { margin-left: auto; }
  .gd-state { padding: 12px; color: var(--gd-text-secondary); }
  .gd-state p { margin: 0 0 8px; }
  .gd-inline-state { margin: 0; padding: 6px 10px; }
  .gd-merge-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 0; }
  .gd-merge-pane { --side-color: var(--gd-lane-2); display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .gd-merge-pane.gd-incoming { --side-color: var(--gd-warning); border-left: 1px solid var(--gd-border); }
  .gd-source-heads { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); flex-shrink: 0; }
  .gd-source-bars { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); flex-shrink: 0; }
  .gd-source-bar { overflow-x: auto; height: 10px; font: var(--gd-font-size-small)/22px var(--gd-font-code); }
  .gd-source-bar > div { height: 1px; }
  .gd-source-scroll { scrollbar-width: none; }
  .gd-source-scroll::-webkit-scrollbar { display: none; }
  .gd-pane-head { --side-color: var(--gd-lane-2); flex-wrap: wrap; }
  .gd-pane-head.gd-incoming { --side-color: var(--gd-warning); border-left: 1px solid var(--gd-border); }
  .gd-source-viewport { flex: 1 1 0; min-height: 0; overflow-y: auto; overflow-x: hidden; border-bottom: 1px solid var(--gd-border); overflow-anchor: none; }
  .gd-source-scroll { min-width: 0; overflow-x: auto; }

  .gd-pane-head h3 { flex: 1; min-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  h3 { margin: 0; font-size: var(--gd-font-size-small); font-weight: 600; }
  .gd-side-badge { color: var(--side-color); border: 1px solid currentColor; font: 600 11px var(--gd-font-code); padding: 0 3px; }
  .gd-code-lines { width: max-content; min-width: 100%; list-style: none; margin: 0; padding: 0; font: var(--gd-font-size-small)/22px var(--gd-font-code); }
  .gd-code-line { display: flex; align-items: center; height: 22px; padding-right: 12px; border-left: 3px solid transparent; }
  .gd-gutter { position: sticky; left: 0; z-index: 1; align-self: stretch; display: flex; align-items: center; justify-content: flex-end; gap: 6px; width: 68px; flex: 0 0 68px; padding: 0 8px 0 4px; background: var(--gd-canvas); user-select: none; }
  .gd-gutter input { flex: 0 0 13px; width: 13px; height: 13px; margin: 0; accent-color: var(--side-color); cursor: pointer; }
  .gd-line-no { min-width: 4ch; color: var(--gd-text-secondary); text-align: right; }
  .gd-code-line code { padding-left: 8px; white-space: pre; font: inherit; tab-size: 4; }
  .is-conflict { border-left-color: var(--side-color); background: color-mix(in srgb, var(--side-color) 13%, var(--gd-canvas)); }
  .is-conflict .gd-gutter { background: color-mix(in srgb, var(--side-color) 13%, var(--gd-canvas)); }
  .is-conflict.is-picked, .is-picked .gd-gutter { background: color-mix(in srgb, var(--side-color) 25%, var(--gd-canvas)); }
  .is-padding code { color: var(--gd-text-secondary); font-style: italic; }
  .gd-order { margin-left: 12px; color: var(--side-color); font-size: 10px; border: 1px solid currentColor; border-radius: 3px; padding: 0 4px; line-height: 14px; }
  .gd-mini { padding: 2px 6px; font-size: var(--gd-font-size-small); color: var(--gd-text); background: transparent; border: 1px solid var(--gd-border); border-radius: var(--gd-radius-control); cursor: pointer; white-space: nowrap; }
  .gd-mini:hover:not(:disabled) { background: var(--gd-surface-hover); }
  button:disabled, input:disabled { opacity: 0.55; cursor: not-allowed; }
  .gd-merge-result { flex: 1 1 0; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  .gd-result-count { margin-left: auto; color: var(--gd-text-secondary); font-size: var(--gd-font-size-small); }
  .gd-merge-foot { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-top: 1px solid var(--gd-border); background: var(--gd-panel); }
  .gd-merge-status { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; font-size: var(--gd-font-size-small); color: var(--gd-text-secondary); }
  .gd-error { color: var(--gd-danger); }
  .gd-apply { padding: 6px 14px; font-weight: 600; border-radius: var(--gd-radius-control); cursor: pointer; color: var(--gd-on-accent); background: var(--gd-accent); border: 0; white-space: nowrap; }
  button:focus-visible, input:focus-visible, .gd-source-viewport:focus-visible { outline: 2px solid var(--gd-focus); outline-offset: -2px; }
</style>
