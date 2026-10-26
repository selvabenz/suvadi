<script module lang="ts">
  import type { StudySection } from '../types';
  // The tab the reader last used, remembered for the session.
  let lastTab: StudySection = 'footnotes';
</script>

<script lang="ts">
  import type { AlignChapter, AlignVerse, BookMeta, Lang, Manifest, Ref, Selection, StepWord, TaIndex, TwIndex, Verse } from '../types';
  import { hasAlignment as aligned, loadAlign, loadStrongToTw, loadTaIndex, loadTwIndex, loadWords } from '../data';
  import { formatRef } from '../refs';
  import { overlaps, strongBase, versesOf } from '../study';
  import { t } from '../i18n';
  import Sheet from './Sheet.svelte';
  import Tabs, { type Tab } from './Tabs.svelte';
  import NotesTab from './NotesTab.svelte';
  import FootnotesTab from './FootnotesTab.svelte';
  import XrefsTab from './XrefsTab.svelte';
  import WordsTab from './WordsTab.svelte';
  import ExplainPanel from './ExplainPanel.svelte';
  import HelpsTab from './HelpsTab.svelte';
  import HelpArticle from './HelpArticle.svelte';
  import Icon from './Icon.svelte';

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
  const notesOn = $derived(study?.notes === true);
  const hasAlignment = $derived(aligned(manifest));

  const tabs = $derived.by<Tab[]>(() => {
    const out: Tab[] = [{ id: 'notes', icon: 'note', label: t(lang, 'tabNotes') }];
    if (hasFootnotes) out.push({ id: 'footnotes', icon: 'footnote', label: t(lang, 'footnotes'), count: verse.footnotes?.length });
    if (xrefsOn || verse.xrefs?.length) out.push({ id: 'xrefs', icon: 'link', label: t(lang, 'tabXrefs') });
    if (wordsOn) out.push({ id: 'words', icon: 'words', label: t(lang, 'tabWords') });
    if (notesOn) out.push({ id: 'helps', icon: 'bulb', label: t(lang, 'tabHelps') });
    return out;
  });

  // svelte-ignore state_referenced_locally
  let active = $state<TabId>(section === 'explain' ? 'helps' : (section ?? (lastTab === 'explain' ? 'footnotes' : lastTab)) as TabId);
  $effect(() => {
    if (!tabs.some((x) => x.id === active)) {
      const fallback = tabs.find((x) => x.id === (explaining ? 'words' : 'footnotes')) ?? tabs.find((x) => x.id === 'helps') ?? tabs[tabs.length > 1 ? 1 : 0];
      active = fallback.id as TabId;
    }
  });

  // A Translation Words / Academy article opened from any tab replaces the tab body.
  let article = $state<{ kind: 'tw' | 'ta'; id: string } | null>(null);
  const openArticle = (kind: 'tw' | 'ta', id: string) => (article = { kind, id });

  // Indexes for article titles and Strong's -> Translation Words, loaded once when needed.
  let twIndex = $state<TwIndex | null>(null);
  let taIndex = $state<TaIndex | null>(null);
  let strongToTw = $state<Map<string, string[]> | null>(null);
  $effect(() => {
    if (!notesOn || (active !== 'helps' && active !== 'words' && !explaining && !article)) return;
    if (!twIndex) loadTwIndex().then((x) => (twIndex = x)).catch(() => {});
    if (!taIndex) loadTaIndex().then((x) => (taIndex = x)).catch(() => {});
    if (!strongToTw) loadStrongToTw().then((x) => (strongToTw = x)).catch(() => {});
  });
  const twTitle = (slug: string) => twIndex?.[slug]?.[0] ?? slug;

  // ULT only: the original-language words under the circled English words.
  let align = $state<AlignChapter | null>(null);
  $effect(() => {
    const ref = r;
    align = null;
    if (!explaining || !hasAlignment) return;
    loadAlign(translation, ref.book, ref.ch).then((a) => (align = a)).catch(() => {});
  });
  const alignedTokens = $derived.by(() => {
    if (!align) return null;
    const entry = align[String(verse.n)] as AlignVerse | undefined;
    if (!entry) return [];
    const lex = align.lex as Record<string, string>;
    const pick = new Set<number>();
    for (const [s, e, idxs] of entry.a) if (!focus || overlaps([s, e], focus)) idxs.forEach((i) => pick.add(i));
    return [...pick].sort((a, b) => a - b).map((i) => {
      const [content, strong, morph] = entry.o[i];
      const base = strongBase(strong);
      const gloss = words?.find((w) => strongBase(w[3]) === base)?.[2] ?? '';
      return { content, strong: base, morph, lemma: base ? lex[base] ?? '' : '', gloss, tw: strongToTw?.get(base) ?? [] };
    });
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
    if (active !== 'words' && !explaining) return; // load when first needed (the explain panel uses glosses)
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

{#snippet origWords()}
  {#if alignedTokens && alignedTokens.length}
    <ul class="orig">
      {#each alignedTokens as tok}
        <li>
          <span class="o" lang={isOT ? 'he' : 'el'} dir={isOT ? 'rtl' : 'ltr'}>{tok.content}</span>
          {#if tok.lemma && tok.lemma !== tok.content}<span class="lem" lang={isOT ? 'he' : 'el'} dir={isOT ? 'rtl' : 'ltr'}>{tok.lemma}</span>{/if}
          {#if tok.gloss}<span class="gl">{tok.gloss}</span>{/if}
          <span class="meta">{tok.strong}{tok.morph ? ` · ${tok.morph}` : ''}</span>
          {#each tok.tw as slug}
            <button class="twc" onclick={() => openArticle('tw', slug)}>{twTitle(slug)}</button>
          {/each}
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<Sheet title={explaining ? `${t(lang, 'explain')} · ${title}` : title} onClose={close} tall>

  {#if explaining && !article}
    <ExplainPanel
      sel={focus}
      {lang}
      textLang={manifest.lang}
      {hasAlignment}
      {aiEnabled}
      onAsk={(m) => onAsk(m, focus)}
      aligned={hasAlignment && alignedTokens?.length ? origWords : undefined}
    />
  {/if}

  <Tabs {tabs} {active} onChange={(id) => { active = id as TabId; article = null; }} />

  <div role="tabpanel">
    {#if article}
      <button class="back" onclick={() => (article = null)}><Icon name="chevron-left" size={16} /> {t(lang, 'back')}</button>
      <HelpArticle kind={article.kind} id={article.id} {lang} {twTitle} onOpen={openArticle} />
    {:else if active === 'notes'}
      <NotesTab initial={note} {lang} autofocus={section === 'notes'} onSave={onSaveNote} {onShare} {onWhatsApp} bind:draft />
    {:else if active === 'footnotes'}
      <FootnotesTab {verse} {lang} textLang={manifest.lang} />
    {:else if active === 'xrefs'}
      <XrefsTab {r} {verse} {books} {lang} {translation} enabled={xrefsOn} {onNavigate} />
    {:else if active === 'words'}
      <WordsTab {words} failed={wordsFailed} {isOT} {lang} twByStrong={notesOn ? strongToTw : null} {twTitle} onOpenTw={(slug) => openArticle('tw', slug)} />
    {:else if active === 'helps'}
      <HelpsTab {r} {verse} {lang} {isOT} aligned={hasAlignment} focus={explaining ? focus : null} {twIndex} {taIndex} onOpen={openArticle} />
    {/if}
  </div>
</Sheet>

<style>
  .back { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-weight: 600; padding: 4px 0 10px; }
  .orig { list-style: none; margin: 0 0 10px; padding: 0; }
  .orig li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 6px 0; border-bottom: 1px solid var(--line); }
  .o { font-size: 20px; unicode-bidi: isolate; }
  .lem { color: var(--fg-muted); unicode-bidi: isolate; }
  .gl { font-weight: 600; }
  .meta { font-size: 12px; color: var(--fg-muted); }
  .twc { padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 600; }
</style>
