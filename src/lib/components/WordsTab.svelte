<script lang="ts">
  import type { Lang, StepWord } from '../types';
  import { strongBase } from '../study';
  import { t } from '../i18n';

  // STEP Bible original-language words for the verse. When a Translation
  // Words article exists for a word's Strong's number, its number becomes a
  // chip that opens the article.
  let {
    words,
    failed,
    isOT,
    lang,
    twByStrong = null,
    twTitle,
    onOpenTw,
  }: {
    words: StepWord[] | null;
    failed: boolean;
    isOT: boolean;
    lang: Lang;
    twByStrong?: Map<string, string[]> | null;
    twTitle?: (slug: string) => string;
    onOpenTw?: (slug: string) => void;
  } = $props();

  function slugsFor(strong: string): string[] {
    return twByStrong?.get(strongBase(strong)) ?? [];
  }
</script>

{#if words === null && !failed}
  <p class="muted small">{t(lang, 'loading')}</p>
{:else if failed}
  <p class="muted small">{t(lang, 'studyOffline')}</p>
{:else if words && words.length}
  <table class="words">
    <thead><tr><th>{t(lang, 'word')}</th><th>{t(lang, 'gloss')}</th><th>{t(lang, 'strongs')}</th></tr></thead>
    <tbody>
      {#each words as [surface, translit, gloss, strong, morph, flag]}
        {@const slugs = slugsFor(strong)}
        <tr class:variant={!!flag}>
          <td>
            <span class="orig" lang={isOT ? 'he' : 'el'} dir={isOT ? 'rtl' : 'ltr'}>{surface}</span>
            <span class="tr muted">{translit}</span>
          </td>
          <td>
            {gloss}{#if flag}<span class="flag" title={flag === 'k' ? t(lang, 'wordsVariantK') : t(lang, 'wordsVariantQ')}>{flag === 'k' ? '†' : 'ᵠ'}</span>{/if}
            {#each slugs as slug}
              <button class="tw" onclick={() => onOpenTw?.(slug)}>{twTitle?.(slug) ?? slug}</button>
            {/each}
          </td>
          <td class="muted small"><div>{strong}</div><div class="morph">{morph}</div></td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="muted small">{t(lang, 'wordsNote')}</p>
  {#if words.some((w) => w[5])}
    <p class="muted small">† {t(lang, 'wordsVariantK')} · ᵠ {t(lang, 'wordsVariantQ')}</p>
  {/if}
{:else}
  <p class="muted small">—</p>
{/if}

<style>
  table.words { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 8px; }
  table.words th { text-align: left; font-weight: 600; color: var(--fg-muted); font-size: 12px; padding: 4px 6px 4px 0; border-bottom: 1px solid var(--line); }
  table.words td { padding: 6px 6px 6px 0; vertical-align: top; border-bottom: 1px solid var(--line); }
  .orig { display: block; font-size: 18px; line-height: 1.3; unicode-bidi: isolate; }
  .tr { display: block; font-size: 12px; }
  .morph { font-size: 11px; }
  tr.variant td { opacity: 0.85; }
  .flag { margin-left: 4px; color: var(--accent); font-weight: 700; }
  .tw {
    display: inline-block;
    margin: 4px 4px 0 0;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
  }
</style>
