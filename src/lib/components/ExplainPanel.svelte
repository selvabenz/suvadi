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

<div class="explain card tint-b">
  <div class="head">
    <Icon name="sparkle" size={18} />
    {#if sel}
      <span class="lab">{t(lang, 'selected')}</span>
      <mark lang={textLang}>{sel.text}</mark>
    {:else}
      <span class="lab">{t(lang, 'wholeVerse')}</span>
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
  .explain { margin-bottom: 16px; }
  .head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; color: var(--accent); }
  .lab { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-muted); }
  mark { background: var(--mark); color: var(--fg); border-radius: 4px; padding: 1px 4px; font-size: calc(16px * var(--font-scale)); }
  .muted.small { margin: 0 0 8px; }
</style>
