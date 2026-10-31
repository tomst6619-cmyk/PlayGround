/**
 * Small procedural soundscape. No audio files, no network.
 * Everything is created lazily after the first user gesture.
 */

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.ambient = null;
    this.filmLoop = null;
    this.muted = false;
    this.ready = false;
  }

  async unlock() {
    if (!this.ready) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.62;
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.createNoise();
      this.ready = true;
    }
    if (this.context.state === 'suspended') {
      await this.context.resume().catch(() => {});
    }
    return true;
  }

  createNoise() {
    const length = Math.floor(this.context.sampleRate * 2);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = 0.97 * last + 0.03 * white;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.62, this.context.currentTime + 0.18);
    }
  }

  startAmbient() {
    if (!this.ready || this.ambient) return;
    const ctx = this.context;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 0.7;
    filter.connect(bus);

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    droneGain.connect(filter);

    const frequencies = [55, 82.5, 110, 164.81];
    const oscillators = frequencies.map((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = index % 2 ? 'sine' : 'triangle';
      osc.frequency.value = frequency;
      osc.detune.value = (index - 1.5) * 4;
      const gain = ctx.createGain();
      gain.gain.value = index === 0 ? 0.3 : 0.12 / (index + 1);
      osc.connect(gain).connect(droneGain);
      osc.start();
      return osc;
    });

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.035;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 520;
    windFilter.Q.value = 0.45;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.055;
    wind.connect(windFilter).connect(windGain).connect(bus);
    wind.start();

    bus.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 3);
    this.ambient = { bus, oscillators, lfo, wind };
  }

  stopAmbient(fade = 0.6) {
    if (!this.ambient || !this.context) return;
    const { bus, oscillators, lfo, wind } = this.ambient;
    const now = this.context.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => {
      oscillators.forEach((osc) => { try { osc.stop(); } catch {} });
      try { lfo.stop(); } catch {}
      try { wind.stop(); } catch {}
      try { bus.disconnect(); } catch {}
    }, (fade + 0.1) * 1000);
    this.ambient = null;
  }

  setFilming(active) {
    if (!this.ready) return;
    if (this.filmActive === active && this.filmLoop) return;
    this.filmActive = active;
    if (!this.filmLoop) {
      if (!active) return;
      const ctx = this.context;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 880;
      filter.Q.value = 1.8;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 92;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.018;
      osc.connect(oscGain).connect(gain);
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.035;
      noise.connect(filter).connect(noiseGain).connect(gain);
      gain.connect(this.master);
      osc.start();
      noise.start();
      this.filmLoop = { gain, osc, noise };
    }
    const now = this.context.currentTime;
    this.filmLoop.gain.gain.cancelScheduledValues(now);
    this.filmLoop.gain.gain.linearRampToValueAtTime(active ? 0.55 : 0, now + 0.12);
  }

  tone({ frequency, type = 'sine', duration = 0.2, gain = 0.12, slideTo = null, delay = 0, attack = 0.01 }) {
    if (!this.ready) return;
    const ctx = this.context;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  noiseBurst({ duration = 0.15, gain = 0.1, frequency = 2200, q = 0.8, delay = 0 }) {
    if (!this.ready) return;
    const ctx = this.context;
    const now = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(amp).connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  ui() {
    this.tone({ frequency: 660, type: 'sine', duration: 0.08, gain: 0.05 });
  }

  filmStart() {
    this.noiseBurst({ duration: 0.09, gain: 0.07, frequency: 1400, q: 1.2 });
    this.tone({ frequency: 240, type: 'square', duration: 0.08, gain: 0.025 });
  }

  shutter() {
    this.noiseBurst({ duration: 0.06, gain: 0.09, frequency: 3200, q: 0.6 });
    this.noiseBurst({ duration: 0.04, gain: 0.05, frequency: 900, q: 0.8, delay: 0.06 });
  }

  capture(combo = 1, precision = 1) {
    this.shutter();
    const root = 523.25;
    const steps = [0, 4, 7, 12, 16];
    const count = precision >= 1.5 ? 5 : 4;
    for (let i = 0; i < count; i += 1) {
      const semitone = steps[Math.min(i, steps.length - 1)] + (combo > 4 ? 12 : 0);
      this.tone({
        frequency: root * 2 ** (semitone / 12),
        type: 'triangle',
        duration: 0.32,
        gain: 0.07,
        delay: 0.05 + i * 0.065,
        attack: 0.005,
      });
    }
    if (combo >= 4) {
      this.tone({ frequency: 1046.5, type: 'sine', duration: 0.6, gain: 0.035, delay: 0.32 });
    }
  }

  falseAlarm() {
    this.tone({ frequency: 196, type: 'sawtooth', duration: 0.28, gain: 0.09, slideTo: 98 });
    this.tone({ frequency: 233, type: 'square', duration: 0.24, gain: 0.035, delay: 0.03, slideTo: 116 });
    this.noiseBurst({ duration: 0.16, gain: 0.06, frequency: 700, q: 0.5 });
  }

  damage() {
    this.tone({ frequency: 70, type: 'sine', duration: 0.5, gain: 0.14, slideTo: 42 });
    this.noiseBurst({ duration: 0.2, gain: 0.05, frequency: 300, q: 0.4 });
  }

  wave() {
    this.tone({ frequency: 740, type: 'sine', duration: 0.12, gain: 0.05 });
    this.tone({ frequency: 988, type: 'sine', duration: 0.16, gain: 0.045, delay: 0.13 });
  }

  radio() {
    this.tone({ frequency: 1200, type: 'square', duration: 0.05, gain: 0.025 });
    this.tone({ frequency: 1200, type: 'square', duration: 0.05, gain: 0.02, delay: 0.1 });
    this.noiseBurst({ duration: 0.12, gain: 0.022, frequency: 1800, q: 2.4, delay: 0.02 });
  }

  gameOver() {
    const notes = [392, 329.63, 261.63, 196];
    notes.forEach((frequency, index) => {
      this.tone({
        frequency,
        type: 'triangle',
        duration: 0.9,
        gain: 0.08,
        delay: index * 0.22,
        attack: 0.02,
      });
    });
    this.tone({ frequency: 55, type: 'sine', duration: 2.4, gain: 0.09, slideTo: 36 });
  }

  newBest() {
    [659.25, 783.99, 987.77, 1318.51].forEach((frequency, index) => {
      this.tone({ frequency, type: 'sine', duration: 0.45, gain: 0.06, delay: 0.15 + index * 0.09 });
    });
  }
}
