<script lang="ts">
  import type { BookMeta, Lang, Ref } from '../types';
  import { formatRef } from '../refs';
  import { t } from '../i18n';
  import Sheet from './Sheet.svelte';

  let {
    r,
    books,
    lang,
    initial,
    onSave,
    onClose,
  }: { r: Ref; books: BookMeta[]; lang: Lang; initial: string; onSave: (text: string) => void; onClose: () => void } = $props();

  // The editor starts from the saved note and then owns its draft.
  // svelte-ignore state_referenced_locally
  let text = $state(initial);

  function focus(node: HTMLTextAreaElement) {
    setTimeout(() => node.focus(), 50);
  }
</script>

<Sheet title={`${t(lang, 'note')} — ${formatRef(books, r)}`} {onClose}>
  <textarea rows="6" bind:value={text} placeholder={t(lang, 'notePlaceholder')} use:focus></textarea>
  <p class="muted small">{t(lang, 'savedLocally')}</p>
  <div class="row">
    {#if initial}
      <button class="btn ghost" onclick={() => onSave('')}>{t(lang, 'delete')}</button>
    {/if}
    <span class="spacer"></span>
    <button class="btn ghost" onclick={onClose}>{t(lang, 'cancel')}</button>
    <button class="btn primary" onclick={() => onSave(text)}>{t(lang, 'save')}</button>
  </div>
</Sheet>

<style>
  textarea { resize: vertical; min-height: 120px; font-size: calc(16px * var(--font-scale)); }
  .row { display: flex; gap: 8px; margin-top: 8px; }
  .spacer { flex: 1; }
</style>
