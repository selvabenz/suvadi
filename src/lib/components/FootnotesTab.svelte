<script lang="ts">
  import type { Lang, Verse } from '../types';
  import { t } from '../i18n';
  import SectionCard from './SectionCard.svelte';

  let {
    verse,
    lang,
    textLang,
    onToast,
  }: { verse: Verse; lang: Lang; textLang: string; onToast?: (msg: string) => void } = $props();

  const letter = (i: number) => String.fromCharCode(97 + (i % 26));
  const fnText = $derived((verse.footnotes ?? []).map((f, i) => `${letter(i)}. ${f.quote ? f.quote + ' — ' : ''}${f.text}`).join('\n'));
</script>

{#if verse.heading || verse.parallel || verse.superscription}
  <SectionCard icon="type" label={t(lang, 'heading')} {lang}>
    {#if verse.heading}<p class="big" lang={textLang}>{verse.heading}</p>{/if}
    {#if verse.parallel}<p class="sub" lang={textLang}><span class="k">{t(lang, 'parallel')}</span> {verse.parallel}</p>{/if}
    {#if verse.superscription}<p class="sub" lang={textLang}><span class="k">{t(lang, 'superscription')}</span> {verse.superscription}</p>{/if}
  </SectionCard>
{/if}

{#if verse.footnotes?.length}
  <SectionCard icon="footnote" label={t(lang, 'footnotes')} tint="a" copyText={fnText} {lang} {onToast}>
    <ol class="fn" lang={textLang}>
      {#each verse.footnotes as f, i}
        <li><span class="mk">{letter(i)}</span><span>{#if f.quote}<b>{f.quote}</b> — {/if}{f.text}</span></li>
      {/each}
    </ol>
  </SectionCard>
{/if}

<style>
  p { margin: 0 0 6px; }
  p:last-child { margin-bottom: 0; }
  .big { font-size: calc(17px * var(--font-scale)); font-weight: 600; }
  .sub { font-size: calc(14px * var(--font-scale)); color: var(--fg-muted); }
  .k { font-weight: 600; margin-right: 4px; }
  ol.fn { list-style: none; margin: 0; padding: 0; }
  ol.fn li { display: flex; gap: 10px; margin-bottom: 8px; font-size: calc(15px * var(--font-scale)); line-height: 1.6; }
  ol.fn li:last-child { margin-bottom: 0; }
  .mk { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--bg-elev); display: grid; place-items: center; font-size: 12px; font-weight: 700; color: var(--fg-muted); margin-top: 2px; }
</style>
