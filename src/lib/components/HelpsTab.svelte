<script lang="ts">
  import type { Lang, Ref, Selection, TaIndex, TnNote, TwIndex, TwlRow, Verse } from '../types';
  import { loadNotes, loadTwl } from '../data';
  import { overlaps, versesOf } from '../study';
  import { t } from '../i18n';
  import Md from './Md.svelte';
  import SectionCard from './SectionCard.svelte';

  // unfoldingWord Translation Notes and Translation Words for the verse. In the
  // ULT the notes also show the English words they are about (from the
  // alignment); in other translations they are listed by verse.
  let {
    r,
    verse,
    lang,
    isOT,
    aligned,
    focus = null,
    twIndex,
    taIndex,
    onOpen,
    onToast,
  }: {
    r: Ref;
    verse: Verse;
    lang: Lang;
    isOT: boolean;
    /** verse.text is the ULT, so note spans point into it */
    aligned: boolean;
    focus?: Selection | null;
    twIndex: TwIndex | null;
    taIndex: TaIndex | null;
    onOpen: (kind: 'tw' | 'ta', id: string) => void;
    onToast?: (msg: string) => void;
  } = $props();

  type Item = TnNote & { title?: boolean };
  let notes = $state<Item[] | null>(null);
  let links = $state<TwlRow[] | null>(null);
  let failed = $state(false);
  let showOthers = $state(false);

  $effect(() => {
    const ref = r;
    const vs = verse;
    notes = null;
    links = null;
    failed = false;
    const keys = versesOf(vs).map(String);
    // notes on a Psalm title are keyed "0" and belong with verse 1
    const withTitle = vs.n === 1 && !!vs.superscription;
    Promise.all([loadNotes(ref.book, ref.ch), loadTwl(ref.book, ref.ch)])
      .then(([n, l]) => {
        const title: Item[] = withTitle ? (n['0'] ?? []).map((x) => ({ ...x, title: true })) : [];
        notes = [...title, ...keys.flatMap((k) => n[k] ?? [])];
        links = [...(withTitle ? l['0'] ?? [] : []), ...keys.flatMap((k) => l[k] ?? [])];
      })
      .catch(() => (failed = true));
  });

  /** The ULT words a note is about, e.g. "the faith … the truth". */
  function english(n: Item): string {
    if (!aligned) return '';
    const spans = n.title ? [] : n.hl ?? [];
    return spans.map(([s, e]) => verse.text.slice(s, e).replace(/\n/g, ' ')).join(' … ');
  }
  const hit = (n: Item) => !!focus && aligned && !n.title && (n.hl ?? []).some((s) => overlaps(s, focus!));
  const ordered = $derived.by(() => {
    if (!notes) return null;
    if (!focus || !aligned) return { first: notes, rest: [] as Item[] };
    return { first: notes.filter(hit), rest: notes.filter((n) => !hit(n)) };
  });
  const terms = $derived.by(() => {
    if (!links) return [];
    const seen = new Set<string>();
    const out: { slug: string; cat: string; title: string; hit: boolean }[] = [];
    for (const [, , slug, cat, , hl] of links) {
      const h = !!focus && aligned && hl.some((s) => overlaps(s, focus!));
      if (seen.has(slug)) {
        if (h) out.find((x) => x.slug === slug)!.hit = true;
        continue;
      }
      seen.add(slug);
      out.push({ slug, cat, title: twIndex?.[slug]?.[0] ?? slug, hit: h });
    }
    return out.sort((a, b) => Number(b.hit) - Number(a.hit));
  });
  // copy: notes as plain text (Markdown marks removed)
  const plain = (md: string) => md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_#]/g, '').trim();
  const notesText = $derived(
    ordered ? [...ordered.first, ...ordered.rest].map((n) => (english(n) ? `${english(n)}: ` : '') + plain(n.note)).join('\n\n') : '',
  );
</script>

{#snippet note(n: Item)}
  <li class="note" class:hit={hit(n)}>
    <div class="qrow">
      {#if english(n)}<span class="en">{english(n)}</span>{/if}
      {#if n.q}<span class="q" lang={isOT ? 'he' : 'el'} dir={isOT ? 'rtl' : 'ltr'}>{n.q}</span>{/if}
      {#if n.title}<span class="tag">{t(lang, 'superscription')}</span>{/if}
    </div>
    <Md src={n.note} {lang} onLink={onOpen} />
    {#if n.ta}
      <button class="tag link" onclick={() => onOpen('ta', n.ta)}>{taIndex?.[n.ta]?.[0] ?? n.ta}</button>
    {/if}
  </li>
{/snippet}

{#if failed}
  <p class="muted small">{t(lang, 'studyOffline')}</p>
{:else if ordered === null}
  <p class="muted small">{t(lang, 'loading')}</p>
{:else}
  {#if terms.length}
    <SectionCard icon="bulb" label={t(lang, 'twTitle')} tint="a" {lang}>
      <div class="terms">
        {#each terms as term (term.slug)}
          <button class="term {term.cat}" class:hit={term.hit} onclick={() => onOpen('tw', term.slug)}>{term.title}</button>
        {/each}
      </div>
    </SectionCard>
  {/if}

  <SectionCard icon="note" label={t(lang, 'tnTitle')} copyText={notesText || undefined} {lang} {onToast} flush={!!(ordered.first.length || ordered.rest.length)}>
    {#if !ordered.first.length && !ordered.rest.length}
      <p class="muted small">—</p>
    {:else}
      <ul class="notes" lang="en">
        {#each ordered.first as n}{@render note(n)}{/each}
      </ul>
      {#if ordered.rest.length}
        <button class="more" onclick={() => (showOthers = !showOthers)} aria-expanded={showOthers}>
          {showOthers ? '▾' : '▸'} {t(lang, 'otherNotes')} ({ordered.rest.length})
        </button>
        {#if showOthers}
          <ul class="notes" lang="en">
            {#each ordered.rest as n}{@render note(n)}{/each}
          </ul>
        {/if}
      {/if}
    {/if}
  </SectionCard>
  <p class="muted note-attr" lang="en">{t(lang, 'attrUw')}</p>
{/if}

<style>
  p.small { margin: 0; }
  .terms { display: flex; flex-wrap: wrap; gap: 6px; }
  .term { padding: 5px 12px; border-radius: var(--r-pill); background: var(--bg-elev); color: var(--fg); font-size: 14px; font-weight: 600; box-shadow: 0 0 0 1px var(--line); }
  .term.names { font-style: italic; font-weight: 500; }
  .term.hit { background: var(--mark); box-shadow: none; }
  .notes { list-style: none; margin: 0; padding: 0; }
  .note { padding: 14px 16px 12px; }
  .note + .note { border-top: 1px solid var(--line); }
  .note.hit { box-shadow: inset 3px 0 0 var(--accent); }
  .qrow { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin-bottom: 8px; }
  .en { font-weight: 700; background: var(--mark); border-radius: 4px; padding: 0 5px; }
  .q { font-size: 17px; color: var(--fg-muted); unicode-bidi: isolate; }
  .tag.link { color: var(--fg); font-weight: 600; background: var(--accent-soft); padding: 3px 10px; font-size: 12px; }
  .more { display: block; width: 100%; text-align: left; color: var(--fg); font-weight: 600; padding: 12px 16px; font-size: 14px; border-top: 1px solid var(--line); }
  .note-attr { font-size: 12px; margin: -8px 4px 16px; }
</style>
