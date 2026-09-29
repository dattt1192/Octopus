<script lang="ts">
  // Ref-kind glyph for graph badges: branch (local), cloud (remote),
  // tag. Inline stroke SVG in currentColor, no icon dependency.
  interface Props {
    kind: "local" | "remote" | "tag";
    size?: number;
  }

  let { kind, size = 12 }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if kind === "local"}
    <line x1="6" x2="6" y1="3" y2="15" /><circle cx="18" cy="6" r="3" /><circle
      cx="6"
      cy="18"
      r="3"
    /><path d="M18 9a9 9 0 0 1-9 9" />
  {:else if kind === "remote"}
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  {:else}
    <path
      d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
    /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
  {/if}
</svg>

<style>
  svg {
    display: block;
  }
</style>
