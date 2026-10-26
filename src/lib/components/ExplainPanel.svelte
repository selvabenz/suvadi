<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Lang, Selection } from '../types';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';
  import AskBox from './AskBox.svelte';

  // The top of the study sheet in explain mode: what was circled, what the
  // original-language words behind it are (ULT, from `aligned`), and the
  // optional AI question box.
  let {
    sel,
    lang,
    textLang,
    hasAlignment,
    aiEnabled,
    onAsk,
    aligned,
  }: {
    sel: Selection | null;
    lang: Lang;
    textLang: string;
    /** This translation carries Hebrew/Greek word alignment (the ULT). */
    hasAlignment: boolean;
    aiEnabled: boolean;
    onAsk: (message: string) => Promise<string>;
    /** The aligned original-language words for the selection (ULT only). */
    aligned?: Snippet;
  } = $props();
</script>

<div class="explain">
  <div class="head">
    <Icon name="sparkle" size={18} />
    {#if sel}
      <span class="label">{t(lang, 'selected')}</span>
      <mark lang={textLang}>{sel.text}</mark>
    {:else}
      <span class="label">{t(lang, 'wholeVerse')}</span>
    {/if}
  </div>
  {#if aligned}
    {@render aligned()}
  {:else if sel && !hasAlignment}
    <p class="muted small">{t(lang, 'noAlignment')}</p>
  {/if}
  <AskBox enabled={aiEnabled} {lang} {onAsk} />
</div>

<style>
  .explain { border-bottom: 1px solid var(--line); margin-bottom: 12px; }
  .head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; color: var(--accent); }
  .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); }
  mark { background: var(--mark); color: var(--fg); border-radius: 4px; padding: 1px 4px; font-size: calc(16px * var(--font-scale)); }
  .muted.small { margin: 0 0 8px; }
</style>
