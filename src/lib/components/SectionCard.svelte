<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Lang } from '../types';
  import { copyText as copy } from '../clipboard';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  // One section of the study page: an icon, a small uppercase label, an
  // optional copy button, and the content in a card.
  let {
    icon,
    label,
    tint = '',
    copyText,
    lang,
    onToast,
    flush = false,
    children,
  }: {
    icon: string;
    label: string;
    tint?: '' | 'a' | 'b';
    /** plain text to copy; no copy button when absent */
    copyText?: string;
    lang: Lang;
    onToast?: (msg: string) => void;
    /** content runs to the card's edges (lists with their own padding) */
    flush?: boolean;
    children: Snippet;
  } = $props();

  async function doCopy() {
    if (!copyText) return;
    const ok = await copy(copyText);
    onToast?.(t(lang, ok ? 'copied' : 'copyFailed'));
  }
</script>

<section class="sec">
  <header class="label">
    <Icon name={icon} size={15} />
    <span class="lt">{label}</span>
    {#if copyText}
      <button class="iconbtn cp" onclick={doCopy} aria-label={t(lang, 'copy')} title={t(lang, 'copy')}><Icon name="copy" size={15} /></button>
    {/if}
  </header>
  <div class="card" class:tint-a={tint === 'a'} class:tint-b={tint === 'b'} class:flush>
    {@render children()}
  </div>
</section>

<style>
  .sec { margin: 0 0 18px; }
  .sec > .label { margin: 0 2px 8px; min-height: 28px; }
  .lt { flex: 1; }
  .cp { width: 28px; height: 28px; margin: -4px -6px -4px 0; }
  .card.flush { padding: 0; overflow: hidden; }
</style>
