export const CONFIG = {
  mapW: 21,
  mapH: 21,
  cell: 4.2,
  wallH: 3.2,
  walkSpeed: 3.95,
  sprintSpeed: 6.35,
  playerRadius: 0.42,
  eyeHeight: 1.66,
  soulsNeeded: 5,
  grace: 3.8,
  sensitivity: 0.0023,
  touchSensitivity: 0.0042,
};

export const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
