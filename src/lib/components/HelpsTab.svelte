<script lang="ts">
  import type { Lang, Ref, Selection, TaIndex, TnNote, TwIndex, TwlRow, Verse } from '../types';
  import { loadNotes, loadTwl } from '../data';
  import { overlaps, versesOf } from '../study';
  import { t } from '../i18n';
  import Md from './Md.svelte';

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
    <section>
      <h3>{t(lang, 'twTitle')}</h3>
      <div class="terms">
        {#each terms as term (term.slug)}
          <button class="chip term {term.cat}" class:hit={term.hit} onclick={() => onOpen('tw', term.slug)}>{term.title}</button>
        {/each}
      </div>
    </section>
  {/if}

  <section>
    <h3>{t(lang, 'tnTitle')}</h3>
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
  </section>
  <p class="muted small" lang="en">{t(lang, 'attrUw')}</p>
{/if}

<style>
  section { margin: 6px 0 18px; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin: 0 0 8px; }
  .terms { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip.term { color: var(--accent); font-weight: 600; }
  .chip.term.names { font-style: italic; }
  .chip.term.hit { background: var(--mark); color: var(--fg); }
  .notes { list-style: none; margin: 0; padding: 0; }
  .note { border-bottom: 1px solid var(--line); padding: 10px 0 8px; }
  .note.hit { border-left: 3px solid var(--accent); padding-left: 10px; }
  .qrow { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin-bottom: 6px; }
  .en { font-weight: 700; background: var(--mark); border-radius: 4px; padding: 0 4px; }
  .q { font-size: 17px; color: var(--fg-muted); unicode-bidi: isolate; }
  .tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--fg-muted); }
  .tag.link { color: var(--accent); font-weight: 600; }
  .more { color: var(--accent); font-weight: 600; padding: 10px 0; font-size: 14px; }
</style>
