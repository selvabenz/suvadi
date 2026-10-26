<script lang="ts">
  import type { Lang, Verse } from '../types';
  import { t } from '../i18n';

  let { verse, lang, textLang }: { verse: Verse; lang: Lang; textLang: string } = $props();
</script>

{#if verse.heading || verse.parallel || verse.superscription}
  <section>
    {#if verse.heading}<h3>{t(lang, 'heading')}</h3><p class="big" lang={textLang}>{verse.heading}</p>{/if}
    {#if verse.parallel}<h3>{t(lang, 'parallel')}</h3><p lang={textLang}>{verse.parallel}</p>{/if}
    {#if verse.superscription}<h3>{t(lang, 'superscription')}</h3><p lang={textLang}>{verse.superscription}</p>{/if}
  </section>
{/if}

{#if verse.footnotes?.length}
  <section>
    <h3>{t(lang, 'footnotes')}</h3>
    <ol class="fn" type="a" lang={textLang}>
      {#each verse.footnotes as f}
        <li>{#if f.quote}<b>{f.quote}</b> — {/if}{f.text}</li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  section { margin: 6px 0 18px; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin: 0 0 6px; }
  p { margin: 0 0 6px; }
  .big { font-size: calc(17px * var(--font-scale)); font-weight: 600; }
  ol.fn { margin: 0; padding-left: 22px; }
  ol.fn li { margin-bottom: 6px; font-size: calc(15px * var(--font-scale)); line-height: 1.6; }
</style>
