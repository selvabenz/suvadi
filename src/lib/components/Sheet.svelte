<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title = '',
    onClose,
    tall = false,
    children,
  }: { title?: string; onClose: () => void; tall?: boolean; children: Snippet } = $props();

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="backdrop" role="presentation" onclick={onClose}></div>
<div class="sheet" class:tall role="dialog" aria-modal="true" aria-label={title}>
  <div class="grip" aria-hidden="true"></div>
  <header>
    <h2>{title}</h2>
    <button class="close" onclick={onClose} aria-label="close">✕</button>
  </header>
  <div class="body">
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 40;
  }
  .sheet {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    max-height: 72dvh;
    background: var(--bg-elev);
    border-radius: 20px 20px 0 0;
    box-shadow: var(--shadow);
    z-index: 41;
    display: flex;
    flex-direction: column;
    padding-bottom: var(--safe-bottom);
    animation: up 0.18s ease-out;
  }
  .sheet.tall { max-height: 92dvh; }
  @keyframes up { from { transform: translateY(24px); opacity: 0.6; } to { transform: none; opacity: 1; } }
  .grip {
    width: 40px; height: 4px; border-radius: 2px;
    background: var(--line);
    margin: 8px auto 0;
  }
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 16px 4px;
  }
  header h2 { font-size: 17px; margin: 0; }
  .close { font-size: 18px; padding: 8px; color: var(--fg-muted); }
  .body {
    overflow-y: auto;
    padding: 4px 16px 20px;
    -webkit-overflow-scrolling: touch;
  }
</style>
