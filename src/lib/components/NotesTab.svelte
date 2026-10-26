<script lang="ts">
  import type { Lang } from '../types';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  // The reader's own note on the verse: written here, saved on this device,
  // and shareable with the verse (system share sheet or WhatsApp).
  let {
    initial,
    lang,
    autofocus = false,
    onSave,
    onShare,
    onWhatsApp,
    draft = $bindable(),
  }: {
    initial: string;
    lang: Lang;
    autofocus?: boolean;
    onSave: (text: string) => void;
    onShare: (note: string) => void;
    onWhatsApp: (note: string) => void;
    /** The text being edited; the sheet reads it to save on close. */
    draft?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let text = $state(initial);
  // svelte-ignore state_referenced_locally
  let saved = $state(initial);
  $effect(() => {
    draft = text;
  });

  function focus(node: HTMLTextAreaElement) {
    if (autofocus) setTimeout(() => node.focus(), 80);
  }
  function save() {
    if (text.trim() === saved.trim()) return;
    onSave(text);
    saved = text;
  }
  function remove() {
    text = '';
    onSave('');
    saved = '';
  }
</script>

<div class="notes">
  <textarea rows="6" bind:value={text} placeholder={t(lang, 'notePlaceholder')} use:focus onblur={save}></textarea>
  <p class="muted small">{t(lang, 'savedLocally')}</p>
  <div class="row">
    {#if saved}
      <button class="btn ghost small" onclick={remove}>{t(lang, 'delete')}</button>
    {/if}
    <span class="spacer"></span>
    <button class="btn primary small" onclick={save} disabled={text.trim() === saved.trim()}>{t(lang, 'save')}</button>
  </div>
  <div class="share">
    <button class="btn ghost" onclick={() => { save(); onShare(text.trim()); }}>
      <Icon name="send" size={18} /> {text.trim() ? t(lang, 'shareWithNote') : t(lang, 'share')}
    </button>
    <button class="btn wa" onclick={() => { save(); onWhatsApp(text.trim()); }}>
      <Icon name="note" size={18} /> {t(lang, 'whatsapp')}
    </button>
  </div>
</div>

<style>
  textarea { resize: vertical; min-height: 120px; font-size: calc(16px * var(--font-scale)); line-height: 1.5; }
  .row { display: flex; gap: 8px; align-items: center; margin: 8px 0 14px; }
  .spacer { flex: 1; }
  .share { display: flex; gap: 8px; flex-wrap: wrap; }
  .share .btn { flex: 1; min-width: 140px; }
  .btn.wa { background: #25d366; color: #0b2e17; }
</style>
