<script lang="ts">
  import type { Lang } from '../types';
  import { parseMd } from '../md';
  import { t } from '../i18n';

  // Renders Markdown-lite as elements. Internal links (tw:slug, ta:id) are
  // handed to onLink; web links open in a new tab.
  let {
    src,
    lang,
    onLink,
  }: { src: string; lang: Lang; onLink?: (kind: 'tw' | 'ta', id: string) => void } = $props();

  const blocks = $derived(parseMd(src));

  function internal(href: string): ['tw' | 'ta', string] | null {
    const m = /^(tw|ta):(.+)$/.exec(href);
    return m ? [m[1] as 'tw' | 'ta', m[2]] : null;
  }
</script>

{#snippet inline(inl: ReturnType<typeof parseMd>[number]['inl'])}
  {#each inl as x}
    {#if x.t === 'b'}<b>{x.s}</b>
    {:else if x.t === 'i'}<i>{x.s}</i>
    {:else if x.t === 'a'}
      {@const int = internal(x.href)}
      {#if int && onLink}
        <button class="link" onclick={() => onLink(int[0], int[1])}>{x.s}</button>
      {:else if int}
        <span>{x.s}</span>
      {:else}
        <a href={x.href} target="_blank" rel="noopener">{x.s}</a>
      {/if}
    {:else}{x.s}{/if}
  {/each}
{/snippet}

<div class="md">
  {#each blocks as b}
    {#if b.t === 'h'}
      <p class="h h{b.level}">{@render inline(b.inl)}</p>
    {:else if b.t === 'li'}
      <p class="li">{@render inline(b.inl)}</p>
    {:else if b.alt}
      <p class="alt"><span class="altl">{t(lang, 'altTranslation')}</span> {@render inline(b.inl)}</p>
    {:else}
      <p>{@render inline(b.inl)}</p>
    {/if}
  {/each}
</div>

<style>
  .md p { margin: 0 0 8px; font-size: calc(15px * var(--font-scale)); line-height: 1.6; }
  .md .h { font-weight: 700; margin-top: 10px; }
  .md .h1 { font-size: calc(17px * var(--font-scale)); }
  .md .li { padding-left: 16px; position: relative; }
  .md .li::before { content: '•'; position: absolute; left: 4px; color: var(--fg-muted); }
  .md .alt { background: var(--accent-soft); border-radius: 10px; padding: 8px 10px; }
  .md .altl { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin-bottom: 2px; }
  .link { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; padding: 0; font: inherit; }
</style>
