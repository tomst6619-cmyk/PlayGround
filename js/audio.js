/* Small synthesised soundscape — no audio files, no network. */

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('sorry-muted') === '1';
    this.stepTimer = 0;
  }

  get ready() {
    return Boolean(this.ctx);
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.startRain();
    this.startPad();
  }

  startRain() {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 2.6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();

    // distant rain hiss
    const hiss = ctx.createBufferSource();
    hiss.buffer = buffer;
    hiss.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const hg = ctx.createGain();
    hg.gain.value = 0.022;
    hiss.connect(hp).connect(hg).connect(this.master);
    hiss.start();
  }

  startPad() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0.09;
    bus.connect(this.master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 640;
    filter.Q.value = 0.6;
    filter.connect(bus);

    const notes = [110, 164.81, 220, 277.18];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 4;

      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.22 / (i * 0.5 + 0.5);

      // slow wandering amplitude
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + i * 0.017;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.14;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();

      osc.connect(g).connect(filter);
      osc.start();
    });

    // gentle tape wobble
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 0.09;
    const wobbleGain = ctx.createGain();
    wobbleGain.gain.value = 70;
    wobble.connect(wobbleGain).connect(filter.frequency);
    wobble.start();

    this.padBus = bus;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('sorry-muted', muted ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, this.ctx.currentTime + 0.2);
    }
  }

  tone({ freq = 440, type = 'sine', dur = 0.3, gain = 0.12, slide = null, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  chime() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone({ freq: f, type: 'sine', dur: 0.55, gain: 0.075, delay: i * 0.075 });
    });
  }

  wrong() {
    this.tone({ freq: 220, type: 'triangle', dur: 0.42, gain: 0.1, slide: 130 });
    this.tone({ freq: 164, type: 'sine', dur: 0.5, gain: 0.07, slide: 98, delay: 0.08 });
  }

  pickup() {
    this.tone({ freq: 880, type: 'sine', dur: 0.18, gain: 0.06 });
    this.tone({ freq: 1320, type: 'sine', dur: 0.26, gain: 0.05, delay: 0.07 });
  }

  click() {
    this.tone({ freq: 640, type: 'triangle', dur: 0.08, gain: 0.05 });
  }

  win() {
    const notes = [392, 523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.7, gain: 0.06, delay: i * 0.11 }));
  }

  lose() {
    const notes = [329.63, 293.66, 246.94, 196];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.8, gain: 0.07, delay: i * 0.18 }));
  }

  step() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, 512, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 400;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }
}
