<script lang="ts">
  import type { Lang, Verse } from '../types';
  import { layoutVerse } from '../layout';
  import { t } from '../i18n';

  let {
    verse,
    label,
    lang,
    redLetters,
    showNumbers,
    bookmarked,
    hasNote,
    onStudy,
    onBookmark,
    onNote,
    onShare,
  }: {
    verse: Verse;
    label: string;
    lang: Lang;
    redLetters: boolean;
    showNumbers: boolean;
    bookmarked: boolean;
    hasNote: boolean;
    onStudy: (section?: 'footnotes' | 'xrefs') => void;
    onBookmark: () => void;
    onNote: () => void;
    onShare: () => void;
  } = $props();

  const lines = $derived(layoutVerse(verse));
</script>

<div class="label">
  <span class="ref">{label}</span>
</div>

<div class="scroll">
  {#if verse.heading}
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
</div>

<div class="actions">
  <button onclick={() => onStudy()} aria-label={t(lang, 'study')}>
    <span class="ic">☰</span><span>{t(lang, 'study')}</span>
  </button>
  <button onclick={onBookmark} aria-pressed={bookmarked} aria-label={t(lang, 'bookmark')}>
    <span class="ic">{bookmarked ? '★' : '☆'}</span><span>{t(lang, 'bookmark')}</span>
  </button>
  <button onclick={onNote} aria-label={t(lang, 'note')}>
    <span class="ic">{hasNote ? '✎' : '✐'}</span><span>{t(lang, 'note')}</span>
  </button>
  <button onclick={onShare} aria-label={t(lang, 'share')}>
    <span class="ic">⇪</span><span>{t(lang, 'share')}</span>
  </button>
</div>

<style>
  .label {
    display: flex; align-items: baseline; gap: 8px;
    color: var(--fg-muted);
    font-size: 14px;
    letter-spacing: 0.01em;
    margin-bottom: 10px;
  }
  .label .ref { color: var(--accent); font-weight: 700; }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    justify-content: center;
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
  .actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .actions button {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    font-size: 12px; color: var(--fg-muted);
    padding: 6px 0;
    border-radius: 10px;
  }
  .actions button:active { background: var(--accent-soft); }
  .actions .ic { font-size: 20px; line-height: 1; color: var(--accent); }
</style>
