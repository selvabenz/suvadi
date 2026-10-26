<script lang="ts">
  import { onMount } from 'svelte';
  import type { Book, Manifest, Ref, Verse } from './lib/types';
  import { loadBook, loadManifest } from './lib/data';
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

  const lang = $derived(app.settings.lang);
  const books = $derived(manifest?.books ?? []);
  const meta = $derived(book ? books.find((b) => b.code === book!.code) ?? null : null);
  const currentLabel = $derived(books.length ? formatRef(books, current) : '');

  $effect(() => {
    document.documentElement.dataset.theme = app.settings.theme;
    document.documentElement.style.setProperty('--font-scale', String(app.settings.fontScale));
    document.documentElement.lang = lang;
  });

  onMount(async () => {
    try {
      manifest = await loadManifest();
      await navigate(app.place, false);
    } catch {
      loadError = true;
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => (offlineReady = true)).catch(() => {});
    }
  });

  async function navigate(ref: Ref, record = true) {
    view = 'read';
    if (!book || book.code !== ref.book) {
      try {
        book = await loadBook(ref.book);
      } catch {
        showToast(t(lang, 'loadFailed'));
        return;
      }
    }
    target = { ...ref };
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

  async function share(r: Ref, v: Verse) {
    const label = formatRef(books, { book: r.book, ch: r.ch, v: v.n }, v.end);
    const text = `${v.text}\n— ${label} (IRV)`;
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

  function retry() {
    loadError = false;
    loadManifest()
      .then(async (m) => {
        manifest = m;
        await navigate(app.place, false);
      })
      .catch(() => (loadError = true));
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
        isBookmarked={(r) => app.isBookmarked(r)}
        hasNote={(r) => !!app.notes[`${r.book}.${r.ch}.${r.v}`]}
        {onCurrent}
        onNavigate={navigate}
        onStudy={(r, v, section) => (study = { r, v, section })}
        onBookmark={(r) => app.toggleBookmark(r)}
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
      <SavedView {books} {lang} onNavigate={navigate} onEditNote={(r) => (noteFor = r)} />
    {:else if view === 'search'}
      <SearchView {books} {lang} onNavigate={navigate} />
    {:else}
      <SettingsView {lang} {offlineReady} />
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
