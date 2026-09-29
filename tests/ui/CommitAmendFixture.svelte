<script lang="ts">
  import RepositoryWorkspace from "../../src/app/RepositoryWorkspace.svelte";
  import { createMockAdapter } from "../../src/lib/ipc/mock";
  import { demoSession } from "../../src/mocks/demoSession";
  import type { AppError, RepoSnapshot } from "../../src/lib/ipc/types";

  let failRead = $state(false);
  let failCommit = $state(false);
  let slowRead = $state(false);
  let generation = $state(0);
  let seed: RepoSnapshot = $state.raw({ ...demoSession, repoId: "amend-fixture", workspaceKey: "fixture:amend" });
  let adapter = $derived.by(() => {
    const base = createMockAdapter(seed);
    return {
      ...base,
      async commitDetails(...args: Parameters<typeof base.commitDetails>) {
        if (slowRead) await new Promise(resolve => setTimeout(resolve, 3000));
        if (failRead) throw { code: "GIT_ERROR", message: "Fixture: could not load HEAD.", recovery: "retryRead", retryable: true } satisfies AppError;
        return base.commitDetails(...args);
      },
      async commitCreate(...args: Parameters<typeof base.commitCreate>) {
        if (failCommit) throw { code: "HOOK_FAILED", message: "Fixture: hook refused the commit.", recovery: "inspectState", retryable: false } satisfies AppError;
        return base.commitCreate(...args);
      }
    };
  });

  function reset(unborn: boolean) {
    generation += 1;
    seed = { ...demoSession, repoId: `amend-fixture-${generation}`, workspaceKey: `fixture:amend:${generation}`,
      head: unborn ? { kind: "unborn", name: "main" } : demoSession.head };
  }
</script>

<nav aria-label="Fixture controls">
  <label><input type="checkbox" bind:checked={failRead} />Fail loading commit</label>
  <label><input type="checkbox" bind:checked={failCommit} />Fail committing</label>
  <label><input type="checkbox" bind:checked={slowRead} />Slow loading</label>
  <button onclick={() => reset(true)}>Reset with unborn HEAD</button>
  <button onclick={() => reset(false)}>Reset with existing HEAD</button>
</nav>
<main>
  {#key generation}
    <RepositoryWorkspace initialSession={seed} active={true} mockAdapter={adapter}
      onOpenRepository={() => {}} onInitRepository={() => {}} onCloseRepository={() => {}} onWorkspaceChange={() => {}} />
  {/key}
</main>

<style>
  nav { display: flex; flex-wrap: wrap; gap: 12px; padding: 10px; font: 12px var(--gd-font-ui); }
  main { height: calc(100vh - 55px); min-width: 1100px; }
</style>
