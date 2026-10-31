export const TAU = Math.PI * 2;

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Rounded rectangle path (independent of Canvas roundRect support). */
export function rr(ctx, x, y, w, h, r = 6) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function heartPath(ctx, x, y, size) {
  const s = size / 16;
  ctx.beginPath();
  ctx.moveTo(x, y + 4 * s);
  ctx.bezierCurveTo(x, y + 1 * s, x - 3 * s, y - 2 * s, x - 7 * s, y - 2 * s);
  ctx.bezierCurveTo(x - 13 * s, y - 2 * s, x - 13 * s, y + 5 * s, x - 13 * s, y + 5 * s);
  ctx.bezierCurveTo(x - 13 * s, y + 9 * s, x - 9 * s, y + 13 * s, x, y + 17 * s);
  ctx.bezierCurveTo(x + 9 * s, y + 13 * s, x + 13 * s, y + 9 * s, x + 13 * s, y + 5 * s);
  ctx.bezierCurveTo(x + 13 * s, y + 5 * s, x + 13 * s, y - 2 * s, x + 7 * s, y - 2 * s);
  ctx.bezierCurveTo(x + 3 * s, y - 2 * s, x, y + 1 * s, x, y + 4 * s);
  ctx.closePath();
}

export function sparklePath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
  ctx.closePath();
}

/** Smoothly approach a target value. */
export function approach(current, target, rate, dt) {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
