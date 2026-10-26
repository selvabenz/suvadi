<script lang="ts">
  import type { Lang } from '../types';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  // Ask an AI service about the verse. Disabled (with a hint) until the reader
  // connects a service in Settings; no request is ever made without one.
  let {
    enabled,
    lang,
    onAsk,
  }: { enabled: boolean; lang: Lang; onAsk: (message: string) => Promise<string> } = $props();

  let message = $state('');
  let busy = $state(false);
  let reply = $state('');
  let error = $state('');

  async function submit(e: Event) {
    e.preventDefault();
    if (!enabled || busy || !message.trim()) return;
    busy = true;
    error = '';
    reply = '';
    try {
      reply = await onAsk(message.trim());
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }
</script>

<form class="ask" onsubmit={submit}>
  <div class="bar">
    <input
      type="text"
      bind:value={message}
      placeholder={t(lang, 'askPlaceholder')}
      disabled={!enabled || busy}
      aria-label={t(lang, 'ask')}
    />
    <button class="btn primary small" type="submit" disabled={!enabled || busy || !message.trim()}>
      <Icon name="sparkle" size={16} /> {busy ? t(lang, 'asking') : t(lang, 'ask')}
    </button>
  </div>
  {#if !enabled}
    <p class="muted small">{t(lang, 'aiHint')}</p>
  {/if}
  {#if reply}<p class="reply">{reply}</p>{/if}
  {#if error}<p class="err small">{error}</p>{/if}
</form>

<style>
  .ask { margin: 4px 0 16px; }
  .bar { display: flex; gap: 8px; align-items: center; }
  .bar input { flex: 1; min-width: 0; }
  .reply { white-space: pre-wrap; background: var(--accent-soft); border-radius: 12px; padding: 10px 12px; margin: 10px 0 0; line-height: 1.6; }
  .err { color: var(--wj); margin: 8px 0 0; }
  .muted.small { margin: 6px 0 0; }
</style>
