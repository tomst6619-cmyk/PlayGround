import { Game, CHIP_INFO } from './game.js';
import { Controls } from './input.js';
import { Sound } from './audio.js';

const $ = (sel) => document.querySelector(sel);

const canvas = $('#game');
const ui = {
  hud: $('#hud'),
  hearts: $('#hearts'),
  timer: $('#timer'),
  friends: $('#friends'),
  hint: $('#hint'),
  minimap: $('#minimap'),
  joystick: $('#joystick'),
  action: $('#action'),
  dialogue: $('#dialogue'),
  portrait: $('#portrait'),
  dlgName: $('#dlg-name'),
  dlgMood: $('#dlg-mood'),
  dlgLine: $('#dlg-line'),
  dlgOptions: $('#dlg-options'),
  dlgContinue: $('#dlg-continue'),
  title: $('#title'),
  end: $('#end'),
  endKicker: $('#end-kicker'),
  endTitle: $('#end-title'),
  endSub: $('#end-sub'),
  endStats: $('#end-stats'),
  toast: $('#toast'),
};

ui.hearts.innerHTML = Array.from({ length: 5 }, () => '<span class="heart"></span>').join('');
ui.friends.innerHTML = CHIP_INFO.map(
  (c) => `<span class="chip" style="--dot:${c.color}">${c.name}</span>`,
).join('');

let game = null;
const sound = new Sound();
const controls = new Controls({
  joystick: ui.joystick,
  knob: $('#stick-knob'),
  action: ui.action,
  canvas,
  onAction: () => game?.interact(),
  onTap: (x, y) => game?.handleTap(x, y),
});

game = new Game(canvas, sound, ui, controls);
window.__game = game;

const soundBtn = $('#sound');
const syncSound = () => {
  soundBtn.textContent = sound.muted ? '🔇' : '🔊';
  soundBtn.setAttribute('aria-label', sound.muted ? 'Unmute sound' : 'Mute sound');
  soundBtn.setAttribute('title', sound.muted ? 'Unmute' : 'Mute');
};
syncSound();

soundBtn.addEventListener('click', () => {
  sound.unlock();
  sound.setMuted(!sound.muted);
  syncSound();
});

$('#start').addEventListener('click', () => {
  game.start();
  syncSound();
});

$('#again').addEventListener('click', () => {
  game.restart();
  syncSound();
});

$('#restart').addEventListener('click', () => {
  if (game.state === 'playing' || game.state === 'dialogue') {
    game.restart();
    game.toast('Fresh evening. Same five friends.');
  }
});

if (game.touch) {
  const controlsLine = $('#title-controls');
  if (controlsLine) controlsLine.textContent = 'Drag to walk · tap a friend to talk · tap Talk to speak';
}

// Never let a stray drag on the page scroll or bounce the game.
document.addEventListener('touchmove', (e) => {
  if (e.target === canvas) e.preventDefault();
}, { passive: false });

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  game.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.fonts?.ready.then(() => {
  // fonts are system stacks; nothing to swap, but keep canvas metrics fresh
  game.resize();
});
