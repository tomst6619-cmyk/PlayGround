(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const STORAGE_KEY = 'ufo-wache.best';
  const SOUND_KEY = 'ufo-wache.sound';

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d', { alpha: false });

  const dom = {
    timer: document.getElementById('timer'),
    timeValue: document.getElementById('timeValue'),
    timeFill: document.getElementById('timeFill'),
    scoreValue: document.getElementById('scoreValue'),
    comboBadge: document.getElementById('comboBadge'),
    comboText: document.getElementById('comboText'),
    comboFill: document.getElementById('comboFill'),
    status: document.getElementById('status'),
    hint: document.getElementById('scopeHint'),
    hintText: document.getElementById('scopeHintText'),
    soundBtn: document.getElementById('soundBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    startScreen: document.getElementById('startScreen'),
    endScreen: document.getElementById('endScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    startBtn: document.getElementById('startBtn'),
    againBtn: document.getElementById('againBtn'),
    homeBtn: document.getElementById('homeBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    quitBtn: document.getElementById('quitBtn'),
    bestLine: document.getElementById('bestLine'),
    endRank: document.getElementById('endRank'),
    endScore: document.getElementById('endScore'),
    endRecord: document.getElementById('endRecord'),
    endScans: document.getElementById('endScans'),
    endMisses: document.getElementById('endMisses'),
    endCombo: document.getElementById('endCombo'),
    endAccuracy: document.getElementById('endAccuracy')
  };

  const number = new Intl.NumberFormat('de-DE');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const rgba = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  const now = () => performance.now();
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  function loadBest() {
    try {
      return Math.max(0, Number(localStorage.getItem(STORAGE_KEY)) || 0);
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(STORAGE_KEY, String(Math.round(value)));
    } catch {
      /* private mode */
    }
  }

  function loadSound() {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  function saveSound(enabled) {
    try {
      localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
    } catch {
      /* private mode */
    }
  }

  const state = {
    mode: 'start',
    time: 75,
    maxTime: 75,
    elapsed: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    bestCombo: 1,
    scans: 0,
    misses: 0,
    spawnTimer: 1.2,
    decoyTimer: 3.4,
    shootTimer: 2.6,
    objects: [],
    particles: [],
    floaters: [],
    ripples: [],
    shootingStars: [],
    stars: [],
    twinkles: [],
    aim: {
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      active: false,
      touch: false,
      fingerX: 0,
      fingerY: 0,
      fingerLife: 0
    },
    scanTarget: null,
    scanProgress: 0,
    decoyTarget: null,
    shake: 0,
    flash: 0,
    flashRGB: [255, 110, 100],
    lastSecond: 75,
    moon: { x: 0, y: 0, r: 40 }
  };

  let W = 0;
  let H = 0;
  let DPR = 1;
  let bgCanvas = null;
  let fgCanvas = null;
  let lastFrame = 0;
  let resizeQueued = false;
  let statusTimer = 0;
  let hintTimer = 0;
  let endShowTimer = 0;
  let best = loadBest();

  const keys = new Set();

  /* ------------------------------------------------------------------ */
  /* Audio                                                               */
  /* ------------------------------------------------------------------ */

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.scanOsc = null;
      this.scanGain = null;
      this.enabled = loadSound();
      this.scanOn = false;
    }

    init() {
      if (this.ctx) {
        this.resume();
        return;
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      try {
        const audio = new AudioContext();
        this.ctx = audio;
        this.master = audio.createGain();
        this.master.gain.value = this.enabled ? 0.42 : 0;
        this.master.connect(audio.destination);
        this.buildAmbient();
        this.buildScanner();
      } catch {
        this.ctx = null;
      }
    }

    buildAmbient() {
      const c = this.ctx;
      if (!c) return;
      const pad = c.createGain();
      pad.gain.value = 0.026;
      pad.connect(this.master);

      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 360;
      filter.Q.value = 0.7;
      filter.connect(pad);

      const frequencies = [55, 82.41, 110];
      frequencies.forEach((freq, index) => {
        const osc = c.createOscillator();
        osc.type = index === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const gain = c.createGain();
        gain.gain.value = index === 0 ? 0.55 : 0.16;
        osc.connect(gain);
        gain.connect(filter);
        osc.start();
      });

      const lfo = c.createOscillator();
      lfo.frequency.value = 0.045;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 120;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
    }

    buildScanner() {
      const c = this.ctx;
      if (!c) return;
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 200;
      const gain = c.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      this.scanOsc = osc;
      this.scanGain = gain;
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    suspend() {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    }

    setEnabled(enabled) {
      this.enabled = enabled;
      saveSound(enabled);
      dom.soundBtn.setAttribute('aria-pressed', String(enabled));
      dom.soundBtn.setAttribute('aria-label', enabled ? 'Ton ausschalten' : 'Ton einschalten');
      if (!this.ctx) return;
      this.resume();
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(enabled ? 0.42 : 0, t, 0.06);
    }

    toggle() {
      this.init();
      this.setEnabled(!this.enabled);
    }

    scan(progress, active) {
      if (!this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime;
      if (this.scanOn !== active) {
        this.scanOn = active;
        this.scanGain.gain.setTargetAtTime(active ? 0.022 : 0, t, active ? 0.03 : 0.07);
      }
      if (active) {
        this.scanOsc.frequency.setTargetAtTime(190 + progress * 330, t, 0.035);
      }
    }

    blip(freq = 880, duration = 0.07, volume = 0.06, type = 'sine') {
      if (!this.ctx || !this.enabled) return;
      const c = this.ctx;
      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.03);
    }

    success() {
      if (!this.ctx || !this.enabled) return;
      const c = this.ctx;
      const t = c.currentTime;
      [523.25, 783.99, 1046.5].forEach((freq, index) => {
        const start = t + index * 0.075;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.07, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.52);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(start);
        osc.stop(start + 0.56);
      });
    }

    fail() {
      if (!this.ctx || !this.enabled) return;
      const c = this.ctx;
      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(165, t);
      osc.frequency.exponentialRampToValueAtTime(62, t + 0.3);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.045, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.38);
    }

    tick() {
      this.blip(1240, 0.035, 0.025, 'sine');
    }

    finish() {
      if (!this.ctx || !this.enabled) return;
      const c = this.ctx;
      const t = c.currentTime;
      [392, 523.25, 659.25, 783.99].forEach((freq, index) => {
        const start = t + index * 0.12;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.045, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(start);
        osc.stop(start + 0.95);
      });
    }
  }

  const sound = new SoundEngine();

  /* ------------------------------------------------------------------ */
  /* Sky                                                                 */
  /* ------------------------------------------------------------------ */

  function gauss() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function makeStars() {
    const count = Math.round(clamp((W * H) / 4600, 110, 330));
    const stars = [];
    const colors = [
      [214, 236, 255],
      [214, 236, 255],
      [214, 236, 255],
      [255, 241, 208],
      [174, 243, 244],
      [191, 204, 255]
    ];
    const angle = -0.36;
    const cx = W * 0.52;
    const cy = H * 0.46;

    for (let i = 0; i < count; i += 1) {
      let x;
      let y;
      if (i < count * 0.4) {
        const along = rand(-0.64, 0.64) * W;
        const offset = gauss() * H * 0.085;
        x = cx + Math.cos(angle) * along + Math.cos(angle + Math.PI / 2) * offset;
        y = cy + Math.sin(angle) * along + Math.sin(angle + Math.PI / 2) * offset;
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) {
          i -= 1;
          continue;
        }
      } else {
        x = Math.random() * W;
        y = Math.random() * H * 0.86;
      }
      const bright = Math.random();
      stars.push({
        x,
        y,
        size: bright > 0.94 ? rand(1.35, 2.1) : rand(0.35, 1.25),
        alpha: bright > 0.94 ? rand(0.65, 1) : rand(0.16, 0.7),
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: rand(0, TAU),
        speed: rand(0.5, 2),
        twinkle: Math.random() < 0.32
      });
    }
    state.stars = stars;
    state.twinkles = stars.filter((star) => star.twinkle);
  }

  function makeLayer() {
    const layer = document.createElement('canvas');
    layer.width = Math.max(1, Math.round(W * DPR));
    layer.height = Math.max(1, Math.round(H * DPR));
    const g = layer.getContext('2d');
    g.scale(DPR, DPR);
    return { layer, g };
  }

  function nebulaBlob(g, x, y, radius, squash, angle, color) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.scale(1, squash);
    const gradient = g.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, color.replace(/[\d.]+\)$/, (match) => `${Number.parseFloat(match) * 0.45})`));
    gradient.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gradient;
    g.beginPath();
    g.arc(0, 0, radius, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawMoonDisc(g, moon) {
    const halo = g.createRadialGradient(moon.x, moon.y, moon.r * 0.7, moon.x, moon.y, moon.r * 4.4);
    halo.addColorStop(0, 'rgba(206,226,235,0.15)');
    halo.addColorStop(0.35, 'rgba(168,204,222,0.065)');
    halo.addColorStop(1, 'rgba(120,180,210,0)');
    g.fillStyle = halo;
    g.beginPath();
    g.arc(moon.x, moon.y, moon.r * 4.4, 0, TAU);
    g.fill();

    const disc = g.createRadialGradient(
      moon.x - moon.r * 0.34,
      moon.y - moon.r * 0.38,
      moon.r * 0.12,
      moon.x,
      moon.y,
      moon.r
    );
    disc.addColorStop(0, '#fffdf1');
    disc.addColorStop(0.5, '#efe9d2');
    disc.addColorStop(0.82, '#d4cdb1');
    disc.addColorStop(1, '#aaa48c');
    g.fillStyle = disc;
    g.beginPath();
    g.arc(moon.x, moon.y, moon.r, 0, TAU);
    g.fill();

    g.save();
    g.beginPath();
    g.arc(moon.x, moon.y, moon.r, 0, TAU);
    g.clip();
    const craters = [
      [-0.3, -0.22, 0.17],
      [0.2, -0.34, 0.11],
      [0.32, 0.16, 0.14],
      [-0.14, 0.38, 0.1],
      [-0.45, 0.15, 0.075],
      [0.05, -0.03, 0.085],
      [0.42, -0.12, 0.06],
      [-0.06, 0.16, 0.05]
    ];
    craters.forEach(([cx, cy, cr]) => {
      g.fillStyle = 'rgba(103,101,82,0.14)';
      g.beginPath();
      g.arc(moon.x + cx * moon.r, moon.y + cy * moon.r, cr * moon.r, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(255,255,245,0.1)';
      g.lineWidth = 0.7;
      g.beginPath();
      g.arc(
        moon.x + cx * moon.r - cr * moon.r * 0.12,
        moon.y + cy * moon.r - cr * moon.r * 0.12,
        cr * moon.r,
        Math.PI * 0.9,
        Math.PI * 1.7
      );
      g.stroke();
    });
    const shade = g.createLinearGradient(moon.x - moon.r, moon.y, moon.x + moon.r, moon.y);
    shade.addColorStop(0, 'rgba(6,12,20,0)');
    shade.addColorStop(0.68, 'rgba(6,12,20,0.03)');
    shade.addColorStop(1, 'rgba(6,12,20,0.34)');
    g.fillStyle = shade;
    g.fillRect(moon.x - moon.r, moon.y - moon.r, moon.r * 2, moon.r * 2);
    g.restore();
  }

  function bakeBackground() {
    const { layer, g } = makeLayer();

    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#02040b');
    sky.addColorStop(0.34, '#05101f');
    sky.addColorStop(0.62, '#081a2a');
    sky.addColorStop(0.82, '#0b2433');
    sky.addColorStop(1, '#123039');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    const horizon = g.createRadialGradient(W * 0.5, H * 0.83, 0, W * 0.5, H * 0.83, Math.max(W, H) * 0.8);
    horizon.addColorStop(0, 'rgba(48,120,126,0.2)');
    horizon.addColorStop(0.34, 'rgba(24,72,88,0.11)');
    horizon.addColorStop(0.7, 'rgba(10,32,48,0.04)');
    horizon.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = horizon;
    g.fillRect(0, 0, W, H);

    const angle = -0.36;
    const cx = W * 0.52;
    const cy = H * 0.46;
    g.save();
    g.globalCompositeOperation = 'lighter';
    nebulaBlob(g, cx, cy, W * 0.46, 0.25, angle, 'rgba(48,105,150,0.11)');
    nebulaBlob(g, cx - W * 0.23, cy + H * 0.04, W * 0.28, 0.3, angle, 'rgba(102,83,164,0.075)');
    nebulaBlob(g, cx + W * 0.2, cy - H * 0.05, W * 0.32, 0.28, angle, 'rgba(55,145,145,0.06)');
    nebulaBlob(g, cx + W * 0.02, cy, W * 0.19, 0.22, angle, 'rgba(176,196,222,0.07)');
    g.restore();

    state.stars.forEach((star) => {
      g.fillStyle = `rgba(${star.color[0]},${star.color[1]},${star.color[2]},${star.alpha})`;
      g.beginPath();
      g.arc(star.x, star.y, star.size, 0, TAU);
      g.fill();
      if (star.size > 1.35) {
        g.strokeStyle = `rgba(${star.color[0]},${star.color[1]},${star.color[2]},${star.alpha * 0.28})`;
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(star.x - star.size * 3.4, star.y);
        g.lineTo(star.x + star.size * 3.4, star.y);
        g.moveTo(star.x, star.y - star.size * 3.4);
        g.lineTo(star.x, star.y + star.size * 3.4);
        g.stroke();
      }
    });

    state.moon = {
      x: W * 0.795,
      y: H * 0.18,
      r: clamp(Math.min(W, H) * 0.051, 22, 52)
    };
    drawMoonDisc(g, state.moon);

    g.save();
    g.globalCompositeOperation = 'lighter';
    nebulaBlob(g, W * 0.18, H * 0.73, W * 0.28, 0.17, -0.1, 'rgba(112,166,177,0.045)');
    nebulaBlob(g, W * 0.79, H * 0.7, W * 0.24, 0.13, 0.06, 'rgba(126,147,170,0.035)');
    g.restore();

    const haze = g.createLinearGradient(0, H * 0.66, 0, H * 0.9);
    haze.addColorStop(0, 'rgba(35,92,99,0)');
    haze.addColorStop(0.65, 'rgba(35,92,99,0.09)');
    haze.addColorStop(1, 'rgba(20,58,68,0.02)');
    g.fillStyle = haze;
    g.fillRect(0, H * 0.66, W, H * 0.24);

    bgCanvas = layer;
  }

  function ridgeLine(x, base, amplitude, phase) {
    return (
      base +
      Math.sin(x * 0.0062 + phase) * amplitude +
      Math.sin(x * 0.017 + phase * 1.9) * amplitude * 0.42 +
      Math.sin(x * 0.0031 + phase * 0.6) * amplitude * 0.55
    );
  }

  function drawPine(g, x, y, height, width, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, y - height);
    g.lineTo(x + width * 0.5, y);
    g.lineTo(x - width * 0.5, y);
    g.closePath();
    g.fill();
    g.fillRect(x - width * 0.07, y - 2, width * 0.14, height * 0.12 + 2);
  }

  function bakeForeground() {
    const { layer, g } = makeLayer();
    const scale = clamp(Math.min(W, H) / 820, 0.78, 1.25);

    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W + 16; x += 12) {
      g.lineTo(x, ridgeLine(x, H * 0.808, 13, 1.3));
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = '#07141d';
    g.fill();

    g.beginPath();
    for (let x = 0; x <= W + 16; x += 12) {
      const y = ridgeLine(x, H * 0.808, 13, 1.3);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(126,243,220,0.06)';
    g.lineWidth = 1;
    g.stroke();

    for (let x = 10; x < W; x += rand(24, 48)) {
      const y = ridgeLine(x, H * 0.808, 13, 1.3) + 2;
      drawPine(g, x, y, rand(5, 16) * scale, rand(5, 10) * scale, '#07141d');
    }

    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W + 16; x += 10) {
      g.lineTo(x, ridgeLine(x, H * 0.872, 18, 3.1));
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = '#03090f';
    g.fill();

    g.beginPath();
    for (let x = 0; x <= W + 16; x += 10) {
      const y = ridgeLine(x, H * 0.872, 18, 3.1);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(126,243,220,0.045)';
    g.lineWidth = 1;
    g.stroke();

    for (let x = -8; x < W; x += rand(18, 40)) {
      const y = ridgeLine(x, H * 0.872, 18, 3.1) + 3;
      drawPine(g, x, y, rand(8, 26) * scale, rand(7, 15) * scale, '#03090f');
    }

    const obsX = W * 0.155;
    const obsY = ridgeLine(obsX, H * 0.872, 18, 3.1) + 2;
    const domeR = 19 * scale;

    const warmGlow = g.createRadialGradient(obsX, obsY - domeR * 0.5, 0, obsX, obsY - domeR * 0.5, domeR * 4.4);
    warmGlow.addColorStop(0, 'rgba(255,192,106,0.2)');
    warmGlow.addColorStop(0.4, 'rgba(255,180,90,0.07)');
    warmGlow.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = warmGlow;
    g.beginPath();
    g.arc(obsX, obsY - domeR * 0.5, domeR * 4.4, 0, TAU);
    g.fill();

    g.fillStyle = '#040c13';
    g.fillRect(obsX - domeR * 1.25, obsY - domeR * 0.5, domeR * 2.5, domeR * 1.5);
    g.beginPath();
    g.arc(obsX, obsY - domeR * 0.5, domeR, Math.PI, TAU);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(150,220,225,0.14)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(obsX, obsY - domeR * 0.5, domeR, Math.PI, TAU);
    g.stroke();

    g.fillStyle = 'rgba(255,207,122,0.85)';
    g.fillRect(obsX + domeR * 0.12, obsY - domeR * 1.1, domeR * 0.38, domeR * 0.16);
    g.fillStyle = 'rgba(255,214,142,0.9)';
    g.fillRect(obsX - domeR * 0.75, obsY - domeR * 0.2, domeR * 0.32, domeR * 0.26);
    g.fillStyle = 'rgba(255,180,90,0.22)';
    g.fillRect(obsX - domeR * 0.8, obsY - domeR * 0.24, domeR * 0.42, domeR * 0.36);

    g.strokeStyle = 'rgba(140,190,200,0.22)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(obsX + domeR * 0.85, obsY - domeR * 1.35);
    g.lineTo(obsX + domeR * 0.85, obsY - domeR * 2.35);
    g.stroke();
    g.fillStyle = 'rgba(255,140,120,0.8)';
    g.beginPath();
    g.arc(obsX + domeR * 0.85, obsY - domeR * 2.4, 1.4, 0, TAU);
    g.fill();

    const ground = g.createLinearGradient(0, H * 0.9, 0, H);
    ground.addColorStop(0, 'rgba(2,6,10,0)');
    ground.addColorStop(1, 'rgba(1,3,6,0.88)');
    g.fillStyle = ground;
    g.fillRect(0, H * 0.86, W, H * 0.14);

    fgCanvas = layer;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === W && height === H && bgCanvas) return;

    const prevW = W;
    const prevH = H;
    W = width;
    H = height;
    DPR = clamp(window.devicePixelRatio || 1, 1, 2);

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;

    if (prevW > 0 && prevH > 0) {
      const sx = W / prevW;
      const sy = H / prevH;
      state.objects.forEach((object) => {
        object.x *= sx;
        object.y *= sy;
      });
      state.aim.x *= sx;
      state.aim.y *= sy;
      state.aim.tx *= sx;
      state.aim.ty *= sy;
    } else {
      state.aim.x = W * 0.5;
      state.aim.y = H * 0.42;
      state.aim.tx = state.aim.x;
      state.aim.ty = state.aim.y;
    }

    state.aim.x = clamp(state.aim.x, 24, W - 24);
    state.aim.y = clamp(state.aim.y, 24, H - 24);
    state.aim.tx = clamp(state.aim.tx, 24, W - 24);
    state.aim.ty = clamp(state.aim.ty, 24, H - 24);

    makeStars();
    bakeBackground();
    bakeForeground();
  }

  /* ------------------------------------------------------------------ */
  /* Entities + simulation                                               */
  /* ------------------------------------------------------------------ */

  const UFO_TYPES = {
    saucer: {
      name: 'Untertasse',
      tag: 'Klasse II',
      r: 16,
      points: 120,
      scan: 1.4,
      speed: [42, 64],
      wobble: 15,
      rgb: [255, 210, 122]
    },
    orb: {
      name: 'Leuchtkugel',
      tag: 'Klasse I',
      r: 12,
      points: 90,
      scan: 1.15,
      speed: [30, 50],
      wobble: 25,
      rgb: [126, 243, 220]
    },
    triangle: {
      name: 'Delta-Sonde',
      tag: 'Klasse III',
      r: 17,
      points: 160,
      scan: 1.7,
      speed: [34, 54],
      wobble: 7,
      rgb: [190, 166, 255]
    },
    mothership: {
      name: 'Mutterschiff',
      tag: 'Klasse V',
      r: 28,
      points: 300,
      scan: 2.1,
      speed: [20, 32],
      wobble: 5,
      rgb: [255, 178, 235]
    }
  };

  function difficulty() {
    return clamp(1 - state.time / state.maxTime, 0, 1);
  }

  function sizeScale() {
    return clamp(Math.min(W, H) / 760, 0.86, 1.2);
  }

  function pickUfoType() {
    const d = difficulty();
    const choices = [
      ['saucer', 44],
      ['orb', 28],
      ['triangle', 21],
      ['mothership', 3 + d * 5]
    ];
    let total = 0;
    choices.forEach(([, weight]) => {
      total += weight;
    });
    let roll = Math.random() * total;
    for (const [key, weight] of choices) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return 'saucer';
  }

  function spawnUfo(options = {}) {
    const typeKey = options.type || pickUfoType();
    const cfg = UFO_TYPES[typeKey];
    const scale = sizeScale() * (options.scale || 1);
    const radius = cfg.r * scale;
    const speedMultiplier = clamp(W / 1100, 0.74, 1.35) * (1 + difficulty() * 0.45);
    let x;
    let y;
    let vx;
    let vy;

    if (options.inside) {
      x = rand(W * 0.28, W * 0.72);
      y = rand(H * 0.22, H * 0.52);
      const direction = Math.random() < 0.5 ? -1 : 1;
      vx = direction * rand(cfg.speed[0], cfg.speed[1]) * speedMultiplier;
      vy = rand(-8, 8);
    } else {
      const side = Math.random();
      if (side < 0.43) {
        x = -radius * 3.4;
        y = rand(H * 0.14, H * 0.68);
      } else if (side < 0.86) {
        x = W + radius * 3.4;
        y = rand(H * 0.14, H * 0.68);
      } else {
        x = rand(W * 0.18, W * 0.82);
        y = -radius * 3.4;
      }
      const targetX = rand(W * 0.24, W * 0.76);
      const targetY = rand(H * 0.16, H * 0.64);
      const length = Math.max(1, Math.hypot(targetX - x, targetY - y));
      const speed = rand(cfg.speed[0], cfg.speed[1]) * speedMultiplier;
      vx = ((targetX - x) / length) * speed;
      vy = ((targetY - y) / length) * speed;
    }

    const object = {
      kind: typeKey,
      isUfo: true,
      decoy: false,
      x,
      y,
      vx,
      vy,
      r: radius,
      cfg,
      points: cfg.points,
      age: 0,
      ttl: rand(18, 26),
      phase: rand(0, TAU),
      freq: rand(0.72, 1.35),
      wobble: cfg.wobble * scale,
      spin: rand(0, TAU),
      spinSpeed: rand(-0.45, 0.45),
      captured: false,
      capturedT: 0,
      failed: false,
      failedT: 0,
      fade: 0,
      dead: false
    };
    state.objects.push(object);

    if (typeKey === 'mothership') {
      announce('Mutterschiff geortet · hohe Priorität', 'amber');
      sound.blip(420, 0.16, 0.035, 'sine');
    }
    return object;
  }

  function spawnDecoy(kind) {
    const scale = sizeScale();
    const fromLeft = Math.random() < 0.5;
    const direction = fromLeft ? 1 : -1;
    let object;

    if (kind === 'plane') {
      const radius = 14 * scale;
      object = {
        kind: 'plane',
        isUfo: false,
        decoy: true,
        x: fromLeft ? -radius * 3 : W + radius * 3,
        y: rand(H * 0.14, H * 0.52),
        vx: direction * rand(64, 96) * clamp(W / 1000, 0.8, 1.35),
        vy: rand(-7, 7),
        r: radius,
        phase: rand(0, TAU),
        age: 0,
        dwell: 0,
        failed: false,
        failedT: 0,
        dead: false
      };
    } else {
      const radius = 8 * scale;
      object = {
        kind: 'satellite',
        isUfo: false,
        decoy: true,
        x: fromLeft ? -radius * 3 : W + radius * 3,
        y: rand(H * 0.12, H * 0.46),
        vx: direction * rand(120, 172) * clamp(W / 1000, 0.8, 1.4),
        vy: rand(-16, 16),
        r: radius,
        phase: rand(0, TAU),
        age: 0,
        dwell: 0,
        failed: false,
        failedT: 0,
        dead: false
      };
    }
    state.objects.push(object);
    return object;
  }

  function updateSpawn(dt) {
    const d = difficulty();
    const ufoCount = state.objects.filter((object) => object.isUfo && !object.captured && !object.failed).length;
    const maxUfos = Math.round(lerp(2, 5, d));

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      if (ufoCount < maxUfos) spawnUfo();
      state.spawnTimer = lerp(2.55, 1.08, d) * rand(0.82, 1.2);
    }

    state.decoyTimer -= dt;
    if (state.decoyTimer <= 0) {
      const decoyCount = state.objects.filter((object) => object.decoy && !object.failed).length;
      if (decoyCount < 3) spawnDecoy(Math.random() < 0.6 ? 'plane' : 'satellite');
      state.decoyTimer = lerp(5.1, 2.5, d) * rand(0.85, 1.25);
    }
  }

  function updateObjects(dt) {
    for (const object of state.objects) {
      object.age += dt;

      if (object.captured) {
        object.capturedT += dt;
        object.y -= 48 * dt;
        object.spin += dt * 3;
        if (object.capturedT > 0.95) object.dead = true;
        continue;
      }

      if (object.failed) {
        object.failedT += dt;
        if (object.failedT > 1.2) object.dead = true;
      }

      if (object.isUfo) {
        object.x += (object.vx + Math.cos(object.age * 0.9 + object.phase) * object.wobble * 0.5) * dt;
        object.y += (object.vy + Math.sin(object.age * object.freq + object.phase) * object.wobble) * dt;
        object.spin += object.spinSpeed * dt;

        if (object.age > object.ttl && !object.failed) {
          object.fade += dt;
          object.y -= 22 * dt;
          if (object.fade > 1) object.dead = true;
        }
      } else {
        object.x += object.vx * dt;
        object.y += object.vy * dt;
      }

      if (
        object.x < -170 ||
        object.x > W + 170 ||
        object.y < -190 ||
        object.y > H + 130
      ) {
        object.dead = true;
      }
    }

    state.objects = state.objects.filter((object) => !object.dead);
  }

  function updateAim(dt) {
    let ax = 0;
    let ay = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) ax -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) ax += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) ay -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) ay += 1;

    if (ax || ay) {
      const length = Math.hypot(ax, ay) || 1;
      const speed = 560;
      state.aim.tx += (ax / length) * speed * dt;
      state.aim.ty += (ay / length) * speed * dt;
      state.aim.active = true;
      hideHint();
    }

    state.aim.tx = clamp(state.aim.tx, 24, W - 24);
    state.aim.ty = clamp(state.aim.ty, 24, H - 24);
    const smooth = 1 - Math.exp(-dt * (coarse ? 24 : 31));
    state.aim.x += (state.aim.tx - state.aim.x) * smooth;
    state.aim.y += (state.aim.ty - state.aim.y) * smooth;

    if (state.aim.fingerLife > 0) state.aim.fingerLife -= dt;
  }

  function updateScan(dt) {
    let target = null;
    let bestDistance = Infinity;
    const tolerance = coarse ? 7 : 0;

    for (const object of state.objects) {
      if (!object.isUfo || object.captured || object.failed || object.fade > 0) continue;
      const hit = object.r * 1.16 + 18 + tolerance;
      const distance = dist(state.aim.x, state.aim.y, object.x, object.y);
      if (distance < hit && distance < bestDistance) {
        bestDistance = distance;
        target = object;
      }
    }

    let decoy = null;
    let decoyDistance = Infinity;
    for (const object of state.objects) {
      if (!object.decoy) continue;
      const hit = object.r + 20 + tolerance;
      const distance = dist(state.aim.x, state.aim.y, object.x, object.y);
      if (distance < hit) {
        object.dwell = Math.min(1.2, object.dwell + dt);
        if (distance < decoyDistance) {
          decoyDistance = distance;
          decoy = object;
        }
        if (object.dwell > 0.7 && !object.failed) failSignal(object);
      } else {
        object.dwell = Math.max(0, object.dwell - dt * 2.6);
      }
      if (object.failed) object.dwell = 0;
    }
    state.decoyTarget = decoy;

    if (target) {
      if (state.scanTarget !== target) {
        if (state.scanTarget && state.scanTarget !== target) state.scanProgress = 0;
        sound.blip(680, 0.05, 0.03, 'sine');
      }
      state.scanTarget = target;
      const duration = target.cfg.scan * lerp(1.16, 0.9, difficulty()) * (coarse ? 1.1 : 1);
      state.scanProgress = Math.min(1, state.scanProgress + dt / duration);
      if (state.scanProgress >= 1) {
        successScan(target);
        return;
      }
    } else {
      state.scanTarget = null;
      state.scanProgress = Math.max(0, state.scanProgress - dt * 1.25);
    }

    sound.scan(state.scanProgress, Boolean(target));
  }

  function successScan(target) {
    if (target.captured) return;
    target.captured = true;
    target.capturedT = 0;
    const points = target.points * state.combo;
    state.score += points;
    state.scans += 1;
    state.time = Math.min(state.maxTime, state.time + 1);
    state.combo = Math.min(6, state.combo + 1);
    state.comboTimer = 6;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.scanTarget = null;
    state.scanProgress = 0;
    state.flash = 0.16;
    state.flashRGB = target.cfg.rgb;

    addBurst(target.x, target.y, target.cfg.rgb, reducedMotion ? 12 : 28, 1);
    addRipple(target.x, target.y, target.cfg.rgb, 0.9);
    addFloater(target.x, target.y - target.r - 12, `+${number.format(points)}`, `${target.cfg.name} · ${target.cfg.tag}`, target.cfg.rgb);
    announce(`${target.cfg.name} gescannt · +${number.format(points)} · Serie ×${state.combo}`, 'good');
    sound.success();
    bumpScore();
    updateHud();
  }

  function failSignal(object) {
    if (object.failed) return;
    object.failed = true;
    object.failedT = 0;
    object.dwell = 0;
    state.misses += 1;
    state.combo = 1;
    state.comboTimer = 0;
    state.time = Math.max(0, state.time - 3);
    state.scanTarget = null;
    state.scanProgress = 0;
    state.flash = 0.8;
    state.flashRGB = [255, 95, 82];
    if (!reducedMotion) state.shake = Math.min(1, state.shake + 0.85);

    const label = object.kind === 'plane' ? 'Flugzeug' : 'Satellit';
    addBurst(object.x, object.y, [255, 106, 92], reducedMotion ? 8 : 18, 0.7);
    addFloater(object.x, object.y - 18, 'FEHLSIGNAL', `${label} · −3 Sek`, [255, 123, 112]);
    announce(`Fehlsignal · ${label} · −3 Sekunden`, 'bad');
    sound.fail();
    if (state.time <= 0) endGame();
  }

  function addBurst(x, y, rgb, count, power) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(24, 150) * power;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        life: rand(0.35, 1.05),
        maxLife: 1.05,
        size: rand(0.8, 2.6),
        rgb
      });
    }
  }

  function addFloater(x, y, text, sub, rgb) {
    state.floaters.push({
      x,
      y,
      text,
      sub,
      rgb,
      life: 1.55,
      maxLife: 1.55
    });
  }

  function addRipple(x, y, rgb, power = 1) {
    state.ripples.push({
      x,
      y,
      rgb,
      life: 0.75,
      maxLife: 0.75,
      radius: 10,
      power
    });
  }

  function updateEffects(dt, time) {
    state.particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - dt * 1.7;
      particle.vy = particle.vy * (1 - dt * 1.7) + 14 * dt;
    });
    state.particles = state.particles.filter((particle) => particle.life > 0);

    state.floaters.forEach((floater) => {
      floater.life -= dt;
      floater.y -= 26 * dt;
    });
    state.floaters = state.floaters.filter((floater) => floater.life > 0);

    state.ripples.forEach((ripple) => {
      ripple.life -= dt;
      ripple.radius += dt * 120 * ripple.power;
    });
    state.ripples = state.ripples.filter((ripple) => ripple.life > 0);

    state.shootTimer -= dt;
    if (state.shootTimer <= 0) {
      state.shootingStars.push({
        x: rand(W * 0.08, W * 0.95),
        y: rand(-20, H * 0.28),
        vx: rand(-540, -300),
        vy: rand(190, 360),
        life: rand(0.55, 0.95),
        maxLife: 0.95
      });
      state.shootTimer = rand(3.8, 9.5);
    }
    state.shootingStars.forEach((star) => {
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      star.life -= dt;
    });
    state.shootingStars = state.shootingStars.filter((star) => star.life > 0 && star.y < H * 0.78);

    state.shake = Math.max(0, state.shake - dt * 2.6);
    state.flash = Math.max(0, state.flash - dt * 2.9);
    if (state.mode === 'playing' && state.comboTimer > 0) {
      state.comboTimer = Math.max(0, state.comboTimer - dt);
      if (state.comboTimer === 0 && state.combo > 1) {
        state.combo = 1;
      }
    }
    void time;
  }

  function updateHud() {
    const seconds = Math.max(0, Math.ceil(state.time));
    if (dom.timeValue.textContent !== String(seconds)) dom.timeValue.textContent = String(seconds);
    dom.timeFill.style.transform = `scaleX(${clamp(state.time / state.maxTime, 0, 1)})`;
    dom.timer.classList.toggle('is-low', state.time <= 10);

    dom.scoreValue.textContent = number.format(Math.round(state.score));
    dom.comboText.textContent = `Serie ×${state.combo}`;
    dom.comboBadge.classList.toggle('is-hot', state.combo > 1);
    dom.comboFill.style.transform = `scaleX(${state.combo > 1 ? clamp(state.comboTimer / 6, 0, 1) : 0})`;
  }

  function bumpScore() {
    dom.scoreValue.classList.remove('is-bumping');
    void dom.scoreValue.offsetWidth;
    dom.scoreValue.classList.add('is-bumping');
    window.setTimeout(() => dom.scoreValue.classList.remove('is-bumping'), 420);
  }

  function announce(text, tone = 'good') {
    window.clearTimeout(statusTimer);
    dom.status.textContent = text;
    dom.status.className = 'status is-visible';
    if (tone === 'bad') dom.status.classList.add('is-bad');
    if (tone === 'amber') dom.status.classList.add('is-amber');
    statusTimer = window.setTimeout(() => {
      dom.status.classList.remove('is-visible');
    }, 2300);
  }

  function showHint(text, duration = 7500) {
    window.clearTimeout(hintTimer);
    dom.hintText.textContent = text;
    dom.hint.classList.remove('is-hidden');
    hintTimer = window.setTimeout(() => {
      dom.hint.classList.add('is-hidden');
    }, duration);
  }

  function hideHint() {
    window.clearTimeout(hintTimer);
    dom.hint.classList.add('is-hidden');
  }

  function update(dt) {
    state.elapsed += dt;
    state.time -= dt;
    if (state.time <= 0) {
      state.time = 0;
      endGame();
      return;
    }

    const seconds = Math.ceil(state.time);
    if (seconds !== state.lastSecond) {
      state.lastSecond = seconds;
      if (seconds <= 5 && seconds > 0) sound.tick();
    }

    updateSpawn(dt);
    updateObjects(dt);
    updateAim(dt);
    updateScan(dt);
    updateEffects(dt, performance.now() / 1000);
    updateHud();
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function drawTwinkles(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const star of state.twinkles) {
      const pulse = Math.max(0, Math.sin(t * star.speed + star.phase));
      const alpha = star.alpha * pulse * 0.8;
      if (alpha < 0.04) continue;
      ctx.fillStyle = `rgba(${star.color[0]},${star.color[1]},${star.color[2]},${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * (1 + pulse * 0.5), 0, TAU);
      ctx.fill();
      if (star.size > 1.3 && pulse > 0.5) {
        ctx.strokeStyle = `rgba(${star.color[0]},${star.color[1]},${star.color[2]},${alpha * 0.34})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(star.x - star.size * 4, star.y);
        ctx.lineTo(star.x + star.size * 4, star.y);
        ctx.moveTo(star.x, star.y - star.size * 4);
        ctx.lineTo(star.x, star.y + star.size * 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawAurora(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let layer = 0; layer < 2; layer += 1) {
      const baseY = H * (0.63 + layer * 0.055);
      const gradient = ctx.createLinearGradient(0, baseY - 90, 0, baseY + 100);
      gradient.addColorStop(0, 'rgba(82,255,204,0)');
      gradient.addColorStop(
        0.48,
        layer === 0 ? 'rgba(82,255,204,0.055)' : 'rgba(132,108,255,0.04)'
      );
      gradient.addColorStop(1, 'rgba(82,255,204,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + 30; x += 30) {
        const y =
          baseY +
          Math.sin(x * 0.005 + t * 0.13 + layer * 1.7) * 24 +
          Math.sin(x * 0.013 - t * 0.21 + layer) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawShootingStars() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const star of state.shootingStars) {
      const alpha = clamp(star.life / star.maxLife, 0, 1);
      const tailX = star.x - star.vx * 0.085;
      const tailY = star.y - star.vy * 0.085;
      const gradient = ctx.createLinearGradient(star.x, star.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(232,250,255,${alpha * 0.9})`);
      gradient.addColorStop(0.25, `rgba(170,236,240,${alpha * 0.38})`);
      gradient.addColorStop(1, 'rgba(120,220,230,0)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.fillStyle = `rgba(240,255,255,${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, 1.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function glowCircle(x, y, radius, rgb, alpha) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(rgb, alpha));
    gradient.addColorStop(0.38, rgba(rgb, alpha * 0.4));
    gradient.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  function drawUfoTrail(object) {
    const speed = Math.hypot(object.vx, object.vy);
    if (speed < 4) return;
    const nx = -object.vx / speed;
    const ny = -object.vy / speed;
    const length = object.r * 3.2;
    const gradient = ctx.createLinearGradient(
      object.x,
      object.y,
      object.x + nx * length,
      object.y + ny * length
    );
    gradient.addColorStop(0, rgba(object.cfg.rgb, 0.15));
    gradient.addColorStop(1, rgba(object.cfg.rgb, 0));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(1.5, object.r * 0.36);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(object.x, object.y);
    ctx.lineTo(object.x + nx * length, object.y + ny * length);
    ctx.stroke();
  }

  function drawSaucer(object, t) {
    const r = object.r;
    const rgb = object.cfg.rgb;
    const tilt = Math.sin(t * 1.5 + object.phase) * 0.09;

    ctx.save();
    ctx.rotate(tilt);
    glowCircle(0, 0, r * 2.8, rgb, 0.17);

    ctx.beginPath();
    ctx.ellipse(0, -r * 0.22, r * 0.52, r * 0.4, 0, 0, TAU);
    const dome = ctx.createRadialGradient(-r * 0.16, -r * 0.42, 0, 0, -r * 0.18, r * 0.58);
    dome.addColorStop(0, 'rgba(238,255,250,0.96)');
    dome.addColorStop(0.42, 'rgba(126,243,220,0.78)');
    dome.addColorStop(1, 'rgba(23,81,92,0.2)');
    ctx.fillStyle = dome;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.32, r * 0.42, 0, 0, TAU);
    const hull = ctx.createLinearGradient(0, -r * 0.48, 0, r * 0.5);
    hull.addColorStop(0, '#d9edf2');
    hull.addColorStop(0.38, '#8aa7b2');
    hull.addColorStop(0.7, '#3c5865');
    hull.addColorStop(1, '#172b36');
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,255,240,0.34)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-r * 0.16, -r * 0.38, r * 0.22, r * 0.09, -0.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.fill();

    const lights = 5;
    for (let i = 0; i < lights; i += 1) {
      const angle = Math.PI * (0.18 + (i / (lights - 1)) * 0.64);
      const lx = Math.cos(angle) * r * 1.16;
      const ly = Math.sin(angle) * r * 0.38 + r * 0.01;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.6 + object.phase + i * 1.4);
      const lightRGB = i % 2 === 0 ? rgb : [240, 255, 248];
      ctx.shadowBlur = 8 + pulse * 5;
      ctx.shadowColor = rgba(lightRGB, 0.8);
      ctx.fillStyle = rgba(lightRGB, 0.55 + pulse * 0.45);
      ctx.beginPath();
      ctx.arc(lx, ly, r * 0.075 + 1, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = rgba(rgb, 0.85);
    ctx.beginPath();
    ctx.arc(0, r * 0.27, r * 0.09, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawTriangle(object, t) {
    const r = object.r;
    const rgb = object.cfg.rgb;
    const tilt = Math.sin(t * 1.2 + object.phase) * 0.06;

    ctx.save();
    ctx.rotate(tilt);
    glowCircle(0, r * 0.1, r * 2.4, rgb, 0.15);

    ctx.beginPath();
    ctx.moveTo(0, -r * 0.98);
    ctx.lineTo(r * 1.08, r * 0.68);
    ctx.lineTo(-r * 1.08, r * 0.68);
    ctx.closePath();
    const body = ctx.createLinearGradient(0, -r, 0, r * 0.7);
    body.addColorStop(0, '#2b3846');
    body.addColorStop(0.5, '#111c27');
    body.addColorStop(1, '#050b11');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = rgba(rgb, 0.55);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -r * 0.46);
    ctx.lineTo(r * 0.44, r * 0.36);
    ctx.lineTo(-r * 0.44, r * 0.36);
    ctx.closePath();
    ctx.strokeStyle = rgba(rgb, 0.22);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    const corners = [
      [0, -r * 0.84],
      [r * 0.88, r * 0.54],
      [-r * 0.88, r * 0.54]
    ];
    corners.forEach(([lx, ly], index) => {
      const pulse = 0.45 + 0.55 * Math.sin(t * 4 + object.phase + index * 2.1) ** 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = rgba(rgb, 0.9);
      ctx.fillStyle = rgba(index === 0 ? [245, 252, 255] : rgb, 0.6 + pulse * 0.4);
      ctx.beginPath();
      ctx.arc(lx, ly, r * 0.075 + 1.1, 0, TAU);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    ctx.fillStyle = rgba(rgb, 0.6);
    ctx.beginPath();
    ctx.arc(0, r * 0.03, r * 0.12, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawOrb(object, t) {
    const r = object.r;
    const rgb = object.cfg.rgb;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.7 + object.phase);

    ctx.save();
    glowCircle(0, 0, r * 3.1, rgb, 0.2);
    glowCircle(0, 0, r * 1.85, rgb, 0.3);

    const core = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r * 1.05);
    core.addColorStop(0, 'rgba(255,255,255,0.98)');
    core.addColorStop(0.32, 'rgba(220,255,250,0.95)');
    core.addColorStop(0.7, rgba(rgb, 0.7));
    core.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.08, 0, TAU);
    ctx.fill();

    ctx.rotate(t * 0.7 + object.phase);
    ctx.strokeStyle = rgba(rgb, 0.45 + pulse * 0.2);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.7, r * 0.34, 0, 0, TAU);
    ctx.stroke();

    for (let i = 0; i < 2; i += 1) {
      const angle = t * 1.5 + i * Math.PI;
      const x = Math.cos(angle) * r * 1.7;
      const y = Math.sin(angle) * r * 0.34;
      ctx.fillStyle = rgba(rgb, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.075 + 1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMothership(object, t) {
    const r = object.r;
    const rgb = object.cfg.rgb;

    ctx.save();
    ctx.rotate(Math.sin(t * 0.7 + object.phase) * 0.035);
    glowCircle(0, 0, r * 3.2, rgb, 0.2);

    ctx.beginPath();
    ctx.ellipse(0, -r * 0.08, r * 2.3, r * 0.42, 0, 0, TAU);
    const upper = ctx.createLinearGradient(0, -r * 0.55, 0, r * 0.4);
    upper.addColorStop(0, '#d4e4ea');
    upper.addColorStop(0.4, '#7e9aa7');
    upper.addColorStop(1, '#22343f');
    ctx.fillStyle = upper;
    ctx.fill();
    ctx.strokeStyle = rgba(rgb, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, r * 0.09, r * 1.5, r * 0.25, 0, 0, TAU);
    ctx.fillStyle = 'rgba(8,17,25,0.9)';
    ctx.fill();

    [-0.82, 0, 0.82].forEach((offset, index) => {
      const dr = index === 1 ? r * 0.4 : r * 0.3;
      ctx.beginPath();
      ctx.ellipse(offset * r, -r * 0.34, dr, dr * 0.75, 0, 0, TAU);
      const dome = ctx.createRadialGradient(
        offset * r - dr * 0.2,
        -r * 0.5,
        0,
        offset * r,
        -r * 0.34,
        dr
      );
      dome.addColorStop(0, 'rgba(255,240,255,0.95)');
      dome.addColorStop(0.5, rgba(rgb, 0.68));
      dome.addColorStop(1, 'rgba(60,32,58,0.2)');
      ctx.fillStyle = dome;
      ctx.fill();
    });

    const lights = 9;
    for (let i = 0; i < lights; i += 1) {
      const angle = Math.PI * (0.12 + (i / (lights - 1)) * 0.76);
      const lx = Math.cos(angle) * r * 2.02;
      const ly = Math.sin(angle) * r * 0.36 + r * 0.04;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + object.phase + i * 0.9);
      ctx.fillStyle = rgba(i % 2 ? rgb : [255, 248, 218], 0.4 + pulse * 0.6);
      ctx.beginPath();
      ctx.arc(lx, ly, r * 0.05 + 1, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = rgba(rgb, 0.5);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 0.45, r * 0.08, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawUFO(object, t) {
    if (object.captured) {
      const progress = clamp(object.capturedT / 0.95, 0, 1);
      ctx.save();
      ctx.translate(object.x, object.y);
      ctx.globalAlpha = 1 - progress;
      ctx.scale(1 + progress * 0.5, 1 + progress * 0.5);
      ctx.rotate(progress * 2.4);
      if (object.kind === 'saucer') drawSaucer(object, t);
      else if (object.kind === 'triangle') drawTriangle(object, t);
      else if (object.kind === 'orb') drawOrb(object, t);
      else drawMothership(object, t);
      ctx.restore();
      return;
    }

    const alpha = object.fade > 0 ? 1 - clamp(object.fade, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawUfoTrail(object);
    ctx.translate(object.x, object.y);
    if (object.kind === 'saucer') drawSaucer(object, t);
    else if (object.kind === 'triangle') drawTriangle(object, t);
    else if (object.kind === 'orb') drawOrb(object, t);
    else drawMothership(object, t);
    ctx.restore();
  }

  function drawPlane(object, t) {
    const speed = Math.hypot(object.vx, object.vy);
    const angle = Math.atan2(object.vy, object.vx);
    const blink = Math.max(0, Math.sin(t * 2.9 + object.phase)) ** 4;
    const strobe = Math.max(0, Math.sin(t * 1.7 + object.phase * 0.7)) ** 14;

    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.rotate(angle);

    const trail = ctx.createLinearGradient(-58, 0, 0, 0);
    trail.addColorStop(0, 'rgba(190,220,230,0)');
    trail.addColorStop(0.75, 'rgba(190,220,230,0.035)');
    trail.addColorStop(1, 'rgba(210,235,240,0.09)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = 3 * (object.r / 14);
    ctx.beginPath();
    ctx.moveTo(-58, 0);
    ctx.lineTo(-4, 0);
    ctx.stroke();

    ctx.save();
    ctx.scale(object.r / 14, object.r / 14);
    ctx.fillStyle = 'rgba(112,138,150,0.55)';
    ctx.strokeStyle = 'rgba(190,220,228,0.22)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(3, 1.8);
    ctx.lineTo(-9, 1.4);
    ctx.lineTo(-13, 0);
    ctx.lineTo(-9, -1.4);
    ctx.lineTo(3, -1.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-7, -9);
    ctx.lineTo(-4, -9.4);
    ctx.lineTo(4.6, -0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-7, 9);
    ctx.lineTo(-4, 9.4);
    ctx.lineTo(4.6, 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-13, -4.4);
    ctx.lineTo(-15, -4.2);
    ctx.lineTo(-13, 0);
    ctx.lineTo(-15, 4.2);
    ctx.lineTo(-13, 4.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,206,128,0.6)';
    ctx.beginPath();
    ctx.arc(7.5, 0, 0.9, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(120,255,170,0.8)';
    ctx.beginPath();
    ctx.arc(-7.5, 8.6, 0.9, 0, TAU);
    ctx.fill();

    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(255,60,50,0.9)';
    ctx.fillStyle = `rgba(255,82,66,${0.3 + blink * 0.7})`;
    ctx.beginPath();
    ctx.arc(-7.5, -8.6, 1.3 + blink * 1.4, 0, TAU);
    ctx.fill();

    ctx.shadowBlur = 16;
    ctx.shadowColor = 'rgba(240,255,255,0.9)';
    ctx.fillStyle = `rgba(250,255,255,${strobe * 0.9})`;
    ctx.beginPath();
    ctx.arc(-14.5, 0, 1.1 + strobe * 1.6, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.restore();
  }

  function drawSatellite(object, t) {
    const angle = Math.atan2(object.vy, object.vx);
    const speed = Math.hypot(object.vx, object.vy);
    const glint = 0.65 + 0.35 * Math.sin(t * 2.2 + object.phase);

    ctx.save();
    ctx.translate(object.x, object.y);

    const tail = ctx.createLinearGradient(-speed * 0.12, 0, 0, 0);
    tail.addColorStop(0, 'rgba(210,240,255,0)');
    tail.addColorStop(1, 'rgba(210,240,255,0.22)');
    ctx.strokeStyle = tail;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-speed * 0.12, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.rotate(angle);
    ctx.scale(object.r / 8, object.r / 8);
    ctx.fillStyle = 'rgba(46,67,89,0.9)';
    ctx.strokeStyle = 'rgba(160,215,235,0.4)';
    ctx.lineWidth = 0.6;
    ctx.fillRect(-3, -2, 6, 4);
    ctx.strokeRect(-3, -2, 6, 4);
    ctx.fillStyle = 'rgba(80,125,165,0.6)';
    ctx.fillRect(-11, -3.4, 7, 6.8);
    ctx.fillRect(4, -3.4, 7, 6.8);
    ctx.strokeRect(-11, -3.4, 7, 6.8);
    ctx.strokeRect(4, -3.4, 7, 6.8);
    ctx.strokeStyle = 'rgba(190,240,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, -8);
    ctx.stroke();

    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(220,250,255,0.9)';
    ctx.fillStyle = `rgba(245,255,255,${0.55 + glint * 0.45})`;
    ctx.beginPath();
    ctx.arc(0, 0, 1.7, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawObject(object, t) {
    if (object.decoy) {
      let alpha = 1;
      if (object.failed) alpha = 1 - clamp(object.failedT / 1.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (object.kind === 'plane') drawPlane(object, t);
      else drawSatellite(object, t);
      ctx.restore();
      return;
    }
    drawUFO(object, t);
  }

  function drawScanBrackets(t) {
    const target = state.scanTarget;
    if (!target) return;
    const radius = target.r * 1.78 + 15;
    const progress = state.scanProgress;

    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.strokeStyle = 'rgba(255,210,122,0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    ctx.lineDashOffset = -t * 20;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    const arm = 6;
    const d = radius;
    ctx.strokeStyle = 'rgba(255,210,122,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-d, -d + arm);
    ctx.lineTo(-d, -d);
    ctx.lineTo(-d + arm, -d);
    ctx.moveTo(d - arm, -d);
    ctx.lineTo(d, -d);
    ctx.lineTo(d, -d + arm);
    ctx.moveTo(-d, d - arm);
    ctx.lineTo(-d, d);
    ctx.lineTo(-d + arm, d);
    ctx.moveTo(d - arm, d);
    ctx.lineTo(d, d);
    ctx.lineTo(d, d - arm);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,210,122,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 5, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,210,122,0.95)';
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255,210,122,0.8)';
    ctx.beginPath();
    ctx.arc(0, 0, radius + 5, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const tip = -Math.PI / 2 + TAU * progress;
    ctx.fillStyle = 'rgba(255,239,198,0.95)';
    ctx.beginPath();
    ctx.arc(Math.cos(tip) * (radius + 5), Math.sin(tip) * (radius + 5), 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of state.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = rgba(particle.rgb, alpha * 0.9);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFloaters() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const floater of state.floaters) {
      const alpha = clamp(floater.life / 0.55, 0, 1);
      const fail = floater.text === 'FEHLSIGNAL';
      ctx.shadowBlur = 14;
      ctx.shadowColor = rgba(floater.rgb, alpha * 0.55);
      ctx.fillStyle = rgba(floater.rgb, alpha);
      ctx.font = `700 ${fail ? 11 : 16}px ${'ui-monospace, "SFMono-Regular", Menlo, monospace'}`;
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(210,232,240,${alpha * 0.58})`;
      ctx.font = '500 8px ui-monospace, "SFMono-Regular", Menlo, monospace';
      ctx.fillText(floater.sub, floater.x, floater.y + (fail ? 15 : 18));
    }
    ctx.restore();
  }

  function drawRipples() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ripple of state.ripples) {
      const alpha = clamp(ripple.life / ripple.maxLife, 0, 1);
      ctx.strokeStyle = rgba(ripple.rgb, alpha * 0.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawReticle(t) {
    if (state.mode === 'start' || state.mode === 'ended') return;
    const x = state.aim.x;
    const y = state.aim.y;
    const locked = Boolean(state.scanTarget);
    const suspicious = Boolean(state.decoyTarget && state.decoyTarget.dwell > 0.12 && !state.decoyTarget.failed);
    const rgb = locked ? [255, 210, 122] : suspicious ? [255, 112, 98] : [126, 235, 230];

    ctx.save();
    ctx.translate(x, y);

    const lens = ctx.createRadialGradient(0, 0, 0, 0, 0, 35);
    lens.addColorStop(0, rgba(rgb, 0.045));
    lens.addColorStop(0.7, rgba(rgb, 0.018));
    lens.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = rgba(rgb, 0.72);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 33, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = rgba(rgb, 0.44);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = rgba(rgb, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-47, 0);
    ctx.lineTo(-13, 0);
    ctx.moveTo(47, 0);
    ctx.lineTo(13, 0);
    ctx.moveTo(0, -47);
    ctx.lineTo(0, -13);
    ctx.moveTo(0, 47);
    ctx.lineTo(0, 13);
    ctx.stroke();

    ctx.strokeStyle = rgba(rgb, 0.32);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i += 1) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -37);
      ctx.lineTo(0, -42);
      ctx.stroke();
      ctx.restore();
    }

    const spin = reducedMotion ? 0 : t * 0.55;
    ctx.strokeStyle = rgba(rgb, 0.55);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i += 1) {
      const start = spin + i * Math.PI;
      ctx.beginPath();
      ctx.arc(0, 0, 41, start, start + 0.55);
      ctx.stroke();
    }

    ctx.fillStyle = rgba(rgb, 0.95);
    ctx.beginPath();
    ctx.arc(0, 0, 1.3, 0, TAU);
    ctx.fill();

    if (locked) {
      const progress = state.scanProgress;
      ctx.strokeStyle = 'rgba(255,210,122,0.92)';
      ctx.lineWidth = 2.4;
      ctx.shadowBlur = 9;
      ctx.shadowColor = 'rgba(255,210,122,0.65)';
      ctx.beginPath();
      ctx.arc(0, 0, 46, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(255,226,164,0.95)';
      ctx.font = '500 8px ui-monospace, "SFMono-Regular", Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`SCAN ${Math.round(progress * 100)} %`, 0, 58);
    } else if (suspicious) {
      const dwell = clamp(state.decoyTarget.dwell / 0.7, 0, 1);
      ctx.strokeStyle = 'rgba(255,112,98,0.9)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, 46, -Math.PI / 2, -Math.PI / 2 + TAU * dwell);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,140,125,0.95)';
      ctx.font = '500 8px ui-monospace, "SFMono-Regular", Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PRÜFEN', 0, 58);
    }
    ctx.restore();

    if (state.aim.touch && state.aim.fingerLife > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(state.aim.fingerLife / 1.3, 0, 1);
      ctx.strokeStyle = 'rgba(160,230,235,0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(state.aim.fingerX, state.aim.fingerY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(state.aim.fingerX, state.aim.fingerY, 11, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function render(t) {
    ctx.fillStyle = '#02040b';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (state.shake > 0 && !reducedMotion) {
      const amount = state.shake * 7;
      ctx.translate(rand(-amount, amount), rand(-amount, amount));
    }

    if (bgCanvas) ctx.drawImage(bgCanvas, -2, -2, W + 4, H + 4);
    drawAurora(t);
    drawTwinkles(t);
    drawShootingStars();

    for (const object of state.objects) {
      drawObject(object, t);
    }

    if (fgCanvas) ctx.drawImage(fgCanvas, -2, -2, W + 4, H + 4);

    drawRipples();
    drawParticles();
    drawFloaters();
    drawScanBrackets(t);
    drawReticle(t);

    if (state.flash > 0) {
      ctx.fillStyle = rgba(state.flashRGB, state.flash * 0.16);
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Game flow                                                           */
  /* ------------------------------------------------------------------ */

  const RANKS = [
    { min: 0, name: 'Sternenlaie' },
    { min: 900, name: 'Nachtschicht-Praktikant' },
    { min: 2200, name: 'UFO-Späher' },
    { min: 4500, name: 'Sternenwart' },
    { min: 7500, name: 'Galaktischer Wächter' }
  ];

  function rankFor(score) {
    let result = RANKS[0];
    for (const rank of RANKS) {
      if (score >= rank.min) result = rank;
    }
    return result;
  }

  function showScreen(element, visible) {
    element.classList.toggle('is-hidden', !visible);
  }

  function setScreen(name) {
    document.body.dataset.screen = name;
    dom.pauseBtn.style.display = name === 'ended' ? 'none' : '';
    dom.pauseBtn.setAttribute('aria-label', name === 'paused' ? 'Fortsetzen' : 'Pause');
  }

  function updateBestLine() {
    dom.bestLine.textContent = best > 0 ? `Rekord: ${number.format(best)}` : 'Rekord: —';
  }

  function startGame() {
    window.clearTimeout(endShowTimer);
    sound.init();
    sound.resume();
    sound.setEnabled(sound.enabled);

    state.mode = 'playing';
    state.time = state.maxTime;
    state.elapsed = 0;
    state.score = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.bestCombo = 1;
    state.scans = 0;
    state.misses = 0;
    state.spawnTimer = 1.9;
    state.decoyTimer = 3.4;
    state.shootTimer = 2.4;
    state.objects = [];
    state.particles = [];
    state.floaters = [];
    state.ripples = [];
    state.shootingStars = [];
    state.scanTarget = null;
    state.scanProgress = 0;
    state.decoyTarget = null;
    state.shake = 0;
    state.flash = 0;
    state.lastSecond = 75;
    state.aim.x = W * 0.5;
    state.aim.y = H * 0.42;
    state.aim.tx = state.aim.x;
    state.aim.ty = state.aim.y;
    state.aim.active = false;
    state.aim.touch = false;
    state.aim.fingerLife = 0;
    keys.clear();

    setScreen('playing');
    showScreen(dom.startScreen, false);
    showScreen(dom.endScreen, false);
    showScreen(dom.pauseScreen, false);
    dom.status.className = 'status';
    updateHud();

    spawnUfo({ inside: true, type: 'saucer' });
    spawnUfo({ inside: true, type: Math.random() < 0.7 ? 'orb' : 'triangle' });
    spawnUfo({ inside: true, type: 'saucer' });

    announce('Schicht beginnt · Bleib wachsam', 'amber');
    showHint(
      coarse
        ? 'Ziehe über den Himmel — halte ein UFO im Visier'
        : 'Maus bewegen — UFO im Visier halten',
      8000
    );
    lastFrame = now();
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    state.scanTarget = null;
    state.scanProgress = 0;
    state.decoyTarget = null;
    sound.scan(0, false);
    sound.suspend();
    setScreen('paused');
    showScreen(dom.pauseScreen, true);
    hideHint();
    updateHud();
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    setScreen('playing');
    showScreen(dom.pauseScreen, false);
    sound.resume();
    lastFrame = now();
  }

  function togglePause() {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
  }

  function endGame() {
    if (state.mode === 'ended') return;
    window.clearTimeout(endShowTimer);
    state.mode = 'ended';
    state.time = Math.max(0, state.time);
    state.scanTarget = null;
    state.scanProgress = 0;
    state.decoyTarget = null;
    sound.scan(0, false);
    sound.resume();
    sound.finish();
    hideHint();
    dom.status.classList.remove('is-visible');
    setScreen('ended');
    updateHud();

    const percentage = state.scans + state.misses > 0
      ? Math.round((state.scans / (state.scans + state.misses)) * 100)
      : null;

    dom.endRank.textContent = rankFor(state.score).name;
    dom.endScore.innerHTML = `${number.format(Math.round(state.score))} <span>Punkte</span>`;
    dom.endScans.textContent = String(state.scans);
    dom.endMisses.textContent = String(state.misses);
    dom.endCombo.textContent = `×${state.bestCombo}`;
    dom.endAccuracy.textContent = percentage === null ? '—' : `${percentage} %`;

    const newBest = state.score > best && state.score > 0;
    if (state.score > best) {
      best = Math.round(state.score);
      saveBest(best);
    }
    updateBestLine();

    if (newBest) {
      dom.endRecord.textContent = 'Neuer Rekord · persönliche Bestleistung';
      dom.endRecord.classList.add('is-best');
    } else if (best > 0) {
      dom.endRecord.textContent = `Persönlicher Rekord · ${number.format(best)} Punkte`;
      dom.endRecord.classList.remove('is-best');
    } else {
      dom.endRecord.textContent = 'Noch kein Rekord · der Himmel wartet';
      dom.endRecord.classList.remove('is-best');
    }

    endShowTimer = window.setTimeout(() => {
      if (state.mode === 'ended') showScreen(dom.endScreen, true);
    }, 420);
  }

  function homeScreen() {
    window.clearTimeout(endShowTimer);
    sound.scan(0, false);
    state.mode = 'start';
    state.time = state.maxTime;
    state.score = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.scans = 0;
    state.misses = 0;
    state.objects = [];
    state.particles = [];
    state.floaters = [];
    state.ripples = [];
    state.shootingStars = [];
    state.scanTarget = null;
    state.scanProgress = 0;
    state.decoyTarget = null;
    state.flash = 0;
    state.shake = 0;
    state.aim.touch = false;
    state.aim.fingerLife = 0;
    keys.clear();

    setScreen('start');
    showScreen(dom.startScreen, true);
    showScreen(dom.endScreen, false);
    showScreen(dom.pauseScreen, false);
    dom.status.className = 'status';
    hideHint();
    updateBestLine();
    updateHud();
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */

  function pointerToSky(event) {
    if (state.mode !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const localX = clamp(event.clientX - rect.left, 0, W);
    const localY = clamp(event.clientY - rect.top, 0, H);
    const touch = event.pointerType !== 'mouse';
    const offset = touch ? Math.min(62, H * 0.082) : 0;

    state.aim.touch = touch;
    if (touch) {
      state.aim.fingerX = localX;
      state.aim.fingerY = localY;
      state.aim.fingerLife = 1.6;
    }
    state.aim.tx = clamp(localX, 24, W - 24);
    state.aim.ty = clamp(localY - offset, 24, H - 24);
    state.aim.active = true;
    hideHint();
  }

  canvas.addEventListener('pointermove', pointerToSky);
  canvas.addEventListener('pointerdown', (event) => {
    if (state.mode !== 'playing') return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is optional */
    }
    pointerToSky(event);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (state.mode === 'playing' || state.mode === 'paused') {
        event.preventDefault();
        togglePause();
      }
      return;
    }

    if (
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'KeyW' ||
      event.code === 'KeyA' ||
      event.code === 'KeyS' ||
      event.code === 'KeyD'
    ) {
      if (state.mode === 'playing') {
        event.preventDefault();
        keys.add(event.code);
        state.aim.touch = false;
        state.aim.active = true;
        hideHint();
      }
    }
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  window.addEventListener('blur', () => {
    keys.clear();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') pauseGame();
  });

  dom.startBtn.addEventListener('click', startGame);
  dom.againBtn.addEventListener('click', startGame);
  dom.homeBtn.addEventListener('click', homeScreen);
  dom.resumeBtn.addEventListener('click', resumeGame);
  dom.quitBtn.addEventListener('click', endGame);
  dom.pauseBtn.addEventListener('click', togglePause);
  dom.soundBtn.addEventListener('click', () => sound.toggle());

  /* ------------------------------------------------------------------ */
  /* Loop + boot                                                         */
  /* ------------------------------------------------------------------ */

  function queueResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    window.requestAnimationFrame(() => {
      resizeQueued = false;
      resize();
    });
  }

  window.addEventListener('resize', queueResize);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(queueResize, 240);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', queueResize);
  }

  function frame(timestamp) {
    const dt = Math.min(0.05, Math.max(0, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;

    if (state.mode === 'playing') {
      update(dt);
    } else if (state.mode === 'start' || state.mode === 'ended') {
      updateEffects(dt, timestamp / 1000);
    }

    render(timestamp / 1000);
    window.requestAnimationFrame(frame);
  }

  function boot() {
    resize();
    setScreen('start');
    updateBestLine();
    updateHud();
    dom.soundBtn.setAttribute('aria-pressed', String(sound.enabled));
    dom.soundBtn.setAttribute('aria-label', sound.enabled ? 'Ton ausschalten' : 'Ton einschalten');
    dom.hint.classList.add('is-hidden');
    showScreen(dom.startScreen, true);
    showScreen(dom.endScreen, false);
    showScreen(dom.pauseScreen, false);
    lastFrame = now();
    window.requestAnimationFrame(frame);
  }

  boot();
  window.__ufoDebug = state;
  window.__ufoTest = { spawnDecoy, spawnUfo, endGame, pauseGame };
})();
