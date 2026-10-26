// Words in Scripture must never be split across lines. Tamil words can be very
// long (the longest IRV word is wider than a phone's text column at reading
// size), and letting the browser break them cuts a word inside, leaving a
// letter such as "ள்" alone on the next line.
//
// The verse text therefore never breaks inside a word (CSS), and this action
// shrinks one verse's text, only as much as needed, when its widest word is
// wider than the column. It re-measures when the column width, the font or the
// text size changes.

/** The scale that makes content of width `content` fit in `box`, with a small margin; 1 when it fits. */
export function fitScale(box: number, content: number, min = 0.2): number {
  if (box <= 0 || content <= box + 1) return 1;
  return Math.max(min, Math.floor((box / content) * 0.985 * 1000) / 1000);
}

export function fitWords(node: HTMLElement) {
  let key = '';
  let raf = 0;

  const measure = () => {
    raf = 0;
    const box = node.clientWidth;
    if (!box) return; // not laid out yet (off screen): measured when it appears
    const cs = getComputedStyle(node);
    const scale = getComputedStyle(document.documentElement).getPropertyValue('--font-scale');
    const k = `${box}|${cs.fontFamily}|${scale}|${node.textContent?.length ?? 0}`;
    if (k === key) return;
    key = k;
    // measure at full size, then shrink once; both in one frame, so nothing flickers
    node.style.setProperty('--fit', '1');
    const f = fitScale(box, node.scrollWidth);
    if (f < 1) node.style.setProperty('--fit', String(f));
    else node.style.removeProperty('--fit');
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(measure);
  };

  const ro = new ResizeObserver(schedule);
  ro.observe(node);
  const mo = new MutationObserver(schedule);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-font'] });
  document.fonts?.ready.then(schedule).catch(() => {});
  schedule();

  return {
    destroy() {
      ro.disconnect();
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
