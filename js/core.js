/* ==========================================================================
   DER LETZTE SCHULTAG – Kern: Setup, Helfer, Sound, Partikel, HUD
   ========================================================================== */
(() => {
'use strict';

const W = 960, H = 540;
const OUT = '#2a2233';
const DISPLAY = '"Arial Black", "Arial Bold", "Trebuchet MS", system-ui, sans-serif';
const BODY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

const ui = {
  hud: $('hud'), meterWrap: $('meterWrap'), meterLabel: $('meterLabel'),
  meterPct: $('meterPct'), meterFill: $('meterFill'), actBadge: $('actBadge'),
  actNum: $('actNum'), actName: $('actName'), muteBtn: $('muteBtn'),
  speech: $('speech'), speaker: $('speaker'), line: $('line'),
  controls: $('controls'), actBtn: $('actBtn'), actIcon: $('actIcon'),
  actLabel: $('actLabel'), leftBtn: $('leftBtn'), rightBtn: $('rightBtn'),
  holdHint: $('holdHint'), title: $('title'), startBtn: $('startBtn'),
  end: $('end'), endLine: $('endLine'), statStare: $('statStare'),
  statFlight: $('statFlight'), statLand: $('statLand'), statPotion: $('statPotion'),
  statRun: $('statRun'), statGrade: $('statGrade'), replayBtn: $('replayBtn'),
  homeBtn: $('homeBtn'), choicePanel: $('choicePanel'), portraitHint: $('portraitHint')
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

// --------------------------------------------------------------------------
// Zustand
// --------------------------------------------------------------------------
let time = 0;
let scene = 'title';
let sceneT = 0;
let shake = 0;
let flash = 0;
let lastPct = -1;
let currentSpeech = '';
let a1 = null, a2 = null, a3 = null, a4 = null;
const stats = { stare: 0, flight: 0, landing: '', wrong: 0, run: 0, taps: 0 };
const input = { stare: false, left: false, right: false, run: false };
let pointerSteer = 0;
let hoverBottle = null;

// --------------------------------------------------------------------------
// Mathe (die einzige, die hier stattfindet)
// --------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const TAU = Math.PI * 2;

// --------------------------------------------------------------------------
// Zeichen-Grundlagen
// --------------------------------------------------------------------------
function rr(x, y, w, h, r = 0) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRR(x, y, w, h, r, fill, stroke, lw = 3) {
  rr(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function circle(x, y, r, fill, stroke, lw = 3) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function line(x1, y1, x2, y2, color, lw = 3, cap = 'round') {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = cap; ctx.stroke();
}
function txt(str, x, y, opt = {}) {
  const { size = 20, weight = 700, color = OUT, align = 'left', font = DISPLAY, base = 'alphabetic', alpha = 1 } = opt;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  ctx.restore();
}
function outlineTxt(str, x, y, size, color, stroke = OUT, lw = 5, align = 'center', font = DISPLAY) {
  ctx.save();
  ctx.font = `800 ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = stroke;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  ctx.restore();
}
function wrap(text, maxWidth, font) {
  ctx.save(); ctx.font = font;
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}

// --------------------------------------------------------------------------
// Partikel & fliegende Wörter
// --------------------------------------------------------------------------
const particles = [];
const floaters = [];

function particle(x, y, o = {}) {
  particles.push({
    x, y,
    vx: o.vx ?? rand(-80, 80), vy: o.vy ?? rand(-150, -30),
    g: o.g ?? 380, life: o.life ?? rand(.5, 1.1), max: o.life ?? rand(.5, 1.1),
    size: o.size ?? rand(3, 8), color: o.color ?? '#ffc145',
    rot: o.rot ?? rand(0, TAU), vr: o.vr ?? rand(-8, 8),
    shape: o.shape ?? 'rect', alpha: o.alpha ?? 1
  });
}
function burst(x, y, n, o = {}) {
  const count = reduceMotion ? Math.ceil(n * .5) : n;
  for (let i = 0; i < count; i++) particle(x, y, o);
}
function floater(text, x, y, color = '#fff', size = 36, o = {}) {
  floaters.push({ text, x, y, color, size, life: o.life ?? 1.5, max: o.life ?? 1.5, vy: o.vy ?? -46, rot: o.rot ?? rand(-.12, .12) });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y += f.vy * dt; f.vy *= .985; f.life -= dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
}
function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1) * p.alpha;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, TAU); ctx.fill(); }
    else if (p.shape === 'shard') {
      ctx.beginPath(); ctx.moveTo(-p.size, -p.size * .6); ctx.lineTo(p.size * 1.4, -p.size * .2);
      ctx.lineTo(p.size * .5, p.size); ctx.lineTo(-p.size * .8, p.size * .5); ctx.closePath(); ctx.fill();
    } else if (p.shape === 'leaf') {
      ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * .5, 0, 0, TAU); ctx.fill();
    } else if (p.shape === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? p.size * .45 : p.size;
        const ang = -Math.PI / 2 + i * Math.PI / 5;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath(); ctx.fill();
    } else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
    ctx.restore();
  }
}
function drawFloaters() {
  for (const f of floaters) {
    const k = 1 - f.life / f.max;
    const pop = k < .18 ? easeOut(k / .18) : 1;
    ctx.save();
    ctx.globalAlpha = clamp(f.life * 2.2, 0, 1);
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.scale(pop, pop);
    outlineTxt(f.text, 0, 0, f.size, f.color, OUT, 7);
    ctx.restore();
  }
}

// --------------------------------------------------------------------------
// Ton (kleine WebAudio-Kapelle)
// --------------------------------------------------------------------------
let actx = null, master = null, noiseBuf = null, muted = false;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = muted ? 0 : .5;
  master.connect(actx.destination);
  const len = Math.floor(actx.sampleRate * 1.1);
  noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
}
function audioReady() {
  if (!actx) return false;
  if (actx.state === 'suspended') actx.resume();
  return true;
}
function tone(freq, dur = .2, type = 'sine', vol = .08, delay = 0, to = null) {
  if (!audioReady()) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(Math.max(20, freq), t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + .012);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + .02);
}
function noise(dur = .3, vol = .08, type = 'highpass', freq = 1200, delay = 0, q = .8) {
  if (!audioReady()) return;
  const t = actx.currentTime + delay;
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + .05);
}
const sfx = {
  click() { tone(620, .07, 'square', .035, 0, 880); },
  pop() { tone(420, .08, 'sine', .06, 0, 660); },
  step() { noise(.08, .07, 'lowpass', 260); tone(75, .12, 'sine', .05, 0, 48); },
  angry() { tone(120, .35, 'sawtooth', .09, 0, 58); tone(180, .28, 'square', .04, .03, 95); },
  whoosh() { noise(.45, .11, 'bandpass', 900, 0, 1.4); },
  glass() {
    noise(.5, .15, 'highpass', 2400);
    for (let i = 0; i < 6; i++) tone(rand(1700, 3200), .18, 'triangle', .035, rand(0, .18), rand(900, 2200));
  },
  thud() { tone(105, .3, 'sine', .16, 0, 38); noise(.16, .1, 'lowpass', 180); },
  glug() { for (let i = 0; i < 5; i++) tone(260 - i * 22, .13, 'sine', .06, i * .16, 130); },
  wrong() { tone(180, .3, 'square', .07, 0, 85); tone(140, .34, 'sawtooth', .04, .04, 70); },
  dead() { [233, 207, 185, 156].forEach((f, i) => tone(f, .32, 'sawtooth', .055, i * .17, f * .92)); },
  ghost() { tone(620, 1.1, 'sine', .045, 0, 1150); tone(930, 1.1, 'sine', .025, .08, 1420); },
  bellStrike(delay = 0) {
    [880, 1320, 1760, 2640].forEach((f, i) => tone(f, .9 - i * .12, 'sine', .045 / (i + 1), delay + i * .008));
  },
  schoolBell() { for (let i = 0; i < 4; i++) sfx.bellStrike(i * .24); },
  cheer() {
    noise(.7, .1, 'bandpass', 1000, 0, .7);
    [523, 659, 784, 1047].forEach((f, i) => tone(f, .3, 'triangle', .05, i * .07));
  },
  confetti() { for (let i = 0; i < 7; i++) tone(rand(500, 1200), .08, 'square', .025, rand(0, .6), rand(900, 1700)); },
  heartbeat() { tone(58, .12, 'sine', .06, 0, 42); tone(52, .1, 'sine', .04, .16, 38); }
};

// --------------------------------------------------------------------------
// HUD
// --------------------------------------------------------------------------
function setAct(n, name) {
  ui.actNum.textContent = 'AKT ' + n;
  ui.actName.textContent = name;
  ui.actBadge.classList.remove('pop'); void ui.actBadge.offsetWidth; ui.actBadge.classList.add('pop');
}
function setMeter(label, value, theme = 'red') {
  ui.meterLabel.textContent = label;
  const v = clamp(value, 0, 1);
  ui.meterFill.style.transform = `scaleX(${v.toFixed(3)})`;
  const pct = Math.round(v * 100);
  if (pct !== lastPct) { lastPct = pct; ui.meterPct.textContent = pct + ' %'; }
  ui.meterWrap.classList.toggle('green', theme === 'green');
  ui.meterWrap.classList.toggle('blue', theme === 'blue');
}
function showMeter(show) {
  ui.meterWrap.classList.toggle('hidden', !show);
}
function say(who, text) {
  const key = who + '|' + text;
  if (key === currentSpeech) return;
  currentSpeech = key;
  ui.speaker.textContent = who;
  ui.speaker.classList.toggle('narrator', who === 'ERZÄHLER');
  ui.speaker.classList.toggle('teacher', who === 'HERR MÜLLER');
  ui.speaker.classList.toggle('player', who === 'DU');
  ui.line.textContent = text;
  ui.speech.classList.remove('pop'); void ui.speech.offsetWidth; ui.speech.classList.add('pop');
}
function showChoices(show) {
  ui.choicePanel.classList.toggle('hidden', !show);
}
function setControls(mode) {
  const stare = mode === 'stare', flight = mode === 'flight', run = mode === 'run';
  ui.actBtn.classList.toggle('hidden', !(stare || run));
  ui.leftBtn.classList.toggle('hidden', !flight);
  ui.rightBtn.classList.toggle('hidden', !flight);
  ui.holdHint.classList.toggle('hidden', mode === 'none');
  ui.controls.classList.toggle('hidden', mode === 'none');
  if (stare) { ui.actIcon.textContent = '👁'; ui.actLabel.textContent = 'GUCKEN'; ui.actBtn.classList.remove('running'); ui.holdHint.textContent = 'gedrückt halten'; }
  if (run) { ui.actIcon.textContent = '🏃'; ui.actLabel.textContent = 'RENNEN'; ui.actBtn.classList.add('running'); ui.holdHint.textContent = 'hämmern!'; }
  if (flight) ui.holdHint.textContent = 'links / rechts';
}
function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : .5;
  ui.muteBtn.textContent = muted ? '🔇' : '🔊';
  ui.muteBtn.setAttribute('aria-label', muted ? 'Ton einschalten' : 'Ton ausschalten');
  if (!muted) sfx.click();
}

// --------------------------------------------------------------------------
// Größe
// --------------------------------------------------------------------------
function resize() {
  const r = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.max(2, Math.round(r.width * dpr));
  canvas.height = Math.max(2, Math.round(r.height * dpr));
}
new ResizeObserver(resize).observe(stage);
addEventListener('resize', resize, { passive: true });

// --------------------------------------------------------------------------
// Export für die anderen Dateien
// --------------------------------------------------------------------------
window.SG = {
  W, H, OUT, DISPLAY, BODY, stage, canvas, ctx, ui, reduceMotion, coarse,
  input, stats, particles, floaters,
  get time() { return time; }, set time(v) { time = v; },
  get scene() { return scene; }, set scene(v) { scene = v; },
  get sceneT() { return sceneT; }, set sceneT(v) { sceneT = v; },
  get shake() { return shake; }, set shake(v) { shake = v; },
  get flash() { return flash; }, set flash(v) { flash = v; },
  get a1() { return a1; }, set a1(v) { a1 = v; },
  get a2() { return a2; }, set a2(v) { a2 = v; },
  get a3() { return a3; }, set a3(v) { a3 = v; },
  get a4() { return a4; }, set a4(v) { a4 = v; },
  get pointerSteer() { return pointerSteer; }, set pointerSteer(v) { pointerSteer = v; },
  get hoverBottle() { return hoverBottle; }, set hoverBottle(v) { hoverBottle = v; },
  clamp, lerp, rand, randInt, pick, easeOut, easeIn, easeInOut, TAU,
  rr, fillRR, circle, line, txt, outlineTxt, wrap,
  particle, burst, floater, updateParticles, drawParticles, drawFloaters,
  initAudio, tone, noise, sfx, setAct, setMeter, showMeter, say, setControls, showChoices, toggleMute, resize
};
})();
