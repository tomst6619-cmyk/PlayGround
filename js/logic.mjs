/**
 * Pure game rules and entity factories.
 * No DOM access here so the rules can be tested with plain Node.
 */

export const CONFIG = Object.freeze({
  startSignal: 100,
  maxSignal: 100,
  captureSignal: 4,
  escapeSignal: 16,
  falseAlarmSignal: 12,
  startBattery: 100,
  batteryDrain: 15,
  batteryRegen: 10,
  batteryCaptureBonus: 26,
  batteryFalseAlarmCost: 14,
  comboWindow: 9,
  maxCombo: 9,
  waveSeconds: 30,
  identifyAfter: 0.55,
  falseAlarmAfter: 1,
  clockStartMinutes: 23 * 60 + 47,
});

export const UFO_TYPES = Object.freeze({
  saucer: {
    kind: 'saucer',
    name: 'Scheibe',
    code: 'TYP II',
    color: '#74efff',
    points: 120,
    captureTime: 2.15,
    lockRadius: 86,
    size: 70,
    weight: 46,
    minWave: 1,
  },
  triangle: {
    kind: 'triangle',
    name: 'Dreieck',
    code: 'TYP III',
    color: '#ff9de2',
    points: 170,
    captureTime: 2.5,
    lockRadius: 92,
    size: 88,
    weight: 30,
    minWave: 1,
  },
  orb: {
    kind: 'orb',
    name: 'Sonde',
    code: 'TYP 0',
    color: '#ffd27a',
    points: 210,
    captureTime: 2.7,
    lockRadius: 68,
    size: 44,
    weight: 16,
    minWave: 1,
  },
  mothership: {
    kind: 'mothership',
    name: 'Mutterschiff',
    code: 'TYP X',
    color: '#b389ff',
    points: 600,
    captureTime: 4.4,
    lockRadius: 128,
    size: 168,
    weight: 8,
    minWave: 3,
  },
});

export const DECOY_TYPES = Object.freeze({
  plane: { kind: 'plane', name: 'Flugzeug', color: '#ffc36b', lockRadius: 70, size: 50 },
  satellite: { kind: 'satellite', name: 'Satellit', color: '#b9d7ff', lockRadius: 54, size: 14 },
  meteor: { kind: 'meteor', name: 'Meteor', color: '#fff1cf', lockRadius: 64, size: 58 },
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function pad2(value) {
  return String(Math.floor(Math.abs(value))).padStart(2, '0');
}

export function formatScore(value) {
  return String(Math.max(0, Math.round(value))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatClock(elapsedSeconds) {
  const total = CONFIG.clockStartMinutes + Math.floor(Math.max(0, elapsedSeconds) / 60);
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

export function formatRecord(elapsedSeconds) {
  const seconds = Math.max(0, Math.floor(elapsedSeconds));
  return `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted(items, random) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function pickUfoKind(wave, random) {
  const available = Object.values(UFO_TYPES).filter((type) => type.minWave <= wave);
  return pickWeighted(available, random).kind;
}

export function waveForElapsed(seconds) {
  return 1 + Math.floor(Math.max(0, seconds) / CONFIG.waveSeconds);
}

export function maxUfosForWave(wave) {
  return clamp(1 + Math.floor(wave / 2), 1, 4);
}

export function nextUfoDelay(wave, random) {
  const base = Math.max(2.6, 5.4 - (wave - 1) * 0.35);
  return base * (0.78 + random() * 0.5);
}

export function nextDecoyDelay(wave, random) {
  const base = Math.max(2.2, 5.8 - (wave - 1) * 0.3);
  return base * (0.7 + random() * 0.75);
}

export function accuracyFactor(aimDistance, lockRadius) {
  if (!(lockRadius > 0)) return 0;
  return clamp(1 - (aimDistance / lockRadius) * 0.65, 0.24, 1);
}

export function exposureDelta(deltaTime, aimDistance, lockRadius, captureTime, battery) {
  if (battery <= 0 || deltaTime <= 0 || captureTime <= 0) return 0;
  return (deltaTime / captureTime) * accuracyFactor(aimDistance, lockRadius);
}

export function batteryDelta(deltaTime, battery, filming) {
  if (deltaTime <= 0) return battery;
  if (filming) return clamp(battery - CONFIG.batteryDrain * deltaTime, 0, 100);
  return clamp(battery + CONFIG.batteryRegen * deltaTime, 0, 100);
}

export function precisionFor(avgError, lockRadius) {
  const ratio = avgError / Math.max(1, lockRadius);
  if (ratio <= 0.3) return 1.5;
  if (ratio <= 0.5) return 1.25;
  return 1;
}

export function scoreCapture(basePoints, combo, precision) {
  return Math.round(basePoints * Math.max(1, combo) * precision);
}

export function nextSignal(signal, delta) {
  return clamp(signal + delta, 0, CONFIG.maxSignal);
}

function scaleFor(width) {
  return clamp(width / 1000, 0.72, 1);
}

export function makeUfo(kind, width, height, random, options = {}) {
  const config = UFO_TYPES[kind] || UFO_TYPES.saucer;
  const scale = scaleFor(width);
  const size = config.size * scale;
  const margin = size * 0.85 + 24;
  const minY = Math.max(height * 0.2, 118);
  const maxY = Math.max(minY + 40, height * 0.6);
  const anchorX = clamp(
    options.x ?? (width * (0.3 + random() * 0.4)),
    margin,
    Math.max(margin, width - margin),
  );
  const anchorY = clamp(
    options.y ?? (minY + random() * Math.max(20, maxY - minY)),
    minY,
    maxY,
  );

  return {
    family: 'ufo',
    ...config,
    size,
    scale,
    lock: config.lockRadius * clamp(scale + 0.08, 0.8, 1.05),
    anchorX,
    anchorY,
    x: anchorX,
    y: anchorY,
    driftX: (random() < 0.5 ? -1 : 1) * (5 + random() * 12),
    driftY: (random() < 0.5 ? -1 : 1) * (3 + random() * 7),
    ampX: (10 + random() * 24) * scale,
    ampY: (6 + random() * 13) * scale,
    freqX: 0.45 + random() * 0.65,
    freqY: 0.38 + random() * 0.52,
    phase: random() * Math.PI * 2,
    age: 0,
    ttl: 22 + random() * 7,
    exposure: 0,
    errorSum: 0,
    samples: 0,
    warpCooldown: 1.8 + random(),
    spawnFade: 0,
    alpha: 0,
    beam: random() < 0.55,
    beamPhase: random() * Math.PI * 2,
    wobble: random() * 0.3,
    dead: false,
  };
}

export function makeDecoy(kind, width, height, random) {
  const config = DECOY_TYPES[kind] || DECOY_TYPES.plane;
  const direction = random() < 0.5 ? -1 : 1;

  if (kind === 'meteor') {
    const speed = 620 + random() * 380;
    const angle = (0.42 + random() * 0.36) * Math.PI;
    const dirX = random() < 0.5 ? -1 : 1;
    return {
      family: 'decoy',
      ...config,
      lock: config.lockRadius,
      x: width * (0.15 + random() * 0.7),
      y: height * (0.1 + random() * 0.24),
      vx: Math.cos(angle) * speed * dirX,
      vy: Math.sin(angle) * speed,
      angle: Math.atan2(Math.sin(angle), Math.cos(angle) * dirX),
      age: 0,
      ttl: 1.5,
      alpha: 0,
      spawnFade: 0,
      exposure: 0,
      classification: 0,
      falseTimer: 0,
      dead: false,
      trail: [],
    };
  }

  if (kind === 'satellite') {
    const speed = (145 + random() * 80) * direction;
    return {
      family: 'decoy',
      ...config,
      lock: config.lockRadius,
      x: direction < 0 ? width + 80 : -80,
      y: height * (0.12 + random() * 0.36),
      vx: speed,
      vy: (random() - 0.5) * 16,
      age: 0,
      ttl: (width + 240) / Math.abs(speed),
      alpha: 0,
      spawnFade: 0,
      exposure: 0,
      classification: 0,
      falseTimer: 0,
      dead: false,
      blink: random() * Math.PI * 2,
    };
  }

  const speed = (42 + random() * 30) * direction;
  return {
    family: 'decoy',
    ...config,
    lock: config.lockRadius,
    x: direction < 0 ? width + 100 : -100,
    y: height * (0.18 + random() * 0.34),
    vx: speed,
    vy: (random() - 0.5) * 7,
    age: 0,
    ttl: (width + 300) / Math.abs(speed),
    alpha: 0,
    spawnFade: 0,
    exposure: 0,
    classification: 0,
    falseTimer: 0,
    dead: false,
    blink: random() * 8,
  };
}

export function pickDecoyKind(random) {
  return pickWeighted(
    [
      { kind: 'plane', weight: 48 },
      { kind: 'satellite', weight: 34 },
      { kind: 'meteor', weight: 18 },
    ],
    random,
  ).kind;
}
