<script lang="ts">
  import RepositoryWorkspace from "../../src/app/RepositoryWorkspace.svelte";
  import { createMockAdapter } from "../../src/lib/ipc/mock";
  import { demoSession } from "../../src/mocks/demoSession";
  import type { AppError, OperationRecord } from "../../src/lib/ipc/types";

  let active = $state(true);
  let failFetch = $state(false);
  let failSettings = $state(false);
  let missingRemote = $state(false);
  let holdJob = $state(false);
  let generation = $state(0);
  let fetchCount = $state(0);
  let historyReads = $state(0);
  let lastFetchAt: string | null = $state(null);
  const operations = new Map<string, OperationRecord>();
  const seed = { ...demoSession, repoId: "auto-fetch-fixture", workspaceKey: "fixture:auto-fetch" };
  const base = createMockAdapter(seed);
  const error: AppError = { code: "AUTH_REQUIRED", message: "Fixture: authentication required.", recovery: "inspectState", retryable: false };
  const adapter = {
    ...base,
    async settingsGet() {
      if (failSettings) throw { ...error, code: "IO_ERROR", message: "Fixture: settings read failed." } satisfies AppError;
      return base.settingsGet();
    },
    async settingsUpdate(...args: Parameters<typeof base.settingsUpdate>) {
      if (failSettings) throw { ...error, code: "IO_ERROR", message: "Fixture: settings save failed." } satisfies AppError;
      return base.settingsUpdate(...args);
    },
    async historyPage(...args: Parameters<typeof base.historyPage>) {
      historyReads += 1;
      return base.historyPage(...args);
    },
    async remoteStatus() {
      const remote = await base.remoteStatus(seed.repoId);
      return { ...remote, remoteName: missingRemote ? null : "origin", lastFetchAt };
    },
    async remoteFetch() {
      fetchCount += 1;
      const operationId = `fixture-fetch-${fetchCount}`;
      operations.set(operationId, { operationId, repoId: seed.repoId, requestId: operationId,
        kind: "fetch", state: "running", stage: "contacting remote", progress: null, errorCode: null });
      // Exposes the IPC admission gap to verify that a second click is blocked.
      await new Promise(resolve => setTimeout(resolve, 500));
      return { operationId };
    },
    async operationGet(id: string): Promise<OperationRecord> {
      const operation = operations.get(id);
      if (!operation) return base.operationGet(id);
      if (holdJob) return operation;
      if (operation.state === "running") {
        operation.state = failFetch ? "failed" : "succeeded";
        operation.error = failFetch ? error : null;
        if (!failFetch) lastFetchAt = new Date().toISOString();
      }
      return { ...operation };
    },
    async operationCancel(id = "") {
      const operation = operations.get(id);
      if (operation) operation.state = "cancelled";
      return { cancelRequested: true };
    }
  };
</script>

<nav aria-label="Auto fetch fixture controls">
  <label><input type="checkbox" bind:checked={active} />Active repository</label>
  <label><input type="checkbox" bind:checked={failFetch} />Fail fetch</label>
  <label><input type="checkbox" bind:checked={failSettings} />Fail settings</label>
  <label><input type="checkbox" bind:checked={missingRemote} />No remote</label>
  <label><input type="checkbox" bind:checked={holdJob} />Hold running job</label>
  <button onclick={() => generation += 1}>Reopen workspace</button>
  <output aria-label="Fetch count">Fetches: {fetchCount}</output>
  <output aria-label="History read count">History reads: {historyReads}</output>
  <output aria-label="Last fetch">Last fetch: {lastFetchAt ?? "never"}</output>
</nav>
<main>
  {#key generation}
    <RepositoryWorkspace initialSession={seed} {active} mockAdapter={adapter}
      onOpenRepository={() => {}} onInitRepository={() => {}} onCloseRepository={() => {}} onWorkspaceChange={() => {}} />
  {/key}
</main>

<style>
  nav { display: flex; flex-wrap: wrap; gap: 12px; padding: 10px; font: 12px var(--gd-font-ui); }
  main { height: calc(100vh - 70px); min-width: 1100px; }
</style>
