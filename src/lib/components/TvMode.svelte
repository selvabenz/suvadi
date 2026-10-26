<script lang="ts">
  import { onMount } from 'svelte';
  import type { Book, BookMeta, Lang, Ref } from '../types';
  import { findVerse } from '../data';
  import { layoutVerse } from '../layout';
  import { nextChapter, prevChapter } from '../refs';
  import { swipe } from '../gestures';
  import { fitWords } from '../fit';
  import { listenReceiver, type TvMessage } from '../present';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  // One verse, very large, for a TV: shown on this screen (and mirrored by the
  // phone's own Cast / Smart View / AirPlay), opened by a smart TV's browser
  // from a QR link, or presented by a desktop browser. Arrow keys, a TV remote,
  // a swipe or a tap on either half move between verses.
  let {
    book,
    meta,
    books,
    current,
    lang,
    textLang,
    abbr,
    redLetters,
    theme,
    autoAdvance,
    receiver,
    fromTap,
    onGo,
    onRemote,
    onExit,
  }: {
    book: Book;
    meta: BookMeta;
    books: BookMeta[];
    current: Ref;
    lang: Lang;
    textLang: string;
    abbr: string;
    redLetters: boolean;
    theme: 'dark' | 'light';
    /** seconds per verse; 0 = off */
    autoAdvance: number;
    /** opened by a presenting browser: follow its messages, no exit button */
    receiver: boolean;
    /** entered by a tap in the app: fullscreen and landscape are allowed */
    fromTap: boolean;
    onGo: (r: Ref) => void;
    onRemote?: (m: TvMessage) => void;
    onExit: () => void;
  } = $props();

  const verse = $derived(book.code === current.book ? findVerse(book, current.ch, current.v) : undefined);
  const lines = $derived(verse ? layoutVerse(verse) : []);
  const chapter = $derived(book.chapters.find((c) => c.n === current.ch));
  const progress = $derived.by(() => {
    const vs = chapter?.verses ?? [];
    const i = verse ? vs.indexOf(verse) : -1;
    return vs.length > 1 && i >= 0 ? (i + 1) / vs.length : 0;
  });
  let waiting = $state(false);
  let hint = $state(true);
  let tick = $state(0); // bumped on every manual move, restarts auto-advance

  function next() {
    const vs = chapter?.verses ?? [];
    const i = verse ? vs.indexOf(verse) : -1;
    if (i >= 0 && i + 1 < vs.length) return onGo({ book: book.code, ch: current.ch, v: vs[i + 1].n });
    const n = nextChapter(books, book.code, current.ch);
    if (n) onGo({ book: n.book, ch: n.ch, v: 1 });
  }
  function prev() {
    const vs = chapter?.verses ?? [];
    const i = verse ? vs.indexOf(verse) : -1;
    if (i > 0) return onGo({ book: book.code, ch: current.ch, v: vs[i - 1].n });
    const p = prevChapter(books, book.code, current.ch);
    if (!p) return;
    const b = books.find((x) => x.code === p.book);
    onGo({ book: p.book, ch: p.ch, v: b?.lastVerse[p.ch - 1] || 1 });
  }
  function move(dir: 1 | -1) {
    tick++;
    if (dir === 1) next();
    else prev();
  }

  let swipedAt = 0;
  function onSwipe(d: 'left' | 'right') {
    swipedAt = Date.now();
    move(d === 'right' ? 1 : -1);
  }
  function onKey(e: KeyboardEvent) {
    const k = e.key;
    if ((e.target as HTMLElement)?.closest?.('button') && (k === 'Enter' || k === ' ')) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'MediaTrackNext'].includes(k)) {
      e.preventDefault();
      move(1);
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'MediaTrackPrevious'].includes(k)) {
      e.preventDefault();
      move(-1);
    } else if (!receiver && ['Escape', 'GoBack', 'BrowserBack'].includes(k)) {
      e.preventDefault();
      onExit();
    }
  }
  function onTap(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('button') || Date.now() - swipedAt < 400) return;
    const w = (e.currentTarget as HTMLElement).clientWidth;
    move(e.clientX < w / 2 ? -1 : 1);
  }

  // auto-advance
  $effect(() => {
    void tick;
    if (!(autoAdvance > 0)) return;
    const id = setInterval(next, autoAdvance * 1000);
    return () => clearInterval(id);
  });

  // keep the screen on; fullscreen + landscape only when entered by a tap
  let lock: WakeLockSentinel | null = null;
  async function wake() {
    try {
      lock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      lock = null;
    }
  }
  function onVisible() {
    if (document.visibilityState === 'visible') wake();
  }
  function onFullscreen() {
    if (fromTap && !document.fullscreenElement) onExit();
  }

  onMount(() => {
    wake();
    document.addEventListener('visibilitychange', onVisible);
    if (fromTap && document.documentElement.requestFullscreen) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          document.addEventListener('fullscreenchange', onFullscreen);
          const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
          return o.lock?.('landscape');
        })
        .catch(() => {});
    }
    let stop = () => {};
    if (receiver) {
      waiting = true;
      stop = listenReceiver((m) => {
        waiting = false;
        onRemote?.(m);
      });
    }
    const hintTimer = setTimeout(() => (hint = false), 3500);
    return () => {
      stop();
      clearTimeout(hintTimer);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('fullscreenchange', onFullscreen);
      lock?.release().catch(() => {});
      try {
        (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
      } catch {
        /* not locked */
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  });
</script>

<svelte:window onkeydown={onKey} />

<!-- Keys are handled on the window (TV remotes, keyboards); a tap on either half is a shortcut. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  class="tv"
  class:light={theme === 'light'}
  role="region"
  aria-label={t(lang, 'tvMode')}
  use:swipe={{ onSwipe }}
  onclick={onTap}
>
  {#if waiting}
    <p class="ref">{t(lang, 'tvWaiting')}</p>
  {:else if verse}
    <div class="text" class:red={redLetters} lang={textLang} use:fitWords aria-live="polite">
      {#each lines as line}
        <span class="ln {line.style}">{#each line.parts as part}{#if part.t === 'text'}<span class:wj={part.wj}>{part.s}</span>{/if}{/each}</span>
      {/each}
    </div>
    <p class="ref"><span>{meta.name} {current.ch}:{verse.id}</span><span class="ab">{abbr}</span></p>
  {/if}

  <div class="bar" aria-hidden="true"><i style="width: {progress * 100}%"></i></div>

  {#if !receiver}
    <button class="exit" onclick={onExit} aria-label={t(lang, 'tvExit')} title={t(lang, 'tvExit')}><Icon name="close" size={22} /></button>
    {#if hint}<p class="hint">{t(lang, 'tvHint')}</p>{/if}
  {/if}
</div>

<style>
  .tv {
    --tv-bg: #000;
    --tv-fg: #f5f4ef;
    --tv-muted: rgba(245, 244, 239, 0.55);
    --tv-line: rgba(245, 244, 239, 0.16);
    --tv-wj: #ff8a80;
    --tv-pad: clamp(24px, 6vw, 96px);
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--tv-pad);
    background: var(--tv-bg);
    color: var(--tv-fg);
    cursor: none;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
  }
  .tv.light {
    --tv-bg: #fbfaf6;
    --tv-fg: #121212;
    --tv-muted: rgba(0, 0, 0, 0.5);
    --tv-line: rgba(0, 0, 0, 0.12);
    --tv-wj: #b3261e;
  }
  .text {
    font-size: calc(clamp(28px, min(5.4vw, 7.5vh), 84px) * var(--fit, 1));
    line-height: 1.38;
    text-align: center;
    max-width: min(92vw, 1500px);
    max-height: 76vh;
    overflow: hidden;
    word-break: keep-all;
    overflow-wrap: normal;
  }
  .ln { display: block; }
  .ln.m, .ln.p, .ln.pi { display: inline; }
  .text.red .wj { color: var(--tv-wj); }
  .ref {
    display: flex;
    gap: 0.8em;
    align-items: baseline;
    margin: 1.2em 0 0;
    font-size: clamp(16px, 2vw, 30px);
    letter-spacing: 0.08em;
    color: var(--tv-muted);
  }
  .ab { font-weight: 700; font-size: 0.8em; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; height: 3px; background: var(--tv-line); }
  .bar i { display: block; height: 100%; background: var(--tv-fg); transition: width 0.3s; }
  .exit {
    position: fixed;
    top: calc(var(--safe-top) + 14px);
    right: 16px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--tv-muted);
    cursor: pointer;
    opacity: 0.6;
  }
  .exit:hover, .exit:focus-visible { opacity: 1; color: var(--tv-fg); }
  .hint {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 22px;
    margin: 0;
    text-align: center;
    font-size: 14px;
    color: var(--tv-muted);
    animation: fade 3.5s forwards;
  }
  @keyframes fade { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .hint { animation: none; } .bar i { transition: none; } }
</style>
