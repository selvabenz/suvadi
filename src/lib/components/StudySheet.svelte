<script module lang="ts">
  import type { StudySection } from '../types';
  // The tab the reader last used, remembered for the session.
  let lastTab: StudySection = 'footnotes';
</script>

<script lang="ts">
  import type { BookMeta, Lang, Manifest, Ref, Selection, StepWord, Verse } from '../types';
  import { loadWords } from '../data';
  import { formatRef } from '../refs';
  import { versesOf } from '../study';
  import { t } from '../i18n';
  import Sheet from './Sheet.svelte';
  import Tabs, { type Tab } from './Tabs.svelte';
  import NotesTab from './NotesTab.svelte';
  import FootnotesTab from './FootnotesTab.svelte';
  import XrefsTab from './XrefsTab.svelte';
  import WordsTab from './WordsTab.svelte';
  import ExplainPanel from './ExplainPanel.svelte';

  let {
    r,
    verse,
    books,
    lang,
    translation,
    manifest,
    section,
    focus = null,
    note,
    aiEnabled,
    onSaveNote,
    onShare,
    onWhatsApp,
    onAsk,
    onNavigate,
    onClose,
  }: {
    r: Ref;
    verse: Verse;
    books: BookMeta[];
    lang: Lang;
    translation: string;
    manifest: Manifest;
    section?: StudySection;
    /** The circled words when opened from explain mode. */
    focus?: Selection | null;
    note: string;
    aiEnabled: boolean;
    onSaveNote: (text: string) => void;
    onShare: (note: string) => void;
    onWhatsApp: (note: string) => void;
    onAsk: (message: string, sel: Selection | null) => Promise<string>;
    onNavigate: (r: Ref) => void;
    onClose: () => void;
  } = $props();

  type TabId = Exclude<StudySection, 'explain'>;

  const study = $derived(manifest.study);
  const explaining = $derived(section === 'explain');
  const meta = $derived(books.find((b) => b.code === r.book));
  const isOT = $derived(meta?.testament === 'ot');
  const title = $derived(formatRef(books, { book: r.book, ch: r.ch, v: verse.n }, verse.end));
  const hasFootnotes = $derived(!!(verse.heading || verse.parallel || verse.superscription || verse.footnotes?.length));
  const xrefsOn = $derived(study?.xrefs !== false);
  const wordsOn = $derived(study?.words !== false);
  const hasAlignment = $derived((manifest.source as { text?: { aligned?: boolean } })?.text?.aligned === true);

  const tabs = $derived.by<Tab[]>(() => {
    const out: Tab[] = [{ id: 'notes', icon: 'note', label: t(lang, 'tabNotes') }];
    if (hasFootnotes) out.push({ id: 'footnotes', icon: 'footnote', label: t(lang, 'footnotes'), count: verse.footnotes?.length });
    if (xrefsOn || verse.xrefs?.length) out.push({ id: 'xrefs', icon: 'link', label: t(lang, 'tabXrefs') });
    if (wordsOn) out.push({ id: 'words', icon: 'words', label: t(lang, 'tabWords') });
    return out;
  });

  // svelte-ignore state_referenced_locally
  let active = $state<TabId>(section === 'explain' ? 'words' : (section ?? (lastTab === 'explain' ? 'footnotes' : lastTab)) as TabId);
  $effect(() => {
    if (!tabs.some((x) => x.id === active)) active = (tabs.find((x) => x.id === 'words') ?? tabs[tabs.length > 1 ? 1 : 0]).id as TabId;
  });
  $effect(() => {
    lastTab = active;
  });

  // STEP words are shared by the Words tab and the explain panel.
  let words = $state<StepWord[] | null>(null);
  let wordsFailed = $state(false);
  $effect(() => {
    const ref = r;
    const vs = verse;
    words = null;
    wordsFailed = false;
    if (!wordsOn) {
      words = [];
      return;
    }
    if (active !== 'words' && !explaining) return; // load when first needed
    loadWords(ref.book, ref.ch)
      .then((m) => (words = versesOf(vs).flatMap((v) => m[String(v)] ?? [])))
      .catch(() => (wordsFailed = true));
  });

  // Set only once the Notes tab has been shown, so closing from another tab never touches the note.
  let draft = $state<string | undefined>(undefined);
  function close() {
    // Escape and the backdrop close the sheet: keep what was typed.
    if (draft !== undefined && draft.trim() !== note.trim()) onSaveNote(draft);
    onClose();
  }
</script>

<Sheet title={explaining ? `${t(lang, 'explain')} · ${title}` : title} onClose={close} tall>
  {#if explaining}
    <ExplainPanel sel={focus} {lang} textLang={manifest.lang} {hasAlignment} {aiEnabled} onAsk={(m) => onAsk(m, focus)} />
  {/if}

  <Tabs {tabs} {active} onChange={(id) => (active = id as TabId)} />

  <div role="tabpanel">
    {#if active === 'notes'}
      <NotesTab initial={note} {lang} autofocus={section === 'notes'} onSave={onSaveNote} {onShare} {onWhatsApp} bind:draft />
    {:else if active === 'footnotes'}
      <FootnotesTab {verse} {lang} textLang={manifest.lang} />
    {:else if active === 'xrefs'}
      <XrefsTab {r} {verse} {books} {lang} {translation} enabled={xrefsOn} {onNavigate} />
    {:else if active === 'words'}
      <WordsTab {words} failed={wordsFailed} {isOT} {lang} />
    {/if}
  </div>
</Sheet>
