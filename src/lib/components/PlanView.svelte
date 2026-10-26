<script lang="ts">
  import type { BookMeta, Lang, Ref } from '../types';
  import { PLANS, buildPlan, streak, todayIndex, type PlanDay } from '../plan';
  import { formatChapterRef } from '../refs';
  import { PLAN_NAME_KEYS, t } from '../i18n';
  import { app } from '../state.svelte';

  let { books, lang, onNavigate }: { books: BookMeta[]; lang: Lang; onNavigate: (r: Ref) => void } = $props();

  const def = $derived(app.plan ? PLANS.find((p) => p.id === app.plan!.id) ?? null : null);
  const days = $derived<PlanDay[]>(def ? buildPlan(books, def) : []);
  const today = $derived(app.plan ? Math.max(1, todayIndex(app.plan.started)) : 0);
  const doneCount = $derived(app.plan?.done.length ?? 0);
  const behind = $derived(def ? Math.max(0, Math.min(today, def.days) - doneCount) : 0);
  const finished = $derived(!!def && doneCount >= def.days);
  const streakDays = $derived(streak(app.readDates));

  function rangeLabel(d: PlanDay): string {
    return d.ranges
      .map((r) => (r.chFrom === r.chTo ? formatChapterRef(books, r.book, r.chFrom) : `${formatChapterRef(books, r.book, r.chFrom)}–${r.chTo}`))
      .join(' · ');
  }
  function readDay(d: PlanDay) {
    const r = d.ranges[0];
    if (r) onNavigate({ book: r.book, ch: r.chFrom, v: 1 });
  }
  function stop() {
    if (confirm(t(lang, 'stopPlanConfirm'))) app.stopPlan();
  }
  let todayEl: HTMLElement | undefined = $state();
  $effect(() => {
    if (todayEl) todayEl.scrollIntoView({ block: 'center' });
  });
</script>

<div class="view">
  <h2>{t(lang, 'readingPlan')}</h2>

  {#if !app.plan || !def}
    <p class="muted">{t(lang, 'choosePlan')}</p>
    <ul class="plans">
      {#each PLANS as p}
        <li>
          <div>
            <div class="pname">{t(lang, PLAN_NAME_KEYS[p.id])}</div>
            <div class="muted small">{p.days} {t(lang, 'daysCount')}</div>
          </div>
          <button class="btn primary small" onclick={() => app.startPlan(p.id)}>{t(lang, 'startPlan')}</button>
        </li>
      {/each}
    </ul>
    {#if streakDays}
      <p class="muted">{t(lang, 'streak')}: <b>{streakDays}</b></p>
    {/if}
  {:else}
    <div class="summary">
      <div class="pname">{t(lang, PLAN_NAME_KEYS[def.id])}</div>
      <div class="muted small">{t(lang, 'startedOn')}: {app.plan.started}</div>
      <div class="bar"><div class="fill" style="width: {Math.round((doneCount / def.days) * 100)}%"></div></div>
      <div class="stats">
        <span>{t(lang, 'progress')}: <b>{doneCount}/{def.days}</b></span>
        <span>{t(lang, 'streak')}: <b>{streakDays}</b></span>
        {#if behind > 0}<span class="warn">{t(lang, 'behind')}: <b>{behind}</b></span>{/if}
      </div>
      {#if finished}<p class="done-msg">{t(lang, 'planFinished')}</p>{/if}
    </div>

    <ol class="days">
      {#each days as d}
        {@const isDone = app.plan.done.includes(d.day)}
        {@const isToday = d.day === Math.min(today, def.days)}
        <li class:done={isDone} class:today={isToday}>
          {#if isToday}<div bind:this={todayEl}></div>{/if}
          <div class="dhead">
            <span class="dnum">{t(lang, 'day')} {d.day}{#if isToday} · {t(lang, 'today')}{/if}</span>
            {#if isDone}<span class="tick">✓ {t(lang, 'done')}</span>{/if}
          </div>
          <div class="range">{rangeLabel(d)}</div>
          <div class="dbtns">
            <button class="btn small" onclick={() => readDay(d)}>{t(lang, 'read')}</button>
            <button class="btn small ghost" onclick={() => app.togglePlanDay(d.day)}>{isDone ? t(lang, 'undo') : t(lang, 'markDone')}</button>
          </div>
        </li>
      {/each}
    </ol>

    <button class="btn ghost stop" onclick={stop}>{t(lang, 'stopPlan')}</button>
  {/if}
</div>

<style>
  .plans { list-style: none; padding: 0; margin: 12px 0; }
  .plans li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
  .pname { font-weight: 700; }
  .summary { margin: 8px 0 16px; }
  .bar { height: 8px; border-radius: 4px; background: var(--accent-soft); margin: 10px 0 6px; overflow: hidden; }
  .fill { height: 100%; background: var(--accent); transition: width 0.3s; }
  .stats { display: flex; flex-wrap: wrap; gap: 12px; font-size: 14px; color: var(--fg-muted); }
  .warn { color: var(--wj); }
  .done-msg { color: var(--accent); font-weight: 700; }
  .days { list-style: none; padding: 0; margin: 0; }
  .days li { padding: 10px 0; border-bottom: 1px solid var(--line); }
  .days li.today { background: var(--accent-soft); margin: 0 -16px; padding: 10px 16px; border-radius: 12px; border-bottom: 0; }
  .days li.done .range { color: var(--fg-muted); text-decoration: line-through; }
  .dhead { display: flex; justify-content: space-between; font-size: 14px; color: var(--fg-muted); }
  .dnum { font-weight: 700; }
  .tick { color: var(--accent); font-weight: 700; }
  .range { margin: 4px 0 8px; font-size: calc(16px * var(--font-scale)); }
  .dbtns { display: flex; gap: 8px; }
  .stop { margin-top: 20px; width: 100%; }
</style>
