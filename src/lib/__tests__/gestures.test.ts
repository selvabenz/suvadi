import { describe, expect, it } from 'vitest';
import { classifySwipe, SWIPE_MAX_MS, SWIPE_MIN_PX } from '../gestures';

describe('classifySwipe', () => {
  it('reads a quick horizontal move as a swipe', () => {
    expect(classifySwipe(-120, 8, 200)).toBe('left');
    expect(classifySwipe(120, -8, 200)).toBe('right');
  });

  it('ignores short moves', () => {
    expect(classifySwipe(SWIPE_MIN_PX - 1, 0, 100)).toBeNull();
    expect(classifySwipe(SWIPE_MIN_PX, 0, 100)).toBe('right');
  });

  it('ignores slow drags', () => {
    expect(classifySwipe(200, 0, SWIPE_MAX_MS + 1)).toBeNull();
  });

  it('ignores a slanted vertical scroll', () => {
    expect(classifySwipe(80, 90, 200)).toBeNull();
    expect(classifySwipe(-90, -40, 200)).toBe('left');
  });
});
