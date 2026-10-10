// Tiny synthesized sound effects (no audio files needed).

export class Audio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.last = {};
  }

  // Browsers only allow audio after a user gesture.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.3, freq = 1200, delay = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  play(name, arg) {
    if (!this.enabled || !this.ctx) return;
    // Throttle very frequent sounds.
    const now = this.ctx.currentTime;
    const gap = { pop: 0.05, hit: 0.03, tap: 0.06, swing: 0.06, bow: 0.06, magic: 0.07, zap: 0.08, boom: 0.08, tick: 0.035, hurry: 0.03 }[name] || 0;
    if (gap && now - (this.last[name] || 0) < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'tick': this.tone(520 + (arg || 0) * 40, 0.05, { type: 'square', vol: 0.08 }); break;
      case 'reveal': {
        const tier = arg || 0;
        const base = [392, 440, 523, 587, 659, 784, 880][tier];
        this.tone(base, 0.18, { type: 'triangle', vol: 0.25 });
        this.tone(base * 1.25, 0.2, { type: 'triangle', vol: 0.22, delay: 0.08 });
        this.tone(base * 1.5, 0.35, { type: 'triangle', vol: 0.22, delay: 0.16 });
        if (tier >= 3) this.tone(base * 2, 0.6, { type: 'sine', vol: 0.2, delay: 0.26 });
        if (tier >= 5) { this.noise(0.6, { vol: 0.15, freq: 4000, delay: 0.1 }); this.tone(base * 3, 0.8, { type: 'sine', vol: 0.15, delay: 0.4 }); }
        break;
      }
      case 'pop': this.tone(660, 0.08, { type: 'square', vol: 0.07, slide: 1.6 }); break;
      case 'hit': this.noise(0.06, { vol: 0.25, freq: 2500 }); this.tone(220, 0.06, { type: 'square', vol: 0.08, slide: 0.6 }); break;
      case 'tap': this.noise(0.04, { vol: 0.12, freq: 3000 }); break;
      case 'swing': this.noise(0.1, { vol: 0.12, freq: 1800 }); break;
      case 'bow': this.tone(900, 0.07, { type: 'triangle', vol: 0.08, slide: 0.5 }); break;
      case 'magic': this.tone(700, 0.15, { type: 'sine', vol: 0.08, slide: 1.8 }); break;
      case 'zap': this.noise(0.12, { vol: 0.18, freq: 6000 }); this.tone(1200, 0.1, { type: 'sawtooth', vol: 0.05, slide: 0.4 }); break;
      case 'boom': this.noise(0.3, { vol: 0.3, freq: 500 }); break;
      case 'cannon': this.noise(0.35, { vol: 0.35, freq: 400 }); this.tone(90, 0.25, { type: 'sine', vol: 0.3, slide: 0.5 }); break;
      case 'coin': this.tone(988, 0.07, { type: 'square', vol: 0.08 }); this.tone(1319, 0.12, { type: 'square', vol: 0.08, delay: 0.07 }); break;
      case 'buy': this.tone(523, 0.1, { type: 'triangle', vol: 0.2 }); this.tone(784, 0.1, { type: 'triangle', vol: 0.2, delay: 0.08 }); this.tone(1047, 0.2, { type: 'triangle', vol: 0.2, delay: 0.16 }); break;
      case 'deny': this.tone(200, 0.15, { type: 'square', vol: 0.1, slide: 0.7 }); break;
      case 'waveStart': this.tone(330, 0.15, { type: 'sawtooth', vol: 0.08 }); this.tone(440, 0.25, { type: 'sawtooth', vol: 0.08, delay: 0.12 }); break;
      case 'waveClear': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.18, delay: i * 0.09 })); break;
      case 'fail': [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.2, delay: i * 0.15 })); break;
      case 'townHit': this.tone(140, 0.2, { type: 'square', vol: 0.15, slide: 0.6 }); break;
      case 'boss': this.tone(110, 0.6, { type: 'sawtooth', vol: 0.15 }); this.tone(104, 0.8, { type: 'sawtooth', vol: 0.15, delay: 0.3 }); break;
      case 'bossDie': this.noise(0.8, { vol: 0.35, freq: 900 }); [523, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.2, delay: 0.2 + i * 0.1 })); break;
      case 'thunder': this.noise(0.7, { vol: 0.4, freq: 1500 }); break;
      case 'click': this.tone(800, 0.04, { type: 'square', vol: 0.06 }); break;
      case 'hurry': this.tone(700 + Math.min(10, arg || 0) * 70, 0.06, { type: 'square', vol: 0.07, slide: 1.4 }); break;
      case 'combo': {
        const f = 440 * Math.pow(2, Math.min(24, arg || 0) / 12);
        this.tone(f, 0.12, { type: 'triangle', vol: 0.15 });
        this.tone(f * 1.5, 0.15, { type: 'triangle', vol: 0.12, delay: 0.05 });
        break;
      }
      case 'comboLost': this.tone(330, 0.2, { type: 'triangle', vol: 0.12, slide: 0.6 }); break;
      case 'dieSpawn': [1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.1, { type: 'sine', vol: 0.12, delay: i * 0.06 })); break;
      case 'rush':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, { type: 'square', vol: 0.09, delay: i * 0.06 }));
        this.noise(0.4, { vol: 0.12, freq: 5000, delay: 0.1 });
        break;
      case 'rushEnd': [784, 523].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.12, delay: i * 0.1 })); break;
    }
  }
}
