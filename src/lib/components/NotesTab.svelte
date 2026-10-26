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
    /** The text being edited; the page reads it to save on close. */
    draft?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let text = $state(initial);
  // svelte-ignore state_referenced_locally
  let saved = $state(initial);
  $effect(() => {
    draft = text;
  });

  const dirty = $derived(text.trim() !== saved.trim());

  function focus(node: HTMLTextAreaElement) {
    if (autofocus) setTimeout(() => node.focus(), 80);
  }
  function save() {
    if (!dirty) return;
    onSave(text);
    saved = text;
  }
  function remove() {
    text = '';
    onSave('');
    saved = '';
  }
</script>

<section class="sec">
  <header class="label"><Icon name="note" size={15} /><span>{t(lang, 'tabNotes')}</span></header>
  <div class="card note">
    <textarea rows="6" bind:value={text} placeholder={t(lang, 'notePlaceholder')} use:focus onblur={save} aria-label={t(lang, 'tabNotes')}></textarea>
    <div class="bar">
      <span class="muted hint">{t(lang, 'savedLocally')}</span>
      {#if saved}
        <button class="iconbtn" onclick={remove} aria-label={t(lang, 'delete')} title={t(lang, 'delete')}><Icon name="trash" size={18} /></button>
      {/if}
      <button class="btn primary small" onclick={save} disabled={!dirty}>{t(lang, 'save')}</button>
    </div>
  </div>
</section>

<div class="share">
  <button
    class="iconbtn big"
    onclick={() => { save(); onShare(text.trim()); }}
    aria-label={text.trim() ? t(lang, 'shareWithNote') : t(lang, 'share')}
    title={text.trim() ? t(lang, 'shareWithNote') : t(lang, 'share')}
  >
    <Icon name="share" size={22} />
  </button>
  <button
    class="iconbtn big wa"
    onclick={() => { save(); onWhatsApp(text.trim()); }}
    aria-label={t(lang, 'whatsapp')}
    title={t(lang, 'whatsapp')}
  >
    <Icon name="whatsapp" size={24} />
  </button>
</div>

<style>
  .sec { margin: 0 0 18px; }
  .sec > .label { margin: 0 2px 8px; min-height: 28px; }
  .note { padding: 4px 4px 8px; }
  textarea {
    display: block;
    border: 0;
    background: transparent;
    resize: vertical;
    min-height: 140px;
    padding: 12px;
    font-size: calc(16px * var(--font-scale));
    line-height: 1.55;
  }
  textarea:focus { outline: none; }
  .note:focus-within { border-color: var(--accent); }
  .bar { display: flex; align-items: center; gap: 6px; padding: 0 8px 0 12px; }
  .hint { flex: 1; font-size: 12px; }
  .share { display: flex; justify-content: center; gap: 18px; margin: 4px 0 12px; }
  .wa { background: #25d366; color: #fff; border-color: transparent; }
  .wa:active, .wa:hover { background: #1fb457; color: #fff; }
</style>
