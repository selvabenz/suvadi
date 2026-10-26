<script lang="ts">
  import Icon from './Icon.svelte';

  export interface ChoiceOption {
    id: string;
    label: string;
    sub?: string;
    lang?: string;
    disabled?: boolean;
    style?: string;
    tag?: string;
  }

  // A one-of-N list: rows with a check mark on the selected one.
  let {
    name,
    value,
    options,
    onChange,
  }: { name: string; value: string; options: ChoiceOption[]; onChange: (id: string) => void } = $props();
</script>

<div class="rows" role="radiogroup" aria-label={name}>
  {#each options as o (o.id)}
    <button
      class="row noicon"
      role="radio"
      aria-checked={o.id === value}
      disabled={o.disabled}
      style={o.style}
      lang={o.lang}
      onclick={() => onChange(o.id)}
    >
      <span class="rl">
        <span class="nm">{o.label}{#if o.tag} <span class="tag">{o.tag}</span>{/if}</span>
        {#if o.sub}<span class="sub">{o.sub}</span>{/if}
      </span>
      <span class="trail on" class:off={o.id !== value}><Icon name="check" size={20} stroke={2.2} /></span>
    </button>
  {/each}
</div>

<style>
  .nm { font-weight: 600; }
  .off { visibility: hidden; }
</style>
