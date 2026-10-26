<script lang="ts">
  import type { Lang, TaArticle, TwArticle } from '../types';
  import { loadTa, loadTw } from '../data';
  import { taUrl } from '../study';
  import { t } from '../i18n';
  import Md from './Md.svelte';

  // A Translation Words or Translation Academy article, shown inside the study
  // sheet. Links inside it open further articles in the same place.
  let {
    kind,
    id,
    lang,
    twTitle,
    onOpen,
  }: {
    kind: 'tw' | 'ta';
    id: string;
    lang: Lang;
    twTitle?: (slug: string) => string;
    onOpen: (kind: 'tw' | 'ta', id: string) => void;
  } = $props();

  let tw = $state<TwArticle | null>(null);
  let ta = $state<TaArticle | null>(null);
  let failed = $state(false);

  $effect(() => {
    const k = kind;
    const x = id;
    tw = null;
    ta = null;
    failed = false;
    (k === 'tw' ? loadTw(x).then((a) => (tw = a)) : loadTa(x).then((a) => (ta = a))).catch(() => (failed = true));
  });
</script>

<article class="art">
  {#if failed}
    {#if kind === 'ta'}
      <p class="muted small">{t(lang, 'studyOffline')}</p>
      <a href={taUrl(id)} target="_blank" rel="noopener">{id}</a>
    {:else}
      <p class="muted small">{t(lang, 'studyOffline')}</p>
    {/if}
  {:else if tw}
    <h3>{tw.title} <span class="tag">{tw.cat === 'kt' ? 'key term' : tw.cat === 'names' ? 'name' : 'term'}</span></h3>
    <Md src={tw.body} {lang} onLink={onOpen} />
    {#if tw.see.length}
      <div class="see">
        {#each tw.see as s}
          <button class="chip link" onclick={() => onOpen('tw', s)}>{twTitle?.(s) ?? s}</button>
        {/each}
      </div>
    {/if}
    {#if tw.strongs.length}<p class="muted small">{t(lang, 'strongs')}: {tw.strongs.join(', ')}</p>{/if}
  {:else if ta}
    <h3>{ta.title}</h3>
    {#if ta.subtitle}<p class="muted small sub">{ta.subtitle}</p>{/if}
    <Md src={ta.body} {lang} onLink={onOpen} />
  {:else}
    <p class="muted small">{t(lang, 'loading')}</p>
  {/if}
  <p class="muted small attr" lang="en">{t(lang, 'attrUw')}</p>
</article>

<style>
  h3 { font-size: 18px; margin: 4px 0 10px; color: var(--fg); text-transform: none; letter-spacing: 0; }
  .tag { font-size: 11px; font-weight: 400; padding: 1px 7px; border-radius: 999px; background: var(--accent-soft); color: var(--fg-muted); vertical-align: middle; }
  .sub { margin: -6px 0 10px; }
  .see { margin: 6px 0 10px; }
  .chip.link { color: var(--accent); font-weight: 600; }
  .attr { margin-top: 14px; }
</style>
