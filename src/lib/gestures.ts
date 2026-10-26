// Touch gestures for the reader. The feed scrolls vertically (the browser
// handles that pan); everything here is what the browser does not do for us:
// a horizontal swipe, a double tap and a long press.

export const SWIPE_MIN_PX = 60;     // shorter horizontal moves are ignored
export const SWIPE_MAX_MS = 700;    // slower moves are a drag, not a swipe
export const TAP_SLOP_PX = 12;      // a finger may wobble this much and still be a tap
export const DOUBLE_TAP_MS = 320;
export const LONG_PRESS_MS = 480;

export type SwipeDir = 'left' | 'right' | null;

/**
 * Classify a finished pointer move. A swipe must be long enough, fast enough
 * and clearly more horizontal than vertical (so a slightly slanted vertical
 * scroll never changes chapter).
 */
export function classifySwipe(dx: number, dy: number, ms: number): SwipeDir {
  if (ms > SWIPE_MAX_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_PX) return null;
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'left' : 'right';
}

export interface SwipeHandlers {
  onSwipe: (dir: 'left' | 'right') => void;
}

/** Svelte action: horizontal swipes on a vertically scrolling element. */
export function swipe(node: HTMLElement, handlers: SwipeHandlers) {
  let start: { x: number; y: number; t: number; id: number } | null = null;

  const down = (e: PointerEvent) => {
    if (!e.isPrimary) {
      start = null;   // a second finger: this is no longer a swipe
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
  };
  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const dir = classifySwipe(e.clientX - start.x, e.clientY - start.y, e.timeStamp - start.t);
    start = null;
    if (dir) handlers.onSwipe(dir);
  };
  const cancel = () => {
    start = null;
  };

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  return {
    update(h: SwipeHandlers) {
      handlers = h;
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
    },
  };
}

export interface TapHandlers {
  onDoubleTap?: (e: PointerEvent) => void;
  onLongPress?: (e: PointerEvent) => void;
}

/**
 * Svelte action: double tap and long press on one element. Taps that land on
 * a button (footnote markers, the menu) are left to the button. A finger that
 * moves more than TAP_SLOP_PX is a scroll, and cancels both gestures.
 */
export function tap(node: HTMLElement, handlers: TapHandlers) {
  let down: { x: number; y: number; id: number } | null = null;
  let lastTap = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let longFired = false;

  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
    down = null;
  };
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary) {
      clear();        // a second finger: neither a tap nor a long press
      lastTap = 0;
      return;
    }
    if ((e.target as HTMLElement).closest('button, a, input, textarea, [role="button"]')) return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    longFired = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!down) return;
      longFired = true;
      lastTap = 0;
      down = null;
      handlers.onLongPress?.(e);
    }, LONG_PRESS_MS);
  };
  const onMove = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    if (Math.abs(e.clientX - down.x) > TAP_SLOP_PX || Math.abs(e.clientY - down.y) > TAP_SLOP_PX) clear();
  };
  const onUp = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) {
      clear();
      return;
    }
    clear();
    if (longFired) return;
    const now = e.timeStamp;
    if (now - lastTap < DOUBLE_TAP_MS) {
      lastTap = 0;
      handlers.onDoubleTap?.(e);
    } else {
      lastTap = now;
    }
  };
  // A long press on a touch screen also opens the browser's context menu or
  // the text-selection callout; the reader has its own menu for that.
  const onContext = (e: Event) => {
    if (handlers.onLongPress) e.preventDefault();
  };

  node.addEventListener('pointerdown', onDown);
  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerup', onUp);
  node.addEventListener('pointercancel', clear);
  node.addEventListener('contextmenu', onContext);
  return {
    update(h: TapHandlers) {
      handlers = h;
    },
    destroy() {
      clear();
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', clear);
      node.removeEventListener('contextmenu', onContext);
    },
  };
}

export const TWO_FINGER_MAX_MS = 450;
export const TWO_FINGER_SLOP_PX = 24;

export interface TwoFingerHandlers {
  onTap: () => void;
}

/**
 * Svelte action: a quick tap with two fingers. Touch events are used because
 * pointer events describe one finger at a time. Fires once both fingers have
 * lifted, if neither moved far; a pinch or a two-finger scroll does nothing.
 */
export function twoFingerTap(node: HTMLElement, handlers: TwoFingerHandlers) {
  let start: { t: number; x: number; y: number } | null = null;

  const centre = (e: TouchEvent) => {
    let x = 0, y = 0;
    for (const t of Array.from(e.touches)) { x += t.clientX; y += t.clientY; }
    return { x: x / e.touches.length, y: y / e.touches.length };
  };
  const onStart = (e: TouchEvent) => {
    if (e.touches.length === 2) start = { t: e.timeStamp, ...centre(e) };
    else if (e.touches.length > 2) start = null;
  };
  const onMove = (e: TouchEvent) => {
    if (!start || e.touches.length !== 2) return;
    const c = centre(e);
    if (Math.abs(c.x - start.x) > TWO_FINGER_SLOP_PX || Math.abs(c.y - start.y) > TWO_FINGER_SLOP_PX) start = null;
  };
  const onEnd = (e: TouchEvent) => {
    if (e.touches.length !== 0) return;
    const s = start;
    start = null;
    if (s && e.timeStamp - s.t <= TWO_FINGER_MAX_MS) handlers.onTap();
  };
  const onCancel = () => {
    start = null;
  };

  node.addEventListener('touchstart', onStart, { passive: true });
  node.addEventListener('touchmove', onMove, { passive: true });
  node.addEventListener('touchend', onEnd);
  node.addEventListener('touchcancel', onCancel);
  return {
    update(h: TwoFingerHandlers) {
      handlers = h;
    },
    destroy() {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onCancel);
    },
  };
}
