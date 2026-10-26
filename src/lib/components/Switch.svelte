<script lang="ts">
  // An on/off row: label (and an optional line under it) with a switch on the right.
  let {
    checked,
    label,
    sub,
    onChange,
  }: { checked: boolean; label: string; sub?: string; onChange: (v: boolean) => void } = $props();
</script>

<label class="row noicon sw-row">
  <span class="rl">
    <span>{label}</span>
    {#if sub}<span class="sub">{sub}</span>{/if}
  </span>
  <input class="sr-only" type="checkbox" role="switch" {checked} onchange={(e) => onChange((e.target as HTMLInputElement).checked)} />
  <span class="sw" aria-hidden="true"></span>
</label>

<style>
  .sw-row { cursor: pointer; }
  .sw {
    position: relative;
    width: 46px;
    height: 28px;
    flex: none;
    border-radius: 999px;
    background: var(--line);
    transition: background 0.15s;
  }
  .sw::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s;
  }
  input:checked + .sw { background: var(--accent); }
  input:checked + .sw::after { transform: translateX(18px); background: var(--accent-fg); }
  input:focus-visible + .sw { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
