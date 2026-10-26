<script lang="ts">
  import { onMount } from 'svelte';
  import type { Book, Manifest, Ref, Selection, StudySection, TranslationInfo, Verse } from './lib/types';
  import { DEFAULT_TRANSLATION, getVerse, loadBook, loadBookIndex, loadManifest, loadNotes, loadTranslations, loadWords } from './lib/data';
  import { versesOf } from './lib/study';
  import type { BookIndex } from './lib/booknames';
  import { formatRef, nextChapter, prevChapter, refKey } from './lib/refs';
  import { ask, AiError } from './lib/ai';
  import { t } from './lib/i18n';
  import { ESV_ID, EsvError, esvKey, setEsvKey } from './lib/esv';
  import Icon from './lib/components/Icon.svelte';
  import { app } from './lib/state.svelte';
  import Feed from './lib/components/Feed.svelte';
  import Picker from './lib/components/Picker.svelte';
  import StudyPage from './lib/components/StudyPage.svelte';
  import TvMode from './lib/components/TvMode.svelte';
  import TvSheet from './lib/components/TvSheet.svelte';
  import TranslationSheet from './lib/components/TranslationSheet.svelte';
  import { appBase, parseAppUrl, receiverUrl, tvUrl } from './lib/url';
  import { isReceiver, presentAvailable, presentSupported, sendRef, startPresenting, stopPresenting, type PresentConn, type TvMessage } from './lib/present';
  import { copyText } from './lib/clipboard';
  import PlanView from './lib/components/PlanView.svelte';
  import SavedView from './lib/components/SavedView.svelte';
  import SearchView from './lib/components/SearchView.svelte';
  import SettingsView from './lib/components/SettingsView.svelte';

  type View = 'read' | 'plan' | 'saved' | 'search' | 'settings' | 'tv';
  // The bottom bar is icons only; the names are the accessible labels and tooltips.
  const NAV = [
    { view: 'read', icon: 'book', label: 'navRead' },
    { view: 'plan', icon: 'calendar', label: 'navPlan' },
    { view: 'saved', icon: 'bookmark', label: 'navSaved' },
    { view: 'search', icon: 'search', label: 'navSearch' },
    { view: 'settings', icon: 'settings', label: 'navSettings' },
  ] as const;

  let translations = $state<TranslationInfo[]>([]);
  let manifest = $state<Manifest | null>(null);
  let loadError = $state(false);
  let view = $state<View>('read');
  let book = $state<Book | null>(null);
  let target = $state<Ref | null>(null);
  let current = $state<Ref>(app.place);
  let picker = $state(false);
  let study = $state<{ r: Ref; v: Verse; section?: StudySection; focus?: Selection | null } | null>(null);
  let toast = $state('');
  let bookIndex = $state<BookIndex | null>(null);
  // TV
  let tvSheet = $state(false);
  let trSheet = $state(false);
  let canPresent = $state(false);
  let presentConn = $state<PresentConn | null>(null);
  let tvReceiver = $state(false);
  let tvFromTap = $state(false);
  let lastView: View = 'read';
  let pushedTv = false; // the app added the #tv history entry (so Back can remove it)
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
    document.documentElement.style.setProperty('--line-height', String(app.settings.lineHeight));
    document.documentElement.dataset.font = app.settings.font;
    document.documentElement.lang = lang;
  });

  $effect(() => setEsvKey(app.settings.esvKey));

  /** The message for a failed load: the ESV has its own reasons (key, rate limit). */
  function failMessage(e: unknown): string {
    if (e instanceof EsvError) {
      if (e.kind === 'nokey') return t(lang, 'esvNeedsKey');
      if (e.kind === 'auth') return t(lang, 'esvBadKey');
      if (e.kind === 'limit') return t(lang, 'esvLimit');
    }
    return t(lang, 'loadFailed');
  }

  async function start() {
    loadError = false;
    // ?ref=JHN.3.16&t=ta-irv (deep link), ?tv=1 (TV mode), ?tv=1&receiver=1 (presented page)
    const u = parseAppUrl(location.search, location.hash);
    try {
      translations = await loadTranslations();
      if (u.translation && translations.some((x) => x.id === u.translation)) app.update('translation', u.translation);
      // A translation that was removed from the build falls back to the default.
      if (!translations.some((x) => x.id === translation) && translations.length) {
        app.update('translation', translations.some((x) => x.id === DEFAULT_TRANSLATION) ? DEFAULT_TRANSLATION : translations[0].id);
      }
      // The ESV needs an API key; without one, open the bundled text instead.
      setEsvKey(app.settings.esvKey);
      if (app.settings.translation === ESV_ID && !esvKey()) app.update('translation', DEFAULT_TRANSLATION);
      loadedFor = app.settings.translation;
      manifest = await loadManifest(loadedFor);
      loadBookIndex(manifest).then((i) => (bookIndex = i)).catch(() => {});
      await navigate(u.ref ?? app.place, !!u.ref);
      if (u.tv) {
        tvReceiver = u.receiver || isReceiver();
        tvFromTap = false;
        lastView = 'read';
        view = 'tv';
      }
      // a refresh should reopen the reader, not replay the link
      if (location.search) history.replaceState(null, '', location.pathname + (view === 'tv' ? '#tv' : ''));
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
    const previous = loadedFor;
    loadedFor = id;
    const place = current;
    loadManifest(id)
      .then(async (m) => {
        const oldManifest = manifest;
        const oldBook = book;
        manifest = m;
        book = null;
        // Reopen the same verse in the new translation without leaving the
        // current tab (the reader is on Settings when this happens). If the
        // text cannot be loaded (an ESV key problem), go back to the previous one.
        if (!(await open(place))) {
          manifest = oldManifest;
          book = oldBook;
          loadedFor = previous;
          app.update('translation', previous);
        }
      })
      .catch(() => showToast(t(lang, 'loadFailed')));
  });

  /** Load the book for `ref` (in the chosen translation) and point the feed at it. */
  async function open(ref: Ref): Promise<boolean> {
    const have = book && book.code === ref.book && (!book.partial || book.chapters.some((c) => c.n === ref.ch));
    if (!have) {
      try {
        book = await loadBook(app.settings.translation, ref.book, ref.ch);
      } catch (e) {
        showToast(failMessage(e));
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

  // Desktop: the arrow keys change chapter like a swipe.
  function onKey(e: KeyboardEvent) {
    if (view !== 'read' || picker || study || tvSheet || trSheet) return;
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  }

  /** The Bible menu (top-left pill). */
  function pickTranslation(id: string) {
    trSheet = false;
    if (id !== translation) app.update('translation', id);
  }
  /** The pill's label: the abbreviation, or the full name when several share it (four "IRV"s). */
  /**
   * The Bible pill shows only the language ("தமிழ்", "हिन्दी"); when two
   * translations share a language (ULT and ESV are both English) it shows the
   * abbreviation instead.
   */
  const pillLabel = $derived.by(() => {
    if (!manifest) return '';
    const sameLang = translations.filter((x) => x.lang === manifest!.lang).length > 1;
    const langName = manifest.name.replace(manifest.abbr, '').trim();
    return sameLang || !langName ? manifest.abbr : langName;
  });

  /** The book pill shows the book's abbreviation (\toc3) to save space; the full name is its label. */
  const chapterLabel = $derived.by(() => {
    const b = books.find((x) => x.code === current.book);
    return b ? b.abbr || b.name : '';
  });

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 2600);
  }

  /** The verse, its reference and, when given, the reader's own note under it. */
  function shareText(r: Ref, v: Verse, note = ''): string {
    const label = formatRef(books, { book: r.book, ch: r.ch, v: v.n }, v.end);
    const base = `${v.text}\n— ${label} (${manifest?.abbr ?? ''})`.replace(' ()', '');
    return note.trim() ? `${base}\n\n${note.trim()}` : base;
  }

  async function share(r: Ref, v: Verse, note = '') {
    const text = shareText(r, v, note);
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
    whatsappText(shareText({ book: current.book, ch: current.ch, v: v.n }, v));
  }

  function whatsappText(text: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    showToast(t(lang, 'whatsapp'));
  }

  // ---- TV ---------------------------------------------------------------
  /** TV mode moves through verses without leaving the view (navigate() would). */
  async function tvGo(r: Ref) {
    if (await open(r)) onCurrent(r);
  }
  function enterTv(fromTap: boolean) {
    tvSheet = false;
    if (view !== 'tv') lastView = view;
    tvFromTap = fromTap;
    tvReceiver = false;
    view = 'tv';
    if (location.hash !== '#tv') {
      history.pushState({ tv: 1 }, '', '#tv');
      pushedTv = true;
    }
  }
  function exitTv() {
    if (view !== 'tv') return;
    view = lastView === 'tv' ? 'read' : lastView;
    if (location.hash === '#tv') {
      // opened from a link, there is no app entry to go back to: just drop the hash
      if (pushedTv) history.back();
      else history.replaceState(null, '', location.pathname);
    }
    pushedTv = false;
    if (view === 'read') target = { ...current };
  }
  function onPop() {
    // the phone's or TV remote's Back button leaves TV mode
    if (view === 'tv' && location.hash !== '#tv' && !tvReceiver) {
      pushedTv = false;
      view = lastView === 'tv' ? 'read' : lastView;
      if (view === 'read') target = { ...current };
    }
  }
  /** On the TV: the presenting browser moved to another verse or translation. */
  function onRemote(m: TvMessage) {
    if (m.translation !== translation && translations.some((x) => x.id === m.translation)) {
      current = m.ref;
      app.update('translation', m.translation);
    } else tvGo(m.ref);
  }
  async function openTvSheet() {
    tvSheet = true;
    canPresent = presentSupported() && (await presentAvailable(receiverUrl(appBase())));
  }
  function present() {
    // must stay the direct result of the click: the browser shows its display picker
    startPresenting(receiverUrl(appBase()))
      .then((c) => {
        presentConn = c;
        c.onconnect = () => sendRef(c, current, translation);
        c.onclose = () => (presentConn = null);
        c.onterminate = () => (presentConn = null);
        sendRef(c, current, translation);
        tvSheet = false;
      })
      .catch(() => showToast(t(lang, 'tvPresentFailed')));
  }
  function stopPresent() {
    stopPresenting(presentConn);
    presentConn = null;
  }
  // the TV follows the reader: every verse or translation change is sent
  $effect(() => {
    const c = presentConn;
    const r = current;
    const tr = translation;
    if (c) sendRef(c, r, tr);
  });
  async function copyTvLink(url: string) {
    showToast(t(lang, (await copyText(url)) ? 'copied' : 'copyFailed'));
  }

  /** Saved > note: open the study sheet on the Notes tab for that verse. */
  function editNote(r: Ref) {
    const stub: Verse = { n: r.v, id: String(r.v), text: '' };
    getVerse(translation, r)
      .then((v) => (study = { r, v: v ?? stub, section: 'notes' }))
      .catch(() => (study = { r, v: stub, section: 'notes' }));
  }

  /** Explain: send the question and what the sheet knows to the reader's AI service. */
  /** The verse's Translation Notes and original words, as plain text for the AI service. */
  async function aiContext(r: Ref, v: Verse): Promise<{ notes: string[]; words: string[] }> {
    const keys = versesOf(v).map(String);
    const [n, w] = await Promise.all([
      loadNotes(r.book, r.ch).catch(() => ({}) as Awaited<ReturnType<typeof loadNotes>>),
      loadWords(r.book, r.ch).catch(() => ({}) as Awaited<ReturnType<typeof loadWords>>),
    ]);
    const plain = (md: string) => md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_#]/g, '').trim();
    return {
      notes: keys.flatMap((k) => n[k] ?? []).slice(0, 12).map((x) => plain(x.note)),
      words: keys.flatMap((k) => w[k] ?? []).map(([surface, , gloss, strong]) => `${surface} (${strong}): ${gloss}`),
    };
  }

  async function askAi(message: string, r: Ref, v: Verse, sel: Selection | null): Promise<string> {
    try {
      const ctx = await aiContext(r, v);
      return await ask(app.settings.aiEndpoint, app.settings.aiKey, {
        message,
        verse: { ref: formatRef(books, { book: r.book, ch: r.ch, v: v.n }, v.end), text: v.text, translation: manifest?.abbr ?? '' },
        context: { selection: sel?.text, ...ctx },
      });
    } catch (e) {
      const kind = e instanceof AiError ? e.kind : 'network';
      throw new Error(t(lang, kind === 'noendpoint' ? 'aiNotSet' : kind === 'bad' ? 'aiBadReply' : 'aiFailed'));
    }
  }

  function retry() {
    start();
  }
</script>

<svelte:window onkeydown={onKey} onpopstate={onPop} />

<div class="shell">
  {#if loadError}
    <div class="center">
      <p>{t(lang, 'loadFailed')}</p>
      <button class="btn primary" onclick={retry}>{t(lang, 'retry')}</button>
    </div>
  {:else if !manifest || !book || !meta}
    <div class="center muted">{t(lang, 'loading')}</div>
  {:else}
    <!-- The reader stays mounted behind the other tabs, so the Read tab comes back instantly at the same verse. -->
    <div class="reader" class:off={view !== 'read'} inert={view !== 'read'}>
        <Feed
          {book}
          {meta}
          {books}
          {target}
          {lang}
          textLang={manifest.lang}
          redLetters={app.settings.redLetters}
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
          onNote={(r, v) => (study = { r, v, section: 'notes' })}
          onShare={(r, v) => share(r, v)}
          onExplain={(r, v, focus) => (study = { r, v, section: 'explain', focus })}
          onTv={openTvSheet}
        />
        <header class="top">
          <div class="pills">
            <button class="pill nav" onclick={() => step(-1)} aria-label={t(lang, 'prevChapter')} title={t(lang, 'prevChapter')}><Icon name="chevron-left" size={18} /></button>
            <button class="pill tr" onclick={() => (trSheet = true)} aria-haspopup="dialog" aria-label={t(lang, 'translation')} title={t(lang, 'translation')} lang={manifest.lang}>{pillLabel}<Icon name="chevron-down" size={14} /></button>
          </div>
          <div class="pills">
            <button class="pill title" onclick={() => (picker = true)} aria-label={currentLabel}>
              <span>{chapterLabel} <span class="ch">{current.ch}</span></span>
              <Icon name="chevron-down" size={16} />
            </button>
            <button class="pill nav" onclick={() => step(1)} aria-label={t(lang, 'nextChapter')} title={t(lang, 'nextChapter')}><Icon name="chevron-right" size={18} /></button>
          </div>
        </header>
    </div>

    {#if view === 'tv'}
      <TvMode
        {book}
        {meta}
        {books}
        {current}
        {lang}
        textLang={manifest.lang}
        abbr={manifest.abbr}
        redLetters={app.settings.redLetters}
        theme={app.settings.tvTheme}
        autoAdvance={app.settings.tvAutoAdvance}
        receiver={tvReceiver}
        fromTap={tvFromTap}
        onGo={tvGo}
        {onRemote}
        onExit={exitTv}
      />
    {:else if view === 'plan'}
      <PlanView {books} {lang} onNavigate={navigate} />
    {:else if view === 'saved'}
      <SavedView {books} {lang} {translation} onNavigate={navigate} onEditNote={editNote} />
    {:else if view === 'search'}
      <SearchView {books} {lang} {translation} index={bookIndex} onNavigate={navigate} />
    {:else if view === 'settings'}
      <SettingsView {lang} {offlineReady} {translations} {manifest} onTvSheet={openTvSheet} />
    {/if}

    {#if !study && view !== 'tv'}
      <nav class="bottom" aria-label="main">
        {#each NAV as n (n.view)}
          <button class:on={view === n.view} onclick={() => (view = n.view)} aria-label={t(lang, n.label)} title={t(lang, n.label)} aria-current={view === n.view ? 'page' : undefined}>
            <Icon name={n.icon} size={24} stroke={view === n.view ? 2 : 1.6} />
          </button>
        {/each}
      </nav>
    {/if}

    {#if trSheet}
      <TranslationSheet
        {lang}
        {translations}
        value={translation}
        usable={(id) => id !== ESV_ID || !!esvKey()}
        onPick={pickTranslation}
        onSettings={() => { trSheet = false; view = 'settings'; }}
        onClose={() => (trSheet = false)}
      />
    {/if}
    {#if tvSheet}
      <TvSheet
        {lang}
        url={tvUrl(appBase(), current, translation)}
        {canPresent}
        presenting={!!presentConn}
        onTvHere={() => enterTv(true)}
        onPresent={present}
        onStopPresent={stopPresent}
        onCopy={copyTvLink}
        onClose={() => (tvSheet = false)}
      />
    {/if}
    {#if picker}
      <Picker {books} {current} {lang} index={bookIndex} onPick={(r) => { picker = false; navigate(r); }} onClose={() => (picker = false)} />
    {/if}
    {#if study}
      <StudyPage
        r={study.r}
        verse={study.v}
        {books}
        {lang}
        {translation}
        {manifest}
        section={study.section}
        focus={study.focus ?? null}
        note={app.notes[refKey(study.r)]?.text ?? ''}
        aiEnabled={!!app.settings.aiEndpoint.trim()}
        onSaveNote={(text) => study && app.setNote(study.r, text)}
        onShare={(n) => study && share(study.r, study.v, n)}
        onWhatsApp={(n) => study && whatsappText(shareText(study.r, study.v, n))}
        onAsk={(m, sel) => (study ? askAi(m, study.r, study.v, sel) : Promise.reject(new Error('')))}
        onNavigate={(r) => { study = null; navigate(r); }}
        onClose={() => (study = null)}
        onToast={showToast}
      />
    {/if}
  {/if}

  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}
</div>

<style>
  .shell { position: relative; height: 100%; overflow: hidden; }
  .reader { position: absolute; inset: 0; }
  .reader.off { visibility: hidden; pointer-events: none; }
  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; }
  .top {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: calc(var(--top-h) + var(--safe-top));
    padding: var(--safe-top) 14px 0;
    display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(var(--bg) 65%, transparent);
    z-index: 5;
    pointer-events: none;
  }
  .pills { display: flex; gap: 8px; pointer-events: auto; }
  .pill.tr { font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; gap: 4px; padding: 0 12px; }
  .pill.title { max-width: 46vw; white-space: nowrap; }
  .pill.title > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pill.title .ch { color: var(--fg-muted); }
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
  .bottom button { display: flex; align-items: center; justify-content: center; color: var(--fg-muted); }
  .bottom button.on { color: var(--fg); }
  .toast {
    position: absolute; left: 50%; bottom: calc(var(--nav-h) + var(--safe-bottom) + 16px);
    transform: translateX(-50%);
    background: var(--fg); color: var(--bg);
    padding: 10px 16px; border-radius: 999px; font-size: 14px;
    max-width: 90vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    z-index: 50;
  }
</style>
