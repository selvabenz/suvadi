<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Book, BookMeta, Lang, Ref, Selection, StudySection, Verse } from '../types';
  import { t } from '../i18n';
  import { swipe, twoFingerTap } from '../gestures';
  import VerseCard from './VerseCard.svelte';

  type Item =
    | { kind: 'intro'; key: string }
    | { kind: 'verse'; key: string; ch: number; verse: Verse }
    | { kind: 'end'; key: string };

  let {
    book,
    meta,
    books,
    target,
    lang,
    textLang,
    redLetters,
    showRef,
    showHeadings,
    isBookmarked,
    isLiked,
    hasNote,
    onCurrent,
    onNavigate,
    onStep,
    onWhatsApp,
    onStudy,
    onBookmark,
    onLike,
    onNote,
    onShare,
    onExplain,
    onTv,
  }: {
    book: Book;
    meta: BookMeta;
    books: BookMeta[];
    target: Ref | null;
    lang: Lang;
    textLang: string;
    redLetters: boolean;
    showRef: boolean;
    showHeadings: boolean;
    isBookmarked: (r: Ref) => boolean;
    isLiked: (r: Ref) => boolean;
    hasNote: (r: Ref) => boolean;
    onCurrent: (r: Ref) => void;
    onNavigate: (r: Ref) => void;
    /** Horizontal swipe: 1 = next chapter (swipe right), -1 = previous (swipe left). */
    onStep: (dir: 1 | -1) => void;
    /** Two-finger tap: share the verse on screen on WhatsApp. */
    onWhatsApp: () => void;
    onStudy: (r: Ref, v: Verse, section?: StudySection) => void;
    onBookmark: (r: Ref) => void;
    onLike: (r: Ref) => void;
    onNote: (r: Ref, v: Verse) => void;
    onShare: (r: Ref, v: Verse) => void;
    onExplain: (r: Ref, v: Verse, sel: Selection | null) => void;
    /** open the "Show on a TV" sheet */
    onTv: () => void;
  } = $props();

  const items = $derived.by<Item[]>(() => {
    const out: Item[] = [];
    if (book.intro.length) out.push({ kind: 'intro', key: 'intro' });
    for (const ch of book.chapters) for (const v of ch.verses) out.push({ kind: 'verse', key: `${ch.n}:${v.n}`, ch: ch.n, verse: v });
    out.push({ kind: 'end', key: 'end' });
    return out;
  });

  const bookIndex = $derived(books.findIndex((b) => b.code === book.code));
  const prevBook = $derived(bookIndex > 0 ? books[bookIndex - 1] : null);
  const nextBook = $derived(bookIndex >= 0 && bookIndex + 1 < books.length ? books[bookIndex + 1] : null);

  // Every verse has a card for scrolling and snapping, but only the cards
  // near the one on screen are filled in: a long book (Psalms has 2,461
  // verses) used to build thousands of full cards and took many seconds.
  // All cards are exactly one screen tall, so the current card is simply
  // scrollTop / height.
  const NEAR = 3;
  let container: HTMLDivElement;
  let at = $state(0);
  let lastKey = '';
  let raf = 0;

  function keyFor(r: Ref): string {
    const ch = book.chapters.find((c) => c.n === r.ch);
    const v = ch?.verses.find((x) => x.n === r.v) ?? ch?.verses.find((x) => x.n <= r.v && (x.end ?? x.n) >= r.v);
    return v ? `${r.ch}:${v.n}` : `${r.ch}:1`;
  }

  function measure() {
    raf = 0;
    const h = container?.clientHeight;
    if (!h) return;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(container.scrollTop / h)));
    if (i !== at) at = i;
    const item = items[i];
    if (item?.kind !== 'verse' || item.key === lastKey) return;
    lastKey = item.key;
    onCurrent({ book: book.code, ch: item.ch, v: item.verse.n });
  }
  function onScroll() {
    if (!raf) raf = requestAnimationFrame(measure);
  }
  onMount(() => () => {
    if (raf) cancelAnimationFrame(raf);
  });

  // Scroll to the requested verse whenever the target or the book changes.
  $effect(() => {
    const tgt = target;
    const code = book.code;
    if (!tgt || tgt.book !== code) return;
    const key = keyFor(tgt);
    const i = items.findIndex((x) => x.key === key);
    if (i < 0) return;
    at = i; // fill the cards around the target before jumping there
    tick().then(() => {
      if (!container) return;
      lastKey = key;
      container.scrollTop = i * container.clientHeight;
      onCurrent({ book: code, ch: tgt.ch, v: tgt.v });
    });
  });


  function label(ch: number, v: Verse): string {
    return showRef ? `${meta.name} ${ch}:${v.id}` : meta.name;
  }
</script>

<div class="feed" bind:this={container} onscroll={onScroll} use:swipe={{ onSwipe: (d) => onStep(d === 'right' ? 1 : -1) }} use:twoFingerTap={{ onTap: onWhatsApp }}>
  {#each items as item, i (item.key)}
    {#if item.kind === 'intro'}
      <article class="card intro" data-key="intro">
        <div class="label"><span class="ref">{meta.long || meta.name}</span></div>
        <div class="scroll">
          <h3>{t(lang, 'bookIntro')}</h3>
          {#each book.intro as block}
            {#if block.kind === 'is' || block.kind === 'iot'}
              <h4>{block.text}</h4>
            {:else if block.kind === 'io1'}
              <p class="io">{block.text}</p>
            {:else}
              <p>{block.text}</p>
            {/if}
          {/each}
        </div>
        <div class="foot">
          <button class="btn primary" onclick={() => onNavigate({ book: book.code, ch: 1, v: 1 })}>{t(lang, 'startReading')} ↓</button>
        </div>
      </article>
    {:else if item.kind === 'verse'}
      {@const ref = { book: book.code, ch: item.ch, v: item.verse.n }}
      <article class="card" data-key={item.key}>
        {#if Math.abs(i - at) <= NEAR}
        <VerseCard
          verse={item.verse}
          label={label(item.ch, item.verse)}
          {lang}
          {textLang}
          draft={!!meta.draft}
          {redLetters}
          {showHeadings}
          bookmarked={isBookmarked(ref)}
          liked={isLiked(ref)}
          hasNote={hasNote(ref)}
          onStudy={(section) => onStudy(ref, item.verse, section)}
          onBookmark={() => onBookmark(ref)}
          onLike={() => onLike(ref)}
          onNote={() => onNote(ref, item.verse)}
          onShare={() => onShare(ref, item.verse)}
          onExplain={(sel) => onExplain(ref, item.verse, sel)}
          {onTv}
        />
        {/if}
      </article>
    {:else}
      <article class="card end" data-key="end">
        {#if book.partial}
          <!-- An online translation holds one chapter at a time: continue chapter by chapter. -->
          <div class="scroll center">
            <h2>{meta.name} {book.chapters[0]?.n}</h2>
            <div class="endbtns">
              <button class="btn ghost" onclick={() => onStep(-1)}>← {t(lang, 'prevChapter')}</button>
              <button class="btn primary" onclick={() => onStep(1)}>{t(lang, 'nextChapter')} →</button>
            </div>
          </div>
        {:else}
        <div class="scroll center">
          <p class="muted">{nextBook ? t(lang, 'endOfBook') : t(lang, 'endOfBible')}</p>
          <h2>{meta.long || meta.name}</h2>
          <div class="endbtns">
            {#if prevBook}
              <button class="btn ghost" onclick={() => onNavigate({ book: prevBook.code, ch: 1, v: 1 })}>↑ {prevBook.name}</button>
            {/if}
            {#if nextBook}
              <button class="btn primary" onclick={() => onNavigate({ book: nextBook.code, ch: 1, v: 1 })}>{nextBook.name} →</button>
            {/if}
          </div>
        </div>
        {/if}
      </article>
    {/if}
  {/each}
</div>

<style>
  .feed {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    /* The browser pans vertically; horizontal swipes and double taps reach our handlers. */
    touch-action: pan-y;
  }
  .card {
    position: relative;
    /* exactly one screen of the feed, so the current card is scrollTop / height */
    height: 100%;
    scroll-snap-align: start;
    scroll-snap-stop: always;
    display: flex;
    flex-direction: column;
    padding: calc(var(--top-h) + var(--safe-top) + 10px) 20px calc(var(--nav-h) + var(--safe-bottom) + 10px);
    content-visibility: auto;
    contain-intrinsic-size: auto 100dvh;
    contain: strict;
    touch-action: pan-y;
  }
  .label { color: var(--fg-muted); font-size: 14px; margin-bottom: 10px; }
  .label .ref { color: var(--accent); font-weight: 700; }
  .scroll { flex: 1; min-height: 0; overflow-y: auto; touch-action: pan-y; }
  .scroll.center { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 12px; }
  .intro h3 { color: var(--fg-muted); margin-bottom: 12px; }
  .intro h4 { margin: 14px 0 4px; font-size: calc(16px * var(--font-scale)); color: var(--accent); }
  .intro p { margin: 0 0 8px; font-size: calc(16px * var(--font-scale)); line-height: 1.7; }
  .intro p.io { padding-left: 1em; color: var(--fg-muted); }
  .foot { padding-top: 12px; display: flex; justify-content: center; }
  .endbtns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
</style>
