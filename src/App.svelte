<script lang="ts">
  import { onMount } from 'svelte';
  import type { Book, Manifest, Ref, TranslationInfo, Verse } from './lib/types';
  import { DEFAULT_TRANSLATION, loadBook, loadManifest, loadTranslations } from './lib/data';
  import { formatRef, nextChapter, prevChapter } from './lib/refs';
  import { t } from './lib/i18n';
  import { app } from './lib/state.svelte';
  import Feed from './lib/components/Feed.svelte';
  import Picker from './lib/components/Picker.svelte';
  import StudySheet from './lib/components/StudySheet.svelte';
  import NoteSheet from './lib/components/NoteSheet.svelte';
  import PlanView from './lib/components/PlanView.svelte';
  import SavedView from './lib/components/SavedView.svelte';
  import SearchView from './lib/components/SearchView.svelte';
  import SettingsView from './lib/components/SettingsView.svelte';

  type View = 'read' | 'plan' | 'saved' | 'search' | 'settings';

  let translations = $state<TranslationInfo[]>([]);
  let manifest = $state<Manifest | null>(null);
  let loadError = $state(false);
  let view = $state<View>('read');
  let book = $state<Book | null>(null);
  let target = $state<Ref | null>(null);
  let current = $state<Ref>(app.place);
  let picker = $state(false);
  let study = $state<{ r: Ref; v: Verse; section?: 'footnotes' | 'xrefs' } | null>(null);
  let noteFor = $state<Ref | null>(null);
  let toast = $state('');
  let offlineReady = $state(false);
  let loadedFor = DEFAULT_TRANSLATION;   // the translation `manifest` was loaded for

  const lang = $derived(app.settings.lang);
  const translation = $derived(app.settings.translation);
  const books = $derived(manifest?.books ?? []);
  const meta = $derived(book ? books.find((b) => b.code === book!.code) ?? null : null);
  const currentLabel = $derived(books.length ? formatRef(books, current) : '');

  $effect(() => {
    document.documentElement.dataset.theme = app.settings.theme;
    document.documentElement.style.setProperty('--font-scale', String(app.settings.fontScale));
    document.documentElement.style.setProperty('--align', app.settings.textAlign);
    document.documentElement.dataset.font = app.settings.font;
    document.documentElement.lang = lang;
  });

  async function start() {
    loadError = false;
    try {
      translations = await loadTranslations();
      // A translation that was removed from the build falls back to the default.
      if (!translations.some((x) => x.id === translation) && translations.length) {
        app.update('translation', translations.some((x) => x.id === DEFAULT_TRANSLATION) ? DEFAULT_TRANSLATION : translations[0].id);
      }
      loadedFor = app.settings.translation;
      manifest = await loadManifest(loadedFor);
      await navigate(app.place, false);
    } catch {
      loadError = true;
    }
  }

  onMount(async () => {
    await start();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => (offlineReady = true)).catch(() => {});
    }
  });

  // Switching translation in Settings: reload the manifest and the open book,
  // and stay on the same verse (verse references are shared across translations).
  $effect(() => {
    const id = translation;
    if (!manifest || id === loadedFor) return;
    loadedFor = id;
    const place = current;
    loadManifest(id)
      .then(async (m) => {
        manifest = m;
        book = null;
        // Reopen the same verse in the new translation without leaving the
        // current tab (the reader is on Settings when this happens).
        await open(place);
      })
      .catch(() => showToast(t(lang, 'loadFailed')));
  });

  /** Load the book for `ref` (in the chosen translation) and point the feed at it. */
  async function open(ref: Ref): Promise<boolean> {
    if (!book || book.code !== ref.book) {
      try {
        book = await loadBook(app.settings.translation, ref.book);
      } catch {
        showToast(t(lang, 'loadFailed'));
        return false;
      }
    }
    target = { ...ref };
    return true;
  }

  async function navigate(ref: Ref, record = true) {
    view = 'read';
    if (!(await open(ref))) return;
    if (record) app.pushHistory(ref);
  }

  let placeTimer: ReturnType<typeof setTimeout> | undefined;
  function onCurrent(r: Ref) {
    current = r;
    clearTimeout(placeTimer);
    placeTimer = setTimeout(() => app.setPlace(r), 400);
  }

  function step(dir: 1 | -1) {
    const next = dir === 1 ? nextChapter(books, current.book, current.ch) : prevChapter(books, current.book, current.ch);
    if (next) navigate({ book: next.book, ch: next.ch, v: 1 });
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 1800);
  }

  function shareText(r: Ref, v: Verse): string {
    const label = formatRef(books, { book: r.book, ch: r.ch, v: v.n }, v.end);
    return `${v.text}\n— ${label} (${manifest?.abbr ?? ''})`.replace(' ()', '');
  }

  async function share(r: Ref, v: Verse) {
    const text = shareText(r, v);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* user cancelled the share sheet */
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast(t(lang, 'copied'));
    } catch {
      showToast(text.slice(0, 60));
    }
  }

  /** Two-finger tap on the feed: the verse on screen goes to WhatsApp (app or web). */
  function whatsapp() {
    const ch = book?.chapters.find((c) => c.n === current.ch);
    const v = ch?.verses.find((x) => x.n === current.v) ?? ch?.verses.find((x) => x.n <= current.v && (x.end ?? x.n) >= current.v);
    if (!v) return;
    const text = shareText({ book: current.book, ch: current.ch, v: v.n }, v);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    showToast(t(lang, 'whatsapp'));
  }

  function retry() {
    start();
  }
</script>

<div class="shell">
  {#if loadError}
    <div class="center">
      <p>{t(lang, 'loadFailed')}</p>
      <button class="btn primary" onclick={retry}>{t(lang, 'retry')}</button>
    </div>
  {:else if !manifest || !book || !meta}
    <div class="center muted">{t(lang, 'loading')}</div>
  {:else}
    {#if view === 'read'}
      <Feed
        {book}
        {meta}
        {books}
        {target}
        {lang}
        redLetters={app.settings.redLetters}
        showNumbers={app.settings.showNumbers}
        showRef={app.settings.showRef}
        showHeadings={app.settings.showHeadings}
        isBookmarked={(r) => app.isBookmarked(r)}
        isLiked={(r) => app.isLiked(r)}
        hasNote={(r) => !!app.notes[`${r.book}.${r.ch}.${r.v}`]}
        {onCurrent}
        onNavigate={navigate}
        onStep={step}
        onWhatsApp={whatsapp}
        onStudy={(r, v, section) => (study = { r, v, section })}
        onBookmark={(r) => app.toggleBookmark(r)}
        onLike={(r) => app.toggleLike(r)}
        onNote={(r) => (noteFor = r)}
        onShare={share}
      />
      <header class="top">
        <button class="nav" onclick={() => step(-1)} aria-label="previous chapter">‹</button>
        <button class="title" onclick={() => (picker = true)}>{currentLabel} ▾</button>
        <button class="nav" onclick={() => step(1)} aria-label="next chapter">›</button>
      </header>
    {:else if view === 'plan'}
      <PlanView {books} {lang} onNavigate={navigate} />
    {:else if view === 'saved'}
      <SavedView {books} {lang} {translation} onNavigate={navigate} onEditNote={(r) => (noteFor = r)} />
    {:else if view === 'search'}
      <SearchView {books} {lang} {translation} onNavigate={navigate} />
    {:else}
      <SettingsView {lang} {offlineReady} {translations} {manifest} />
    {/if}

    <nav class="bottom" aria-label="main">
      <button class:on={view === 'read'} onclick={() => (view = 'read')}><span class="ic">📖</span>{t(lang, 'navRead')}</button>
      <button class:on={view === 'plan'} onclick={() => (view = 'plan')}><span class="ic">▦</span>{t(lang, 'navPlan')}</button>
      <button class:on={view === 'saved'} onclick={() => (view = 'saved')}><span class="ic">★</span>{t(lang, 'navSaved')}</button>
      <button class:on={view === 'search'} onclick={() => (view = 'search')}><span class="ic">⌕</span>{t(lang, 'navSearch')}</button>
      <button class:on={view === 'settings'} onclick={() => (view = 'settings')}><span class="ic">⚙</span>{t(lang, 'navSettings')}</button>
    </nav>

    {#if picker}
      <Picker {books} {current} {lang} onPick={(r) => { picker = false; navigate(r); }} onClose={() => (picker = false)} />
    {/if}
    {#if study}
      <StudySheet
        r={study.r}
        verse={study.v}
        {books}
        {lang}
        {translation}
        study={manifest.study}
        section={study.section}
        onNavigate={(r) => { study = null; navigate(r); }}
        onClose={() => (study = null)}
      />
    {/if}
    {#if noteFor}
      <NoteSheet
        r={noteFor}
        {books}
        {lang}
        initial={app.notes[`${noteFor.book}.${noteFor.ch}.${noteFor.v}`]?.text ?? ''}
        onSave={(text) => { app.setNote(noteFor!, text); noteFor = null; }}
        onClose={() => (noteFor = null)}
      />
    {/if}
  {/if}

  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}
</div>

<style>
  .shell { position: relative; height: 100%; overflow: hidden; }
  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; }
  .top {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: calc(var(--top-h) + var(--safe-top));
    padding-top: var(--safe-top);
    display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(var(--bg) 70%, transparent);
    z-index: 5;
  }
  .top .title { flex: 1; font-weight: 700; color: var(--accent); font-size: 16px; padding: 10px; }
  .top .nav { font-size: 28px; padding: 0 18px; color: var(--fg-muted); line-height: 1; }
  .bottom {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: calc(var(--nav-h) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
    background: var(--bg-elev);
    border-top: 1px solid var(--line);
    z-index: 5;
  }
  .bottom button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; font-size: 11px; color: var(--fg-muted); }
  .bottom button.on { color: var(--accent); font-weight: 700; }
  .bottom .ic { font-size: 18px; line-height: 1.2; }
  .toast {
    position: absolute; left: 50%; bottom: calc(var(--nav-h) + var(--safe-bottom) + 16px);
    transform: translateX(-50%);
    background: var(--fg); color: var(--bg);
    padding: 10px 16px; border-radius: 999px; font-size: 14px;
    max-width: 90vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    z-index: 50;
  }
</style>
