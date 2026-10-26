<script lang="ts">
  import type { Lang, Selection, StudySection, Verse } from '../types';
  import { layoutVerse, selectionText, splitWords } from '../layout';
  import { tap } from '../gestures';
  import { fitWords } from '../fit';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  let {
    verse,
    label,
    lang,
    textLang,
    draft = false,
    redLetters,
    showHeadings,
    bookmarked,
    liked,
    hasNote,
    onStudy,
    onBookmark,
    onLike,
    onNote,
    onShare,
    onExplain,
  }: {
    verse: Verse;
    label: string;
    lang: Lang;
    textLang: string;
    /** the book comes from an unreleased source (some ULT books) */
    draft?: boolean;
    redLetters: boolean;
    showHeadings: boolean;
    bookmarked: boolean;
    liked: boolean;
    hasNote: boolean;
    onStudy: (section?: StudySection) => void;
    onBookmark: () => void;
    onLike: () => void;
    onNote: () => void;
    onShare: () => void;
    /** Open the explain sheet for the circled words, or the whole verse. */
    onExplain: (sel: Selection | null) => void;
  } = $props();

  const lines = $derived(layoutVerse(verse));

  // The study / bookmark / note / share icons are folded away by default:
  // the ⋯ button or a long press on the verse opens them.
  let open = $state(false);
  // Each like plays a heart animation; the counter re-keys the element.
  let burst = $state(0);

  function like() {
    if (!liked) burst++;
    onLike();
  }
  // Footnote / cross-reference markers are inline text (not buttons), so a
  // marker never wraps onto a line by itself, away from its word.
  function activate(e: KeyboardEvent, section: StudySection) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onStudy(section);
    }
  }
  function longPress() {
    if (selecting) return;
    open = true;
    if (navigator.vibrate) navigator.vibrate(12);
  }

  // Explain mode: ✦ turns the verse into tappable words; tapping words circles
  // a phrase, and the pill (or ✦ again) opens the explanation.
  let selecting = $state(false);
  let sel = $state<{ a: number; b: number } | null>(null);
  const wordLines = $derived(splitWords(lines));
  const selection = $derived(sel ? selectionText(verse.text, wordLines, sel.a, sel.b) : null);

  function toggleWord(w: number) {
    if (!sel) sel = { a: w, b: w };
    else if (w === sel.a - 1) sel = { a: w, b: sel.b };
    else if (w === sel.b + 1) sel = { a: sel.a, b: w };
    else if (w === sel.a && w === sel.b) sel = null;
    else if (w === sel.a) sel = { a: w + 1, b: sel.b };
    else if (w === sel.b) sel = { a: sel.a, b: w - 1 };
    else sel = { a: w, b: w };
  }
  function exitSelect() {
    selecting = false;
    sel = null;
  }
  function sparkle() {
    if (!selecting) {
      open = false;
      selecting = true;
      return;
    }
    explain();
  }
  function explain() {
    const s = selection;
    exitSelect();
    onExplain(s);
  }
  function clip(s: string, n = 28): string {
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  }
  function onKey(e: KeyboardEvent) {
    if (selecting && e.key === 'Escape') exitSelect();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="scroll" use:tap={{ onDoubleTap: like, onLongPress: longPress }}>
  <div class="body">
    {#if showHeadings && verse.heading}
      <h3 class="heading" lang={textLang}>{verse.heading}</h3>
      {#if verse.parallel}<p class="parallel" lang={textLang}>{verse.parallel}</p>{/if}
    {/if}
    {#if verse.superscription}
      <p class="superscription" lang={textLang}>{verse.superscription}</p>
    {/if}
    {#if verse.lead}
      <p class="lead muted" lang={textLang}>{verse.lead}</p>
    {/if}

    <div class="text" class:red={redLetters} class:selecting lang={textLang} use:fitWords>
      {#if selecting}
        {#each wordLines as line, li}
          <span class="line {line.style}" class:first={li === 0}>
            {#each line.items as it}
              {#if it.t === 'word'}
                <button
                  class="w"
                  class:wj={it.wj}
                  class:sel={!!sel && it.w >= sel.a && it.w <= sel.b}
                  onclick={() => toggleWord(it.w)}
                >{it.s}</button>
              {:else if it.t === 'space'}{it.s}
              {:else if it.t === 'fn'}<span class="marker">{String.fromCharCode(97 + (it.i % 26))}</span>
              {:else}<span class="marker">✱</span>{/if}
            {/each}
          </span>
        {/each}
      {:else}
      {#each lines as line, li}
        <span class="line {line.style}" class:first={li === 0}>
          {#each line.parts as part}
            {#if part.t === 'text'}
              <span class:wj={part.wj}>{part.s}</span>
            {:else if part.t === 'fn'}
              <span class="marker fn" role="button" tabindex="0" onclick={() => onStudy('footnotes')} onkeydown={(e) => activate(e, 'footnotes')} aria-label={t(lang, 'footnotes')}>{String.fromCharCode(97 + (part.i % 26))}</span>
            {:else}
              <span class="marker x" role="button" tabindex="0" onclick={() => onStudy('xrefs')} onkeydown={(e) => activate(e, 'xrefs')} aria-label={t(lang, 'irvXrefs')}>✱</span>
            {/if}
          {/each}
        </span>
      {/each}
      {/if}
    </div>

    <p class="ref">{label}{#if draft} <span class="draft">{t(lang, 'draft')}</span>{/if}</p>
  </div>

  {#key burst}
    {#if burst}<div class="burst" aria-hidden="true"><Icon name="heart" size={110} filled /></div>{/if}
  {/key}
</div>

<div class="rail">
  {#if open}
    <div class="menu">
      <button onclick={() => onStudy()} aria-label={t(lang, 'study')} title={t(lang, 'study')}><Icon name="bulb" /></button>
      <button class:set={bookmarked} onclick={onBookmark} aria-pressed={bookmarked} aria-label={t(lang, 'bookmark')} title={t(lang, 'bookmark')}><Icon name="bookmark" filled={bookmarked} /></button>
      <button class:set={hasNote} onclick={onNote} aria-label={t(lang, 'note')} title={t(lang, 'note')}><Icon name="note" filled={hasNote} /></button>
      <button onclick={onShare} aria-label={t(lang, 'share')} title={t(lang, 'share')}><Icon name="send" /></button>
    </div>
  {/if}
  <button class="ai" class:on={selecting} onclick={sparkle} aria-pressed={selecting} aria-label={t(lang, 'explain')} title={t(lang, 'explain')}>
    <Icon name="sparkle" />
  </button>
  <button class="like" class:liked onclick={like} aria-pressed={liked} aria-label={t(lang, 'like')} title={t(lang, 'like')}>
    <Icon name="heart" filled={liked} />
  </button>
  <button class:on={open} onclick={() => (open = !open)} aria-expanded={open} aria-label={t(lang, 'more')} title={t(lang, 'more')}>
    <Icon name={open ? 'close' : 'more'} />
  </button>
</div>

{#if selecting}
  <div class="selbar" role="status">
    <button class="btn primary" onclick={explain}>
      <Icon name="sparkle" size={18} />
      <span>{selection ? `${t(lang, 'explain')} “${clip(selection.text)}”` : t(lang, 'explainVerse')}</span>
    </button>
    <button class="btn ghost x" onclick={exitSelect} aria-label={t(lang, 'exitSelect')} title={t(lang, 'exitSelect')}><Icon name="close" size={18} /></button>
  </div>
  {#if !selection}<p class="hint">{t(lang, 'selectHint')}</p>{/if}
{/if}

<style>
  .scroll {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    display: flex;
    flex-direction: column;
    /* A long press opens the reader's own menu, not the text-selection callout. */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  /* margin: auto centres the verse vertically yet lets a long one scroll from its top. */
  .body { margin: auto 0; padding: 0 12px; }
  .heading {
    font-size: calc(16px * var(--font-scale));
    color: var(--fg-muted);
    font-weight: 600;
    margin: 0 0 6px;
  }
  .parallel { margin: 0 0 14px; font-size: calc(13px * var(--font-scale)); color: var(--fg-muted); }
  .superscription { margin: 0 0 12px; font-style: italic; font-size: calc(15px * var(--font-scale)); color: var(--fg-muted); }
  .lead { margin: 0 0 8px; font-size: calc(15px * var(--font-scale)); }
  .heading, .parallel, .superscription, .lead, .text, .ref { text-align: var(--align, center); }
  .text {
    /* --fit < 1 only for a verse whose longest word is wider than the column (fit.ts) */
    font-size: calc(23px * var(--font-scale) * var(--fit, 1));
    line-height: var(--line-height, 1.45);
    color: var(--fg);
    /* never break inside a word */
    word-break: keep-all;
    overflow-wrap: normal;
    hyphens: manual;
  }
  .ref {
    margin: 22px 0 0;
    font-size: 15px;
    letter-spacing: 0.02em;
    color: var(--fg-muted);
  }
  .draft { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: var(--accent-soft); vertical-align: middle; }
  .line { display: block; }
  .line.q2 { padding-left: 1.5em; }
  .line.q3 { padding-left: 3em; }
  .line.qr { text-align: right; }
  .line.m, .line.p, .line.pi { display: inline; }
  .line.q, .line.q2, .line.q3, .line.qr { display: block; }
  .text.red .wj { color: var(--wj); }
  .marker {
    cursor: pointer;
    font-size: 0.5em;
    vertical-align: super;
    color: var(--fg-muted);
    font-weight: 700;
    padding: 0 3px;
    line-height: 1;
  }

  .rail {
    position: absolute;
    right: 8px;
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 12px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    z-index: 2;
  }
  .menu { display: flex; flex-direction: column; gap: 6px; animation: rise 160ms ease-out; }
  .rail button {
    width: 44px; height: 44px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 999px;
    color: var(--fg);
  }
  .rail button:active, .rail button.on { background: var(--accent-soft); }
  .rail button.set { color: var(--accent); }
  .rail .like.liked { color: var(--heart); }
  .rail .ai { color: var(--accent); }
  .rail .ai.on { background: var(--accent); color: var(--accent-fg); }

  /* Word buttons in select mode look like the text they are. */
  .text.selecting { -webkit-user-select: none; user-select: none; }
  .w {
    display: inline;
    padding: 0 1px;
    margin: 0;
    border-radius: 5px;
    font: inherit;
    color: inherit;
    line-height: inherit;
    text-align: inherit;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .text.red .w.wj { color: var(--wj); }
  .w.sel { background: var(--mark); box-shadow: 0 0 0 2px var(--mark); }
  .selbar {
    position: absolute;
    left: 50%;
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 16px);
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    max-width: calc(100% - 120px);
    z-index: 3;
    animation: rise 160ms ease-out;
  }
  .selbar .btn.primary { min-width: 0; box-shadow: var(--pill-shadow); }
  .selbar .btn.primary span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .selbar .btn.x { padding: 8px 10px; background: var(--bg-elev); box-shadow: var(--pill-shadow); }
  .hint {
    position: absolute;
    left: 0; right: 0;
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 70px);
    text-align: center;
    font-size: 13px;
    color: var(--fg-muted);
    margin: 0;
    pointer-events: none;
  }

  .burst {
    position: absolute;
    left: 50%; top: 50%;
    color: var(--heart);
    pointer-events: none;
    filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.18));
    animation: pop 900ms ease-out forwards;
  }
  @keyframes pop {
    0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
    20% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
    45% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    100% { transform: translate(-50%, -70%) scale(0.9); opacity: 0; }
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .burst, .menu, .selbar { animation: none; }
  }
</style>
