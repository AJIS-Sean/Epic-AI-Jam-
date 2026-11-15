export class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private carveGain: GainNode | null = null;
  private carveFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private muted = false;
  private started = false;

  public unlock(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.started = true;

      // Create 2-second white/pinkish noise buffer
      const sr = this.ctx.sampleRate;
      const len = sr * 2;
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.04 * white) / 1.04;
        lastOut = data[i];
      }
      this.noiseBuffer = buf;

      // Continuous snow carve hiss
      const carveSrc = this.ctx.createBufferSource();
      carveSrc.buffer = buf;
      carveSrc.loop = true;

      this.carveFilter = this.ctx.createBiquadFilter();
      this.carveFilter.type = 'bandpass';
      this.carveFilter.frequency.value = 1200;
      this.carveFilter.Q.value = 0.9;

      this.carveGain = this.ctx.createGain();
      this.carveGain.gain.value = 0;

      carveSrc.connect(this.carveFilter);
      this.carveFilter.connect(this.carveGain);
      this.carveGain.connect(this.ctx.destination);
      carveSrc.start();

      // Continuous alpine wind rush
      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 350;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;

      windSrc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      windSrc.start();
    } catch {
      // Audio unavailable
    }
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (mute && this.ctx) {
      const now = this.ctx.currentTime;
      this.carveGain?.gain.setTargetAtTime(0, now, 0.05);
      this.windGain?.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateContinuous(params: {
    active: boolean;
    speed: number;
    grounded: boolean;
    carveAmount: number; // 0..1
    braking: boolean;
    timeScale: number;
  }): void {
    if (!this.ctx || !this.carveGain || !this.carveFilter || !this.windGain || !this.windFilter) {
      return;
    }

    const now = this.ctx.currentTime;
    if (this.muted || !params.active) {
      this.carveGain.gain.setTargetAtTime(0, now, 0.08);
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const speedNorm = Math.min(1, params.speed / 42);
    const carveIntensity = params.grounded
      ? (0.04 + params.carveAmount * 0.22 + (params.braking ? 0.26 : 0)) * speedNorm
      : 0;

    this.carveGain.gain.setTargetAtTime(Math.min(0.32, carveIntensity), now, 0.04);
    this.carveFilter.frequency.setTargetAtTime(
      params.braking ? 2100 : 900 + params.carveAmount * 1400,
      now,
      0.05
    );

    const windVol = Math.min(0.24, speedNorm * speedNorm * 0.22);
    this.windGain.gain.setTargetAtTime(windVol, now, 0.08);
    this.windFilter.frequency.setTargetAtTime(
      (240 + speedNorm * 950) * Math.max(0.4, params.timeScale),
      now,
      0.08
    );
  }

  public playClapper(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1150, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.055);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playJump(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.14);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playLand(impactStrength: number): void {
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.35, 0.12 + impactStrength * 0.2);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(550, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.21);
  }

  public playExplosion(): void {
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Low boom thump
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.45);
    oscGain.gain.setValueAtTime(0.45, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);

    // Fireball roar
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.65);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.72);
  }

  public playHoopWhoosh(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.32);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playMoneyShot(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Cinematic sub drop
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.55);
    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 0.62);

    // Camera shutter click
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(1800, now);
    click.frequency.exponentialRampToValueAtTime(400, now + 0.025);
    clickGain.gain.setValueAtTime(0.15, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    click.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    click.start(now);
    click.stop(now + 0.035);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
