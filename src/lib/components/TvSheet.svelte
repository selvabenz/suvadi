<script lang="ts">
  import qrcode from 'qrcode-generator';
  import type { Lang } from '../types';
  import { t } from '../i18n';
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';

  // "Show on a TV": TV mode on this screen (for the phone's own screen
  // mirroring), presenting on a Chromecast / display from a desktop browser
  // when it can, or a QR code and link for a smart TV's browser.
  let {
    lang,
    url,
    canPresent,
    presenting,
    onTvHere,
    onPresent,
    onStopPresent,
    onCopy,
    onClose,
  }: {
    lang: Lang;
    url: string;
    canPresent: boolean;
    presenting: boolean;
    onTvHere: () => void;
    onPresent: () => void;
    onStopPresent: () => void;
    onCopy: (url: string) => void;
    onClose: () => void;
  } = $props();

  let open = $state(false);
  const qr = $derived.by(() => {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    return q;
  });
  const n = $derived(qr.getModuleCount());
  // one path of unit squares (no markup injection: only numbers go in)
  const d = $derived.by(() => {
    let p = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) p += `M${c + 4} ${r + 4}h1v1h-1z`;
    return p;
  });
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  async function shareLink() {
    try {
      await navigator.share({ url });
    } catch {
      /* cancelled */
    }
  }
</script>

<Sheet title={t(lang, 'tvOpen').replace('…', '')} {onClose}>
  <div class="card rows">
    <button class="row" onclick={onTvHere}>
      <span class="lead"><Icon name="tv" size={22} /></span>
      <span class="rl"><span>{t(lang, 'tvHere')}</span><span class="sub">{t(lang, 'tvHereSub')}</span></span>
      <span class="trail"><Icon name="chevron-right" size={18} /></span>
    </button>
    {#if presenting}
      <button class="row" onclick={onStopPresent}>
        <span class="lead on"><Icon name="cast" size={22} /></span>
        <span class="rl"><span>{t(lang, 'tvStop')}</span><span class="sub">{t(lang, 'tvPresenting')}</span></span>
        <span class="trail"><Icon name="close" size={18} /></span>
      </button>
    {:else if canPresent}
      <button class="row" onclick={onPresent}>
        <span class="lead"><Icon name="cast" size={22} /></span>
        <span class="rl"><span>{t(lang, 'tvPresent')}</span><span class="sub">{t(lang, 'tvPresentSub')}</span></span>
        <span class="trail"><Icon name="chevron-right" size={18} /></span>
      </button>
    {/if}
    <button class="row" onclick={() => (open = !open)} aria-expanded={open}>
      <span class="lead"><Icon name="qr" size={22} /></span>
      <span class="rl"><span>{t(lang, 'tvOpenBrowser')}</span><span class="sub">{t(lang, 'tvOpenBrowserSub')}</span></span>
      <span class="trail" class:turn={open}><Icon name="chevron-right" size={18} /></span>
    </button>
    {#if open}
      <div class="row noicon block qrrow">
        <svg class="qr" viewBox="0 0 {n + 8} {n + 8}" shape-rendering="crispEdges" role="img" aria-label={url}>
          <rect width="100%" height="100%" fill="#fff" />
          <path {d} fill="#000" />
        </svg>
        <p class="hint">{t(lang, 'tvScanHint')}</p>
        <p class="link" lang="en">{url}</p>
        <div class="acts">
          <button class="btn small" onclick={() => onCopy(url)}><Icon name="copy" size={16} /> {t(lang, 'copyLink')}</button>
          {#if canShare}<button class="btn small" onclick={shareLink}><Icon name="share" size={16} /> {t(lang, 'shareLink')}</button>{/if}
        </div>
      </div>
    {/if}
  </div>
</Sheet>

<style>
  .lead.on { color: var(--accent); }
  .trail { transition: transform 0.15s; }
  .trail.turn { transform: rotate(90deg); }
  .qrrow { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px; }
  .qr { width: 200px; height: 200px; border-radius: 12px; box-shadow: 0 0 0 1px var(--line); }
  .hint { margin: 0; font-size: 13px; color: var(--fg-muted); text-align: center; max-width: 30ch; }
  .link { margin: 0; font-size: 13px; user-select: all; word-break: break-all; text-align: center; color: var(--fg); }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
</style>
