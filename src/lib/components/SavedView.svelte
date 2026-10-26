<script lang="ts">
  import type { BookMeta, Lang, Ref } from '../types';
  import { compareRefs, formatRef, parseRefKey } from '../refs';
  import { t } from '../i18n';
  import { app } from '../state.svelte';
  import VersePreview from './VersePreview.svelte';

  let {
    books,
    lang,
    translation,
    onNavigate,
    onEditNote,
  }: { books: BookMeta[]; lang: Lang; translation: string; onNavigate: (r: Ref) => void; onEditNote: (r: Ref) => void } = $props();

  const bookmarks = $derived(
    Object.keys(app.bookmarks)
      .map(parseRefKey)
      .filter((r): r is Ref => !!r)
      .sort((a, b) => compareRefs(books, a, b)),
  );
  const likes = $derived(
    Object.keys(app.likes)
      .map(parseRefKey)
      .filter((r): r is Ref => !!r)
      .sort((a, b) => compareRefs(books, a, b)),
  );
  const notes = $derived(
    Object.entries(app.notes)
      .map(([k, n]) => ({ r: parseRefKey(k), n }))
      .filter((x): x is { r: Ref; n: { text: string; at: string } } => !!x.r)
      .sort((a, b) => b.n.at.localeCompare(a.n.at)),
  );
</script>

<div class="view">
  <h2>{t(lang, 'navSaved')}</h2>
  <p class="muted small">{t(lang, 'savedLocally')}</p>

  <h3>{t(lang, 'bookmarks')} ({bookmarks.length})</h3>
  {#if !bookmarks.length}
    <p class="muted">{t(lang, 'nothingSaved')}</p>
  {:else}
    <ul class="list">
      {#each bookmarks as r (r.book + r.ch + ':' + r.v)}
        <li>
          <button class="row" onclick={() => onNavigate(r)}>
            <span class="rref">{formatRef(books, r)}</span>
            <VersePreview {r} {translation} />
          </button>
          <button class="del" onclick={() => app.toggleBookmark(r)} aria-label={t(lang, 'delete')}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}

  <h3><span class="heart">♥</span> {t(lang, 'liked')} ({likes.length})</h3>
  {#if !likes.length}
    <p class="muted">{t(lang, 'nothingSaved')}</p>
  {:else}
    <ul class="list">
      {#each likes as r (r.book + r.ch + ':' + r.v)}
        <li>
          <button class="row" onclick={() => onNavigate(r)}>
            <span class="rref">{formatRef(books, r)}</span>
            <VersePreview {r} {translation} />
          </button>
          <button class="del" onclick={() => app.toggleLike(r)} aria-label={t(lang, 'delete')}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}

  <h3>{t(lang, 'notes')} ({notes.length})</h3>
  {#if !notes.length}
    <p class="muted">{t(lang, 'nothingSaved')}</p>
  {:else}
    <ul class="list">
      {#each notes as { r, n } (r.book + r.ch + ':' + r.v)}
        <li>
          <button class="row" onclick={() => onNavigate(r)}>
            <span class="rref">{formatRef(books, r)}</span>
            <span class="ntext">{n.text}</span>
            <VersePreview {r} {translation} max={100} />
          </button>
          <button class="del" onclick={() => onEditNote(r)} aria-label={t(lang, 'note')}>✎</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  h3 { margin-top: 18px; }
  .heart { color: var(--heart); }
  .list { list-style: none; margin: 0; padding: 0; }
  .list li { display: flex; align-items: flex-start; gap: 8px; border-bottom: 1px solid var(--line); }
  .row { flex: 1; display: block; text-align: left; padding: 10px 0; }
  .rref { display: block; color: var(--accent); font-weight: 700; font-size: 14px; margin-bottom: 2px; }
  .ntext { display: block; margin-bottom: 4px; white-space: pre-wrap; font-size: calc(16px * var(--font-scale)); }
  .del { padding: 12px 6px; color: var(--fg-muted); font-size: 16px; }
</style>
