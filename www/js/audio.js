// Процедурный аудио-движок на WebAudio API (работает офлайн на любом Android без внешних mp3)

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.sfxVolume = 0.7;
    this.musicVolume = 0.35;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.inBossFight = false;
    this.noiseBuffer = null;
  }

  init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
        this._buildNoise();
        this.applyVolumes();
        this.startMusicLoop();
      } catch (_e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoise() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 0.4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume, now, 0.02);
    this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.32, now, 0.05);
  }

  setSettings({ sfxVolume, musicVolume, muted }) {
    if (typeof sfxVolume === 'number') this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
    if (typeof musicVolume === 'number') this.musicVolume = Math.max(0, Math.min(1, musicVolume));
    if (typeof muted === 'boolean') this.muted = muted;
    this.applyVolumes();
  }

  setBossMode(active) {
    this.inBossFight = !!active;
  }

  _tone(freq, endFreq, dur, type = 'triangle', vol = 0.25, delay = 0, dest = null) {
    if (!this.ctx || this.muted || this.sfxVolume <= 0.01) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, freq), t0);
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, endFreq), t0 + dur);
    }
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.015, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _burst(dur = 0.1, filterFreq = 1200, vol = 0.2, q = 1.2) {
    if (!this.ctx || !this.noiseBuffer || this.muted || this.sfxVolume <= 0.01) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, filterFreq * 0.35), t0 + dur);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.01);
  }

  play(name) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    switch (name) {
      case 'swing':
        this._burst(0.11, 1600, 0.22, 1.0);
        this._tone(280, 110, 0.09, 'sawtooth', 0.10);
        break;
      case 'daggers':
        this._burst(0.07, 2600, 0.18, 1.6);
        this._tone(520, 220, 0.06, 'triangle', 0.10);
        break;
      case 'bow':
        this._tone(460, 180, 0.11, 'triangle', 0.18);
        this._burst(0.06, 2200, 0.12, 2.0);
        break;
      case 'hammer':
        this._tone(130, 42, 0.22, 'sawtooth', 0.28);
        this._burst(0.18, 520, 0.28, 0.8);
        break;
      case 'magic':
        this._tone(420, 880, 0.15, 'sine', 0.18);
        this._tone(630, 1120, 0.13, 'triangle', 0.12, 0.02);
        break;
      case 'scythe':
        this._burst(0.14, 1900, 0.22, 1.2);
        this._tone(340, 680, 0.14, 'sawtooth', 0.14);
        break;
      case 'hit':
        this._tone(160, 65, 0.08, 'square', 0.14);
        this._burst(0.06, 900, 0.16, 1.1);
        break;
      case 'crit':
        this._tone(580, 960, 0.12, 'triangle', 0.22);
        this._tone(220, 75, 0.12, 'sawtooth', 0.18);
        this._burst(0.09, 1800, 0.2, 1.4);
        break;
      case 'hurt':
        this._tone(190, 72, 0.18, 'sawtooth', 0.26);
        this._burst(0.12, 650, 0.22, 0.9);
        break;
      case 'jump':
        this._tone(210, 460, 0.14, 'sine', 0.18);
        break;
      case 'slam':
        this._tone(110, 34, 0.30, 'sawtooth', 0.34);
        this._burst(0.26, 480, 0.34, 0.7);
        break;
      case 'skill_fire':
        this._burst(0.28, 1100, 0.30, 0.8);
        this._tone(240, 520, 0.24, 'sawtooth', 0.20);
        break;
      case 'skill_shield':
        this._tone(330, 660, 0.25, 'sine', 0.22);
        this._tone(495, 990, 0.28, 'triangle', 0.16, 0.06);
        break;
      case 'pickup':
        this._tone(660, 990, 0.09, 'sine', 0.15);
        break;
      case 'gold':
        this._tone(880, 1320, 0.08, 'triangle', 0.14);
        this._tone(1320, 1760, 0.09, 'sine', 0.12, 0.05);
        break;
      case 'chest':
        [440, 554, 659, 880].forEach((f, idx) => {
          this._tone(f, f * 1.03, 0.18, 'triangle', 0.20, idx * 0.07);
        });
        break;
      case 'levelup':
        [392, 494, 587, 784, 988].forEach((f, idx) => {
          this._tone(f, f * 1.02, 0.24, 'triangle', 0.22, idx * 0.075);
        });
        break;
      case 'boss_roar':
        this._tone(98, 42, 0.55, 'sawtooth', 0.32);
        this._burst(0.45, 380, 0.28, 0.8);
        break;
      case 'potion':
        this._tone(360, 720, 0.18, 'sine', 0.20);
        this._tone(540, 900, 0.16, 'sine', 0.16, 0.08);
        break;
      case 'ui':
        this._tone(520, 640, 0.05, 'sine', 0.10);
        break;
      default:
        break;
    }
  }

  startMusicLoop() {
    if (this.musicTimer || typeof window === 'undefined') return;
    // Атмосферная арпеджио-тема (спокойная в мире и напряжённая на боссе)
    const calmNotes = [220, 261.63, 329.63, 392.0, 329.63, 293.66, 246.94, 196.0];
    const bossNotes = [146.83, 174.61, 220.0, 207.65, 146.83, 164.81, 196.0, 233.08];

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || this.muted || this.musicVolume <= 0.01) return;
      const scale = this.inBossFight ? bossNotes : calmNotes;
      const note = scale[this.musicStep % scale.length];
      const t0 = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = this.inBossFight ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(note, t0);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = this.inBossFight ? 680 : 900;

      const dur = this.inBossFight ? 0.32 : 0.72;
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(this.inBossFight ? 0.26 : 0.22, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);

      if (this.musicStep % 4 === 0) {
        const bass = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bass.type = 'triangle';
        bass.frequency.setValueAtTime(note * 0.5, t0);
        bg.gain.setValueAtTime(0.001, t0);
        bg.gain.linearRampToValueAtTime(0.24, t0 + 0.08);
        bg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);
        bass.connect(bg);
        bg.connect(this.musicGain);
        bass.start(t0);
        bass.stop(t0 + 1.25);
      }

      this.musicStep++;
    }, 420);
  }
}

export const sound = new SoundEngine();
