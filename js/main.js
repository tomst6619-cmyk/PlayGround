/* ==========================================================================
   DER LETZTE SCHULTAG – Eingabe, Schleife, Start
   ========================================================================== */
(() => {
'use strict';
const S = window.SG;
const { W, H, stage, canvas, ui, input } = S;

// --------------------------------------------------------------------------
// Koordinaten
// --------------------------------------------------------------------------
function toWorld(e) {
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function bottleAt(x, y) {
  const a = S.a3;
  if (!a || a.phase !== 'choice') return null;
  return a.bottles.find(b => Math.abs(x - b.x) < 46 && y > 262 && y < 394) || null;
}

// --------------------------------------------------------------------------
// Tastatur
// --------------------------------------------------------------------------
addEventListener('keydown', e => {
  const k = e.code;
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
  if (S.scene === 'title') {
    if (k === 'Space' || k === 'Enter') S.startGame();
    return;
  }
  if (S.scene === 'end') {
    if (k === 'Enter' || k === 'Space') S.startGame();
    return;
  }
  if (k === 'Space') {
    if (S.scene === 'act1') input.stare = true;
    if (S.scene === 'act4') { input.run = true; if (!e.repeat) S.tapRun(); }
  }
  if (k === 'ArrowLeft' || k === 'KeyA') input.left = true;
  if (k === 'ArrowRight' || k === 'KeyD') input.right = true;
  if (k === 'KeyM') S.toggleMute();
});
addEventListener('keyup', e => {
  const k = e.code;
  if (k === 'Space') { input.stare = false; input.run = false; }
  if (k === 'ArrowLeft' || k === 'KeyA') input.left = false;
  if (k === 'ArrowRight' || k === 'KeyD') input.right = false;
});

// --------------------------------------------------------------------------
// Zeiger
// --------------------------------------------------------------------------
function clearHeld() {
  input.stare = false;
  input.run = false;
  input.left = false;
  input.right = false;
  S.pointerSteer = 0;
  ui.actBtn.classList.remove('pressed');
  ui.leftBtn.classList.remove('pressed');
  ui.rightBtn.classList.remove('pressed');
}
addEventListener('pointerup', clearHeld);
addEventListener('pointercancel', clearHeld);
addEventListener('blur', clearHeld);

stage.addEventListener('pointerdown', e => {
  e.preventDefault();
  initAudioSafe();
  const p = toWorld(e);
  if (S.scene === 'act1') {
    input.stare = true;
    sfxTap();
  } else if (S.scene === 'act2' && S.a2 && S.a2.phase === 'flight') {
    S.pointerSteer = p.x < S.a2.x ? -1 : 1;
  } else if (S.scene === 'act3') {
    const b = bottleAt(p.x, p.y);
    if (b) S.chooseBottle(b);
  } else if (S.scene === 'act4') {
    input.run = true;
    S.tapRun();
  }
}, { passive: false });

stage.addEventListener('pointermove', e => {
  const p = toWorld(e);
  if (S.scene === 'act2' && S.a2 && S.a2.phase === 'flight' && (e.buttons || e.pointerType === 'touch')) {
    S.pointerSteer = p.x < S.a2.x ? -1 : 1;
  } else if (S.scene === 'act3') {
    S.hoverBottle = bottleAt(p.x, p.y);
    stage.style.cursor = S.hoverBottle ? 'pointer' : 'crosshair';
  }
}, { passive: true });
stage.addEventListener('pointerleave', () => {
  if (S.scene === 'act3') { S.hoverBottle = null; stage.style.cursor = 'crosshair'; }
});

// --------------------------------------------------------------------------
// Knöpfe
// --------------------------------------------------------------------------
ui.startBtn.addEventListener('click', () => S.startGame());
ui.replayBtn.addEventListener('click', () => S.startGame());
ui.homeBtn.addEventListener('click', () => S.goTitle());
ui.muteBtn.addEventListener('click', e => { e.preventDefault(); S.toggleMute(); });
ui.choicePanel.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    const b = S.a3 && S.a3.bottles.find(x => x.id === btn.dataset.potion);
    if (b) S.chooseBottle(b);
  });
});

function pressAct(e) {
  e.preventDefault(); e.stopPropagation();
  initAudioSafe();
  if (S.scene === 'act1') input.stare = true;
  if (S.scene === 'act4') { input.run = true; S.tapRun(); }
  ui.actBtn.classList.add('pressed');
}
ui.actBtn.addEventListener('pointerdown', pressAct, { passive: false });
ui.actBtn.addEventListener('pointerup', e => { e.preventDefault(); clearHeld(); }, { passive: false });
ui.actBtn.addEventListener('pointercancel', clearHeld);
ui.actBtn.addEventListener('pointerleave', () => { if (!ui.actBtn.matches(':active')) ui.actBtn.classList.remove('pressed'); });

function holdDir(dir) {
  return e => {
    e.preventDefault(); e.stopPropagation();
    initAudioSafe();
    if (dir < 0) input.left = true; else input.right = true;
    (dir < 0 ? ui.leftBtn : ui.rightBtn).classList.add('pressed');
  };
}
ui.leftBtn.addEventListener('pointerdown', holdDir(-1), { passive: false });
ui.rightBtn.addEventListener('pointerdown', holdDir(1), { passive: false });
[ui.leftBtn, ui.rightBtn].forEach(btn => {
  btn.addEventListener('pointerup', e => { e.preventDefault(); clearHeld(); }, { passive: false });
  btn.addEventListener('pointercancel', clearHeld);
});

// --------------------------------------------------------------------------
// Kleine Helfer
// --------------------------------------------------------------------------
let audioStarted = false;
function initAudioSafe() {
  if (audioStarted) return;
  audioStarted = true;
  S.initAudio();
}
function sfxTap() {
  if (S.scene === 'act1' && !input.stare) S.sfx.click();
}

// --------------------------------------------------------------------------
// Schleife
// --------------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(.034, Math.max(0, (now - last) / 1000));
  last = now;
  S.update(dt);
  S.render();
  requestAnimationFrame(loop);
}
addEventListener('visibilitychange', () => {
  if (!document.hidden) last = performance.now();
});

// --------------------------------------------------------------------------
// Debug-Schnittstelle (für Tests und neugierige Lehrer)
// --------------------------------------------------------------------------
window.SCHULTAG = {
  start: () => S.startGame(),
  title: () => S.goTitle(),
  act: n => S.gotoAct(n),
  choose: id => { const b = S.a3 && S.a3.bottles.find(x => x.id === id); if (b) S.chooseBottle(b); },
  tap: () => S.tapRun(),
  get scene() { return S.scene; },
  get state() {
    return {
      scene: S.scene,
      stats: { ...S.stats },
      a1: S.a1 && { phase: S.a1.phase, stare: S.a1.stare, t: S.a1.t },
      a2: S.a2 && { phase: S.a2.phase, x: S.a2.x, y: S.a2.y, quality: S.a2.quality },
      a3: S.a3 && { phase: S.a3.phase, bottles: S.a3.bottles.map(b => ({ id: b.id, x: b.x })), t: S.a3.t },
      a4: S.a4 && { phase: S.a4.phase, distance: S.a4.distance, t: S.a4.t }
    };
  }
};

S.resize();
requestAnimationFrame(loop);
})();
