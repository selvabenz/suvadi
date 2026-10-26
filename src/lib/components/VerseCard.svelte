<script lang="ts">
  import type { Lang, Verse } from '../types';
  import { layoutVerse } from '../layout';
  import { tap } from '../gestures';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  let {
    verse,
    label,
    lang,
    textLang,
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
  }: {
    verse: Verse;
    label: string;
    lang: Lang;
    textLang: string;
    redLetters: boolean;
    showHeadings: boolean;
    bookmarked: boolean;
    liked: boolean;
    hasNote: boolean;
    onStudy: (section?: 'footnotes' | 'xrefs') => void;
    onBookmark: () => void;
    onLike: () => void;
    onNote: () => void;
    onShare: () => void;
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
  function longPress() {
    open = true;
    if (navigator.vibrate) navigator.vibrate(12);
  }
</script>

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

    <div class="text" class:red={redLetters} lang={textLang}>
      {#each lines as line, li}
        <span class="line {line.style}" class:first={li === 0}>
          {#each line.parts as part}
            {#if part.t === 'text'}
              <span class:wj={part.wj}>{part.s}</span>
            {:else if part.t === 'fn'}
              <button class="marker fn" onclick={() => onStudy('footnotes')} aria-label={t(lang, 'footnotes')}>{String.fromCharCode(97 + (part.i % 26))}</button>
            {:else}
              <button class="marker x" onclick={() => onStudy('xrefs')} aria-label={t(lang, 'irvXrefs')}>✱</button>
            {/if}
          {/each}
        </span>
      {/each}
    </div>

    <p class="ref">{label}</p>
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
  <button class="like" class:liked onclick={like} aria-pressed={liked} aria-label={t(lang, 'like')} title={t(lang, 'like')}>
    <Icon name="heart" filled={liked} />
  </button>
  <button class:on={open} onclick={() => (open = !open)} aria-expanded={open} aria-label={t(lang, 'more')} title={t(lang, 'more')}>
    <Icon name={open ? 'close' : 'more'} />
  </button>
</div>

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
  .body { margin: auto 0; padding: 0 30px; }
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
    font-size: calc(23px * var(--font-scale));
    line-height: 1.6;
    color: var(--fg);
    word-break: normal;
    overflow-wrap: anywhere;
  }
  .ref {
    margin: 22px 0 0;
    font-size: 15px;
    letter-spacing: 0.02em;
    color: var(--fg-muted);
  }
  .line { display: block; }
  .line.q2 { padding-left: 1.5em; }
  .line.q3 { padding-left: 3em; }
  .line.qr { text-align: right; }
  .line.m, .line.p, .line.pi { display: inline; }
  .line.q, .line.q2, .line.q3, .line.qr { display: block; }
  .text.red .wj { color: var(--wj); }
  .marker {
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
    .burst, .menu { animation: none; }
  }
</style>
