<script lang="ts">
  import type { FontId, Lang, Manifest, TextAlign, Theme, TranslationInfo } from '../types';
  import { t, type StringKey } from '../i18n';
  import { app } from '../state.svelte';
  import { ESV_ID, ESV_NOTICE, hasBuildKey } from '../esv';

  let {
    lang,
    offlineReady,
    translations,
    manifest,
  }: { lang: Lang; offlineReady: boolean; translations: TranslationInfo[]; manifest: Manifest | null } = $props();

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
  const esvUsable = $derived(hasBuildKey() || !!app.settings.esvKey);
  const version: string = __APP_VERSION__;
</script>

<div class="view">
  <h2>{t(lang, 'navSettings')}</h2>

  <section>
    <h3>{t(lang, 'language')}</h3>
    <div class="seg">
      <button class:on={app.settings.lang === 'ta'} onclick={() => app.update('lang', 'ta')}>தமிழ்</button>
      <button class:on={app.settings.lang === 'en'} onclick={() => app.update('lang', 'en')}>English</button>
    </div>
  </section>

  {#if translations.length > 1}
    <section>
      <h3>{t(lang, 'translation')}</h3>
      <div class="list">
        {#each translations as tr (tr.id)}
          <button
            class="opt"
            class:on={app.settings.translation === tr.id}
            disabled={tr.id === ESV_ID && !esvUsable}
            onclick={() => app.update('translation', tr.id)}
            lang={tr.lang}
          >
            <span class="tname">{tr.name}{#if tr.id === ESV_ID} <span class="tag">{t(lang, 'online')}</span>{/if}</span>
            <span class="muted small">{tr.nameEn}</span>
          </button>
        {/each}
      </div>
      {#if !hasBuildKey()}
        <label class="keyfield">
          <span class="small">{t(lang, 'esvKey')}</span>
          <input
            type="password"
            autocomplete="off"
            spellcheck="false"
            value={app.settings.esvKey}
            onchange={(e) => app.update('esvKey', (e.target as HTMLInputElement).value.trim())}
            placeholder="Token…"
          />
          <span class="muted small">{t(lang, 'esvKeyHint')}</span>
        </label>
      {/if}
    </section>
  {/if}

  <section>
    <h3>{t(lang, 'theme')}</h3>
    <div class="themes" role="radiogroup" aria-label={t(lang, 'theme')}>
      {#each themes as th (th.id)}
        <button
          class="swatch"
          class:on={app.settings.theme === th.id}
          role="radio"
          aria-checked={app.settings.theme === th.id}
          onclick={() => app.update('theme', th.id)}
        >
          <span class="chip" style="background: {th.bg}; color: {th.fg}; border-color: {th.accent}">
            <span style="color: {th.accent}">அ</span>a
          </span>
          <span class="tlabel">{t(lang, th.key)}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3>{t(lang, 'textSize')} · {Math.round(app.settings.fontScale * 100)}%</h3>
    <input
      type="range"
      min="0.8"
      max="1.6"
      step="0.1"
      value={app.settings.fontScale}
      oninput={(e) => app.update('fontScale', Number((e.target as HTMLInputElement).value))}
      aria-label={t(lang, 'textSize')}
    />
    <h3 class="sub">{t(lang, 'lineSpacing')} · {app.settings.lineHeight.toFixed(2)}</h3>
    <input
      type="range"
      min="1.3"
      max="2"
      step="0.05"
      value={app.settings.lineHeight}
      oninput={(e) => app.update('lineHeight', Number((e.target as HTMLInputElement).value))}
      aria-label={t(lang, 'lineSpacing')}
    />
    <p class="sample" lang={manifest?.lang}>{manifest?.sample || 'ஆதியிலே தேவன் வானத்தையும் பூமியையும் படைத்தார்.'}</p>
  </section>

  <section>
    <h3>{t(lang, 'font')}</h3>
    <div class="list" role="radiogroup" aria-label={t(lang, 'font')}>
      {#each fonts as f (f.id)}
        <button
          class="opt font"
          class:on={app.settings.font === f.id}
          role="radio"
          aria-checked={app.settings.font === f.id}
          style="font-family: '{f.name}', var(--font)"
          onclick={() => app.update('font', f.id)}
        >
          <span class="tname">{f.name}</span>
          <span class="fsample" lang={manifest?.lang}>{manifest?.sample || 'ஆதியிலே தேவன் வானத்தையும் பூமியையும் படைத்தார்.'}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3>{t(lang, 'textAlign')}</h3>
    <div class="seg" role="radiogroup" aria-label={t(lang, 'textAlign')}>
      {#each aligns as a (a.id)}
        <button
          class="align {a.id}"
          class:on={app.settings.textAlign === a.id}
          role="radio"
          aria-checked={app.settings.textAlign === a.id}
          onclick={() => app.update('textAlign', a.id)}
        >
          <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>{t(lang, a.key)}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <label class="toggle">
      <input type="checkbox" checked={app.settings.redLetters} onchange={(e) => app.update('redLetters', (e.target as HTMLInputElement).checked)} />
      <span>{t(lang, 'redLetters')}</span>
    </label>
    <label class="toggle">
      <input type="checkbox" checked={app.settings.showRef} onchange={(e) => app.update('showRef', (e.target as HTMLInputElement).checked)} />
      <span>{t(lang, 'showRef')}</span>
    </label>
    <label class="toggle">
      <input type="checkbox" checked={app.settings.showHeadings} onchange={(e) => app.update('showHeadings', (e.target as HTMLInputElement).checked)} />
      <span>{t(lang, 'showHeadings')}</span>
    </label>
  </section>

  <section>
    <h3>{t(lang, 'gestures')}</h3>
    <ul class="small gestures">
      <li><span class="g">♥</span>{t(lang, 'gestureDouble')}</li>
      <li><span class="g">⋯</span>{t(lang, 'gestureLong')}</li>
      <li><span class="g">⇆</span>{t(lang, 'gestureSwipe')}</li>
      <li><span class="g">✌</span>{t(lang, 'gestureTwoFinger')}</li>
      <li><span class="g">✦</span>{t(lang, 'gestureAi')}</li>
    </ul>
  </section>

  <section>
    <h3>{t(lang, 'aiSection')}</h3>
    <p class="muted small">{t(lang, 'aiHint')}</p>
    <label class="keyfield">
      <span class="small">{t(lang, 'aiEndpoint')}</span>
      <input
        type="url"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        placeholder="https://…"
        value={app.settings.aiEndpoint}
        onchange={(e) => app.update('aiEndpoint', (e.target as HTMLInputElement).value.trim())}
      />
    </label>
    <label class="keyfield">
      <span class="small">{t(lang, 'aiKey')}</span>
      <input
        type="password"
        autocomplete="off"
        spellcheck="false"
        value={app.settings.aiKey}
        onchange={(e) => app.update('aiKey', (e.target as HTMLInputElement).value.trim())}
      />
    </label>
  </section>

  <section>
    <button class="btn ghost" onclick={() => app.resetPlace()}>{t(lang, 'resetPlace')}</button>
  </section>

  <section>
    <h3>{t(lang, 'installApp')}</h3>
    <p class="muted small">{t(lang, 'installHint')}</p>
    {#if offlineReady}<p class="ok small">✓ {t(lang, 'offlineReady')}</p>{/if}
  </section>

  <section>
    <h3>{t(lang, 'about')}</h3>
    <p class="small">{t(lang, 'aboutText')}</p>
    <h3>{t(lang, 'attributions')}</h3>
    <ul class="small attr">
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
    <p class="muted small">{t(lang, 'version')} {version}</p>
  </section>
</div>

<style>
  section { margin: 0 0 22px; }
  h3 { margin-bottom: 8px; }
  .seg { display: flex; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .seg button { flex: 1; padding: 10px 6px; font-size: 14px; }
  .seg button.on { background: var(--accent); color: var(--accent-fg); font-weight: 700; }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .opt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; text-align: left; }
  .opt.on { border-color: var(--accent); background: var(--accent-soft); }
  .opt .tname { font-weight: 700; }
  .opt .tag { font-weight: 400; font-size: 11px; padding: 1px 6px; border-radius: 999px; background: var(--accent-soft); color: var(--fg-muted); vertical-align: middle; }
  .keyfield { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
  .opt.font .fsample { font-size: calc(18px * var(--font-scale)); line-height: 1.5; }

  .themes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .swatch { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px 2px; border-radius: 12px; }
  .swatch .chip {
    width: 52px; height: 52px;
    border-radius: 14px;
    border: 2px solid;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 700; line-height: 1;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
  .swatch .tlabel { font-size: 12px; color: var(--fg-muted); }
  .swatch.on .chip { outline: 3px solid var(--accent); outline-offset: 2px; }
  .swatch.on .tlabel { color: var(--accent); font-weight: 700; }

  .align { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .bars { display: flex; flex-direction: column; gap: 3px; width: 22px; }
  .bars i { display: block; height: 2px; background: currentColor; border-radius: 1px; width: 100%; }
  .align.left .bars { align-items: flex-start; }
  .align.center .bars { align-items: center; }
  .align.right .bars { align-items: flex-end; }
  .align.left .bars i:nth-child(2), .align.center .bars i:nth-child(2), .align.right .bars i:nth-child(2) { width: 60%; }
  .align.left .bars i:nth-child(3), .align.center .bars i:nth-child(3), .align.right .bars i:nth-child(3) { width: 80%; }
  .align span:last-child { font-size: 12px; }

  input[type='range'] { width: 100%; padding: 0; border: 0; background: none; }
  .sub { margin-top: 14px; }
  .sample { font-size: calc(22px * var(--font-scale)); line-height: var(--line-height, 1.45); margin: 8px 0 0; text-align: var(--align, left); }
  .toggle { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .toggle input { width: 22px; height: 22px; accent-color: var(--accent); }
  .gestures { list-style: none; padding: 0; margin: 0; }
  .gestures li { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; }
  .gestures .g { width: 24px; text-align: center; color: var(--accent); font-size: 18px; line-height: 1.2; flex: none; }
  .ok { color: var(--accent); font-weight: 600; }
  .attr { padding-left: 18px; }
  .attr li { margin-bottom: 4px; }
</style>
