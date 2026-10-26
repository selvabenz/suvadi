<script lang="ts">
  import { tick } from 'svelte';
  import type { BookMeta, Lang, OpenXref, Ref, StepWord, Verse, XrefTarget } from '../types';
  import { loadOpenXrefs, loadWords } from '../data';
  import { formatChapterRef, formatRef } from '../refs';
  import { t } from '../i18n';
  import Sheet from './Sheet.svelte';
  import VersePreview from './VersePreview.svelte';

  let {
    r,
    verse,
    books,
    lang,
    translation,
    study,
    section,
    onNavigate,
    onClose,
  }: {
    r: Ref;
    verse: Verse;
    books: BookMeta[];
    lang: Lang;
    translation: string;
    /** Which shared study datasets apply to this translation (from its manifest). */
    study?: { xrefs?: boolean; words?: boolean };
    section?: 'footnotes' | 'xrefs';
    onNavigate: (r: Ref) => void;
    onClose: () => void;
  } = $props();

  const meta = $derived(books.find((b) => b.code === r.book));
  const isOT = $derived(meta?.testament === 'ot');
  const title = $derived(`${formatRef(books, { book: r.book, ch: r.ch, v: verse.n }, verse.end)}`);
  const showXrefs = $derived(study?.xrefs !== false);
  const showWords = $derived(study?.words !== false);

  let open = $state<OpenXref[] | null>(null);
  let openFailed = $state(false);
  let words = $state<StepWord[] | null>(null);
  let wordsFailed = $state(false);
  let body: HTMLElement | undefined = $state();

  $effect(() => {
    const ref = r;
    open = null;
    openFailed = false;
    if (!showXrefs) {
      open = [];
      return;
    }
    loadOpenXrefs(ref.book)
      .then((m) => (open = m[`${ref.ch}:${ref.v}`] ?? []))
      .catch(() => (openFailed = true));
  });

  $effect(() => {
    const ref = r;
    words = null;
    wordsFailed = false;
    if (!showWords) {
      words = [];
      return;
    }
    loadWords(ref.book, ref.ch)
      .then((m) => {
        // a verse bridge shows the words of every verse it spans
        const out: StepWord[] = [];
        for (let v = verse.n; v <= (verse.end ?? verse.n); v++) out.push(...(m[String(v)] ?? []));
        words = out;
      })
      .catch(() => (wordsFailed = true));
  });

  $effect(() => {
    if (!section) return;
    tick().then(() => document.getElementById(`study-${section}`)?.scrollIntoView({ block: 'start' }));
  });

  function targetLabel(x: XrefTarget): string {
    if (!x.book || !x.ch) return x.raw ?? '';
    if (x.v === undefined) return formatChapterRef(books, x.book, x.ch);
    return formatRef(books, { book: x.book, ch: x.ch, v: x.v }, x.vEnd, x.chEnd);
  }
  function go(x: XrefTarget) {
    if (!x.book || !x.ch) return;
    onNavigate({ book: x.book, ch: x.ch, v: x.v ?? 1 });
  }
  const hasAnything = $derived(
    !!(verse.heading || verse.parallel || verse.superscription || verse.footnotes?.length || verse.xrefs?.length) ||
      (open?.length ?? 0) > 0 ||
      (words?.length ?? 0) > 0,
  );
</script>

<Sheet {title} {onClose} tall>
  <div bind:this={body}>
    {#if verse.heading || verse.parallel || verse.superscription}
      <section>
        {#if verse.heading}<h3>{t(lang, 'heading')}</h3><p class="big">{verse.heading}</p>{/if}
        {#if verse.parallel}<h3>{t(lang, 'parallel')}</h3><p>{verse.parallel}</p>{/if}
        {#if verse.superscription}<h3>{t(lang, 'superscription')}</h3><p>{verse.superscription}</p>{/if}
      </section>
    {/if}

    {#if verse.footnotes?.length}
      <section id="study-footnotes">
        <h3>{t(lang, 'footnotes')}</h3>
        <ol class="fn" type="a">
          {#each verse.footnotes as f}
            <li>
              {#if f.quote}<b>{f.quote}</b> — {/if}{f.text}
            </li>
          {/each}
        </ol>
      </section>
    {/if}

    {#if verse.xrefs?.length}
      <section id="study-xrefs">
        <h3>{t(lang, 'irvXrefs')}</h3>
        {#each verse.xrefs as x}
          <div class="xrow">
            {#each x.targets as tg}
              {#if tg.book}
                <button class="chip link" onclick={() => go(tg)}>{targetLabel(tg)}</button>
              {:else}
                <span class="chip">{tg.raw}</span>
              {/if}
            {/each}
          </div>
        {/each}
      </section>
    {/if}

    {#if showXrefs}
    <section>
      <h3>{t(lang, 'openXrefs')}</h3>
      {#if open === null && !openFailed}
        <p class="muted small">{t(lang, 'loading')}</p>
      {:else if openFailed}
        <p class="muted small">{t(lang, 'studyOffline')}</p>
      {:else if open && open.length}
        <ul class="list">
          {#each open as [code, ch, v, vEnd]}
            {@const ref = { book: code, ch, v }}
            <li>
              <button class="row" onclick={() => onNavigate(ref)}>
                <span class="rref">{formatRef(books, ref, vEnd || undefined)}</span>
                <VersePreview r={ref} {translation} />
              </button>
            </li>
          {/each}
        </ul>
        <p class="muted small">{t(lang, 'openXrefsNote')}</p>
      {:else}
        <p class="muted small">—</p>
      {/if}
    </section>
    {/if}

    {#if showWords}
    <section>
      <h3>{t(lang, 'words')}</h3>
      {#if words === null && !wordsFailed}
        <p class="muted small">{t(lang, 'loading')}</p>
      {:else if wordsFailed}
        <p class="muted small">{t(lang, 'studyOffline')}</p>
      {:else if words && words.length}
        <table class="words">
          <thead><tr><th>{t(lang, 'word')}</th><th>{t(lang, 'gloss')}</th><th>{t(lang, 'strongs')}</th></tr></thead>
          <tbody>
            {#each words as [surface, translit, gloss, strong, morph, flag]}
              <tr class:variant={!!flag}>
                <td>
                  <span class="orig" lang={isOT ? 'he' : 'el'} dir={isOT ? 'rtl' : 'ltr'}>{surface}</span>
                  <span class="tr muted">{translit}</span>
                </td>
                <td>{gloss}{#if flag}<span class="flag" title={flag === 'k' ? t(lang, 'wordsVariantK') : t(lang, 'wordsVariantQ')}>{flag === 'k' ? '†' : 'ᵠ'}</span>{/if}</td>
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
    </section>
    {/if}

    {#if !hasAnything}
      <p class="muted">{t(lang, 'nothingHere')}</p>
    {/if}
  </div>
</Sheet>

<style>
  section { margin: 6px 0 18px; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin: 0 0 6px; }
  p { margin: 0 0 6px; }
  .big { font-size: calc(17px * var(--font-scale)); font-weight: 600; }
  ol.fn { margin: 0; padding-left: 22px; }
  ol.fn li { margin-bottom: 6px; font-size: calc(15px * var(--font-scale)); line-height: 1.6; }
  .xrow { margin-bottom: 4px; }
  .chip.link { color: var(--accent); font-weight: 600; }
  .list { list-style: none; margin: 0; padding: 0; }
  .list li { border-bottom: 1px solid var(--line); }
  .row { display: block; width: 100%; text-align: left; padding: 8px 0; }
  .rref { display: block; color: var(--accent); font-weight: 700; font-size: 14px; margin-bottom: 2px; }
  table.words { width: 100%; border-collapse: collapse; font-size: 14px; }
  table.words th { text-align: left; font-weight: 600; color: var(--fg-muted); font-size: 12px; padding: 4px 6px 4px 0; border-bottom: 1px solid var(--line); }
  table.words td { padding: 6px 6px 6px 0; vertical-align: top; border-bottom: 1px solid var(--line); }
  .orig { display: block; font-size: 18px; line-height: 1.3; }
  .tr { display: block; font-size: 12px; }
  .morph { font-size: 11px; }
  tr.variant td { opacity: 0.85; }
  .flag { margin-left: 4px; color: var(--accent); font-weight: 700; }
</style>
