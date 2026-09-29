<script lang="ts">
  import { onMount } from "svelte";
  import { highlightDiffLine } from "../diff/highlight";
  import { mergeRowWindow, type MergePreviewLine } from "../conflict/merge";

  let { text, path, preview, manual, disabled, onChange }: {
    text: string; path: string; preview: MergePreviewLine[]; manual: boolean; disabled: boolean;
    onChange: (text: string) => void;
  } = $props();
  let input: HTMLTextAreaElement;
  let height = $state(300);
  let scrollTop = $state(0);
  let scrollLeft = $state(0);
  const lines = $derived(text.split("\n"));
  const window = $derived(mergeRowWindow(lines.length, scrollTop, height, 5));
  const visible = $derived(lines.slice(window.start, window.end).map((line, i) => ({
    html: highlightDiffLine(line || " ", path),
    number: window.start + i + 1,
    origin: manual ? (/^(<{7}|={7}|>{7}|\|{7})/.test(line) ? "marker" : "clean") : preview[window.start + i]?.origin ?? "clean"
  })));
  function syncScroll() { scrollTop = input.scrollTop; scrollLeft = input.scrollLeft; }
  export function revealLine(index: number) { input.scrollTop = Math.max(0, index * 22 - 44); syncScroll(); }
  onMount(() => {
    const observer = new ResizeObserver(() => { height = input.clientHeight; });
    observer.observe(input);
    return () => observer.disconnect();
  });
</script>

<div class="gd-result-editor gd-syntax">
  <div class="gd-editor-numbers" aria-hidden="true">
    <div style:transform={`translateY(${window.before - scrollTop}px)`}>
      {#each visible as line (line.number)}<div>{line.number}</div>{/each}
    </div>
  </div>
  <div class="gd-editor-code">
    <div class="gd-editor-highlight" aria-hidden="true">
      <div class="gd-editor-window" style:transform={`translate(${-scrollLeft}px, ${window.before - scrollTop}px)`}>
        {#each visible as line (line.number)}
          <div class:resolved={line.origin === "current" || line.origin === "incoming"} class:marker={line.origin === "marker"}><code>{@html line.html}</code></div>
        {/each}
      </div>
    </div>
    <textarea bind:this={input} aria-label="Edit merge result" value={text} {disabled} wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" onscroll={syncScroll} oninput={(event) => { onChange(event.currentTarget.value); syncScroll(); }}></textarea>
  </div>
</div>

<style>
  .gd-result-editor { flex: 1; min-height: 0; display: grid; grid-template-columns: 64px minmax(0, 1fr); font: var(--gd-font-size-small)/22px var(--gd-font-code); background: var(--gd-canvas); }
  .gd-editor-numbers { overflow: hidden; padding: 8px 8px 0 0; color: var(--gd-text-secondary); text-align: right; border-right: 1px solid var(--gd-border); user-select: none; }
  .gd-editor-numbers div div { height: 22px; }
  .gd-editor-code { position: relative; min-width: 0; min-height: 0; }
  .gd-editor-highlight { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .gd-editor-window { padding: 8px 12px; width: max-content; min-width: 100%; }
  .gd-editor-window > div { height: 22px; white-space: pre; }
  code { font: inherit; tab-size: 4; }
  .resolved { background: color-mix(in srgb, var(--gd-lane-4) 15%, var(--gd-canvas)); }
  .marker { background: color-mix(in srgb, var(--gd-warning) 10%, var(--gd-canvas)); }
  textarea { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 8px 12px; border: 0; resize: none; background: transparent; color: transparent; -webkit-text-fill-color: transparent; caret-color: var(--gd-text); font: inherit; line-height: 22px; tab-size: 4; white-space: pre; overflow: auto; border-radius: 0; }
  textarea::selection { background: color-mix(in srgb, var(--gd-focus) 30%, transparent); }
  textarea:focus-visible { outline: 2px solid var(--gd-focus); outline-offset: -2px; }
  textarea:disabled { opacity: .65; }
  @media (forced-colors: active) { textarea { color: CanvasText; -webkit-text-fill-color: CanvasText; } .gd-editor-highlight { visibility: hidden; } }
</style>
