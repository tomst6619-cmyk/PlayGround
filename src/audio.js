/* Tiny WebAudio instrument — every sound is synthesized, no external assets. */
export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.noiseBuffer = null
    this.ambient = null
    this.birdTimer = null
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.42
    this.master.connect(this.ctx.destination)
    this.noiseBuffer = this.makeNoise(2)
    this.startAmbience()
  }

  makeNoise(seconds = 1) {
    const ctx = this.ctx
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
    return buffer
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.04)
    return muted
  }

  toggleMute() {
    return this.setMuted(!this.muted)
  }

  startAmbience() {
    const ctx = this.ctx
    if (!ctx) return
    const src = ctx.createBufferSource()
    src.buffer = this.makeNoise(3)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    const gain = ctx.createGain()
    gain.gain.value = 0.05
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
    this.ambient = { src, gain, filter }

    const scheduleBird = () => {
      if (!this.muted && this.ctx) this.bird()
      this.birdTimer = window.setTimeout(scheduleBird, 3200 + Math.random() * 6500)
    }
    this.birdTimer = window.setTimeout(scheduleBird, 2600)
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0
  }

  tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.15, gain = 0.2, delay = 0, attack = 0.005 }) {
    if (!this.ctx) return
    const t = this.now() + delay
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  noise({ dur = 0.2, gain = 0.2, type = 'lowpass', freq = 900, freqEnd = null, delay = 0, q = 0.8 }) {
    if (!this.ctx || !this.noiseBuffer) return
    const t = this.now() + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.Q.value = q
    filter.frequency.setValueAtTime(freq, t)
    if (freqEnd !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  pickup() {
    this.tone({ freq: 520, freqEnd: 760, type: 'triangle', dur: 0.11, gain: 0.16 })
    this.tone({ freq: 1040, type: 'sine', dur: 0.08, gain: 0.06, delay: 0.05 })
  }

  deposit() {
    const notes = [392, 523, 659, 784]
    notes.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.13, delay: i * 0.055 }))
    this.noise({ dur: 0.25, gain: 0.06, type: 'bandpass', freq: 1200, delay: 0.05 })
  }

  throw() {
    this.noise({ dur: 0.28, gain: 0.14, type: 'bandpass', freq: 1900, freqEnd: 380, q: 1.4 })
    this.tone({ freq: 190, freqEnd: 90, type: 'sine', dur: 0.12, gain: 0.08 })
  }

  splat() {
    this.noise({ dur: 0.24, gain: 0.24, type: 'lowpass', freq: 1500, freqEnd: 200, q: 0.6 })
    this.tone({ freq: 120, freqEnd: 55, type: 'sine', dur: 0.18, gain: 0.18 })
  }

  scream() {
    this.tone({ freq: 420, freqEnd: 880, type: 'sawtooth', dur: 0.18, gain: 0.07 })
    this.tone({ freq: 880, freqEnd: 360, type: 'sawtooth', dur: 0.4, gain: 0.06, delay: 0.18 })
    this.tone({ freq: 700, freqEnd: 300, type: 'square', dur: 0.35, gain: 0.025, delay: 0.2 })
  }

  tackle() {
    this.noise({ dur: 0.5, gain: 0.3, type: 'lowpass', freq: 800, freqEnd: 90, q: 0.7 })
    this.tone({ freq: 90, freqEnd: 38, type: 'sine', dur: 0.5, gain: 0.32 })
    this.tone({ freq: 180, freqEnd: 80, type: 'triangle', dur: 0.4, gain: 0.12, delay: 0.04 })
    this.tone({ freq: 1200, freqEnd: 200, type: 'sawtooth', dur: 0.3, gain: 0.04, delay: 0.08 })
  }

  bunny() {
    this.tone({ freq: 900, freqEnd: 1300, type: 'sine', dur: 0.09, gain: 0.11 })
    this.tone({ freq: 1200, freqEnd: 900, type: 'sine', dur: 0.1, gain: 0.08, delay: 0.1 })
    this.tone({ freq: 1500, type: 'sine', dur: 0.06, gain: 0.05, delay: 0.22 })
  }

  batman() {
    this.tone({ freq: 78, freqEnd: 58, type: 'square', dur: 0.5, gain: 0.05 })
    this.tone({ freq: 120, freqEnd: 90, type: 'sawtooth', dur: 0.4, gain: 0.025, delay: 0.05 })
  }

  footstep(run = false) {
    this.noise({ dur: 0.08, gain: run ? 0.055 : 0.035, type: 'lowpass', freq: 260, freqEnd: 90 })
  }

  click() {
    this.tone({ freq: 660, freqEnd: 440, type: 'square', dur: 0.05, gain: 0.03 })
  }

  deny() {
    this.tone({ freq: 210, freqEnd: 150, type: 'square', dur: 0.14, gain: 0.06 })
  }

  bird() {
    const base = 1800 + Math.random() * 1300
    const notes = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < notes; i++) {
      this.tone({ freq: base, freqEnd: base * (0.7 + Math.random() * 0.6), type: 'sine', dur: 0.06 + Math.random() * 0.05, gain: 0.017, delay: i * 0.09, attack: 0.004 })
    }
  }

  fanfare() {
    const melody = [523, 659, 784, 1047, 784, 1047, 1319]
    melody.forEach((f, i) => {
      this.tone({ freq: f, type: 'triangle', dur: 0.28, gain: 0.13, delay: i * 0.11 })
      this.tone({ freq: f / 2, type: 'sine', dur: 0.3, gain: 0.08, delay: i * 0.11 })
    })
    this.tone({ freq: 1568, type: 'triangle', dur: 0.8, gain: 0.1, delay: 0.85 })
  }
}
