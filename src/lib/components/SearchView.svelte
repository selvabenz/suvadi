<script lang="ts">
  import type { BookMeta, Lang, Ref } from '../types';
  import { searchAll, type SearchHit } from '../data';
  import { formatRef, parseTypedRef } from '../refs';
  import type { BookIndex } from '../booknames';
  import { t } from '../i18n';
  import { app } from '../state.svelte';
  import Icon from './Icon.svelte';

  let {
    books,
    lang,
    translation,
    index = null,
    onNavigate,
  }: { books: BookMeta[]; lang: Lang; translation: string; index?: BookIndex | null; onNavigate: (r: Ref) => void } = $props();

  let query = $state('');
  let hits = $state<SearchHit[] | null>(null);
  let busy = $state(false);
  let progress = $state(0);
  let signal: { cancelled: boolean; skipped?: number } | null = null;
  let skipped = $state(0);

  const typedRef = $derived(parseTypedRef(books, query, index ?? undefined));
  const tooShort = $derived(query.trim().length < 2);

  async function run(e?: Event) {
    e?.preventDefault();
    if (tooShort) return;
    app.pushSearch(query);
    if (signal) signal.cancelled = true;
    const s = { cancelled: false, skipped: 0 };
    signal = s;
    busy = true;
    progress = 0;
    hits = null;
    skipped = 0;
    try {
      const out = await searchAll(translation, books.map((b) => b.code), query.trim(), (n) => (progress = n), 200, s);
      if (!s.cancelled) {
        hits = out;
        skipped = s.skipped;
      }
    } catch {
      if (!s.cancelled) hits = [];
    } finally {
      if (!s.cancelled) busy = false;
    }
  }

  // emptying the box brings the history back
  $effect(() => {
    if (!query.trim()) hits = null;
  });

  function again(q: string) {
    query = q;
    run();
  }
  const recentRefs = $derived(app.history.filter((r) => books.some((b) => b.code === r.book)).slice(0, 12));

  function snippet(text: string): { before: string; match: string; after: string } {
    const flat = text.replace(/\n/g, ' ');
    const i = flat.indexOf(query.trim());
    if (i < 0) return { before: flat.slice(0, 120), match: '', after: '' };
    const start = Math.max(0, i - 50);
    return {
      before: (start > 0 ? '…' : '') + flat.slice(start, i),
      match: flat.slice(i, i + query.trim().length),
      after: flat.slice(i + query.trim().length, i + query.trim().length + 90),
    };
  }
</script>

<div class="view">
  <h2>{t(lang, 'search')}</h2>
  <form class="bar" onsubmit={run}>
    <input type="search" bind:value={query} placeholder={t(lang, 'searchPlaceholder')} aria-label={t(lang, 'search')} autocomplete="off" />
    <button class="btn primary" type="submit" disabled={tooShort || busy}>{t(lang, 'search')}</button>
  </form>

  {#if typedRef}
    <button class="btn goto" onclick={() => onNavigate(typedRef)}>→ {formatRef(books, typedRef)}</button>
  {/if}

  {#if tooShort && !hits}
    <p class="muted small">{t(lang, 'searchHint')}</p>
  {/if}

  {#if !query.trim() && !hits && !busy}
    {#if recentRefs.length}
      <section class="hist">
        <header class="label"><Icon name="book" size={15} /><span class="lt">{t(lang, 'recentRefs')}</span>
          <button class="clr" onclick={() => app.clearHistory()}>{t(lang, 'clearAll')}</button></header>
        <div class="chips">
          {#each recentRefs as r (r.book + r.ch + ':' + r.v)}
            <button class="hchip" onclick={() => onNavigate(r)}>{formatRef(books, r)}</button>
          {/each}
        </div>
      </section>
    {/if}
    {#if app.searches.length}
      <section class="hist">
        <header class="label"><Icon name="search" size={15} /><span class="lt">{t(lang, 'recentSearches')}</span>
          <button class="clr" onclick={() => app.clearSearches()}>{t(lang, 'clearAll')}</button></header>
        <div class="card rows">
          {#each app.searches.slice(0, 10) as q (q)}
            <button class="row qrow" onclick={() => again(q)}>
              <span class="lead"><Icon name="search" size={18} /></span>
              <span class="rl"><span>{q}</span></span>
              <span class="trail"><Icon name="chevron-right" size={16} /></span>
            </button>
          {/each}
        </div>
      </section>
    {/if}
  {/if}

  {#if busy}
    <p class="muted">{t(lang, 'searching')} {progress}/{books.length}</p>
  {/if}

  {#if hits}
    <h3>{t(lang, 'results')}: {hits.length}{#if hits.length >= 200} · {t(lang, 'tooMany')}{/if}</h3>
    {#if skipped}<p class="muted small">{t(lang, 'searchSkipped')}: {skipped}</p>{/if}
    {#if !hits.length}
      <p class="muted">{t(lang, 'noResults')}</p>
    {:else}
      <ul class="list">
        {#each hits as h (h.ref.book + h.ref.ch + ':' + h.ref.v)}
          {@const s = snippet(h.text)}
          <li>
            <button class="row" onclick={() => onNavigate(h.ref)}>
              <span class="rref">{formatRef(books, h.ref)}</span>
              <span class="snip">{s.before}<mark>{s.match}</mark>{s.after}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .hist { margin: 18px 0 8px; }
  .hist > .label { margin: 0 2px 8px; }
  .lt { flex: 1; }
  .clr { font-size: 12px; text-transform: none; letter-spacing: 0; color: var(--fg-muted); padding: 4px 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .hchip { padding: 7px 14px; border-radius: var(--r-pill); background: var(--bg-elev); border: 1px solid var(--line); font-size: 14px; font-weight: 600; }
  .hchip:active { background: var(--accent-soft); }
  .card.rows .qrow { display: grid; padding: 10px 16px; min-height: 48px; }
  .bar { display: flex; gap: 8px; margin-bottom: 12px; }
  .bar input { flex: 1; }
  .goto { margin-bottom: 12px; }
  .list { list-style: none; margin: 0; padding: 0; }
  .list li { border-bottom: 1px solid var(--line); }
  .row { display: block; width: 100%; text-align: left; padding: 10px 0; }
  .rref { display: block; color: var(--accent); font-weight: 700; font-size: 14px; margin-bottom: 2px; }
  .snip { font-size: calc(15px * var(--font-scale)); line-height: 1.5; }
  mark { background: var(--mark); color: inherit; border-radius: 3px; padding: 0 2px; }
</style>
