<script module lang="ts">
  import type { StudySection } from '../types';
  // The tab the reader last used, remembered for the session.
  let lastTab: StudySection = 'footnotes';
</script>

<script lang="ts">
  import type { AlignChapter, AlignVerse, BookMeta, Lang, Manifest, Ref, Selection, StepWord, TaIndex, TwIndex, Verse } from '../types';
  import { hasAlignment as aligned, loadAlign, loadTaIndex, loadTwIndex, loadTwl, loadWords } from '../data';
  import { formatRef } from '../refs';
  import { overlaps, strongBase, versesOf } from '../study';
  import { t } from '../i18n';
  import { fitWords } from '../fit';
  import { copyText } from '../clipboard';
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
    onToast,
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
    onToast?: (msg: string) => void;
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
  // Strong's -> Translation Words articles for THIS verse, from its Words links
  // (exact per word; a Strong's number alone would match many articles).
  let strongToTw = $state<Map<string, string[]> | null>(null);
  $effect(() => {
    const ref = r;
    const vs = versesOf(verse).map(String);
    strongToTw = null;
    if (!notesOn) return;
    loadTwl(ref.book, ref.ch)
      .then((rows) => {
        const m = new Map<string, string[]>();
        for (const k of vs) {
          for (const [, , slug, , strong] of rows[k] ?? []) {
            const b = strongBase(strong);
            if (!b) continue;
            const list = m.get(b) ?? [];
            if (!list.includes(slug)) list.push(slug);
            m.set(b, list);
          }
        }
        strongToTw = m;
      })
      .catch(() => {});
  });
  $effect(() => {
    if (!notesOn || (active !== 'helps' && active !== 'words' && !explaining && !article)) return;
    if (!twIndex) loadTwIndex().then((x) => (twIndex = x)).catch(() => {});
    if (!taIndex) loadTaIndex().then((x) => (taIndex = x)).catch(() => {});
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
  // The verse as quoted at the top of the page; the circled words are marked.
  const quoteParts = $derived.by(() => {
    const text = verse.text;
    if (!explaining || !focus || focus.end <= focus.start) return [{ s: text, mark: false }];
    return [
      { s: text.slice(0, focus.start), mark: false },
      { s: text.slice(focus.start, focus.end), mark: true },
      { s: text.slice(focus.end), mark: false },
    ].filter((x) => x.s);
  });
  async function copyVerse() {
    const ok = await copyText(`${verse.text}\n— ${title} (${manifest.abbr})`);
    onToast?.(t(lang, ok ? 'copied' : 'copyFailed'));
  }

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

<svelte:window onkeydown={(e) => { if (e.key !== 'Escape') return; if (article) article = null; else close(); }} />

<div class="page" role="dialog" aria-modal="true" aria-label={`${explaining ? t(lang, 'explain') : t(lang, 'study')} · ${title}`}>
  <header class="phead">
    <button class="pill back" onclick={close} aria-label={t(lang, 'back')}>
      <Icon name="chevron-left" size={18} /><span>{t(lang, 'back')}</span>
    </button>
    <div class="ptitle">
      <span class="pt"><Icon name={explaining ? 'sparkle' : 'bulb'} size={18} /> {explaining ? t(lang, 'explain') : t(lang, 'study')}</span>
      <h1>{title}</h1>
    </div>
  </header>

  <blockquote class="quote card tint-a" lang={manifest.lang}>
    <div class="qtext" use:fitWords>{#each quoteParts as part}{#if part.mark}<mark>{part.s}</mark>{:else}{part.s}{/if}{/each}</div>
    <footer>
      <span class="abbr">{manifest.abbr}</span>
      <button class="iconbtn" onclick={copyVerse} aria-label={t(lang, 'copy')} title={t(lang, 'copy')}><Icon name="copy" size={17} /></button>
    </footer>
  </blockquote>

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
      <button class="pill artback" onclick={() => (article = null)}><Icon name="chevron-left" size={16} /> {t(lang, 'back')}</button>
      <HelpArticle kind={article.kind} id={article.id} {lang} {twTitle} onOpen={openArticle} />
    {:else if active === 'notes'}
      <NotesTab initial={note} {lang} autofocus={section === 'notes'} onSave={onSaveNote} {onShare} {onWhatsApp} bind:draft />
    {:else if active === 'footnotes'}
      <FootnotesTab {verse} {lang} textLang={manifest.lang} {onToast} />
    {:else if active === 'xrefs'}
      <XrefsTab {r} {verse} {books} {lang} {translation} enabled={xrefsOn} {onNavigate} {onToast} />
    {:else if active === 'words'}
      <WordsTab {words} failed={wordsFailed} {isOT} {lang} twByStrong={notesOn ? strongToTw : null} {twTitle} onOpenTw={(slug) => openArticle('tw', slug)} {onToast} />
    {:else if active === 'helps'}
      <HelpsTab {r} {verse} {lang} {isOT} aligned={hasAlignment} focus={explaining ? focus : null} {twIndex} {taIndex} onOpen={openArticle} {onToast} />
    {/if}
  </div>
</div>

<style>
  .page {
    position: absolute;
    inset: 0;
    z-index: 30;
    background: var(--bg);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: calc(var(--safe-top) + 10px) 16px calc(var(--safe-bottom) + 32px);
    animation: slide 0.2s ease-out;
  }
  @keyframes slide { from { transform: translateX(24px); opacity: 0.6; } to { transform: none; opacity: 1; } }
  .phead { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 8px; margin-bottom: 14px; }
  .back { justify-self: start; padding: 0 14px 0 8px; gap: 2px; font-size: 15px; }
  .ptitle { grid-column: 2; display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 2px; }
  .pt { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--fg-muted); }
  .ptitle h1 { font-size: 19px; font-weight: 700; margin: 2px 0 0; }
  .quote {
    margin: 0 0 16px;
    padding: 18px 18px 8px;
    text-align: center;
  }
  .qtext {
    font-size: calc(18px * var(--font-scale) * var(--fit, 1));
    line-height: var(--line-height, 1.5);
    white-space: pre-line;
    word-break: keep-all;
    overflow-wrap: normal;
  }
  .quote:lang(en) .qtext { font-style: italic; }
  .quote mark { background: var(--mark); color: var(--fg); border-radius: 4px; padding: 0 3px; }
  .quote footer { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 8px; font-size: 13px; color: var(--fg-muted); }
  .abbr { font-weight: 700; letter-spacing: 0.04em; }
  .artback { margin-bottom: 12px; padding: 0 14px 0 8px; height: 34px; font-size: 14px; }
  @media (prefers-reduced-motion: reduce) { .page { animation: none; } }
  .orig { list-style: none; margin: 0 0 10px; padding: 0; }
  .orig li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 6px 0; border-bottom: 1px solid var(--line); }
  .o { font-size: 20px; unicode-bidi: isolate; }
  .lem { color: var(--fg-muted); unicode-bidi: isolate; }
  .gl { font-weight: 600; }
  .meta { font-size: 12px; color: var(--fg-muted); }
  .twc { padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 600; }
</style>
