<script lang="ts">
  import type { BookMeta, Lang, Ref } from '../types';
  import { searchAll, type SearchHit } from '../data';
  import { formatRef, parseTypedRef } from '../refs';
  import { t } from '../i18n';

  let { books, lang, translation, onNavigate }: { books: BookMeta[]; lang: Lang; translation: string; onNavigate: (r: Ref) => void } = $props();

  let query = $state('');
  let hits = $state<SearchHit[] | null>(null);
  let busy = $state(false);
  let progress = $state(0);
  let signal: { cancelled: boolean; skipped?: number } | null = null;
  let skipped = $state(0);

  const typedRef = $derived(parseTypedRef(books, query));
  const tooShort = $derived(query.trim().length < 2);

  async function run(e?: Event) {
    e?.preventDefault();
    if (tooShort) return;
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
