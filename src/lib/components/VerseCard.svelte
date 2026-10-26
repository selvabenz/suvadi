<script lang="ts">
  import type { Lang, Verse } from '../types';
  import { layoutVerse } from '../layout';
  import { tap } from '../gestures';
  import { t } from '../i18n';

  let {
    verse,
    label,
    lang,
    redLetters,
    showNumbers,
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
    redLetters: boolean;
    showNumbers: boolean;
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

  // The action menu is folded away by default: the "⋯" button or a long
  // press on the verse opens it. Icons only, with the name as the tooltip.
  let open = $state(false);
  // Each like plays a heart animation; the counter re-keys the element.
  let burst = $state(0);

  function doubleTap() {
    if (!liked) burst++;
    onLike();
  }
  function longPress() {
    open = true;
    if (navigator.vibrate) navigator.vibrate(12);
  }
</script>

<div class="label">
  <span class="ref">{label}</span>
  {#if liked}<span class="heart" role="img" aria-label={t(lang, 'liked')}>♥</span>{/if}
  <span class="spacer"></span>
  <button class="more" class:on={open} onclick={() => (open = !open)} aria-expanded={open} aria-label={t(lang, 'more')}>
    {open ? '✕' : '⋯'}
  </button>
</div>

<div class="scroll" use:tap={{ onDoubleTap: doubleTap, onLongPress: longPress }}>
  {#if showHeadings && verse.heading}
    <h3 class="heading">{verse.heading}</h3>
    {#if verse.parallel}<p class="parallel">{verse.parallel}</p>{/if}
  {/if}
  {#if verse.superscription}
    <p class="superscription">{verse.superscription}</p>
  {/if}
  {#if verse.lead}
    <p class="lead muted">{verse.lead}</p>
  {/if}

  <div class="text" class:red={redLetters}>
    {#if showNumbers}<span class="vnum">{verse.id}</span>{/if}
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

  {#key burst}
    {#if burst}<div class="burst" aria-hidden="true">♥</div>{/if}
  {/key}
</div>

{#if open}
  <div class="actions">
    <button onclick={() => onStudy()} aria-label={t(lang, 'study')} title={t(lang, 'study')}>☰</button>
    <button onclick={onBookmark} aria-pressed={bookmarked} aria-label={t(lang, 'bookmark')} title={t(lang, 'bookmark')}>{bookmarked ? '★' : '☆'}</button>
    <button onclick={onNote} aria-label={t(lang, 'note')} title={t(lang, 'note')}>{hasNote ? '✎' : '✐'}</button>
    <button onclick={onShare} aria-label={t(lang, 'share')} title={t(lang, 'share')}>⇪</button>
  </div>
{/if}

<style>
  .label {
    display: flex; align-items: center; gap: 8px;
    color: var(--fg-muted);
    font-size: 14px;
    letter-spacing: 0.01em;
    margin-bottom: 10px;
    min-height: 28px;
  }
  .label .ref { color: var(--accent); font-weight: 700; }
  .label .heart { color: var(--heart); font-size: 16px; line-height: 1; }
  .label .spacer { flex: 1; }
  .more {
    width: 32px; height: 28px;
    border-radius: 999px;
    font-size: 18px; line-height: 1;
    color: var(--fg-muted);
  }
  .more.on, .more:active { background: var(--accent-soft); color: var(--accent); }
  .scroll {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    justify-content: center;
    /* A long press opens the reader's own menu, not the text-selection callout. */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .heading {
    font-size: calc(17px * var(--font-scale));
    color: var(--fg-muted);
    font-weight: 600;
    margin: 0 0 4px;
  }
  .parallel { margin: 0 0 12px; font-size: calc(14px * var(--font-scale)); color: var(--fg-muted); }
  .superscription { margin: 0 0 12px; font-style: italic; font-size: calc(15px * var(--font-scale)); color: var(--fg-muted); }
  .lead { margin: 0 0 8px; font-size: calc(15px * var(--font-scale)); }
  .heading, .parallel, .superscription, .lead, .text { text-align: var(--align, left); }
  .text {
    font-size: calc(22px * var(--font-scale));
    line-height: 1.7;
    word-break: normal;
    overflow-wrap: anywhere;
  }
  .vnum {
    font-size: 0.55em;
    vertical-align: super;
    color: var(--fg-muted);
    margin-right: 4px;
    font-weight: 700;
  }
  .line { display: block; }
  .line.q2 { padding-left: 1.5em; }
  .line.q3 { padding-left: 3em; }
  .line.qr { text-align: right; }
  .line.m, .line.p, .line.pi { display: inline; }
  .line.m.first, .line.p.first, .line.pi.first { display: inline; }
  .line.q, .line.q2, .line.q3, .line.qr { display: block; }
  .text.red .wj { color: var(--wj); }
  .marker {
    font-size: 0.55em;
    vertical-align: super;
    color: var(--accent);
    font-weight: 700;
    padding: 0 3px;
    line-height: 1;
  }
  .marker.x { color: var(--fg-muted); }

  .burst {
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    font-size: 96px;
    line-height: 1;
    color: var(--heart);
    pointer-events: none;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
    animation: pop 900ms ease-out forwards;
  }
  @keyframes pop {
    0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
    20% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
    45% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    100% { transform: translate(-50%, -70%) scale(0.9); opacity: 0; }
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    animation: rise 160ms ease-out;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  .actions button {
    display: flex; align-items: center; justify-content: center;
    height: 44px;
    font-size: 22px; line-height: 1;
    color: var(--accent);
    border-radius: 12px;
  }
  .actions button:active { background: var(--accent-soft); }
  @media (prefers-reduced-motion: reduce) {
    .burst, .actions { animation: none; }
  }
</style>
