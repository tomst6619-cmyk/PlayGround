import * as THREE from '../vendor/three.module.js';
import { CONFIG, IS_MOBILE, clamp, lerp, wrapAngle } from './config.js';
import { createAssets } from './textures.js';
import { HospitalWorld } from './world.js';
import { SoulDemon } from './demon.js';
import { AudioEngine } from './audio.js';

const $ = (id) => document.getElementById(id);

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
const gl = renderer.getContext();
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|mesa offscreen/i.test(gpuName) || navigator.webdriver;
const LOW_GFX = IS_MOBILE || SOFTWARE_RENDERER;
const PIXEL_SCALE = SOFTWARE_RENDERER ? 0.85 : (IS_MOBILE ? 1.15 : Math.min(window.devicePixelRatio || 1, 1.85));

renderer.setPixelRatio(PIXEL_SCALE);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !LOW_GFX;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040505);
scene.fog = new THREE.FogExp2(0x040505, 0.058);

const camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.05, 130);
camera.rotation.order = 'YXZ';
scene.add(camera);

const assets = createAssets(renderer);
assets.lowGfx = LOW_GFX;
if (LOW_GFX) {
  for (const m of [assets.mats.wall, assets.mats.floor, assets.mats.ceiling, assets.mats.fabric, assets.mats.mattress, assets.mats.skin]) {
    m.bumpMap = null;
    m.needsUpdate = true;
  }
}
const world = new HospitalWorld(scene, assets);
const demon = new SoulDemon(scene, assets);
const audio = new AudioEngine();

/* ---------------- flashlight ---------------- */

const flashlight = new THREE.SpotLight(0xf0ecdc, 96, 30, Math.PI * 0.165, 0.62, 1.35);
flashlight.position.set(0.17, -0.1, 0.02);
flashlight.target.position.set(0, -0.04, -1);
flashlight.castShadow = !LOW_GFX;
if (!LOW_GFX) {
  flashlight.shadow.mapSize.set(1024, 1024);
  flashlight.shadow.camera.near = 0.2;
  flashlight.shadow.camera.far = 30;
  flashlight.shadow.bias = -0.0012;
  flashlight.shadow.normalBias = 0.025;
}
camera.add(flashlight);
camera.add(flashlight.target);

const hemi = new THREE.HemisphereLight(0x3c4148, 0x08090a, 0.42);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0x232622, 0.16);
scene.add(ambient);

/* ---------------- state ---------------- */

const state = {
  mode: 'menu',
  pos: new THREE.Vector3(),
  yaw: 1.2,
  pitch: 0,
  stamina: 100,
  elapsed: 0,
  visualTime: 0,
  grace: CONFIG.grace,
  collected: 0,
  flashlightOn: true,
  muted: false,
  speed: 0,
  bob: 0,
  stepTimer: 0,
  threat: 0,
  deathT: 0,
  flashOpacity: 0,
  shake: 0,
  hintUntil: 0,
  hintText: '',
  exitSealedAt: -10,
  pointerLocked: false,
  lockGuard: 0,
  dragging: false,
  dragId: null,
  dragX: 0,
  dragY: 0,
  joyId: null,
  joyX: 0,
  joyY: 0,
  touchSprint: false,
  sprintHeld: false,
  lastClock: '',
  wins: 0,
};

let layout = null;
let clock = 0;
let last = performance.now();

/* ---------------- UI helpers ---------------- */

const ui = {
  start: $('startScreen'),
  pause: $('pauseScreen'),
  dead: $('deadScreen'),
  win: $('winScreen'),
  hud: $('hud'),
  hint: $('hint'),
  clock: $('clock'),
  pips: [...document.querySelectorAll('#soulPips i')],
  stamina: $('stamina'),
  threat: $('threat'),
  flash: $('flash'),
  compass: $('compass'),
  compassArrow: document.querySelector('#compass .arrow'),
  compassDist: document.querySelector('#compass .dist'),
  boot: $('boot'),
};

function hideScreens() {
  for (const el of [ui.start, ui.pause, ui.dead, ui.win]) el.classList.add('hidden');
}

function showHint(text, danger = false, ms = 3200) {
  ui.hint.textContent = text;
  ui.hint.classList.toggle('danger', danger);
  ui.hint.classList.add('show');
  state.hintUntil = performance.now() + ms;
}

function clearHint() {
  ui.hint.classList.remove('show');
  state.hintUntil = 0;
}

function updatePips() {
  ui.pips.forEach((pip, i) => pip.classList.toggle('on', i < state.collected));
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function setFlash(opacity, color = null) {
  state.flashOpacity = opacity;
  if (color) ui.flash.style.background = color;
  ui.flash.style.opacity = String(opacity);
}

function setSoundLabels() {
  const label = `Sound: ${state.muted ? 'off' : 'on'}`;
  const btn = $('pauseSoundBtn');
  if (btn) btn.textContent = label;
  const hud = $('muteBtn');
  if (hud) {
    hud.textContent = state.muted ? 'MUTE' : 'SND';
    hud.classList.toggle('active', state.muted);
  }
}

function toggleMute() {
  state.muted = !state.muted;
  audio.setMuted(state.muted);
  setSoundLabels();
}

/* ---------------- run lifecycle ---------------- */

function placePlayer(l) {
  state.pos.copy(l.spawn.pos);
  state.yaw = l.spawn.yaw;
  state.pitch = 0;
  state.speed = 0;
  state.bob = 0;
  state.stamina = 100;
  state.stepTimer = 0;
  camera.position.set(state.pos.x, CONFIG.eyeHeight, state.pos.z);
  camera.rotation.set(0, state.yaw, 0);
}

function prepareRun(l) {
  layout = l;
  placePlayer(l);
  demon.spawn(l.demonPos, l.spawn.pos);
  state.collected = 0;
  state.elapsed = 0;
  state.grace = CONFIG.grace;
  state.threat = 0;
  state.flashOpacity = 0;
  state.shake = 0;
  state.exitSealedAt = -10;
  state.lastClock = '';
  ui.flash.style.opacity = '0';
  ui.threat.style.opacity = '0';
  ui.compass.classList.remove('show');
  updatePips();
  ui.clock.textContent = '00:00';
  ui.stamina.style.width = '100%';
  flashlight.visible = true;
  state.flashlightOn = true;
  $('lightBtn').classList.add('active');
}

function startRun(fresh = false) {
  audio.init();
  hideScreens();
  ui.hud.classList.remove('hidden');
  if (fresh) {
    prepareRun(world.generate());
  } else {
    prepareRun(layout || world.generate());
  }
  state.mode = 'playing';
  last = performance.now();
  showHint('Find the five souls. Stay out of its sight.', false, 4200);
}

function restartRun() {
  audio.init();
  hideScreens();
  ui.hud.classList.remove('hidden');
  prepareRun(world.generate());
  state.mode = 'playing';
  last = performance.now();
  showHint('Find the five souls. Stay out of its sight.', false, 4200);
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  ui.pause.classList.remove('hidden');
  ui.hud.classList.add('hidden');
  clearHint();
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  ui.pause.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  state.mode = 'playing';
  state.lastClock = '';
  last = performance.now();
  audio.init();
}

function beginDeath() {
  if (state.mode !== 'playing') return;
  state.mode = 'dying';
  state.deathT = 0;
  state.shake = 1;
  clearHint();
  audio.scare();
  demon.placeForScare(state.pos, state.yaw);
  const overlay = 'radial-gradient(circle at 50% 46%, rgba(255,240,195,.95), rgba(190,20,12,.6) 42%, rgba(20,0,0,.96))';
  setFlash(1, overlay);
}

function finishDeath() {
  if (state.mode === 'dead') return;
  state.mode = 'dead';
  setFlash(0, null);
  ui.threat.style.opacity = '0';
  ui.hud.classList.add('hidden');
  $('deadSub').textContent = `${state.collected} of ${CONFIG.soulsNeeded} souls claimed. Your dark waits for you.`;
  ui.dead.classList.remove('hidden');
}

function winRun() {
  if (state.mode !== 'playing') return;
  state.mode = 'won';
  state.wins++;
  audio.exitChime();
  clearHint();
  $('winSub').textContent = `Escaped in ${formatTime(state.elapsed)} with five souls.`;
  ui.compass.classList.remove('show');
  setFlash(0.9, 'radial-gradient(circle at 50% 50%, rgba(255,246,210,.95), rgba(255,190,40,.45) 40%, rgba(0,0,0,.9))');
  setTimeout(() => setFlash(0), 700);
  setTimeout(() => {
    if (state.mode === 'won') {
      ui.hud.classList.add('hidden');
      ui.win.classList.remove('hidden');
    }
  }, 650);
}

/* ---------------- input ---------------- */

const keys = { forward: false, back: false, left: false, right: false, sprint: false };

function moveInput() {
  let x = state.joyX;
  let y = state.joyY;
  if (keys.forward) y += 1;
  if (keys.back) y -= 1;
  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y, moving: len > 0.08 };
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state.mode === 'playing') { pauseGame(); e.preventDefault(); }
    else if (state.mode === 'paused') { resumeGame(); e.preventDefault(); }
    return;
  }
  if (state.mode === 'menu' && (e.code === 'Enter' || e.code === 'Space')) {
    startRun();
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyF' && state.mode === 'playing') { toggleFlashlight(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { keys.sprint = true; state.sprintHeld = true; return; }
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = true;
  else if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.back = true;
  else if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  else if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { keys.sprint = false; state.sprintHeld = false; }
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = false;
  else if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.back = false;
  else if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  else if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
});

window.addEventListener('blur', () => {
  keys.forward = keys.back = keys.left = keys.right = false;
  keys.sprint = false;
  state.touchSprint = false;
  state.joyX = state.joyY = 0;
});

document.addEventListener('pointerlockchange', () => {
  state.pointerLocked = document.pointerLockElement === canvas;
  if (state.pointerLocked) state.lockGuard = performance.now() + 260;
});
document.addEventListener('pointerlockerror', () => { state.pointerLocked = false; });

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'playing') return;
  if (e.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
    try {
      const p = canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
      state.lockGuard = performance.now() + 260;
    } catch { /* ignore */ }
  }
  state.dragging = true;
  state.dragId = e.pointerId;
  state.dragX = e.clientX;
  state.dragY = e.clientY;
});

canvas.addEventListener('pointermove', (e) => {
  if (state.mode !== 'playing') return;
  if (document.pointerLockElement === canvas && e.pointerType === 'mouse' && performance.now() < state.lockGuard) return;
  let dx = 0;
  let dy = 0;
  if (document.pointerLockElement === canvas && e.pointerType === 'mouse') {
    dx = e.movementX || 0;
    dy = e.movementY || 0;
  } else {
    if (!state.dragging || e.pointerId !== state.dragId) return;
    dx = e.clientX - state.dragX;
    dy = e.clientY - state.dragY;
    state.dragX = e.clientX;
    state.dragY = e.clientY;
  }
  const sens = e.pointerType === 'touch' ? CONFIG.touchSensitivity : CONFIG.sensitivity;
  state.yaw -= dx * sens;
  state.pitch = clamp(state.pitch - dy * sens, -1.22, 1.15);
});

function endDrag(e) {
  if (state.dragId === null || (e && e.pointerId !== state.dragId)) return;
  state.dragging = false;
  state.dragId = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* joystick */

const joystick = $('joystick');
const stick = $('stick');
let joyCenter = { x: 0, y: 0 };
const JOY_RADIUS = 40;

function joyMove(e) {
  const dx = e.clientX - joyCenter.x;
  const dy = e.clientY - joyCenter.y;
  const len = Math.hypot(dx, dy);
  const max = JOY_RADIUS;
  const k = len > max ? max / len : 1;
  const sx = dx * k;
  const sy = dy * k;
  stick.style.transform = `translate(${sx}px, ${sy}px)`;
  state.joyX = clamp(sx / max, -1, 1);
  state.joyY = clamp(-sy / max, -1, 1);
}

joystick.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  state.joyId = e.pointerId;
  joystick.classList.add('active');
  joystick.setPointerCapture?.(e.pointerId);
  const rect = joystick.getBoundingClientRect();
  joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  joyMove(e);
});
joystick.addEventListener('pointermove', (e) => {
  if (state.joyId !== e.pointerId) return;
  e.preventDefault();
  joyMove(e);
});
function joyEnd(e) {
  if (state.joyId !== e.pointerId) return;
  state.joyId = null;
  state.joyX = 0;
  state.joyY = 0;
  stick.style.transform = 'translate(0px, 0px)';
  joystick.classList.remove('active');
}
joystick.addEventListener('pointerup', joyEnd);
joystick.addEventListener('pointercancel', joyEnd);
joystick.addEventListener('lostpointercapture', joyEnd);

/* buttons */

function bindPress(el, down, up) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('active');
    el.setPointerCapture?.(e.pointerId);
    down?.();
  });
  const finish = (e) => {
    if (e) e.preventDefault();
    el.classList.remove('active');
    up?.();
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
  el.addEventListener('pointerleave', (e) => { if (e.buttons === 0) finish(e); });
}

const sprintBtn = $('sprintBtn');
bindPress(sprintBtn, () => { state.touchSprint = true; }, () => { state.touchSprint = false; });

function toggleFlashlight() {
  if (state.mode !== 'playing') return;
  state.flashlightOn = !state.flashlightOn;
  flashlight.visible = state.flashlightOn;
  $('lightBtn').classList.toggle('active', state.flashlightOn);
  audio.whisper();
}

$('lightBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleFlashlight(); });
$('muteBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleMute(); });
$('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); pauseGame(); });
$('startBtn').addEventListener('click', (e) => { e.stopPropagation(); startRun(false); });
$('resumeBtn').addEventListener('click', resumeGame);
$('restartBtn').addEventListener('click', restartRun);
$('retryBtn').addEventListener('click', restartRun);
$('againBtn').addEventListener('click', restartRun);
$('pauseSoundBtn').addEventListener('click', toggleMute);

/* ---------------- gameplay update ---------------- */

function updatePlaying(dt) {
  state.visualTime += dt;
  state.elapsed += dt;
  state.grace = Math.max(0, state.grace - dt);

  const input = moveInput();
  const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const wish = new THREE.Vector3()
    .addScaledVector(forward, input.y)
    .addScaledVector(right, input.x);
  if (wish.lengthSq() > 0) wish.normalize();

  const wantsSprint = (keys.sprint || state.touchSprint) && input.moving;
  const canSprint = state.stamina > 0.5;
  const sprinting = wantsSprint && canSprint;
  if (sprinting) state.stamina = Math.max(0, state.stamina - 25 * dt);
  else state.stamina = Math.min(100, state.stamina + (input.moving ? 10 : 17) * dt);

  const targetSpeed = input.moving ? (sprinting ? CONFIG.sprintSpeed : CONFIG.walkSpeed) : 0;
  state.speed = lerp(state.speed, targetSpeed, 1 - Math.exp(-dt * 11));

  if (input.moving) {
    const stepX = wish.x * state.speed * dt;
    const stepZ = wish.z * state.speed * dt;
    const nx = state.pos.x + stepX;
    const nz = state.pos.z + stepZ;
    if (world.canStand(nx, state.pos.z)) state.pos.x = nx;
    if (world.canStand(state.pos.x, nz)) state.pos.z = nz;
  }

  // head bob and footsteps
  const moving = input.moving && state.speed > 0.4;
  state.bob += dt * state.speed * (sprinting ? 2.15 : 1.9);
  const bobAmt = sprinting ? 0.06 : 0.032;
  const bobY = moving ? Math.sin(state.bob * 2) * bobAmt : Math.sin(state.visualTime * 1.2) * 0.006;
  const bobRoll = moving ? Math.sin(state.bob) * (sprinting ? 0.008 : 0.004) : 0;

  camera.position.set(state.pos.x, CONFIG.eyeHeight + bobY, state.pos.z);
  camera.rotation.set(state.pitch, state.yaw, bobRoll);

  if (moving) {
    state.stepTimer -= dt;
    if (state.stepTimer <= 0) {
      audio.footstep(sprinting);
      state.stepTimer = sprinting ? 0.31 : 0.47;
    }
  } else {
    state.stepTimer = Math.min(state.stepTimer, 0.1);
  }

  // flashlight life
  const flickerSeed = Math.sin(state.visualTime * 17.3 + 1.7) * Math.sin(state.visualTime * 5.1);
  const flicker = flickerSeed > 0.982 ? 0.35 : (Math.sin(state.visualTime * 61) > 0.995 ? 0.6 : 1);
  flashlight.intensity = 96 * flicker;

  // souls
  const soul = world.tryCollectSoul(state.pos);
  if (soul) {
    state.collected++;
    updatePips();
    audio.pickup();
    if (state.collected >= CONFIG.soulsNeeded) {
      world.activateExit();
      audio.exitChime();
      ui.compass.classList.add('show');
      showHint('THE EXIT IS OPEN — RUN.', false, 4200);
    } else {
      showHint(`SOUL CLAIMED — ${state.collected} OF ${CONFIG.soulsNeeded}`, false, 2500);
    }
  }

  // exit gate
  const dxExit = state.pos.x - world.exit.pos.x;
  const dzExit = state.pos.z - world.exit.pos.z;
  const exitDist = Math.hypot(dxExit, dzExit);
  if (world.exitActive && exitDist < 1.55) {
    winRun();
  } else if (!world.exitActive && exitDist < 2.1 && state.elapsed - state.exitSealedAt > 5) {
    state.exitSealedAt = state.elapsed;
    showHint('SEALED — FIVE SOULS REQUIRED', true, 2400);
  }

  // compass
  if (world.exitActive) {
    const desired = Math.atan2(-(world.exit.pos.x - state.pos.x), -(world.exit.pos.z - state.pos.z));
    const rel = wrapAngle(desired - state.yaw);
    ui.compassArrow.style.transform = `rotate(${-rel}rad)`;
    ui.compassDist.textContent = `EXIT ${Math.round(exitDist)}m`;
  }

  // demon
  const sprintingForNoise = sprinting;
  demon.update(dt, state.visualTime, {
    mode: 'playing',
    grace: state.grace,
    world,
    playerPos: state.pos,
    sprinting: sprintingForNoise,
    flashlightOn: state.flashlightOn,
    onCatch: beginDeath,
    onGrowl: () => audio.growl(),
  });
  state.threat = demon.threat;

  // audio + ui
  const nearest = world.nearestSoulDistance(state.pos);
  audio.update(dt, state.threat, true, nearest);
  ui.threat.style.opacity = String(clamp(state.threat * 0.82, 0, 0.8));
  ui.stamina.style.width = `${state.stamina}%`;
  ui.stamina.classList.toggle('low', state.stamina < 22);

  const clockText = formatTime(state.elapsed);
  if (clockText !== state.lastClock) {
    state.lastClock = clockText;
    ui.clock.textContent = clockText;
  }

  if (state.hintUntil && performance.now() > state.hintUntil) {
    ui.hint.classList.remove('show');
    state.hintUntil = 0;
  }
}

function updateDying(dt) {
  state.visualTime += dt;
  state.deathT += dt;
  state.shake = Math.max(0, 1 - state.deathT * 0.8);

  const dx = demon.group.position.x - state.pos.x;
  const dz = demon.group.position.z - state.pos.z;
  state.yaw = Math.atan2(-dx, -dz);
  state.pitch = 0.32;
  const s = state.shake;
  const shakeX = (Math.random() - 0.5) * 0.09 * s;
  const shakeY = (Math.random() - 0.5) * 0.09 * s;
  camera.position.set(state.pos.x, CONFIG.eyeHeight + shakeY, state.pos.z);
  camera.rotation.set(state.pitch + (Math.random() - 0.5) * 0.04 * s, state.yaw + shakeX, (Math.random() - 0.5) * 0.06 * s);

  demon.update(dt, state.visualTime, {
    mode: 'dying',
    grace: 0,
    world,
    playerPos: state.pos,
    sprinting: false,
    flashlightOn: state.flashlightOn,
  });

  const pulse = 0.72 + Math.sin(state.deathT * 34) * 0.12;
  setFlash(pulse * clamp(1.2 - state.deathT * 0.35, 0.35, 1));
  audio.update(dt, 1, false);

  if (state.deathT > 1.55) finishDeath();
}

function updateIdle(dt) {
  state.visualTime += dt;
  demon.update(dt, state.visualTime, {
    mode: state.mode === 'paused' ? 'paused' : 'menu',
    grace: 99,
    world,
    playerPos: state.pos,
    sprinting: false,
    flashlightOn: state.flashlightOn,
  });
  if (state.mode === 'menu' || state.mode === 'paused') {
    camera.position.set(state.pos.x, CONFIG.eyeHeight, state.pos.z);
    camera.rotation.set(state.pitch, state.yaw, 0);
  }
  audio.update(dt, 0, false);
}

/* ---------------- main loop ---------------- */

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!Number.isFinite(dt)) dt = 0;
  dt = Math.min(dt, 0.05);

  if (state.mode === 'playing') updatePlaying(dt);
  else if (state.mode === 'dying') updateDying(dt);
  else updateIdle(dt);

  world.update(dt, state.visualTime);
  renderer.render(scene, camera);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(PIXEL_SCALE);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 79 : 71;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

/* ---------------- boot ---------------- */

layout = world.generate();
prepareRun(layout);
demon.update(0, 0, {
  mode: 'menu', grace: 99, world, playerPos: state.pos,
  sprinting: false, flashlightOn: true,
});
renderer.render(scene, camera);
requestAnimationFrame(frame);

setTimeout(() => ui.boot.classList.add('gone'), 30);
setTimeout(() => { ui.boot.style.display = 'none'; }, 700);

// Small public debug surface for automated browser verification.
window.__SOUL_EYES__ = {
  state,
  world,
  demon,
  renderer,
  gpuName,
  lowGfx: LOW_GFX,
  start: () => startRun(false),
  restart: restartRun,
  get mode() { return state.mode; },
};
