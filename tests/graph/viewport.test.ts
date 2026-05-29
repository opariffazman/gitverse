import { describe, it, expect } from 'vitest';
import { clampZoom, zoomAt, panBy, fitTransform, followHeadPan, MIN_K, MAX_K } from '$graph/viewport';

describe('viewport helpers', () => {
  it('clamps zoom into [MIN_K, MAX_K]', () => {
    expect(clampZoom(MAX_K + 5)).toBe(MAX_K);
    expect(clampZoom(MIN_K - 5)).toBe(MIN_K);
    expect(clampZoom(1)).toBe(1);
  });

  it('zoomAt keeps the focus point stationary', () => {
    const start = { panX: 0, panY: 0, k: 1 };
    const next = zoomAt(start, 2, 100, 100);
    const before = { x: (100 - start.panX) / start.k, y: (100 - start.panY) / start.k };
    const after = { x: (100 - next.panX) / next.k, y: (100 - next.panY) / next.k };
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
    expect(next.k).toBeCloseTo(2, 5);
  });

  it('fitTransform centers content within the viewport with zoom <= 1', () => {
    const t = fitTransform(400, 200, 800, 600, 40);
    expect(t.k).toBeLessThanOrEqual(1);
    expect(t.k).toBeGreaterThan(0);
    const cx = t.panX + (400 / 2) * t.k;
    const cy = t.panY + (200 / 2) * t.k;
    expect(cx).toBeCloseTo(400, 0);
    expect(cy).toBeCloseTo(300, 0);
  });

  it('panBy translates without changing zoom', () => {
    const t = panBy({ panX: 10, panY: 20, k: 1.5 }, 5, -5);
    expect(t).toEqual({ panX: 15, panY: 15, k: 1.5 });
  });

  it('followHeadPan centers the given node, preserving zoom', () => {
    const t = followHeadPan({ panX: 0, panY: 0, k: 2 }, 300, 150, 800, 600);
    expect(t.k).toBe(2);
    expect(t.panX + 300 * t.k).toBeCloseTo(400, 5);
    expect(t.panY + 150 * t.k).toBeCloseTo(300, 5);
  });
});
