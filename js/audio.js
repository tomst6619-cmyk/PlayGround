import { clamp, lerp } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    this.started = false;
    this.threat = 0;
    this.heartTimer = 0;
    this.soulTimer = 0;
    this.soulPing = 0;
  }

  init() {
    if (this.started) {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.started = true;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.52;
      this.master.connect(ctx.destination);

      // sub drone
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.055;
      droneGain.connect(this.master);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 150;
      lp.Q.value = 1.2;
      lp.connect(droneGain);
      this.droneFilter = lp;
      [41, 55, 82.4].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 2 ? 'triangle' : 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = i === 2 ? 0.14 : 0.45;
        o.connect(g);
        g.connect(lp);
        o.start();
        if (i === 0) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.07;
          const lg = ctx.createGain();
          lg.gain.value = 1.6;
          lfo.connect(lg);
          lg.connect(o.frequency);
          lfo.start();
        }
      });

      // air / room tone
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
      this.noiseBuf = buf;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 380;
      bp.Q.value = 0.45;
      const ng = ctx.createGain();
      ng.gain.value = 0.02;
      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.master);
      src.start();
      this.airGain = ng;
    } catch {
      this.ctx = null;
      this.started = false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.52, this.ctx.currentTime, 0.08);
    }
  }

  _noise(duration, gain, filterType, freq, when = 0, q = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  _tone(freq, duration, gain, type = 'sine', when = 0, endFreq = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  footstep(running) {
    if (!this.ctx || this.muted) return;
    const g = running ? 0.11 : 0.065;
    this._noise(running ? 0.16 : 0.12, g, 'lowpass', running ? 420 : 300, 0, 0.6);
    this._tone(running ? 82 : 68, 0.1, g * 0.55, 'sine');
  }

  pickup() {
    if (!this.ctx || this.muted) return;
    this._tone(523, 0.5, 0.12, 'sine', 0);
    this._tone(784, 0.6, 0.09, 'sine', 0.08);
    this._tone(1046, 0.7, 0.06, 'sine', 0.16);
    this._noise(0.4, 0.035, 'highpass', 2200, 0.02);
  }

  heartbeat(intensity) {
    if (!this.ctx || this.muted) return;
    this._tone(52, 0.16, 0.14 + intensity * 0.18, 'sine');
    this._tone(44, 0.2, 0.1 + intensity * 0.12, 'sine', 0.19);
  }

  growl() {
    if (!this.ctx || this.muted) return;
    this._tone(64, 0.85, 0.09, 'sawtooth', 0, 46);
    this._noise(0.7, 0.045, 'bandpass', 210, 0, 2.5);
  }

  whisper() {
    if (!this.ctx || this.muted) return;
    this._noise(0.55, 0.03, 'bandpass', 1500 + Math.random() * 900, 0, 3);
  }

  scare() {
    if (!this.ctx) return;
    this._noise(1.1, 0.55, 'highpass', 600, 0, 0.7);
    this._tone(920, 1.1, 0.16, 'sawtooth', 0, 120);
    this._tone(140, 1.3, 0.24, 'sawtooth', 0, 32);
    this._tone(57, 1.4, 0.3, 'sine', 0, 28);
    this._noise(1.5, 0.2, 'lowpass', 240, 0.25, 1);
  }

  exitChime() {
    if (!this.ctx || this.muted) return;
    [392, 523, 659, 784].forEach((f, i) => this._tone(f, 0.9, 0.08, 'sine', i * 0.11));
  }

  soulClose(distance) {
    if (!this.ctx || this.muted) return;
    this._tone(220 + (10 - Math.min(distance, 10)) * 30, 0.35, 0.025, 'sine', 0, 300);
  }

  update(dt, threat, playing, soulsNear = 99) {
    if (!this.ctx) return;
    this.threat = lerp(this.threat, threat, 0.12);
    if (this.droneFilter) this.droneFilter.frequency.value = 130 + this.threat * 320;
    if (this.airGain) this.airGain.gain.value = 0.018 + this.threat * 0.02;
    if (!playing || this.muted) return;

    this.heartTimer -= dt;
    if (this.threat > 0.16 && this.heartTimer <= 0) {
      this.heartbeat(clamp(this.threat, 0, 1));
      this.heartTimer = lerp(1.5, 0.36, this.threat);
    }
    this.soulTimer -= dt;
    if (soulsNear < 11 && this.soulTimer <= 0) {
      this.soulClose(soulsNear);
      this.soulTimer = lerp(2.4, 1.5, 1 - soulsNear / 11);
    }
  }
}
