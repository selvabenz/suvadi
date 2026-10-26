<script module lang="ts">
  export interface Tab {
    id: string;
    icon: string;
    label: string;
    count?: number;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  let { tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (id: string) => void } = $props();

  let strip: HTMLDivElement | undefined = $state();

  // Keep the active tab in view when the strip scrolls sideways on a phone.
  $effect(() => {
    const id = active;
    strip?.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  function onKey(e: KeyboardEvent) {
    const i = tabs.findIndex((x) => x.id === active);
    if (e.key === 'ArrowRight' && i < tabs.length - 1) onChange(tabs[i + 1].id);
    else if (e.key === 'ArrowLeft' && i > 0) onChange(tabs[i - 1].id);
  }
</script>

<div class="tabs" role="tablist" tabindex="-1" bind:this={strip} onkeydown={onKey}>
  {#each tabs as tab (tab.id)}
    <button
      role="tab"
      data-tab={tab.id}
      class:on={tab.id === active}
      aria-selected={tab.id === active}
      tabindex={tab.id === active ? 0 : -1}
      onclick={() => onChange(tab.id)}
    >
      <Icon name={tab.icon} size={16} />
      <span>{tab.label}</span>
      {#if tab.count}<span class="count">{tab.count}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    position: sticky;
    top: -4px;
    z-index: 2;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    background: var(--bg-elev);
    padding: 4px 0 10px;
    margin-bottom: 6px;
  }
  .tabs::-webkit-scrollbar { display: none; }
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 13px;
    color: var(--fg-muted);
    white-space: nowrap;
    background: transparent;
    border: 1px solid var(--line);
  }
  button.on { background: var(--accent-soft); color: var(--fg); border-color: transparent; font-weight: 600; }
  .count { font-size: 11px; color: var(--fg-muted); }
</style>
