// Синтезатор звуковых эффектов WebAudio API без внешних тяжёлых аудиофайлов
// Мгновенный отклик на Android и 0 КБ нагрузки на память

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.55;
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  tone(freq, endFreq, dur, type = 'triangle', gainVal = 0.18, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, freq), now);
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, endFreq), now + dur);
    }
    const peak = Math.min(0.9, gainVal * this.volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.015);
  }

  play(kind) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;

    switch (kind) {
      case 'swing':
        this.tone(300, 110, 0.10, 'sawtooth', 0.14);
        break;
      case 'gun':
        this.tone(420, 95, 0.09, 'square', 0.22);
        this.tone(180, 55, 0.11, 'sawtooth', 0.18);
        break;
      case 'shotgun':
        this.tone(240, 48, 0.18, 'sawtooth', 0.30);
        this.tone(360, 75, 0.14, 'square', 0.22);
        break;
      case 'explosion':
        this.tone(145, 28, 0.42, 'sawtooth', 0.36);
        this.tone(95, 24, 0.48, 'square', 0.26, 0.03);
        break;
      case 'hit':
        this.tone(180, 65, 0.08, 'square', 0.18);
        break;
      case 'crit':
        this.tone(540, 210, 0.12, 'sawtooth', 0.24);
        this.tone(820, 460, 0.14, 'triangle', 0.20, 0.03);
        break;
      case 'playerHit':
        this.tone(135, 48, 0.18, 'sawtooth', 0.26);
        break;
      case 'jump':
        this.tone(230, 490, 0.14, 'sine', 0.18);
        break;
      case 'dash':
        this.tone(440, 160, 0.13, 'triangle', 0.18);
        break;
      case 'pickup':
        this.tone(580, 880, 0.09, 'sine', 0.15);
        break;
      case 'unlock':
        this.tone(440, 660, 0.12, 'triangle', 0.22, 0);
        this.tone(660, 990, 0.18, 'triangle', 0.24, 0.10);
        break;
      case 'vehicle':
        this.tone(110, 165, 0.18, 'sawtooth', 0.20);
        break;
      case 'heal':
        this.tone(420, 640, 0.14, 'sine', 0.18);
        this.tone(640, 860, 0.16, 'sine', 0.16, 0.09);
        break;
      case 'skill':
        this.tone(260, 620, 0.22, 'sawtooth', 0.22);
        this.tone(520, 920, 0.20, 'triangle', 0.16, 0.06);
        break;
      case 'levelup':
        this.tone(440, 440, 0.11, 'triangle', 0.22, 0);
        this.tone(554, 554, 0.11, 'triangle', 0.22, 0.09);
        this.tone(659, 659, 0.13, 'triangle', 0.24, 0.18);
        this.tone(880, 880, 0.28, 'triangle', 0.26, 0.28);
        break;
      case 'ui':
        this.tone(660, 740, 0.05, 'sine', 0.10);
        break;
    }
  }
}
