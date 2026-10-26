<script lang="ts">
  import type { Lang, StepWord } from '../types';
  import { strongBase } from '../study';
  import { t } from '../i18n';
  import SectionCard from './SectionCard.svelte';

  // STEP Bible original-language words for the verse. When a Translation
  // Words article exists for a word's Strong's number, the article opens from
  // a chip under the gloss.
  let {
    words,
    failed,
    isOT,
    lang,
    twByStrong = null,
    twTitle,
    onOpenTw,
    onToast,
  }: {
    words: StepWord[] | null;
    failed: boolean;
    isOT: boolean;
    lang: Lang;
    twByStrong?: Map<string, string[]> | null;
    twTitle?: (slug: string) => string;
    onOpenTw?: (slug: string) => void;
    onToast?: (msg: string) => void;
  } = $props();

  function slugsFor(strong: string): string[] {
    return twByStrong?.get(strongBase(strong)) ?? [];
  }
  const tsv = $derived((words ?? []).map(([s, tr, g, st]) => `${s}\t${tr}\t${g}\t${st}`).join('\n'));
</script>

<SectionCard icon="words" label={t(lang, 'words')} copyText={words?.length ? tsv : undefined} {lang} {onToast} flush={!!words?.length}>
  {#if words === null && !failed}
    <p class="muted small">{t(lang, 'loading')}</p>
  {:else if failed}
    <p class="muted small">{t(lang, 'studyOffline')}</p>
  {:else if words && words.length}
    <ul class="wl">
      {#each words as [surface, translit, gloss, strong, morph, flag]}
        {@const slugs = slugsFor(strong)}
        <li class:variant={!!flag}>
          <div class="w1">
            <span class="orig" lang={isOT ? 'he' : 'el'} dir={isOT ? 'rtl' : 'ltr'}>{surface}</span>
            <span class="tr">{translit}</span>
          </div>
          <div class="w2">
            <span class="gl">{gloss}{#if flag}<span class="flag" title={flag === 'k' ? t(lang, 'wordsVariantK') : t(lang, 'wordsVariantQ')}>{flag === 'k' ? '†' : 'ᵠ'}</span>{/if}</span>
            <span class="meta">{strong}{morph ? ` · ${morph}` : ''}</span>
            {#if slugs.length}
              <span class="tws">
                {#each slugs as slug}
                  <button class="tw" onclick={() => onOpenTw?.(slug)}>{twTitle?.(slug) ?? slug}</button>
                {/each}
              </span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted small">—</p>
  {/if}
</SectionCard>
{#if words?.length}
  <p class="muted note">{t(lang, 'wordsNote')}{#if words.some((w) => w[5])} † {t(lang, 'wordsVariantK')} · ᵠ {t(lang, 'wordsVariantQ')}{/if}</p>
{/if}

<style>
  p.small { margin: 0; }
  .wl { list-style: none; margin: 0; padding: 0; }
  .wl li { display: grid; grid-template-columns: minmax(84px, 38%) 1fr; gap: 12px; padding: 12px 16px; }
  .wl li + li { border-top: 1px solid var(--line); }
  .wl li.variant { opacity: 0.85; }
  .w1 { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .orig { font-size: 21px; line-height: 1.25; unicode-bidi: isolate; }
  .tr { font-size: 12px; color: var(--fg-muted); }
  .w2 { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .gl { font-weight: 600; font-size: 15px; }
  .meta { font-size: 11px; color: var(--fg-muted); letter-spacing: 0.02em; }
  .flag { margin-left: 4px; color: var(--accent); font-weight: 700; }
  .tws { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
  .tw { padding: 2px 9px; border-radius: var(--r-pill); background: var(--accent-soft); color: var(--fg); font-size: 12px; font-weight: 600; }
  .note { font-size: 12px; margin: -8px 4px 16px; }
</style>
