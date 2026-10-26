<script lang="ts">
  import type { FontId, Lang, Manifest, TextAlign, Theme, TranslationInfo } from '../types';
  import { t, type StringKey } from '../i18n';
  import { app } from '../state.svelte';
  import { ESV_ID, ESV_NOTICE, hasBuildKey } from '../esv';
  import Icon from './Icon.svelte';
  import Switch from './Switch.svelte';
  import Choice from './Choice.svelte';

  let {
    lang,
    offlineReady,
    translations,
    manifest,
    onTvSheet,
  }: {
    lang: Lang;
    offlineReady: boolean;
    translations: TranslationInfo[];
    manifest: Manifest | null;
    /** open the "Show on a TV" sheet */
    onTvSheet?: () => void;
  } = $props();

  /** "Tamil IRV, Bridge Connectivity Solutions, " — the licence follows as a link when it has a URL. */
  function attribution(x: TranslationInfo): string {
    const parts = [lang === 'en' ? x.nameEn : `${x.name} (${x.nameEn})`, x.publisher].filter(Boolean);
    return parts.join(', ') + (x.licence ? ', ' : '.');
  }

  // Each theme swatch previews its own colours, whatever theme is active.
  const themes: { id: Theme; key: StringKey; bg: string; fg: string; accent: string }[] = [
    { id: 'system', key: 'themeSystem', bg: 'linear-gradient(135deg, #f9f9fb 50%, #111113 50%)', fg: '#1d1d1f', accent: '#86868b' },
    { id: 'light', key: 'themeLight', bg: '#f9f9fb', fg: '#1d1d1f', accent: '#1d1d1f' },
    { id: 'sepia', key: 'themeSepia', bg: '#f4e9d8', fg: '#3b2a1a', accent: '#6f4a26' },
    { id: 'dark', key: 'themeDark', bg: '#111113', fg: '#f2f2f5', accent: '#f2f2f5' },
    { id: 'mono', key: 'themeMono', bg: '#ffffff', fg: '#000000', accent: '#000000' },
    { id: 'teen', key: 'themeTeen', bg: '#fff3f9', fg: '#2b1a3f', accent: '#ff2d8a' },
    { id: 'genz', key: 'themeGenz', bg: '#0b0a14', fg: '#f2f0ff', accent: '#c6ff3d' },
    { id: 'pastel', key: 'themePastel', bg: 'linear-gradient(135deg, #e7f7ef, #fbf8f1 50%, #fde7ef)', fg: '#33304a', accent: '#7b6cd9' },
  ];
  const aligns: { id: TextAlign; key: StringKey }[] = [
    { id: 'left', key: 'alignLeft' },
    { id: 'center', key: 'alignCenter' },
    { id: 'right', key: 'alignRight' },
    { id: 'justify', key: 'alignJustify' },
  ];
  const fonts: { id: FontId; name: string }[] = [
    { id: 'meera', name: 'Meera Inimai' },
    { id: 'mukta', name: 'Mukta Malar' },
    { id: 'pavanam', name: 'Pavanam' },
    { id: 'lohit', name: 'Lohit Tamil' },
    { id: 'tiro', name: 'Tiro Tamil' },
  ];
  const sample = $derived(manifest?.sample || 'ஆதியிலே தேவன் வானத்தையும் பூமியையும் படைத்தார்.');
  const esvUsable = $derived(hasBuildKey() || !!app.settings.esvKey);
  const version: string = __APP_VERSION__;
  const autoSteps = [0, 10, 15, 20, 30, 60];
</script>

<div class="view settings">
  <h2>{t(lang, 'navSettings')}</h2>

  <!-- Reading -->
  <section class="group">
    <h3 class="label"><Icon name="type" size={15} /> {t(lang, 'setReading')}</h3>

    {#if translations.length > 1}
      <p class="cap">{t(lang, 'translation')}</p>
      <div class="card rows">
        <Choice
          name={t(lang, 'translation')}
          value={app.settings.translation}
          options={translations.map((tr) => ({
            id: tr.id,
            label: tr.name,
            sub: tr.nameEn,
            lang: tr.lang,
            disabled: tr.id === ESV_ID && !esvUsable,
            tag: tr.id === ESV_ID ? t(lang, 'online') : undefined,
          }))}
          onChange={(id) => app.update('translation', id)}
        />
        {#if !hasBuildKey()}
          <label class="row noicon block field">
            <span class="fl">{t(lang, 'esvKey')}</span>
            <input
              type="password"
              autocomplete="off"
              spellcheck="false"
              value={app.settings.esvKey}
              onchange={(e) => app.update('esvKey', (e.target as HTMLInputElement).value.trim())}
              placeholder="Token…"
            />
            <span class="sub">{t(lang, 'esvKeyHint')}</span>
          </label>
        {/if}
      </div>
    {/if}

    <p class="cap">{t(lang, 'theme')}</p>
    <div class="card themes" role="radiogroup" aria-label={t(lang, 'theme')}>
      {#each themes as th (th.id)}
        <button class="swatch" class:on={app.settings.theme === th.id} role="radio" aria-checked={app.settings.theme === th.id} onclick={() => app.update('theme', th.id)}>
          <span class="tile" style="background: {th.bg}; color: {th.fg}">
            <span style="color: {th.accent}">அ</span>a
            {#if app.settings.theme === th.id}<span class="badge"><Icon name="check" size={12} stroke={3} /></span>{/if}
          </span>
          <span class="tl">{t(lang, th.key)}</span>
        </button>
      {/each}
    </div>

    <p class="cap">{t(lang, 'font')}</p>
    <div class="card rows">
      <Choice
        name={t(lang, 'font')}
        value={app.settings.font}
        options={fonts.map((f) => ({ id: f.id, label: f.name, sub: sample, style: `font-family: '${f.name}', var(--font)`, lang: manifest?.lang }))}
        onChange={(id) => app.update('font', id as FontId)}
      />
    </div>

    <p class="cap">{t(lang, 'textSize')}</p>
    <div class="card rows">
      <div class="row noicon block">
        <div class="sl"><span>{t(lang, 'textSize')}</span><span class="val">{Math.round(app.settings.fontScale * 100)}%</span></div>
        <input type="range" min="0.8" max="1.6" step="0.1" value={app.settings.fontScale}
          oninput={(e) => app.update('fontScale', Number((e.target as HTMLInputElement).value))} aria-label={t(lang, 'textSize')} />
      </div>
      <div class="row noicon block">
        <div class="sl"><span>{t(lang, 'lineSpacing')}</span><span class="val">{app.settings.lineHeight.toFixed(2)}</span></div>
        <input type="range" min="1.3" max="2" step="0.05" value={app.settings.lineHeight}
          oninput={(e) => app.update('lineHeight', Number((e.target as HTMLInputElement).value))} aria-label={t(lang, 'lineSpacing')} />
      </div>
      <div class="row noicon block">
        <div class="seg" role="radiogroup" aria-label={t(lang, 'textAlign')}>
          {#each aligns as a (a.id)}
            <button class="align {a.id}" class:on={app.settings.textAlign === a.id} role="radio" aria-checked={app.settings.textAlign === a.id} onclick={() => app.update('textAlign', a.id)} title={t(lang, a.key)}>
              <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="al">{t(lang, a.key)}</span>
            </button>
          {/each}
        </div>
      </div>
      <div class="row noicon block">
        <p class="sample" lang={manifest?.lang}>{sample}</p>
      </div>
    </div>

    <p class="cap">{t(lang, 'display')}</p>
    <div class="card rows">
      <Switch checked={app.settings.redLetters} label={t(lang, 'redLetters')} onChange={(v) => app.update('redLetters', v)} />
      <Switch checked={app.settings.showRef} label={t(lang, 'showRef')} onChange={(v) => app.update('showRef', v)} />
      <Switch checked={app.settings.showHeadings} label={t(lang, 'showHeadings')} onChange={(v) => app.update('showHeadings', v)} />
    </div>
  </section>

  <!-- Language -->
  <section class="group">
    <h3 class="label"><Icon name="globe" size={15} /> {t(lang, 'setLanguage')}</h3>
    <div class="card rows">
      <div class="row noicon block">
        <div class="seg" role="radiogroup" aria-label={t(lang, 'language')}>
          <button class:on={app.settings.lang === 'ta'} role="radio" aria-checked={app.settings.lang === 'ta'} onclick={() => app.update('lang', 'ta')}>தமிழ்</button>
          <button class:on={app.settings.lang === 'en'} role="radio" aria-checked={app.settings.lang === 'en'} onclick={() => app.update('lang', 'en')}>English</button>
        </div>
      </div>
    </div>
  </section>

  <!-- TV -->
  {#if onTvSheet}
    <section class="group">
      <h3 class="label"><Icon name="tv" size={15} /> {t(lang, 'tv')}</h3>
      <div class="card rows">
        <button class="row tvopen" onclick={onTvSheet}>
          <span class="lead"><Icon name="cast" size={20} /></span>
          <span class="rl"><span>{t(lang, 'tvOpen')}</span><span class="sub">{t(lang, 'tvOpenSub')}</span></span>
          <span class="trail"><Icon name="chevron-right" size={18} /></span>
        </button>
        <div class="row noicon block">
          <div class="sl"><span>{t(lang, 'tvAutoAdvance')}</span></div>
          <div class="seg">
            {#each autoSteps as sec}
              <button class:on={app.settings.tvAutoAdvance === sec} onclick={() => app.update('tvAutoAdvance', sec)}>{sec ? `${sec}${t(lang, 'secondsShort')}` : t(lang, 'tvAutoOff')}</button>
            {/each}
          </div>
        </div>
        <div class="row noicon block">
          <div class="sl"><span>{t(lang, 'tvTheme')}</span></div>
          <div class="seg">
            <button class:on={app.settings.tvTheme === 'dark'} onclick={() => app.update('tvTheme', 'dark')}>{t(lang, 'themeDark')}</button>
            <button class:on={app.settings.tvTheme === 'light'} onclick={() => app.update('tvTheme', 'light')}>{t(lang, 'themeLight')}</button>
          </div>
        </div>
      </div>
    </section>
  {/if}

  <!-- Explain (AI) -->
  <section class="group">
    <h3 class="label"><Icon name="sparkle" size={15} /> {t(lang, 'setExplain')}</h3>
    <div class="card rows">
      <p class="row noicon block sub">{t(lang, 'aiHint')}</p>
      <label class="row noicon block field">
        <span class="fl">{t(lang, 'aiEndpoint')}</span>
        <input type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://…" value={app.settings.aiEndpoint}
          onchange={(e) => app.update('aiEndpoint', (e.target as HTMLInputElement).value.trim())} />
      </label>
      <label class="row noicon block field">
        <span class="fl">{t(lang, 'aiKey')}</span>
        <input type="password" autocomplete="off" spellcheck="false" value={app.settings.aiKey}
          onchange={(e) => app.update('aiKey', (e.target as HTMLInputElement).value.trim())} />
      </label>
    </div>
  </section>

  <!-- Gestures -->
  <section class="group">
    <h3 class="label"><Icon name="fingers" size={15} /> {t(lang, 'gestures')}</h3>
    <div class="card rows">
      {#each [['heart', 'gestureDouble'], ['more', 'gestureLong'], ['arrows-h', 'gestureSwipe'], ['fingers', 'gestureTwoFinger'], ['sparkle', 'gestureAi']] as [icon, key]}
        <div class="row">
          <span class="lead"><Icon name={icon} size={20} /></span>
          <span class="rl"><span class="gt">{t(lang, key as StringKey)}</span></span>
          <span></span>
        </div>
      {/each}
    </div>
  </section>

  <!-- App -->
  <section class="group">
    <h3 class="label"><Icon name="download" size={15} /> {t(lang, 'setApp')}</h3>
    <div class="card rows">
      <div class="row">
        <span class="lead"><Icon name="download" size={20} /></span>
        <span class="rl"><span>{t(lang, 'installApp')}</span><span class="sub">{t(lang, 'installHint')}</span></span>
        {#if offlineReady}<span class="trail on" title={t(lang, 'offlineReady')}><Icon name="check" size={18} stroke={2.4} /></span>{:else}<span></span>{/if}
      </div>
      {#if offlineReady}
        <div class="row">
          <span class="lead"><Icon name="check" size={20} /></span>
          <span class="rl"><span>{t(lang, 'offlineReady')}</span></span>
          <span></span>
        </div>
      {/if}
      <button class="row" onclick={() => app.resetPlace()}>
        <span class="lead"><Icon name="book" size={20} /></span>
        <span class="rl"><span>{t(lang, 'resetPlace')}</span></span>
        <span class="trail"><Icon name="chevron-right" size={18} /></span>
      </button>
    </div>
  </section>

  <!-- About -->
  <section class="group">
    <h3 class="label"><Icon name="info" size={15} /> {t(lang, 'about')}</h3>
    <div class="card rows">
      <p class="row noicon block about">{t(lang, 'aboutText')}</p>
      <div class="row noicon block">
        <p class="fl">{t(lang, 'attributions')}</p>
        <ul class="attr">
          {#each translations as tr (tr.id)}
            <li>
              {t(lang, 'attrScripture')}: {attribution(tr)}{#if tr.licence?.url}<a href={tr.licence.url} target="_blank" rel="noopener">{tr.licence.name}</a>.{:else if tr.licence}{tr.licence.name}.{/if}
            </li>
          {/each}
          <li>{ESV_NOTICE} <a href="https://www.esv.org" target="_blank" rel="noopener">esv.org</a></li>
          <li>{t(lang, 'attrOpenBible')}</li>
          <li>{t(lang, 'attrStep')}</li>
          {#if manifest?.study?.notes || translations.some((x) => x.study?.notes)}<li>{t(lang, 'attrUw')}</li>{/if}
          <li>{t(lang, 'attrFont')}</li>
          <li>{t(lang, 'attrCode')} <a href="https://github.com/selvabenz/suvadi" target="_blank" rel="noopener">github.com/selvabenz/suvadi</a></li>
        </ul>
      </div>
      <div class="row noicon">
        <span>{t(lang, 'version')}</span>
        <span class="trail">{version}</span>
      </div>
    </div>
  </section>
</div>

<style>
  .settings h2 { font-size: 26px; margin: 4px 2px 18px; }
  .group { margin: 0 0 26px; }
  .group > .label { margin: 0 4px 10px; }
  .cap { margin: 14px 4px 6px; font-size: 13px; color: var(--fg-muted); }
  .group > .cap:first-of-type { margin-top: 0; }

  .field { display: flex; flex-direction: column; align-items: stretch; gap: 6px; text-align: left; }
  .fl { font-size: 14px; font-weight: 600; margin: 0; text-align: left; }
  .sl { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; font-size: 15px; }
  .val { color: var(--fg-muted); font-size: 14px; font-variant-numeric: tabular-nums; }
  input[type='range'] { width: 100%; }

  .themes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 6px; padding: 14px 10px; }
  .swatch { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .tile {
    position: relative;
    width: 50px;
    height: 50px;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19px;
    font-weight: 700;
    line-height: 1;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12);
  }
  .swatch.on .tile { outline: 2.5px solid var(--accent); outline-offset: 2px; }
  .badge {
    position: absolute;
    right: -6px;
    bottom: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-fg);
    display: grid;
    place-items: center;
    box-shadow: 0 0 0 2px var(--bg-elev);
  }
  .tl { font-size: 12px; color: var(--fg-muted); text-align: center; line-height: 1.25; }
  .swatch.on .tl { color: var(--fg); font-weight: 600; }

  .align { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px; }
  .bars { display: flex; flex-direction: column; gap: 3px; width: 20px; }
  .bars i { display: block; height: 2px; background: currentColor; border-radius: 1px; width: 100%; }
  .align.left .bars { align-items: flex-start; }
  .align.center .bars { align-items: center; }
  .align.right .bars { align-items: flex-end; }
  .align:not(.justify) .bars i:nth-child(2) { width: 60%; }
  .align:not(.justify) .bars i:nth-child(3) { width: 80%; }
  .al { font-size: 12px; }

  .sample { margin: 0; font-size: calc(21px * var(--font-scale)); line-height: var(--line-height, 1.45); text-align: var(--align, left); }
  p.row { margin: 0; }
  .about { font-size: 14px; line-height: 1.6; }
  .gt { font-size: 14px; line-height: 1.45; }
  .attr { padding-left: 18px; margin: 6px 0 0; font-size: 13px; line-height: 1.5; color: var(--fg-muted); }
  .attr li { margin-bottom: 4px; }
</style>
