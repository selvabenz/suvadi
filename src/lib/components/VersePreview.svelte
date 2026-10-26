<script lang="ts">
  import type { Ref } from '../types';
  import { getVerse } from '../data';

  let { r, translation, max = 160 }: { r: Ref; translation: string; max?: number } = $props();

  let text = $state<string | null>(null);
  let failed = $state(false);

  $effect(() => {
    const ref = r;
    const id = translation;
    text = null;
    failed = false;
    getVerse(id, ref)
      .then((v) => {
        const s = v?.text.replace(/\n/g, ' ') ?? '';
        text = s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
      })
      .catch(() => (failed = true));
  });
</script>

{#if text !== null}
  <span class="prev">{text}</span>
{:else if failed}
  <span class="prev muted">—</span>
{:else}
  <span class="prev muted">…</span>
{/if}

<style>
  .prev { font-size: calc(15px * var(--font-scale)); line-height: 1.5; }
</style>
