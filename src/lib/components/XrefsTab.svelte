<script lang="ts">
  import type { BookMeta, Lang, OpenXref, Ref, Verse, XrefTarget } from '../types';
  import { loadOpenXrefs } from '../data';
  import { formatChapterRef, formatRef } from '../refs';
  import { t } from '../i18n';
  import VersePreview from './VersePreview.svelte';

  let {
    r,
    verse,
    books,
    lang,
    translation,
    enabled,
    onNavigate,
  }: {
    r: Ref;
    verse: Verse;
    books: BookMeta[];
    lang: Lang;
    translation: string;
    /** OpenBible related verses apply to this translation's versification. */
    enabled: boolean;
    onNavigate: (r: Ref) => void;
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
</script>

{#if verse.xrefs?.length}
  <section>
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

{#if enabled}
  <section>
    <h3>{t(lang, 'openXrefs')}</h3>
    {#if open === null && !failed}
      <p class="muted small">{t(lang, 'loading')}</p>
    {:else if failed}
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

<style>
  section { margin: 6px 0 18px; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin: 0 0 6px; }
  .xrow { margin-bottom: 4px; }
  .chip.link { color: var(--accent); font-weight: 600; }
  .list { list-style: none; margin: 0 0 6px; padding: 0; }
  .list li { border-bottom: 1px solid var(--line); }
  .row { display: block; width: 100%; text-align: left; padding: 8px 0; }
  .rref { display: block; color: var(--accent); font-weight: 700; font-size: 14px; margin-bottom: 2px; }
</style>
