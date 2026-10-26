<script lang="ts">
  import type { BookMeta, Lang, Ref } from '../types';
  import { formatRef, parseTypedRef } from '../refs';
  import { app } from '../state.svelte';
  import type { BookIndex } from '../booknames';
  import { t } from '../i18n';
  import Sheet from './Sheet.svelte';

  let {
    books,
    current,
    lang,
    onPick,
    onClose,
    index = null,
  }: { books: BookMeta[]; current: Ref; lang: Lang; onPick: (r: Ref) => void; onClose: () => void; index?: BookIndex | null } = $props();

  // The picker starts at the reader's current position and then holds its own
  // selection; later prop changes are not meant to move it.
  let step = $state<'book' | 'chapter' | 'verse'>('book');
  // svelte-ignore state_referenced_locally
  let book = $state<BookMeta>(books.find((b) => b.code === current.book) ?? books[0]);
  // svelte-ignore state_referenced_locally
  let chapter = $state(current.ch);
  let typed = $state('');
  let typedError = $state(false);

  const recent = $derived(app.history.filter((r) => books.some((b) => b.code === r.book)).slice(0, 8));
  const ot = $derived(books.filter((b) => b.testament === 'ot'));
  const nt = $derived(books.filter((b) => b.testament === 'nt'));
  const title = $derived(
    step === 'book' ? t(lang, 'books') : step === 'chapter' ? `${book.name} — ${t(lang, 'chapter')}` : `${book.name} ${chapter} — ${t(lang, 'verse')}`,
  );

  function pickBook(b: BookMeta) {
    book = b;
    if (b.chapters.length === 1) {
      chapter = 1;
      step = 'verse';
    } else {
      step = 'chapter';
    }
  }
  function pickChapter(c: number) {
    chapter = c;
    step = 'verse';
  }
  function pickVerse(v: number) {
    onPick({ book: book.code, ch: chapter, v });
  }
  function submitTyped(e: Event) {
    e.preventDefault();
    const r = parseTypedRef(books, typed, index ?? undefined);
    if (r) onPick(r);
    else typedError = true;
  }
  function back() {
    if (step === 'verse') step = book.chapters.length === 1 ? 'book' : 'chapter';
    else if (step === 'chapter') step = 'book';
  }
</script>

<Sheet {title} {onClose} tall>
  {#if step === 'book'}
    <form class="typed" onsubmit={submitTyped}>
      <input
        type="text"
        bind:value={typed}
        oninput={() => (typedError = false)}
        placeholder={t(lang, 'refPlaceholder')}
        aria-label={t(lang, 'goToRef')}
        autocomplete="off"
      />
      <button class="btn primary" type="submit" disabled={!typed.trim()}>{t(lang, 'go')}</button>
    </form>
    {#if typedError}<p class="small err">{t(lang, 'refNotFound')}</p>{/if}
    {#if recent.length}
      <h3>{t(lang, 'recentRefs')}</h3>
      <div class="recent">
        {#each recent as r (r.book + r.ch + ':' + r.v)}
          <button class="rc" onclick={() => onPick(r)}>{formatRef(books, r)}</button>
        {/each}
      </div>
    {/if}

    <h3>{t(lang, 'oldTestament')}</h3>
    <div class="grid books">
      {#each ot as b}
        <button class="cell" class:active={b.code === current.book} onclick={() => pickBook(b)}>{b.name}</button>
      {/each}
    </div>
    <h3>{t(lang, 'newTestament')}</h3>
    <div class="grid books">
      {#each nt as b}
        <button class="cell" class:active={b.code === current.book} onclick={() => pickBook(b)}>{b.name}</button>
      {/each}
    </div>
  {:else if step === 'chapter'}
    <button class="btn small ghost" onclick={back}>← {t(lang, 'back')}</button>
    <div class="grid nums">
      {#each book.chapters as _, i}
        <button class="cell num" class:active={book.code === current.book && i + 1 === current.ch} onclick={() => pickChapter(i + 1)}>{i + 1}</button>
      {/each}
    </div>
  {:else}
    <button class="btn small ghost" onclick={back}>← {t(lang, 'back')}</button>
    <div class="grid nums">
      {#each Array(book.lastVerse[chapter - 1] || 1) as _, i}
        <button class="cell num" class:active={book.code === current.book && chapter === current.ch && i + 1 === current.v} onclick={() => pickVerse(i + 1)}>{i + 1}</button>
      {/each}
    </div>
  {/if}
</Sheet>

<style>
  .typed { display: flex; gap: 8px; margin: 4px 0 12px; }
  .typed input { flex: 1; }
  .err { color: var(--wj); margin: -6px 0 10px; }
  h3 { margin: 12px 0 8px; font-size: 14px; }
  .grid { display: grid; gap: 6px; margin-bottom: 8px; }
  .grid.books { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
  .grid.nums { grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); margin-top: 10px; }
  .cell {
    padding: 10px 8px;
    border-radius: 10px;
    background: var(--accent-soft);
    font-size: 14px;
    text-align: center;
    line-height: 1.3;
  }
  .cell.num { padding: 12px 0; font-weight: 600; }
  .cell.active { background: var(--accent); color: var(--accent-fg); }
  .recent { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; margin-bottom: 4px; }
  .rc { flex: none; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg-elev); font-size: 14px; font-weight: 600; white-space: nowrap; }
</style>
