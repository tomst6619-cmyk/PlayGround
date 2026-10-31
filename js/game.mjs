import {
  CONFIG,
  UFO_TYPES,
  clamp,
  distance,
  exposureDelta,
  batteryDelta,
  formatClock,
  formatRecord,
  formatScore,
  makeDecoy,
  makeUfo,
  maxUfosForWave,
  nextDecoyDelay,
  nextSignal,
  nextUfoDelay,
  pad2,
  pickDecoyKind,
  pickUfoKind,
  precisionFor,
  scoreCapture,
  waveForElapsed,
} from './logic.mjs';
import { SkyRenderer } from './sky.mjs';
import { AudioEngine } from './audio.mjs';

const BEST_KEY = 'ufos-schauen-best-v1';
const MUTED_KEY = 'ufos-schauen-muted-v1';
const TAU = Math.PI * 2;

const app = document.getElementById('app');
const canvas = document.getElementById('sky');
const renderer = new SkyRenderer(canvas);
const audio = new AudioEngine();

const dom = {
  score: document.getElementById('score-value'),
  combo: document.getElementById('combo-value'),
  signalValue: document.getElementById('signal-value'),
  signalFill: document.getElementById('signal-fill'),
  signalBar: document.getElementById('signal-bar'),
  wave: document.getElementById('wave-label'),
  clock: document.getElementById('clock'),
  filmFill: document.getElementById('film-fill'),
  filmBar: document.getElementById('film-bar'),
  filmPercent: document.getElementById('film-percent'),
  logbookCount: document.getElementById('logbook-count'),
  logbookTypes: document.getElementById('logbook-types'),
  hint: document.getElementById('hint'),
  recFrame: document.getElementById('rec-frame'),
  recTime: document.getElementById('rec-time'),
  transmission: document.getElementById('transmission'),
  transmissionText: document.getElementById('transmission-text'),
  toast: document.getElementById('toast'),
  toastKicker: document.getElementById('toast-kicker'),
  toastMain: document.getElementById('toast-main'),
  toastSub: document.getElementById('toast-sub'),
  flash: document.getElementById('screen-flash'),
  menu: document.getElementById('overlay-menu'),
  pause: document.getElementById('overlay-pause'),
  over: document.getElementById('overlay-over'),
  best: document.getElementById('best-score'),
  finalScore: document.getElementById('final-score'),
  finalCaptures: document.getElementById('final-captures'),
  finalFalse: document.getElementById('final-false'),
  finalEscaped: document.getElementById('final-escaped'),
  finalCombo: document.getElementById('final-combo'),
  newBest: document.getElementById('new-best'),
  logbookSummary: document.getElementById('logbook-summary'),
  overCopy: document.getElementById('over-copy'),
  overEyebrow: document.getElementById('over-eyebrow'),
  btnMute: document.getElementById('btn-mute'),
  btnPause: document.getElementById('btn-pause'),
  btnStart: document.getElementById('btn-start'),
  btnResume: document.getElementById('btn-resume'),
  btnRestart: document.getElementById('btn-restart'),
  btnAgain: document.getElementById('btn-again'),
  btnMenu: document.getElementById('btn-menu'),
};

const state = {
  mode: 'menu',
  now: performance.now(),
  elapsed: 0,
  wave: 1,
  signal: CONFIG.startSignal,
  score: 0,
  combo: 1,
  comboTimer: 0,
  battery: CONFIG.startBattery,
  aim: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.48 },
  target: null,
  entities: [],
  demoEntities: [],
  particles: [],
  effects: [],
  pointerDown: false,
  keyFilm: false,
  filming: false,
  wasFilming: false,
  nextUfoIn: 0.8,
  nextDecoyIn: 4,
  stats: { captured: 0, falseAlarms: 0, escaped: 0, bestCombo: 1, log: {} },
  best: readNumber(BEST_KEY),
  radio: {},
  hintTimer: null,
  toastTimer: null,
  transmissionTimer: null,
  flashTimer: null,
  comboPopTimer: null,
  gameOverTimer: null,
  lastHud: -1,
  cricketIn: 2.5,
  started: false,
  intro: false,
};

function readNumber(key) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function random() {
  return Math.random();
}

function updateAim(x, y) {
  const marginX = 24;
  state.aim.x = clamp(x, marginX, renderer.w - marginX);
  state.aim.y = clamp(y, renderer.h * 0.16, renderer.h * 0.8);
}

function azimuth() {
  return ((state.aim.x / Math.max(1, renderer.w)) * 360 + 180) % 360;
}

function elevation() {
  return clamp((1 - state.aim.y / Math.max(1, renderer.h)) * 90, 0, 90);
}

function setAimCenter() {
  updateAim(renderer.w * 0.5, renderer.h * 0.47);
}

/* ------------------------------------------------------------------ HUD */

function updateHud(force = false) {
  if (!force && state.elapsed - state.lastHud < 0.08) return;
  state.lastHud = state.elapsed;

  dom.score.textContent = formatScore(state.score);
  dom.combo.textContent = `SERIE ×${state.combo}`;
  dom.combo.classList.toggle('is-hot', state.combo > 1);

  const signal = Math.round(state.signal);
  dom.signalValue.textContent = String(signal);
  dom.signalFill.style.width = `${signal}%`;
  dom.signalBar.classList.toggle('is-low', signal <= 30);
  dom.signalBar.setAttribute('aria-valuenow', String(signal));

  const battery = Math.round(state.battery);
  dom.filmFill.style.width = `${battery}%`;
  dom.filmPercent.textContent = `${battery}%`;
  dom.filmBar.classList.toggle('is-low', battery <= 30);
  dom.filmBar.classList.toggle('is-empty', battery < 1);
  dom.filmBar.setAttribute('aria-valuenow', String(battery));

  dom.wave.textContent = `WELLE ${pad2(state.wave)}`;
  dom.clock.textContent = formatClock(state.elapsed);

  const log = state.stats.log;
  const counts = ['saucer', 'triangle', 'orb', 'mothership'].map((kind) => log[kind] || 0);
  const total = counts.reduce((sum, count) => sum + count, 0);
  dom.logbookCount.textContent = pad2(total);
  dom.logbookTypes.textContent = counts[3] > 0
    ? `S ${counts[0]} · D ${counts[1]} · O ${counts[2]} · M ${counts[3]}`
    : `S ${counts[0]} · D ${counts[1]} · O ${counts[2]}`;

  dom.recTime.textContent = formatRecord(state.elapsed);
  dom.recFrame.classList.toggle('is-visible', state.filming);
}

function popCombo() {
  dom.combo.classList.remove('is-pop');
  void dom.combo.offsetWidth;
  dom.combo.classList.add('is-pop');
  clearTimeout(state.comboPopTimer);
  state.comboPopTimer = setTimeout(() => dom.combo.classList.remove('is-pop'), 280);
}

function showToast(kicker, main, sub, tone = '') {
  dom.toastKicker.textContent = kicker;
  dom.toastMain.textContent = main;
  dom.toastSub.textContent = sub;
  dom.toast.classList.remove('is-danger', 'is-warn');
  if (tone) dom.toast.classList.add(tone);
  dom.toast.classList.add('is-visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => dom.toast.classList.remove('is-visible'), 1900);
}

function flash(tone) {
  dom.flash.classList.remove('is-danger', 'is-warn', 'is-good');
  void dom.flash.offsetWidth;
  dom.flash.classList.add(tone);
  clearTimeout(state.flashTimer);
  state.flashTimer = setTimeout(() => {
    dom.flash.classList.remove('is-danger', 'is-warn', 'is-good');
  }, 700);
}

function transmit(text, force = false) {
  if (!force && state.mode !== 'playing') return;
  dom.transmissionText.textContent = text;
  dom.transmission.classList.add('is-visible');
  clearTimeout(state.transmissionTimer);
  state.transmissionTimer = setTimeout(() => {
    dom.transmission.classList.remove('is-visible');
  }, 5600);
  audio.radio();
}

function showHint() {
  dom.hint.classList.add('is-visible');
  clearTimeout(state.hintTimer);
  state.hintTimer = setTimeout(() => dom.hint.classList.remove('is-visible'), 11000);
}

function hideHint() {
  dom.hint.classList.remove('is-visible');
  clearTimeout(state.hintTimer);
}

/* -------------------------------------------------------------- Overlays */

function setOverlay(overlay, open) {
  overlay.classList.toggle('is-open', open);
  overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function closeOverlays() {
  for (const overlay of [dom.menu, dom.pause, dom.over]) setOverlay(overlay, false);
}

function syncAppClass() {
  app.classList.toggle('is-menu', state.mode === 'menu');
  app.classList.toggle('is-playing', state.mode === 'playing');
  app.classList.toggle('is-paused', state.mode === 'paused');
  app.classList.toggle('is-over', state.mode === 'over');
  document.getElementById('hud').setAttribute('aria-hidden', state.mode === 'menu' ? 'true' : 'false');
  document.getElementById('film-panel').setAttribute('aria-hidden', state.mode === 'menu' ? 'true' : 'false');
  document.getElementById('utility').setAttribute('aria-hidden', state.mode === 'menu' ? 'true' : 'false');
}

function setupMenuScene() {
  const rng = () => random();
  const saucer = makeUfo('saucer', renderer.w, renderer.h, rng, {
    x: renderer.w * 0.82,
    y: renderer.h * 0.37,
  });
  saucer.ttl = Infinity;
  saucer.alpha = 1;
  saucer.beam = true;
  saucer.age = 2.4;

  const orb = makeUfo('orb', renderer.w, renderer.h, rng, {
    x: renderer.w * 0.18,
    y: renderer.h * 0.3,
  });
  orb.ttl = Infinity;
  orb.alpha = 0.62;
  orb.age = 5.2;

  state.demoEntities = [saucer, orb];
}

function startGame() {
  clearTimeout(state.gameOverTimer);
  closeOverlays();
  state.mode = 'playing';
  state.started = true;
  state.elapsed = 0;
  state.wave = 1;
  state.signal = CONFIG.startSignal;
  state.score = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.battery = CONFIG.startBattery;
  state.entities = [];
  state.particles = [];
  state.effects = [];
  state.target = null;
  state.pointerDown = false;
  state.keyFilm = false;
  state.filming = false;
  state.wasFilming = false;
  state.nextUfoIn = 0.35;
  state.nextDecoyIn = 4.2;
  state.stats = { captured: 0, falseAlarms: 0, escaped: 0, bestCombo: 1, log: {} };
  state.radio = {};
  state.lastHud = -1;
  state.cricketIn = 2.5;
  state.intro = false;
  state.gameOverTimer = null;
  setAimCenter();
  syncAppClass();
  updateHud(true);
  showHint();
  audio.unlock().then(() => audio.startAmbient()).catch(() => {});
  audio.setFilming(false);
  audio.ui();
  setTimeout(() => {
    if (state.mode === 'playing' && !state.intro) {
      state.intro = true;
      transmit('Sternwarte Hochwald, wir haben Sie. Halten Sie die Linse ruhig.');
    }
  }, 2400);
}

function endGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'over';
  state.filming = false;
  state.pointerDown = false;
  state.keyFilm = false;
  state.target = null;
  audio.setFilming(false);
  hideHint();
  dom.transmission.classList.remove('is-visible');
  syncAppClass();

  const isBest = state.score > state.best;
  if (isBest) {
    state.best = state.score;
    try { localStorage.setItem(BEST_KEY, String(state.best)); } catch {}
  }

  dom.best.textContent = formatScore(state.best);
  dom.finalScore.textContent = formatScore(state.score);
  dom.finalCaptures.textContent = String(state.stats.captured);
  dom.finalFalse.textContent = String(state.stats.falseAlarms);
  dom.finalEscaped.textContent = String(state.stats.escaped);
  dom.finalCombo.textContent = `×${state.stats.bestCombo}`;
  dom.newBest.hidden = !isBest;
  dom.overCopy.textContent = state.stats.captured > 0
    ? 'Die Verbindung ist abgebrochen. Immerhin: Ein paar Lichter haben jetzt Namen.'
    : 'Die Verbindung ist abgebrochen. Der Himmel behält seine Geheimnisse.';
  dom.overEyebrow.textContent = isBest ? 'Neue Bestleistung' : 'Nachtwache beendet';

  dom.logbookSummary.replaceChildren();
  const entries = Object.values(UFO_TYPES)
    .map((type) => ({ type, count: state.stats.log[type.kind] || 0 }))
    .filter((entry) => entry.count > 0);
  if (entries.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'log-pill';
    empty.textContent = 'Keine Kontakte bestätigt';
    dom.logbookSummary.append(empty);
  } else {
    for (const { type, count } of entries) {
      const pill = document.createElement('span');
      pill.className = 'log-pill';
      const name = document.createElement('span');
      name.textContent = `${type.name} ${type.code}`;
      const value = document.createElement('b');
      value.textContent = `×${count}`;
      pill.append(name, value);
      dom.logbookSummary.append(pill);
    }
  }

  setOverlay(dom.over, true);
  audio.gameOver();
  if (isBest) setTimeout(() => audio.newBest(), 550);
  setTimeout(() => dom.btnAgain.focus({ preventScroll: true }), 120);
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  state.pointerDown = false;
  state.keyFilm = false;
  state.filming = false;
  audio.setFilming(false);
  syncAppClass();
  setOverlay(dom.pause, true);
  dom.btnResume.focus({ preventScroll: true });
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  syncAppClass();
  setOverlay(dom.pause, false);
  audio.unlock().catch(() => {});
  audio.ui();
}

function backToMenu() {
  state.mode = 'menu';
  state.pointerDown = false;
  state.keyFilm = false;
  state.filming = false;
  state.target = null;
  state.entities = [];
  state.particles = [];
  state.effects = [];
  audio.setFilming(false);
  closeOverlays();
  setupMenuScene();
  syncAppClass();
  updateHud(true);
  dom.best.textContent = formatScore(state.best);
  setOverlay(dom.menu, true);
  audio.ui();
  setTimeout(() => dom.btnStart.focus({ preventScroll: true }), 120);
}

/* ------------------------------------------------------------- Menu demo */

function updateDemo(dt) {
  for (const entity of state.demoEntities) {
    entity.age += dt;
    entity.alpha = Math.min(1, entity.alpha + dt * 2);
    entity.anchorX += entity.driftX * dt * 0.6;
    entity.anchorY += entity.driftY * dt * 0.45;
    const margin = entity.size + 40;
    if (entity.anchorX < margin || entity.anchorX > renderer.w - margin) entity.driftX *= -1;
    if (entity.anchorY < renderer.h * 0.2 || entity.anchorY > renderer.h * 0.6) entity.driftY *= -1;
    entity.anchorX = clamp(entity.anchorX, margin, renderer.w - margin);
    entity.anchorY = clamp(entity.anchorY, renderer.h * 0.2, renderer.h * 0.6);
    entity.x = entity.anchorX + Math.sin(entity.age * entity.freqX + entity.phase) * entity.ampX;
    entity.y = entity.anchorY + Math.cos(entity.age * entity.freqY + entity.phase * 1.7) * entity.ampY;
  }
  updateParticles(dt);
}

/* ---------------------------------------------------------------- Spawning */

function spawnUfo() {
  let kind = pickUfoKind(state.wave, random);
  const options = {};
  if (state.elapsed < 2.5 && state.stats.captured === 0 && state.stats.escaped === 0) {
    kind = 'saucer';
    options.x = renderer.w * 0.62;
    options.y = renderer.h * 0.36;
  }
  const entity = makeUfo(kind, renderer.w, renderer.h, random, options);
  entity.exposure = 0;
  entity.errorSum = 0;
  entity.samples = 0;
  state.entities.push(entity);
  state.nextUfoIn = nextUfoDelay(state.wave, random);
  if (kind === 'mothership' && !state.radio.mothership) {
    state.radio.mothership = true;
    transmit('Großes Objekt im Anflug. Das ist kein Wetterballon.');
  }
}

function spawnDecoy() {
  const kind = pickDecoyKind(random);
  const entity = makeDecoy(kind, renderer.w, renderer.h, random);
  state.entities.push(entity);
  state.nextDecoyIn = nextDecoyDelay(state.wave, random);
}

function activeCount(family) {
  let count = 0;
  for (const entity of state.entities) {
    if (!entity.dead && entity.family === family) count += 1;
  }
  return count;
}

function updateSpawning(dt) {
  state.nextUfoIn -= dt;
  state.nextDecoyIn -= dt;

  if (state.nextUfoIn <= 0) {
    if (activeCount('ufo') < maxUfosForWave(state.wave)) spawnUfo();
    else state.nextUfoIn = 0.7;
  }

  if (state.nextDecoyIn <= 0) {
    if (activeCount('decoy') < 3) spawnDecoy();
    else state.nextDecoyIn = 0.9;
  }
}

/* -------------------------------------------------------------- Entities */

function spawnParticles(x, y, color, count, speed = 1) {
  for (let i = 0; i < count; i += 1) {
    const angle = random() * TAU;
    const velocity = (25 + random() * 120) * speed;
    const size = 0.7 + random() * 2.2;
    state.particles.push({
      type: 'spark',
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      size,
      life: 0.45 + random() * 0.75,
      maxLife: 1.2,
      color,
      alpha: 0.85,
    });
  }
}

function spawnRing(x, y, color, radius = 30) {
  state.effects.push({
    x,
    y,
    radius,
    life: 0.7,
    maxLife: 0.7,
    color,
  });
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - dt * 0.9;
    particle.vy = particle.vy * (1 - dt * 0.9) - 4 * dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  for (const effect of state.effects) effect.life -= dt;
  state.effects = state.effects.filter((effect) => effect.life > 0);
}

function updateEntity(entity, dt) {
  entity.age += dt;
  entity.alpha = Math.min(1, entity.alpha + dt * 2.8);

  if (entity.family === 'ufo') {
    const isTarget = entity === state.target && state.filming;
    if (isTarget) {
      const dx = entity.x - state.aim.x;
      const dy = entity.y - state.aim.y;
      const d = Math.hypot(dx, dy) || 1;
      const urgency = 0.45 + entity.exposure * 1.45;
      entity.anchorX += (dx / d) * 16 * urgency * dt;
      entity.anchorY += (dy / d) * 9 * urgency * dt;
    }

    entity.anchorX += entity.driftX * dt;
    entity.anchorY += entity.driftY * dt;

    const marginX = entity.size * 0.7 + 36;
    const minY = Math.max(renderer.h * 0.2, 118);
    const maxY = renderer.h * 0.61;
    if (entity.anchorX < marginX) {
      entity.anchorX = marginX;
      entity.driftX = Math.abs(entity.driftX);
    } else if (entity.anchorX > renderer.w - marginX) {
      entity.anchorX = renderer.w - marginX;
      entity.driftX = -Math.abs(entity.driftX);
    }
    if (entity.anchorY < minY) {
      entity.anchorY = minY;
      entity.driftY = Math.abs(entity.driftY);
    } else if (entity.anchorY > maxY) {
      entity.anchorY = maxY;
      entity.driftY = -Math.abs(entity.driftY);
    }

    entity.warpCooldown -= dt;
    if (
      isTarget
      && entity.exposure > 0.22
      && entity.warpCooldown <= 0
      && (entity.kind === 'orb' || entity.kind === 'triangle')
    ) {
      entity.anchorX = clamp(
        entity.x + (random() - 0.5) * 190,
        marginX,
        renderer.w - marginX,
      );
      entity.anchorY = clamp(
        entity.y + (random() - 0.5) * 120,
        minY,
        maxY,
      );
      entity.warpCooldown = 1.9 + random() * 1.5;
      spawnRing(entity.x, entity.y, 'rgba(255, 194, 109, 0.8)', entity.size * 0.6);
      spawnParticles(entity.x, entity.y, 'rgba(255, 220, 168, 0.9)', 10, 0.7);
      audio.tone({ frequency: 880, type: 'sine', duration: 0.22, gain: 0.035, slideTo: 320 });
    }

    entity.x = entity.anchorX + Math.sin(entity.age * entity.freqX + entity.phase) * entity.ampX;
    entity.y = entity.anchorY + Math.cos(entity.age * entity.freqY + entity.phase * 1.7) * entity.ampY;

    if (entity.age > entity.ttl) {
      escapeEntity(entity);
    }
  } else {
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
    if (entity.kind === 'meteor') {
      entity.alpha = Math.max(0, entity.alpha - dt * 1.1);
      if (entity.age > entity.ttl || entity.alpha <= 0.02) entity.dead = true;
    } else if (
      entity.x < -220
      || entity.x > renderer.w + 220
      || entity.y < -120
      || entity.y > renderer.h + 120
    ) {
      entity.dead = true;
    }
  }
}

function cleanupEntities() {
  if (state.target && (state.target.dead || state.target.exposure > 1)) state.target = null;
  state.entities = state.entities.filter((entity) => !entity.dead);
}

/* --------------------------------------------------------------- Combat */

function nearestTarget() {
  let found = null;
  let foundDistance = Infinity;
  for (const entity of state.entities) {
    if (entity.dead || entity.alpha < 0.1) continue;
    const d = distance(state.aim.x, state.aim.y, entity.x, entity.y);
    if (d <= entity.lock && d < foundDistance) {
      found = entity;
      foundDistance = d;
    }
  }
  return found;
}

function updateTargeting(dt) {
  const wantsFilm = state.filming;
  if (wantsFilm) {
    if (state.target) {
      const targetDistance = distance(state.aim.x, state.aim.y, state.target.x, state.target.y);
      if (state.target.dead || targetDistance > state.target.lock * 1.55) {
        state.target = null;
      }
    }
    if (!state.target) state.target = nearestTarget();
  } else {
    state.target = nearestTarget();
    for (const entity of state.entities) {
      entity.exposure = Math.max(0, entity.exposure - dt * 0.42);
      entity.classification = Math.max(0, (entity.classification || 0) - dt * 0.5);
      entity.falseTimer = Math.max(0, (entity.falseTimer || 0) - dt * 0.8);
    }
  }
}

function updateFilming(dt) {
  const wantsFilm = state.pointerDown || state.keyFilm;
  state.filming = wantsFilm;
  if (wantsFilm && !state.wasFilming) audio.filmStart();
  if (!wantsFilm && state.wasFilming) audio.setFilming(false);
  state.wasFilming = wantsFilm;

  const target = state.target;
  const canFilm = wantsFilm && target && state.battery > 0 && !target.dead;

  if (canFilm) {
    const aimDistance = distance(state.aim.x, state.aim.y, target.x, target.y);
    target.classification = (target.classification || 0) + dt;

    if (target.family === 'ufo') {
      const gain = exposureDelta(dt, aimDistance, target.lock, target.captureTime, state.battery);
      target.exposure = Math.min(1, target.exposure + gain);
      target.errorSum = (target.errorSum || 0) + aimDistance * dt;
      target.samples = (target.samples || 0) + dt;
      if (random() < 0.5) {
        spawnParticles(
          target.x + (random() - 0.5) * target.size,
          target.y + (random() - 0.5) * target.size * 0.5,
          'rgba(142, 245, 255, 0.9)',
          1,
          0.18,
        );
      }
      if (target.exposure >= 1) {
        captureEntity(target);
      }
    } else {
      if (target.classification >= CONFIG.identifyAfter) {
        target.falseTimer = (target.falseTimer || 0) + dt;
        target.exposure = clamp(target.falseTimer / CONFIG.falseAlarmAfter, 0, 1);
        if (target.falseTimer >= CONFIG.falseAlarmAfter) falseAlarm(target);
      } else {
        target.exposure = clamp(target.classification / CONFIG.identifyAfter * 0.4, 0, 0.4);
      }
    }

    state.battery = batteryDelta(dt, state.battery, true);
    audio.setFilming(true);
  } else {
    state.battery = batteryDelta(dt, state.battery, false);
    if (!wantsFilm) audio.setFilming(false);
  }
}

function captureEntity(entity) {
  if (entity.dead) return;
  const avgError = entity.samples > 0 ? entity.errorSum / entity.samples : entity.lock * 0.5;
  const precision = precisionFor(avgError, entity.lock);
  const comboUsed = state.combo;
  const gain = scoreCapture(entity.points, comboUsed, precision);

  entity.dead = true;
  state.stats.captured += 1;
  state.stats.log[entity.kind] = (state.stats.log[entity.kind] || 0) + 1;
  state.stats.bestCombo = Math.max(state.stats.bestCombo, state.combo);
  state.score += gain;
  state.combo = Math.min(CONFIG.maxCombo, state.combo + 1);
  state.comboTimer = CONFIG.comboWindow;
  state.signal = nextSignal(state.signal, CONFIG.captureSignal);
  state.battery = clamp(state.battery + CONFIG.batteryCaptureBonus, 0, 100);
  state.target = null;

  spawnParticles(entity.x, entity.y, 'rgba(116, 239, 255, 0.95)', 34, 1);
  spawnParticles(entity.x, entity.y, 'rgba(255, 255, 255, 0.9)', 12, 1.5);
  spawnRing(entity.x, entity.y, 'rgba(116, 239, 255, 0.9)', entity.size * 0.6);
  audio.capture(comboUsed, precision);
  audio.setFilming(false);
  flash('is-good');
  popCombo();

  showToast(
    precision >= 1.5 ? 'PERFEKTE AUFNAHME' : 'KONTAKT BESTÄTIGT',
    `${entity.name.toUpperCase()} · ${entity.code}`,
    `+${formatScore(gain)} PUNKTE · SERIE ×${state.combo}`,
  );

  if (state.stats.captured === 1) {
    setTimeout(() => {
      if (state.mode === 'playing') transmit('Kontakt bestätigt. Was auch immer das war — es ist jetzt Aktenlage.');
    }, 700);
  }
  updateHud(true);
}

function escapeEntity(entity) {
  if (entity.dead) return;
  entity.dead = true;
  if (state.target === entity) state.target = null;
  state.stats.escaped += 1;
  state.signal = nextSignal(state.signal, -CONFIG.escapeSignal);
  state.combo = 1;
  spawnParticles(entity.x, entity.y, 'rgba(255, 95, 125, 0.7)', 20, 1);
  spawnRing(entity.x, entity.y, 'rgba(255, 95, 125, 0.7)', entity.size * 0.7);
  audio.damage();
  audio.setFilming(false);
  flash('is-danger');
  showToast('KONTAKT VERLOREN', entity.name.toUpperCase(), `SIGNAL −${CONFIG.escapeSignal}`, 'is-danger');
  updateHud(true);
  checkGameOver();
}

function falseAlarm(entity) {
  if (entity.dead) return;
  entity.dead = true;
  if (state.target === entity) state.target = null;
  state.stats.falseAlarms += 1;
  state.signal = nextSignal(state.signal, -CONFIG.falseAlarmSignal);
  state.combo = 1;
  state.battery = clamp(state.battery - CONFIG.batteryFalseAlarmCost, 0, 100);
  spawnParticles(entity.x, entity.y, 'rgba(255, 195, 107, 0.8)', 14, 0.7);
  audio.falseAlarm();
  audio.setFilming(false);
  flash('is-warn');
  showToast('FEHLALARM', entity.name.toUpperCase(), `SIGNAL −${CONFIG.falseAlarmSignal} · FILM VERLOREN`, 'is-warn');
  updateHud(true);
  checkGameOver();
}

function checkGameOver() {
  if (state.signal > 0 || state.mode !== 'playing') return;
  clearTimeout(state.gameOverTimer);
  state.gameOverTimer = setTimeout(() => {
    if (state.signal <= 0 && state.mode === 'playing') endGame();
  }, 700);
}

/* ---------------------------------------------------------------- Runtime */

function onWaveChange(wave) {
  state.wave = wave;
  audio.wave();
  showToast('NEUE WELLE', `WELLE ${pad2(wave)}`, 'Mehr Aktivität im Sektor', 'is-warn');

  if (wave === 2 && !state.radio.wave2) {
    state.radio.wave2 = true;
    setTimeout(() => {
      if (state.mode === 'playing') transmit('Mehr Aktivität im Sektor. Filmvorrat im Blick behalten.');
    }, 900);
  }
  if (wave === 4 && !state.radio.wave4) {
    state.radio.wave4 = true;
    setTimeout(() => {
      if (state.mode === 'playing') transmit('Die Behörden schweigen. Wir nicht. Weiter filmen.');
    }, 900);
  }
  updateHud(true);
}

function updateRadio() {
  if (!state.radio.low && state.signal <= 32) {
    state.radio.low = true;
    transmit('Ihr Signal wird schwach. Atmen Sie. Zielen Sie.');
  }
  if (state.signal > 55) state.radio.low = false;
}

function toggleMute() {
  const muted = !audio.muted;
  audio.setMuted(muted);
  dom.btnMute.classList.toggle('is-muted', muted);
  dom.btnMute.setAttribute('aria-label', muted ? 'Ton einschalten' : 'Ton ausschalten');
  try { localStorage.setItem(MUTED_KEY, muted ? '1' : '0'); } catch {}
  if (!muted) {
    audio.unlock().then(() => audio.ui()).catch(() => {});
  }
}

function update(dt) {
  state.elapsed += dt;

  const wave = waveForElapsed(state.elapsed);
  if (wave !== state.wave) onWaveChange(wave);

  state.comboTimer -= dt;
  if (state.comboTimer <= 0 && state.combo > 1) {
    state.combo = 1;
    updateHud(true);
  }

  for (const entity of state.entities) updateEntity(entity, dt);
  updateTargeting(dt);
  updateFilming(dt);
  updateSpawning(dt);
  updateParticles(dt);
  updateRadio();
  cleanupEntities();
  updateHud();

  state.cricketIn -= dt;
  if (state.cricketIn <= 0) {
    state.cricketIn = 2.5 + random() * 5.5;
    if (random() < 0.6) {
      audio.tone({
        frequency: 2600 + random() * 900,
        type: 'sine',
        duration: 0.045,
        gain: 0.008,
        attack: 0.004,
      });
    }
  }

  if (keys.size > 0) {
    const speed = 620 * dt;
    if (keys.has('arrowleft') || keys.has('a')) updateAim(state.aim.x - speed, state.aim.y);
    if (keys.has('arrowright') || keys.has('d')) updateAim(state.aim.x + speed, state.aim.y);
    if (keys.has('arrowup') || keys.has('w')) updateAim(state.aim.x, state.aim.y - speed);
    if (keys.has('arrowdown') || keys.has('s')) updateAim(state.aim.x, state.aim.y + speed);
  }
}

/* ----------------------------------------------------------------- Input */

const keys = new Set();

function isUiTarget(target) {
  return target instanceof Element && Boolean(target.closest('button, a, .overlay.is-open'));
}

window.addEventListener('pointermove', (event) => {
  if (state.mode !== 'playing') return;
  if (event.pointerType === 'touch' && !state.pointerDown) return;
  updateAim(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (state.mode !== 'playing') return;
  if (isUiTarget(event.target)) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  updateAim(event.clientX, event.clientY);
  state.pointerDown = true;
  audio.unlock().catch(() => {});
  event.preventDefault();
}, { passive: false });

function releasePointer() {
  if (!state.pointerDown) return;
  state.pointerDown = false;
  audio.setFilming(false);
}

window.addEventListener('pointerup', releasePointer);
window.addEventListener('pointercancel', releasePointer);
window.addEventListener('blur', () => {
  releasePointer();
  keys.clear();
  state.keyFilm = false;
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && state.mode === 'playing') {
    event.preventDefault();
  }
  if (key === ' ' && state.mode === 'playing') {
    state.keyFilm = true;
    audio.unlock().catch(() => {});
  }
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
    keys.add(key);
  }
  if (key === 'escape' || key === 'p') {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
  }
  if (key === 'm') toggleMute();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys.delete(key);
  if (key === ' ') state.keyFilm = false;
});

window.addEventListener('contextmenu', (event) => {
  if (state.mode === 'playing') event.preventDefault();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') pauseGame();
});

dom.btnStart.addEventListener('click', () => startGame());
dom.btnResume.addEventListener('click', () => resumeGame());
dom.btnRestart.addEventListener('click', () => startGame());
dom.btnAgain.addEventListener('click', () => startGame());
dom.btnMenu.addEventListener('click', () => backToMenu());
dom.btnPause.addEventListener('click', () => {
  if (state.mode === 'playing') pauseGame();
  else if (state.mode === 'paused') resumeGame();
});
dom.btnMute.addEventListener('click', () => toggleMute());

window.addEventListener('resize', () => {
  renderer.resize();
  state.aim.x = clamp(state.aim.x, 24, renderer.w - 24);
  state.aim.y = clamp(state.aim.y, renderer.h * 0.16, renderer.h * 0.8);
  if (state.mode === 'menu') setupMenuScene();
});

/* ------------------------------------------------------------------ Boot */

const muted = (() => {
  try { return localStorage.getItem(MUTED_KEY) === '1'; } catch { return false; }
})();
audio.muted = muted;
dom.btnMute.classList.toggle('is-muted', muted);
dom.btnMute.setAttribute('aria-label', muted ? 'Ton einschalten' : 'Ton ausschalten');
dom.best.textContent = formatScore(state.best);
setupMenuScene();
setAimCenter();
syncAppClass();
updateHud(true);

let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  state.now = now;

  if (state.mode === 'playing') {
    update(dt);
  } else if (state.mode === 'menu') {
    updateDemo(dt);
  }

  const entities = state.mode === 'menu' ? state.demoEntities : state.entities;
  const showReticle = state.mode === 'playing' || state.mode === 'paused';

  renderer.render({
    now,
    entities,
    particles: state.particles,
    effects: state.effects,
    aim: state.aim,
    target: state.target,
    filming: state.mode === 'playing' && state.filming,
    showReticle,
    width: renderer.w,
    height: renderer.h,
    azimuth: azimuth(),
    elevation: elevation(),
  }, dt);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// A tiny debug handle keeps browser verification and curious players honest.
window.__ufosSchauen = {
  state,
  renderer,
  startGame,
  endGame,
  pauseGame,
  resumeGame,
  spawnUfo,
  spawnDecoy,
  setAim: (x, y) => updateAim(x, y),
  setFilming: (on) => { state.keyFilm = Boolean(on); },
};
