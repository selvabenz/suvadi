<script lang="ts">
  import type { Lang, Theme } from '../types';
  import { t } from '../i18n';
  import { app } from '../state.svelte';

  let { lang, offlineReady }: { lang: Lang; offlineReady: boolean } = $props();

  const themes: { id: Theme; key: 'themeLight' | 'themeDark' | 'themeSepia' | 'themeSystem' }[] = [
    { id: 'system', key: 'themeSystem' },
    { id: 'light', key: 'themeLight' },
    { id: 'sepia', key: 'themeSepia' },
    { id: 'dark', key: 'themeDark' },
  ];
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

  <section>
    <h3>{t(lang, 'theme')}</h3>
    <div class="seg">
      {#each themes as th}
        <button class:on={app.settings.theme === th.id} onclick={() => app.update('theme', th.id)}>{t(lang, th.key)}</button>
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
    <p class="sample">ஆதியிலே தேவன் வானத்தையும் பூமியையும் படைத்தார்.</p>
  </section>

  <section>
    <label class="toggle">
      <input type="checkbox" checked={app.settings.redLetters} onchange={(e) => app.update('redLetters', (e.target as HTMLInputElement).checked)} />
      <span>{t(lang, 'redLetters')}</span>
    </label>
    <label class="toggle">
      <input type="checkbox" checked={app.settings.showNumbers} onchange={(e) => app.update('showNumbers', (e.target as HTMLInputElement).checked)} />
      <span>{t(lang, 'showNumbers')}</span>
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
      <li>{t(lang, 'attrIrv')}</li>
      <li>{t(lang, 'attrOpenBible')}</li>
      <li>{t(lang, 'attrStep')}</li>
      <li>{t(lang, 'attrFont')}</li>
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
  input[type='range'] { width: 100%; padding: 0; border: 0; background: none; }
  .sample { font-size: calc(22px * var(--font-scale)); line-height: 1.6; margin: 8px 0 0; }
  .toggle { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .toggle input { width: 22px; height: 22px; accent-color: var(--accent); }
  .ok { color: var(--accent); font-weight: 600; }
  .attr { padding-left: 18px; }
  .attr li { margin-bottom: 4px; }
</style>
