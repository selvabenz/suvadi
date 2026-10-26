<script lang="ts">
  import type { Lang, TranslationInfo } from '../types';
  import { t } from '../i18n';
  import { ESV_ID } from '../esv';
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';

  // The Bible menu: opened from the translation pill at the top of the reader.
  let {
    lang,
    translations,
    value,
    usable,
    onPick,
    onSettings,
    onClose,
  }: {
    lang: Lang;
    translations: TranslationInfo[];
    value: string;
    /** false for a translation that cannot open yet (the ESV without a key) */
    usable: (id: string) => boolean;
    onPick: (id: string) => void;
    onSettings: () => void;
    onClose: () => void;
  } = $props();

  function credit(x: TranslationInfo): string {
    return [x.publisher, x.licence?.name].filter(Boolean).join(' · ');
  }
</script>

<Sheet title={t(lang, 'translation')} {onClose}>
  <div class="card rows" role="radiogroup" aria-label={t(lang, 'translation')}>
    {#each translations as tr (tr.id)}
      {@const ok = usable(tr.id)}
      <button
        class="row noicon tr"
        role="radio"
        aria-checked={tr.id === value}
        disabled={!ok}
        onclick={() => onPick(tr.id)}
      >
        <span class="rl">
          <span class="nm" lang={tr.lang}>
            {tr.name}
            {#if tr.id === ESV_ID}<span class="tag">{t(lang, 'online')}</span>{/if}
          </span>
          <span class="en">{tr.nameEn}</span>
          {#if !ok}
            <span class="sm">{t(lang, 'esvNeedsKey')}</span>
          {:else if credit(tr)}
            <span class="sm">{credit(tr)}</span>
          {/if}
        </span>
        <span class="trail on" class:off={tr.id !== value}><Icon name="check" size={22} stroke={2.2} /></span>
      </button>
    {/each}
  </div>
  <button class="more" onclick={onSettings}><Icon name="settings" size={16} /> {t(lang, 'moreInSettings')}</button>
</Sheet>

<style>
  .tr { padding-top: 12px; padding-bottom: 12px; }
  .nm { font-size: 17px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; }
  .en { font-size: 14px; color: var(--fg-muted); }
  .sm { font-size: 12px; color: var(--fg-muted); line-height: 1.4; }
  .off { visibility: hidden; }
  .more { display: inline-flex; align-items: center; gap: 6px; margin: 12px 4px 4px; font-size: 13px; color: var(--fg-muted); }
</style>
