<script lang="ts">
  import ConflictMergePane from "../../src/lib/components/ConflictMergePane.svelte";
  import { takeSide, toggleLine, type MergePicks } from "../../src/lib/conflict/merge";
  import type { AppError, ConflictHunks, MergeSegment } from "../../src/lib/ipc/types";

  const block = (hunkId: string, current: string[], incoming: string[]): MergeSegment => ({
    kind: "conflict", hunkId, current, incoming, base: [],
    raw: ["<<<<<<< HEAD", ...current, "=======", ...incoming, ">>>>>>> feature/layout", ""].join("\n")
  });
  const sample: ConflictHunks = {
    pathId: "fixture", displayPath: "src/styles/layout.css", currentLabel: "main", incomingLabel: "feature/layout",
    workingFingerprint: "fixture", workingText: "", conflictCount: 3,
    segments: [
      { kind: "clean", lines: ["/* Shared styles */", "body {", "  font-family: system-ui;", "}", "", ".panel {"] },
      block("spacing", ["  margin: 10px;", "  padding: 10px;", "  border: 0;"], ["  margin: 20px;", "  padding: 20px;"]),
      { kind: "clean", lines: ["  display: flex;", "}", "", ...Array.from({ length: 45 }, (_, i) => `/* Shared context ${i + 1} */`), ".title {"] },
      block("title", ["  color: white;"], ["  color: mintcream;", "  font-weight: 600;"]),
      { kind: "clean", lines: ["}", "", ".legacy {"] },
      block("deletion", [], ["  text-transform: uppercase;"]),
      { kind: "clean", lines: ["}", "", `/* ${"Long unchanged line. ".repeat(35)}*/`, "/* End of file */"] }
    ]
  };
  sample.workingText = sample.segments.map((part) => part.kind === "clean" ? part.lines.join("\n") + "\n" : part.raw).join("");
  let manualText = $state<string | null>(null);
  let fixtureMode = $state("ready");
  let picks: MergePicks = $state({});
  let applied = $state<string | null>(null);
  const large = { ...sample, segments: [{ kind: "clean" as const, lines: Array.from({ length: 4000 }, (_, i) => `/* Context line ${i + 1} */`) }, ...sample.segments] };
  large.workingText = large.segments.map((part) => part.kind === "clean" ? part.lines.join("\n") + "\n" : part.raw).join("");
  const doc = $derived(fixtureMode === "loading" || fixtureMode === "error" ? null : fixtureMode === "empty" ? { ...sample, conflictCount: 0, segments: [], workingText: "" } : fixtureMode === "large" ? large : sample);
  const error: AppError = { code: "GIT_ERROR", message: "Fixture read failed. Retry to reload the conflict file.", retryable: true, recovery: "retryRead" };
  function clear(hunkId: string) {
    const next = { ...picks };
    delete next[hunkId];
    picks = next;
  }
</script>

<main>
  <nav aria-label="Fixture states">
    {#each ["ready", "large", "loading", "error", "empty", "applying", "auto-resolving", "apply-error", "locked"] as value}
      <button onclick={() => { fixtureMode = value; picks = {}; manualText = null; applied = null; }}>{value}</button>
    {/each}
  </nav>
  <div class="editor">
    <ConflictMergePane
      {doc} loading={fixtureMode === "loading"} error={fixtureMode === "error" ? error : null} {picks} {manualText} onEdit={(text) => manualText = text}
      applying={fixtureMode === "applying"} applyDisabled={fixtureMode === "locked"} applyDisabledReason="Trust this repository first"
      autoResolving={fixtureMode === "auto-resolving"} onAutoResolve={() => applied = "No additional conflicts could be resolved automatically. Review the remaining blocks."}
      applyError={fixtureMode === "apply-error" ? "The file changed on disk. Reload before applying." : null} notice={applied}
      onTakeSide={(id, side) => { const part = sample.segments.find((s) => s.kind === "conflict" && s.hunkId === id); if (part?.kind === "conflict") picks = { ...picks, [id]: takeSide(part, side) }; }}
      onToggleLine={(id, side, index) => picks = toggleLine(picks, id, side, index)}
      onClearBlock={clear} onRetry={() => fixtureMode = "ready"} onClose={() => fixtureMode = "empty"}
      onApply={() => applied = `Fixture Apply: ${JSON.stringify(manualText ?? picks)}`}
    />
  </div>
</main>

<style>
  main { height: 100vh; display: flex; flex-direction: column; font-family: var(--gd-font-ui); }
  nav { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; }
  nav button { background: var(--gd-panel); color: var(--gd-text); border: 1px solid var(--gd-border); padding: 4px 10px; cursor: pointer; }
  .editor { flex: 1; min-height: 0; }
</style>
