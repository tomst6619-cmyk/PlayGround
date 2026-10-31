import {
  WORLD, STREET, PARK, SPAWN, HOUSES, PROPS, propBaseY,
  buildGround, drawProp, drawLampGlow, drawBeacon, LAMPS,
} from './world.js';
import { drawCharacter, drawPortrait } from './characters.js';
import { TAU, clamp, lerp, dist, heartPath, sparklePath, seeded, prefersReducedMotion } from './utils.js';

const RUN_SECONDS = 180;
const TALK_RADIUS = 112;

const FRIENDS = [
  {
    id: 'mia',
    name: 'Mia',
    x: 500, y: 1050, radius: 130,
    status: 'stood up',
    pal: {
      skin: '#f2c39f', skinShade: '#d59f79', hair: '#6d4326', hairStyle: 'long',
      shirt: '#f783a9', shirtShade: '#cf5d83', pants: '#3c4056', shoes: '#f6f2e8',
    },
    prompt: 'I waited with two tickets and a whole popcorn bucket. The movie started without us.',
    choices: [
      { text: 'You\'re right — I stood you up, and I\'m sorry. Movie night, tonight, my treat?', ok: true },
      { text: 'Something came up. You know how it is.', ok: false },
      { text: 'You could\'ve just gone alone, honestly.', ok: false },
    ],
    forgive: '…okay. Tonight. But I\'m picking the film.',
    hurt: 'Right. I knew you\'d say that.',
  },
  {
    id: 'noah',
    name: 'Noah',
    x: 1390, y: 1405, radius: 70,
    status: 'let down',
    pal: {
      skin: '#b9784f', skinShade: '#955c39', hair: '#241f28', hairStyle: 'curly',
      shirt: '#59c9bb', shirtShade: '#35a294', pants: '#2c3246', shoes: '#e9e6dd',
      accessory: 'glasses', brow: 'rgba(20,16,14,0.8)',
    },
    prompt: 'That skateboard was my birthday present. You said you\'d bring it back the next day.',
    choices: [
      { text: 'I lost it and then hid it from you. That was cowardly. I\'ll replace it — and I\'ll tell you how.', ok: true },
      { text: 'Boards get lost. It\'s really not a big deal.', ok: false },
      { text: 'I think someone stole it. Not my fault.', ok: false },
    ],
    forgive: '…you could have just told me. But okay. Thank you for being honest.',
    hurt: 'You\'re doing it again. Hiding.',
  },
  {
    id: 'emma',
    name: 'Emma',
    x: 2080, y: 1040, radius: 120,
    status: 'humiliated',
    pal: {
      skin: '#f0bd9b', skinShade: '#d29a76', hair: '#e8b44d', hairStyle: 'bun',
      shirt: '#a98ee0', shirtShade: '#8468bb', pants: '#383d51', shoes: '#fff6e2',
    },
    prompt: 'People keep looking at me and whispering. I know exactly what you told them.',
    choices: [
      { text: 'I started that rumour. I\'ll set the record straight with everyone — starting right now.', ok: true },
      { text: 'It was just a joke. Everyone is so sensitive.', ok: false },
      { text: 'Who told you that? They\'re lying.', ok: false },
    ],
    forgive: 'You\'d really do that? …okay. Start with the group chat.',
    hurt: 'Wow. You can\'t even admit it.',
  },
  {
    id: 'leo',
    name: 'Leo',
    x: 1330, y: 690, radius: 90,
    status: 'hurt',
    pal: {
      skin: '#dd9c6c', skinShade: '#b97c4f', hair: '#2b211c', hairStyle: 'cap',
      cap: '#e0834b', capDark: '#b8642f', shirt: '#ffb15c', shirtShade: '#d68c3a',
      pants: '#2b3042', shoes: '#f2eee2',
    },
    prompt: 'I looked for you in the stands the whole second half. You said you\'d be there.',
    choices: [
      { text: 'I bailed on your final for a game. That\'s embarrassing. Next match — front row, I promise.', ok: true },
      { text: 'You won anyway, right? So it\'s basically fine.', ok: false },
      { text: 'Football is boring. I did us both a favour.', ok: false },
    ],
    forgive: 'Front row. You said it. I\'m holding you to that.',
    hurt: 'Cool. Good to know where I rank.',
  },
  {
    id: 'zoe',
    name: 'Zoe',
    x: 1010, y: 1440, radius: 100,
    status: 'wounded',
    pal: {
      skin: '#f7cfb4', skinShade: '#d9a98c', hair: '#2f3b52', hairStyle: 'beanie',
      beanie: '#5b6ee0', beanieDark: '#3d4fb4',
      shirt: '#8fce9b', shirtShade: '#69a975', pants: '#3a4053', shoes: '#f1e9da',
    },
    prompt: 'I haven\'t drawn anything since that day. You said it in front of everyone.',
    choices: [
      { text: 'What I said about your art was cruel and wrong. You\'re talented, and I made you doubt it. I\'m sorry.', ok: true },
      { text: 'I was just being honest. Art needs critique.', ok: false },
      { text: 'It\'s just a drawing. You\'ll get over it.', ok: false },
    ],
    forgive: '…I\'m going to draw something tonight. Something loud.',
    hurt: 'Don\'t. Just don\'t.',
  },
];

const CHIP_COLORS = ['#f783a9', '#59c9bb', '#a98ee0', '#ffb15c', '#8fce9b'];

const GIFT_PICKUP = 48;

export class Game {
  constructor(canvas, sound, ui, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = sound;
    this.ui = ui;
    this.controls = controls;
    this.touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
      || new URLSearchParams(location.search).has('touch');
    this.reduced = prefersReducedMotion();

    this.ground = buildGround();
    this.t = 0;
    this.state = 'title';
    this.dpr = 1;
    this.vw = innerWidth;
    this.vh = innerHeight;
    this.camera = { x: SPAWN.x, y: SPAWN.y, scale: 1, shake: 0, shakeX: 0, shakeY: 0 };
    this.keys = new Set();
    this.rain = [];
    this.ripples = [];
    this.particles = [];
    this.fireflies = [];
    this.timeouts = [];
    this.toastTimer = null;
    this.hintFade = 0;

    this.player = {
      x: SPAWN.x, y: SPAWN.y, dir: 1, walkPhase: 0, moving: false, mood: 'neutral',
      name: 'LAMI', isPlayer: true, seed: 0, scale: 1.12, showPrompt: false,
      pal: {
        skin: '#f2c6a0', skinShade: '#d49e77', hair: '#ffd35c', hairStyle: 'swoop',
        shirt: '#2f7cf6', shirtShade: '#1f5cc2', pants: '#2b3346', shoes: '#f7f5ee',
        cape: '#e0453f', logo: 'LAMI',
      },
    };

    this.friends = FRIENDS.map((f, i) => this.makeNpc(f, i));
    this.gifts = PROPS.filter((p) => p.kind === 'gift').map((p) => ({ ...p, collected: false }));
    this.resetRun();

    this.resize();
    this.bindEvents();

    this.fireflySeed = seeded(99);
    for (let i = 0; i < 34; i++) {
      const zone = i % 3;
      const base = zone === 0 ? PARK : zone === 1 ? { x: 600, y: 1200, r: 380 } : { x: 1950, y: 1200, r: 380 };
      const a = this.fireflySeed() * TAU;
      const r = Math.sqrt(this.fireflySeed()) * (base.r || 300);
      this.fireflies.push({
        x: base.x + Math.cos(a) * r,
        y: base.y + Math.sin(a) * r * 0.7,
        phase: this.fireflySeed() * TAU,
        speed: 0.3 + this.fireflySeed() * 0.6,
        size: 1.2 + this.fireflySeed() * 1.4,
      });
    }
    this.makeRain();
  }

  makeNpc(f, i) {
    return {
      ...f,
      homeX: f.x,
      homeY: f.y,
      dir: i % 2 ? -1 : 1,
      walkPhase: 0,
      moving: false,
      mood: 'sad',
      forgiven: false,
      flee: 0,
      talking: false,
      seed: i * 1.7 + 0.4,
      scale: 1.08,
      wanderTimer: 0.5 + i * 0.4,
      target: { x: f.x, y: f.y },
      showPrompt: false,
      choicesOrder: [0, 1, 2],
    };
  }

  bindEvents() {
    this._onResize = () => this.resize();
    addEventListener('resize', this._onResize);
    addEventListener('orientationchange', this._onResize);

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (this.state === 'dialogue') {
        if (['1', '2', '3'].includes(k)) {
          const btn = this.ui.dlgOptions.querySelectorAll('.option')[Number(k) - 1];
          if (btn && !btn.disabled) btn.click();
          e.preventDefault();
        } else if (k === 'escape') {
          this.closeDialogue();
        }
      } else if (this.state === 'playing' && (k === 'e' || k === ' ' || k === 'enter')) {
        this.interact();
        e.preventDefault();
      }
    });

    this.ui.dlgContinue.addEventListener('click', () => this.closeDialogue());
    addEventListener('blur', () => this.keys.clear());
  }

  /* ------------------------------------------------------------- lifecycle */

  resetRun() {
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts = [];
    clearTimeout(this.toastTimer);

    this.timeLeft = RUN_SECONDS;
    this.forgivenCount = 0;
    this.wrongCount = 0;
    this.giftsFound = 0;
    this.pendingWin = false;
    this.activeNpc = null;
    this.particles = [];
    this.ripples = [];
    this.camera.shake = 0;
    this.tapTarget = null;
    this.hintFade = 0;

    this.player.x = SPAWN.x;
    this.player.y = SPAWN.y;
    this.player.dir = 1;
    this.player.moving = false;
    this.player.capeScale = 1;

    for (const f of this.friends) {
      f.x = f.homeX;
      f.y = f.homeY;
      f.forgiven = false;
      f.mood = 'sad';
      f.flee = 0;
      f.talking = false;
      f.showPrompt = false;
      f.moving = false;
      f.choicesOrder = [0, 1, 2]
        .map((v) => ({ v, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map((o) => o.v);
    }
    for (const g of this.gifts) g.collected = false;

    this.controls.axis.x = 0;
    this.controls.axis.y = 0;
    this.controls.tap = null;

    this.updateHearts();
    this.updateChips();
    this.updateTimer(true);
    this.ui.hint.textContent = this.touch ? 'Drag to walk · tap a friend to talk' : 'WASD to move · E to talk';
    this.ui.hint.classList.remove('fade');
    this.ui.action.classList.add('hidden');
    this.ui.dialogue.classList.add('hidden');
  }

  start() {
    this.resetRun();
    this.state = 'playing';
    this.ui.title.classList.add('hidden');
    this.ui.end.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.joystick.classList.toggle('hidden', !this.touch);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.sound.unlock();
    this.toast('Find your five friends — follow the pink light.');
  }

  restart() {
    this.sound.unlock();
    this.resetRun();
    this.state = 'playing';
    this.ui.end.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.joystick.classList.toggle('hidden', !this.touch);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.toast('One evening. Five apologies. Go.');
  }

  end(win) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.activeNpc = null;
    this.ui.dialogue.classList.add('hidden');
    this.ui.action.classList.add('hidden');
    this.ui.joystick.classList.add('hidden');
    this.ui.hud.classList.add('hidden');

    if (win) {
      this.sound.win();
      this.confetti();
      this.ui.endKicker.textContent = 'Sunset · 5 of 5';
      this.ui.endTitle.textContent = 'Forgiven.';
      this.ui.endSub.textContent = 'Five hearts, five chances taken. Turns out the hardest level in Brookhaven is saying it properly.';
    } else {
      this.sound.lose();
      this.ui.endKicker.textContent = `Sunset · ${this.forgivenCount} of 5`;
      this.ui.endTitle.textContent = 'The sun went down.';
      this.ui.endSub.textContent = 'Some words need practice. Luckily, tomorrow is another evening.';
    }

    const mins = Math.floor(this.timeLeft / 60);
    const secs = Math.floor(this.timeLeft % 60);
    this.ui.endStats.innerHTML = [
      `<div class="stat"><b>${this.forgivenCount}/5</b><span>Friends</span></div>`,
      `<div class="stat"><b>${this.giftsFound}</b><span>Flowers</span></div>`,
      `<div class="stat"><b>${this.wrongCount}</b><span>Missteps</span></div>`,
      `<div class="stat"><b>${mins}:${String(secs).padStart(2, '0')}</b><span>Left</span></div>`,
    ].join('');
    this.ui.end.classList.remove('hidden');
  }

  toast(text) {
    const el = this.ui.toast;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------------------------------------------------------------- layout */

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.vw = innerWidth;
    this.vh = innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = `${this.vw}px`;
    this.canvas.style.height = `${this.vh}px`;
    this.camera.scale = clamp(Math.min(this.vw / 1000, this.vh / 760), 0.76, 1.18);
    if (this.touch) this.camera.scale = Math.max(this.camera.scale, 0.82);

    this.vignette = this.ctx.createRadialGradient(
      this.vw / 2, this.vh * 0.46, Math.min(this.vw, this.vh) * 0.32,
      this.vw / 2, this.vh * 0.46, Math.max(this.vw, this.vh) * 0.78,
    );
    this.vignette.addColorStop(0, 'rgba(6,10,18,0)');
    this.vignette.addColorStop(0.62, 'rgba(6,10,18,0.12)');
    this.vignette.addColorStop(1, 'rgba(4,7,14,0.58)');

    this.grade = this.ctx.createLinearGradient(0, 0, this.vw, this.vh);
    this.grade.addColorStop(0, 'rgba(70,110,190,0.18)');
    this.grade.addColorStop(0.55, 'rgba(120,90,150,0.05)');
    this.grade.addColorStop(1, 'rgba(255,160,110,0.2)');

    this.makeRain();
    this.makeLeaves();
  }

  makeLeaves() {
    const rnd = seeded(4242);
    this.leaves = Array.from({ length: 18 }, () => ({
      x: rnd() * this.vw,
      y: rnd() * this.vh,
      vy: 14 + rnd() * 24,
      sway: 10 + rnd() * 22,
      phase: rnd() * TAU,
      spin: (rnd() - 0.5) * 2.4,
      rot: rnd() * TAU,
      size: 2.6 + rnd() * 3,
      color: ['#d19a56', '#bf7a4a', '#c9a75c', '#93a862'][Math.floor(rnd() * 4)],
    }));
  }

  makeRain() {
    const count = this.reduced ? 50 : Math.round(clamp((this.vw * this.vh) / 9500, 70, 210));
    this.rain = Array.from({ length: count }, () => ({
      x: Math.random() * this.vw,
      y: Math.random() * this.vh,
      len: 8 + Math.random() * 16,
      speed: 380 + Math.random() * 380,
      alpha: 0.06 + Math.random() * 0.13,
    }));
  }

  get viewW() { return this.vw / this.camera.scale; }
  get viewH() { return this.vh / this.camera.scale; }

  /* ----------------------------------------------------------------- logic */

  frame(dt) {
    this.t += dt;
    if (this.state === 'playing') this.updatePlaying(dt);
    else this.updateAmbient(dt);

    this.updateRain(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.render();
  }

  updatePlaying(dt) {
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.updateTimer();
    if (this.timeLeft <= 0) {
      this.end(false);
      return;
    }
    this.updatePlayer(dt);
    this.updateFriends(dt);
    this.updateGifts();
    this.updateProximity();
  }

  updateAmbient(dt) {
    for (const f of this.friends) {
      if (f.forgiven) continue;
      this.updateFriendWander(f, dt, 0.55);
    }
    this.player.walkPhase += dt * 1.4;
  }

  updateTimer(force) {
    const secs = Math.ceil(this.timeLeft);
    if (!force && secs === this.lastShownSecond) return;
    this.lastShownSecond = secs;
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, '0');
    this.ui.timer.textContent = `${m}:${s}`;
    this.ui.timer.classList.toggle('warn', secs <= 30);
  }

  updatePlayer(dt) {
    const p = this.player;
    let ax = this.controls.axis.x;
    let ay = this.controls.axis.y;

    const k = this.controls.keyAxis();
    ax += k.x;
    ay += k.y;

    if (this.tapTarget) {
      if (Math.abs(ax) > 0.08 || Math.abs(ay) > 0.08) this.tapTarget = null;
      else {
        const dx = this.tapTarget.x - p.x;
        const dy = this.tapTarget.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 12) {
          this.tapTarget = null;
        } else {
          ax = dx / d;
          ay = dy / d;
        }
      }
    }

    let len = Math.hypot(ax, ay);
    if (len > 1) { ax /= len; ay /= len; len = 1; }

    const speed = 258;
    if (len > 0.06) {
      p.moving = true;
      p.x += ax * speed * dt;
      p.y += ay * speed * dt;
      if (Math.abs(ax) > 0.12) p.dir = ax < 0 ? -1 : 1;
      p.walkPhase += dt * (9 + len * 5);
      this.resolveCollisions(p);
      this.sound.stepTimer -= dt;
      if (this.sound.stepTimer <= 0) {
        this.sound.step();
        this.sound.stepTimer = 0.32;
      }
    } else {
      p.moving = false;
    }
    this.resolveCollisions(p);

    // auto-open dialogue when walking to a tapped friend
    if (this.tapTarget && this.tapTarget.npc && !this.tapTarget.npc.forgiven) {
      const n = this.tapTarget.npc;
      if (dist(p.x, p.y, n.x, n.y) < TALK_RADIUS - 6) {
        this.tapTarget = null;
        this.openDialogue(n);
      }
    }

    if (p.moving && this.hintFade === 0) {
      this.hintFade = 1;
      this.timeouts.push(setTimeout(() => this.ui.hint.classList.add('fade'), 5000));
    }
  }

  resolveCollisions(e) {
    const r = 15;
    e.x = clamp(e.x, 30, WORLD.w - 30);
    e.y = clamp(e.y, 30, WORLD.h - 30);

    for (const h of HOUSES) {
      const nx = clamp(e.x, h.x, h.x + h.w);
      const ny = clamp(e.y, h.y, h.base);
      const dx = e.x - nx;
      const dy = e.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) {
          const left = Math.abs(e.x - h.x);
          const right = Math.abs(h.x + h.w - e.x);
          const top = Math.abs(e.y - h.y);
          const bottom = Math.abs(h.base - e.y);
          const m = Math.min(left, right, top, bottom);
          if (m === left) e.x = h.x - r;
          else if (m === right) e.x = h.x + h.w + r;
          else if (m === top) e.y = h.y - r;
          else e.y = h.base + r;
        } else {
          const d = Math.sqrt(d2);
          e.x = nx + (dx / d) * r;
          e.y = ny + (dy / d) * r;
        }
      }
    }

    const fdx = e.x - PARK.x;
    const fdy = e.y - PARK.y;
    const fd = Math.hypot(fdx, fdy);
    const fountainR = 112 + r;
    if (fd < fountainR) {
      const k = fd || 1;
      e.x = PARK.x + (fdx / k) * fountainR;
      e.y = PARK.y + (fdy / k) * fountainR;
    }
  }

  updateFriends(dt) {
    for (const f of this.friends) {
      if (f.forgiven) {
        f.moving = false;
        continue;
      }
      if (f.talking) {
        f.moving = false;
        continue;
      }
      if (f.flee > 0) {
        f.flee -= dt;
        const dx = f.x - this.player.x;
        const dy = f.y - this.player.y;
        const d = Math.hypot(dx, dy) || 1;
        f.x += (dx / d) * 155 * dt;
        f.y += (dy / d) * 125 * dt;
        f.dir = dx < 0 ? -1 : 1;
        f.moving = true;
        f.walkPhase += dt * 14;
        this.resolveCollisions(f);
        if (f.flee <= 0) f.wanderTimer = 0.4;
        continue;
      }
      this.updateFriendWander(f, dt, 1);
    }
  }

  updateFriendWander(f, dt, rate) {
    f.wanderTimer -= dt * rate;
    if (f.wanderTimer <= 0) {
      const a = Math.random() * TAU;
      const r = Math.random() * (f.radius || 90);
      f.target = { x: f.homeX + Math.cos(a) * r, y: f.homeY + Math.sin(a) * r * 0.6 };
      f.wanderTimer = 1.8 + Math.random() * 3.2;
    }
    const dx = f.target.x - f.x;
    const dy = f.target.y - f.y;
    const d = Math.hypot(dx, dy);
    if (d > 6) {
      f.moving = true;
      const s = 42;
      f.x += (dx / d) * s * dt;
      f.y += (dy / d) * s * dt;
      if (Math.abs(dx) > 2) f.dir = dx < 0 ? -1 : 1;
      f.walkPhase += dt * 7;
      this.resolveCollisions(f);
    } else {
      f.moving = false;
    }
  }

  updateGifts() {
    for (const g of this.gifts) {
      if (g.collected) continue;
      if (dist(this.player.x, this.player.y, g.x, g.y) < GIFT_PICKUP) {
        g.collected = true;
        this.giftsFound++;
        this.timeLeft = Math.min(300, this.timeLeft + 8);
        this.sound.pickup();
        this.sparkles(g.x, g.y - 24, 14, g.hue);
        this.floatText(g.x, g.y - 44, '+8s', '#ffe6a8');
        this.toast('A little more daylight. +8s');
      }
    }
  }

  updateProximity() {
    let nearest = null;
    let best = TALK_RADIUS;
    for (const f of this.friends) {
      if (f.forgiven) continue;
      const d = dist(this.player.x, this.player.y, f.x, f.y);
      if (d < best) {
        best = d;
        nearest = f;
      }
    }
    for (const f of this.friends) {
      f.showPrompt = f === nearest;
      f.promptText = this.touch ? '!' : 'E';
    }
    this.nearFriend = nearest;

    const action = this.ui.action;
    if (this.touch) {
      action.classList.toggle('hidden', this.state !== 'playing' || !nearest);
      action.disabled = !nearest;
      action.textContent = nearest ? 'Talk' : 'Find';
    }
    if (nearest) {
      this.ui.hint.textContent = this.touch ? `Tap Talk to speak with ${nearest.name}` : `Press E to talk to ${nearest.name}`;
      this.ui.hint.classList.remove('fade');
    } else {
      this.ui.hint.textContent = this.touch ? 'Drag to walk · tap a friend to talk' : 'WASD to move · E to talk';
    }
  }

  interact() {
    if (this.state !== 'playing') return;
    if (this.nearFriend) this.openDialogue(this.nearFriend);
    else {
      const n = this.nearestFriend();
      if (n) this.toast(`${n.name} is somewhere over there — follow the pink light.`);
    }
  }

  handleTap(sx, sy) {
    if (this.state !== 'playing') return;
    const cam = this.camera;
    const wx = cam.x + (sx - this.vw / 2) / cam.scale;
    const wy = cam.y + (sy - this.vh / 2) / cam.scale;

    // did they tap a friend?
    let tapped = null;
    let bd = 64;
    for (const f of this.friends) {
      if (f.forgiven) continue;
      const d = dist(wx, wy, f.x, f.y - 26);
      if (d < bd) { bd = d; tapped = f; }
    }
    if (tapped) {
      if (dist(this.player.x, this.player.y, tapped.x, tapped.y) < TALK_RADIUS) {
        this.openDialogue(tapped);
      } else {
        this.tapTarget = { x: tapped.x, y: tapped.y, npc: tapped };
      }
      return;
    }
    this.tapTarget = {
      x: clamp(wx, 40, WORLD.w - 40),
      y: clamp(wy, 40, WORLD.h - 40),
    };
  }

  nearestFriend() {
    let best = null;
    let bd = Infinity;
    for (const f of this.friends) {
      if (f.forgiven) continue;
      const d = dist(this.player.x, this.player.y, f.x, f.y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /* -------------------------------------------------------------- dialogue */

  openDialogue(npc) {
    if (this.state !== 'playing' || npc.forgiven) return;
    this.state = 'dialogue';
    this.activeNpc = npc;
    npc.talking = true;
    npc.moving = false;
    this.sound.click();

    drawPortrait(this.ui.portrait, npc.pal, 'sad');
    this.ui.dlgMood.style.color = '';
    this.ui.dlgMood.style.borderColor = '';
    this.ui.dlgMood.style.background = '';
    this.ui.dlgName.textContent = npc.name;
    this.ui.dlgMood.textContent = npc.status;
    this.ui.dlgLine.textContent = npc.prompt;
    this.ui.dlgContinue.classList.add('hidden');
    this.ui.dlgOptions.classList.remove('hidden');
    this.ui.dlgOptions.innerHTML = '';

    npc.choicesOrder.forEach((idx, slot) => {
      const choice = npc.choices[idx];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      btn.innerHTML = `<span class="key">${slot + 1}</span><span>${choice.text}</span>`;
      btn.addEventListener('click', () => this.chooseChoice(npc, choice, btn));
      this.ui.dlgOptions.appendChild(btn);
    });

    this.ui.dialogue.classList.remove('hidden');
    this.ui.action.classList.add('hidden');
    this.ui.joystick.classList.add('hidden');
    this.ui.hint.classList.add('fade');
    if (this.touch) this.ui.hint.textContent = 'Choose what you say';
    this.ui.dlgOptions.querySelector('.option')?.focus({ preventScroll: true });
  }

  chooseChoice(npc, choice, btn) {
    if (this.state !== 'dialogue' || npc.forgiven) return;
    this.ui.dlgOptions.querySelectorAll('.option').forEach((b) => { b.disabled = true; });
    btn.classList.add(choice.ok ? 'ok' : 'bad');

    if (choice.ok) {
      npc.forgiven = true;
      npc.mood = 'happy';
      npc.showPrompt = false;
      this.forgivenCount++;
      this.sound.chime();
      this.hearts(npc.x, npc.y - 90, 12);
      this.ui.dlgLine.textContent = npc.forgive;
      this.ui.dlgMood.textContent = 'forgiven';
      this.ui.dlgMood.style.color = '#bff5d8';
      this.ui.dlgMood.style.borderColor = 'rgba(120,230,180,0.4)';
      this.ui.dlgMood.style.background = 'rgba(80,200,150,0.14)';
      drawPortrait(this.ui.portrait, npc.pal, 'happy');
      this.ui.dlgOptions.classList.add('hidden');
      this.ui.dlgContinue.classList.remove('hidden');
      this.ui.dlgContinue.textContent = this.forgivenCount === 5 ? 'One last sunset' : 'Continue';
      this.updateHearts();
      this.updateChips();
      if (this.forgivenCount === 5) this.pendingWin = true;
      this.ui.dlgContinue.focus({ preventScroll: true });
    } else {
      this.wrongCount++;
      this.timeLeft = Math.max(0, this.timeLeft - 12);
      this.updateTimer();
      this.sound.wrong();
      this.camera.shake = 0.5;
      npc.mood = 'sad';
      this.ui.dlgLine.textContent = npc.hurt;
      this.ui.dlgMood.textContent = 'needs space';
      this.ui.dlgMood.style.color = '#ffb0c4';
      this.ui.dlgMood.style.borderColor = 'rgba(255,111,156,0.3)';
      this.ui.dlgMood.style.background = 'rgba(255,111,156,0.13)';
      this.ui.dlgOptions.classList.add('hidden');
      this.ui.dlgContinue.classList.remove('hidden');
      this.ui.dlgContinue.textContent = 'Let them go';
      this.floatText(npc.x, npc.y - 120, '−12s', '#ff9aa8');
      this.updateChips();
      this.timeouts.push(setTimeout(() => this.closeDialogue(true), 2600));
      this.ui.dlgContinue.focus({ preventScroll: true });
    }
  }

  closeDialogue(fled = false) {
    if (this.state !== 'dialogue') return;
    const npc = this.activeNpc;
    this.ui.dialogue.classList.add('hidden');
    this.ui.dlgOptions.innerHTML = '';
    this.ui.dlgMood.style.color = '';
    this.ui.dlgMood.style.borderColor = '';
    this.ui.dlgMood.style.background = '';
    this.activeNpc = null;
    if (npc) {
      npc.talking = false;
      if (!npc.forgiven && (fled || npc.mood === 'sad')) {
        npc.flee = 3.4;
      }
    }
    if (this.pendingWin) {
      this.state = 'playing';
      this.timeouts.push(setTimeout(() => {
        this.pendingWin = false;
        this.end(true);
      }, 700));
      return;
    }
    if (this.timeLeft <= 0) {
      this.end(false);
      return;
    }
    this.state = 'playing';
    this.ui.joystick.classList.toggle('hidden', !this.touch);
    this.updateProximity();
  }

  /* ------------------------------------------------------------------- HUD */

  updateHearts() {
    const hearts = this.ui.hearts.querySelectorAll('.heart');
    hearts.forEach((el, i) => el.classList.toggle('on', i < this.forgivenCount));
  }

  updateChips() {
    const chips = this.ui.friends.querySelectorAll('.chip');
    chips.forEach((el, i) => el.classList.toggle('done', this.friends[i].forgiven));
  }

  /* -------------------------------------------------------------- particles */

  hearts(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        type: 'heart',
        x: x + (Math.random() - 0.5) * 44,
        y: y + (Math.random() - 0.5) * 18,
        vx: (Math.random() - 0.5) * 46,
        vy: -48 - Math.random() * 60,
        life: 1.5 + Math.random() * 0.8,
        max: 2.3,
        size: 7 + Math.random() * 9,
        color: Math.random() > 0.4 ? '#ff7ea6' : '#ffd0dd',
        rot: (Math.random() - 0.5) * 0.5,
      });
    }
  }

  sparkles(x, y, n = 10, color = '#ffe6a8') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = 40 + Math.random() * 90;
      this.particles.push({
        type: 'spark',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        life: 0.7 + Math.random() * 0.5,
        max: 1.2,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  floatText(x, y, text, color = '#fff') {
    this.particles.push({ type: 'text', x, y, vx: 0, vy: -34, life: 1.2, max: 1.2, text, color });
  }

  confetti() {
    const cx = this.ui ? this.vw / 2 : 0;
    for (let i = 0; i < 70; i++) {
      this.particles.push({
        type: 'heart',
        screen: true,
        x: Math.random() * this.vw,
        y: this.vh * 0.18 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 90,
        vy: 40 + Math.random() * 90,
        life: 2.6 + Math.random() * 1.6,
        max: 4.2,
        size: 8 + Math.random() * 12,
        color: ['#ff7ea6', '#ffd0dd', '#ffcf7a', '#9fc0ff'][i % 4],
        rot: (Math.random() - 0.5) * 0.8,
        screenX: cx,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'heart') {
        p.vy += 12 * dt;
        p.vx *= 1 - 1.2 * dt;
        p.rot = (p.rot || 0) + dt * 0.4;
      } else if (p.type === 'spark') {
        p.vy += 160 * dt;
        p.vx *= 1 - 2.4 * dt;
      } else {
        p.vy *= 1 - 1.6 * dt;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateRain(dt) {
    const wind = 55;
    for (const l of this.leaves) {
      l.phase += dt * 0.9;
      l.x += Math.sin(l.phase) * l.sway * dt + 8 * dt;
      l.y += l.vy * dt;
      l.rot += l.spin * dt;
      if (l.y > this.vh + 12) { l.y = -12; l.x = Math.random() * this.vw; }
      if (l.x > this.vw + 16) l.x = -16;
    }
    for (const d of this.rain) {
      d.y += d.speed * dt;
      d.x += wind * dt;
      if (d.y > this.vh + 24) {
        d.y = -24;
        d.x = Math.random() * (this.vw + 120) - 60;
      }
      if (d.x > this.vw + 30) d.x = -30;
    }
    if (this.reduced) return;
    if (Math.random() < dt * 9) {
      const x = this.camera.x + (Math.random() - 0.5) * this.viewW;
      const y = this.camera.y + (Math.random() - 0.5) * this.viewH;
      this.ripples.push({ x, y, life: 0.55, max: 0.55, r: 2 });
    }
    for (const r of this.ripples) {
      r.life -= dt;
      r.r += 22 * dt;
    }
    this.ripples = this.ripples.filter((r) => r.life > 0);
  }

  /* ----------------------------------------------------------------- camera */

  updateCamera(dt) {
    const cam = this.camera;
    const viewW = this.viewW;
    const viewH = this.viewH;
    let tx = this.player.x;
    let ty = this.player.y;

    if (this.state === 'title') {
      tx = SPAWN.x + Math.sin(this.t * 0.13) * 160;
      ty = SPAWN.y - 40 + Math.cos(this.t * 0.1) * 60;
    } else if (this.activeNpc) {
      tx = lerp(this.player.x, this.activeNpc.x, 0.35);
      ty = lerp(this.player.y, this.activeNpc.y, 0.35);
    }

    cam.x = lerp(cam.x, tx, 1 - Math.exp(-5 * dt));
    cam.y = lerp(cam.y, ty, 1 - Math.exp(-5 * dt));

    cam.x = viewW >= WORLD.w ? WORLD.w / 2 : clamp(cam.x, viewW / 2, WORLD.w - viewW / 2);
    cam.y = viewH >= WORLD.h ? WORLD.h / 2 : clamp(cam.y, viewH / 2, WORLD.h - viewH / 2);

    if (cam.shake > 0) {
      cam.shake = Math.max(0, cam.shake - dt);
      const amp = cam.shake * 14;
      cam.shakeX = (Math.random() - 0.5) * amp;
      cam.shakeY = (Math.random() - 0.5) * amp;
    } else {
      cam.shakeX = 0;
      cam.shakeY = 0;
    }
  }

  /* ------------------------------------------------------------------ draw */

  render() {
    const ctx = this.ctx;
    const cam = this.camera;
    const viewW = this.viewW;
    const viewH = this.viewH;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b1018';
    ctx.fillRect(0, 0, this.vw, this.vh);

    ctx.save();
    ctx.translate(this.vw / 2 + cam.shakeX, this.vh / 2 + cam.shakeY);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-cam.x, -cam.y);

    // ground (only the visible slice)
    const sx = clamp(Math.floor(cam.x - viewW / 2) - 4, 0, WORLD.w);
    const sy = clamp(Math.floor(cam.y - viewH / 2) - 4, 0, WORLD.h);
    const sw = clamp(Math.ceil(viewW) + 8, 1, WORLD.w - sx);
    const sh = clamp(Math.ceil(viewH) + 8, 1, WORLD.h - sy);
    ctx.drawImage(this.ground, sx, sy, sw, sh, sx, sy, sw, sh);

    // fireflies behind people
    this.drawFireflies(ctx);

    // beacons for friends still waiting
    for (const f of this.friends) {
      if (!f.forgiven && this.state !== 'title') drawBeacon(ctx, f.x, f.y, this.t);
    }

    // depth-sorted world
    const drawables = [];
    for (const p of PROPS) drawables.push({ y: propBaseY(p), draw: () => drawProp(ctx, p, this.t) });
    for (const g of this.gifts) {
      if (g.collected) continue;
      drawables.push({ y: g.y + 14, draw: () => drawProp(ctx, g, this.t) });
    }
    for (const f of this.friends) drawables.push({ y: f.y + 1, draw: () => drawCharacter(ctx, f, this.t) });
    drawables.push({ y: this.player.y + 1, draw: () => drawCharacter(ctx, this.player, this.t) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // lamp haze over everything
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly] of LAMPS) drawLampGlow(ctx, lx, ly, this.t);
    const fountainGlow = ctx.createRadialGradient(PARK.x, PARK.y - 30, 10, PARK.x, PARK.y - 30, 190);
    fountainGlow.addColorStop(0, 'rgba(120,230,230,0.12)');
    fountainGlow.addColorStop(1, 'rgba(120,230,230,0)');
    ctx.fillStyle = fountainGlow;
    ctx.beginPath();
    ctx.arc(PARK.x, PARK.y - 30, 190, 0, TAU);
    ctx.fill();
    ctx.restore();

    // rain ripples on the ground
    ctx.strokeStyle = 'rgba(200,225,255,0.2)';
    ctx.lineWidth = 1;
    for (const r of this.ripples) {
      const a = r.life / r.max;
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.42, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // world particles
    this.drawParticles(ctx, false);

    ctx.restore();

    // ---------- screen space ----------
    this.drawRain(ctx);
    this.drawOverlays(ctx);
    this.drawParticles(ctx, true);
    this.drawMinimap();
  }

  drawFireflies(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) {
      const a = 0.35 + Math.sin(this.t * f.speed * 2 + f.phase) * 0.3;
      if (a <= 0.05) continue;
      const x = f.x + Math.sin(this.t * f.speed + f.phase) * 16;
      const y = f.y + Math.cos(this.t * f.speed * 0.8 + f.phase) * 10 - 10;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
      g.addColorStop(0, `rgba(220,255,180,${a})`);
      g.addColorStop(1, 'rgba(180,255,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,220,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, f.size * 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles(ctx, screen) {
    for (const p of this.particles) {
      if (Boolean(p.screen) !== screen) continue;
      const a = clamp(p.life / p.max, 0, 1);
      if (p.type === 'heart') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        heartPath(ctx, 0, 0, p.size / 5);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'spark') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        sparklePath(ctx, p.x, p.y, p.size);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'text') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = '800 15px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(10,12,20,0.5)';
        ctx.fillText(p.text, p.x + 1, p.y + 1);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }
    }
  }

  drawRain(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const l of this.leaves) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size * 0.45, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,50,20,0.35)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-l.size, 0);
      ctx.lineTo(l.size, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const d of this.rain) {
      ctx.strokeStyle = `rgba(190,215,255,${d.alpha})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.18, d.y + d.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawOverlays(ctx) {
    // dusk deepens as the timer runs out
    const ratio = clamp(this.timeLeft / RUN_SECONDS, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(48,58,108,${0.06 + (1 - ratio) * 0.17})`;
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = this.grade;
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.restore();

    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, this.vw, this.vh);

    if (this.state === 'title' || this.state === 'over') {
      ctx.fillStyle = 'rgba(6,8,16,0.28)';
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
  }

  drawMinimap() {
    if (!this.ui.minimap || this.ui.hud.classList.contains('hidden')) return;
    const c = this.ui.minimap;
    const g = c.getContext('2d');
    const W = c.width;
    const H = c.height;
    const s = W / WORLD.w;

    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(16,22,36,0.9)';
    g.fillRect(0, 0, W, H);

    g.fillStyle = 'rgba(64,92,70,0.75)';
    g.fillRect(0, 0, W, H);

    g.fillStyle = 'rgba(58,64,80,0.9)';
    g.fillRect(0, STREET.top * s, W, (STREET.bottom - STREET.top) * s);

    g.fillStyle = 'rgba(120,112,98,0.9)';
    g.beginPath();
    g.arc(PARK.x * s, PARK.y * s, (PARK.r - 30) * s, 0, TAU);
    g.fill();

    g.fillStyle = 'rgba(120,150,125,0.9)';
    g.beginPath();
    g.arc(PARK.x * s, PARK.y * s, (PARK.plaza + 4) * s, 0, TAU);
    g.fill();

    g.fillStyle = 'rgba(210,190,160,0.5)';
    for (const h of HOUSES) {
      g.fillRect(h.x * s, h.y * s, h.w * s, (h.base - h.y) * s);
    }

    // friends
    for (const f of this.friends) {
      const x = f.x * s;
      const y = f.y * s;
      if (f.forgiven) {
        g.fillStyle = '#ff7ea6';
        heartPath(g, x, y - 3, 0.95);
        g.fill();
      } else {
        const pulse = 1 + Math.sin(this.t * 4 + f.seed) * 0.25;
        g.strokeStyle = 'rgba(255,150,185,0.55)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, y, 5.5 * pulse, 0, TAU);
        g.stroke();
        g.fillStyle = '#ffd9e4';
        g.beginPath();
        g.arc(x, y, 2.6, 0, TAU);
        g.fill();
      }
    }

    // player
    const px = this.player.x * s;
    const py = this.player.y * s;
    g.fillStyle = '#78a9ff';
    g.beginPath();
    g.arc(px, py, 3.4, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1;
    g.stroke();

    // viewport rectangle
    const vw = this.viewW * s;
    const vh = this.viewH * s;
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 1;
    g.strokeRect(this.camera.x * s - vw / 2, this.camera.y * s - vh / 2, vw, vh);

    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
  }
}

export const FRIEND_DATA = FRIENDS;
export const CHIP_INFO = FRIENDS.map((f, i) => ({ name: f.name, color: CHIP_COLORS[i] }));
