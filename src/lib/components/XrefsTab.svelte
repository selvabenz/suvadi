<script lang="ts">
  import type { BookMeta, Lang, OpenXref, Ref, Verse, XrefTarget } from '../types';
  import { loadOpenXrefs } from '../data';
  import { formatChapterRef, formatRef } from '../refs';
  import { t } from '../i18n';
  import VersePreview from './VersePreview.svelte';
  import SectionCard from './SectionCard.svelte';

  let {
    r,
    verse,
    books,
    lang,
    translation,
    enabled,
    onNavigate,
    onToast,
  }: {
    r: Ref;
    verse: Verse;
    books: BookMeta[];
    lang: Lang;
    translation: string;
    /** OpenBible related verses apply to this translation's versification. */
    enabled: boolean;
    onNavigate: (r: Ref) => void;
    onToast?: (msg: string) => void;
  } = $props();

  let open = $state<OpenXref[] | null>(null);
  let failed = $state(false);

  $effect(() => {
    const ref = r;
    const vs = verse;
    open = null;
    failed = false;
    if (!enabled) {
      open = [];
      return;
    }
    loadOpenXrefs(ref.book)
      .then((m) => {
        // a verse bridge shows the related verses of every verse it spans
        const out: OpenXref[] = [];
        for (let v = vs.n; v <= (vs.end ?? vs.n); v++) out.push(...(m[`${ref.ch}:${v}`] ?? []));
        open = out;
      })
      .catch(() => (failed = true));
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
  const irvText = $derived((verse.xrefs ?? []).flatMap((x) => x.targets.map(targetLabel)).filter(Boolean).join('; '));
  const openText = $derived((open ?? []).map(([code, ch, v, vEnd]) => formatRef(books, { book: code, ch, v }, vEnd || undefined)).join('; '));
</script>

{#if verse.xrefs?.length}
  <SectionCard icon="link" label={t(lang, 'irvXrefs')} copyText={irvText} {lang} {onToast}>
    <div class="chips">
      {#each verse.xrefs as x}
        {#each x.targets as tg}
          {#if tg.book}
            <button class="chip link" onclick={() => go(tg)}>{targetLabel(tg)}</button>
          {:else}
            <span class="chip">{tg.raw}</span>
          {/if}
        {/each}
      {/each}
    </div>
  </SectionCard>
{/if}

{#if enabled}
  <SectionCard icon="link" label={t(lang, 'openXrefs')} copyText={openText || undefined} {lang} {onToast} flush={!!open?.length}>
    {#if open === null && !failed}
      <p class="muted small">{t(lang, 'loading')}</p>
    {:else if failed}
      <p class="muted small">{t(lang, 'studyOffline')}</p>
    {:else if open && open.length}
      <ul class="xl">
        {#each open as [code, ch, v, vEnd]}
          {@const ref = { book: code, ch, v }}
          <li>
            <button class="xr" onclick={() => onNavigate(ref)}>
              <span class="rref">{formatRef(books, ref, vEnd || undefined)}</span>
              <VersePreview r={ref} {translation} />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted small">—</p>
    {/if}
  </SectionCard>
  {#if open?.length}<p class="muted note">{t(lang, 'openXrefsNote')}</p>{/if}
{/if}

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { margin: 0; }
  .chip.link { color: var(--accent); font-weight: 600; }
  p.small { margin: 0; }
  .xl { list-style: none; margin: 0; padding: 0; }
  .xl li + li { border-top: 1px solid var(--line); }
  .xr { display: block; width: 100%; text-align: left; padding: 12px 16px; }
  .xr:active { background: var(--accent-soft); }
  .rref { display: block; color: var(--fg); font-weight: 700; font-size: 14px; margin-bottom: 3px; }
  .note { font-size: 12px; margin: -8px 4px 16px; }
</style>
