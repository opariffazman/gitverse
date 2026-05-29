// Pure pan/zoom transform math for the commit graph. No DOM access — unit-tested.

export type Transform = { panX: number; panY: number; k: number };

export const MIN_K = 0.2;
export const MAX_K = 2.5;

export function clampZoom(k: number): number {
  return Math.min(MAX_K, Math.max(MIN_K, k));
}

/** Zoom by `factor` about screen point (cx, cy), keeping the content point under it stationary. */
export function zoomAt(t: Transform, factor: number, cx: number, cy: number): Transform {
  const k = clampZoom(t.k * factor);
  const ratio = k / t.k;
  return { k, panX: cx - (cx - t.panX) * ratio, panY: cy - (cy - t.panY) * ratio };
}

export function panBy(t: Transform, dx: number, dy: number): Transform {
  return { ...t, panX: t.panX + dx, panY: t.panY + dy };
}

/** Fit content (contentW × contentH) into the viewport with padding; zoom capped at 1. */
export function fitTransform(
  contentW: number,
  contentH: number,
  viewW: number,
  viewH: number,
  padding: number,
): Transform {
  if (contentW <= 0 || contentH <= 0) return { panX: 0, panY: 0, k: 1 };
  const kx = (viewW - padding * 2) / contentW;
  const ky = (viewH - padding * 2) / contentH;
  const k = clampZoom(Math.min(kx, ky, 1));
  return { k, panX: (viewW - contentW * k) / 2, panY: (viewH - contentH * k) / 2 };
}

/** Pan (keeping zoom) so content point (nodeX, nodeY) sits at the viewport center. */
export function followHeadPan(
  t: Transform,
  nodeX: number,
  nodeY: number,
  viewW: number,
  viewH: number,
): Transform {
  return { k: t.k, panX: viewW / 2 - nodeX * t.k, panY: viewH / 2 - nodeY * t.k };
}
