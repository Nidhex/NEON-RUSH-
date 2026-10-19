/**
 * AudioManager: Procedural Web Audio API sound generator.
 * Creates original cyberpunk sound effects and dynamic synthwave background music
 * with zero external dependencies.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.muted = false;
    this.sfxVolume = 0.8;
    this.musicVolume = 0.45;
    this.isInitialized = false;

    // Music sequencer state
    this.isPlayingMusic = false;
    this.musicTimer = null;
    this.currentStep = 0;
    this.bpm = 124;
    this.tempoSpeedMultiplier = 1.0;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API initialization failed:', e);
    }
  }

  ensureContext() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  setVolumes(sfxVol, musicVol) {
    this.sfxVolume = Math.max(0, Math.min(1, sfxVol));
    this.musicVolume = Math.max(0, Math.min(1, musicVol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  // --- Sound Effects ---

  playJump() {
    if (!this.canPlaySound()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Pitch sweeps up rapidly: 160Hz -> 520Hz
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.16);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio fallback
    }
  }

  playSlide() {
    if (!this.canPlaySound()) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.18;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.18);
      filter.Q.value = 3;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(now);
      noise.stop(now + 0.22);
    } catch {
      // Audio fallback
    }
  }

  playCoin() {
    if (!this.canPlaySound()) return;
    try {
      const now = this.ctx.currentTime;
      // High harmonious dual-tone chime (B5 987Hz -> E6 1318Hz)
      const freqs = [987.77, 1318.51];
      freqs.forEach((f, idx) => {
        const start = now + idx * 0.045;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(0.22, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch {
      // Audio fallback
    }
  }

  playPowerup() {
    if (!this.canPlaySound()) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.05;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, start);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1800;

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(start);
        osc.stop(start + 0.14);
      });
    } catch {
      // Audio fallback
    }
  }

  playHit() {
    if (!this.canPlaySound()) return;
    try {
      const now = this.ctx.currentTime;
      // 1. Deep impact sub boom
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(130, now);
      sub.frequency.exponentialRampToValueAtTime(32, now + 0.35);

      subGain.gain.setValueAtTime(0.5, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      sub.connect(subGain);
      subGain.connect(this.sfxGain);
      sub.start(now);
      sub.stop(now + 0.45);

      // 2. Resonant noise crunch
      const bufferSize = this.ctx.sampleRate * 0.3;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(150, now + 0.3);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(now);
      noise.stop(now + 0.35);
    } catch {
      // Audio fallback
    }
  }

  playClick() {
    if (!this.canPlaySound()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Audio fallback
    }
  }

  // --- Procedural Synthwave Music Engine ---

  startMusic() {
    this.ensureContext();
    if (this.isPlayingMusic || !this.ctx) return;
    this.isPlayingMusic = true;
    this.currentStep = 0;
    this.scheduleNextBeat();
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setSpeed(speedMultiplier) {
    this.tempoSpeedMultiplier = Math.max(0.8, Math.min(1.4, speedMultiplier));
  }

  scheduleNextBeat() {
    if (!this.isPlayingMusic || !this.ctx) return;

    const stepDuration = (60 / this.bpm / 4) / this.tempoSpeedMultiplier; // 16th note in seconds
    this.playStep(this.currentStep);

    this.currentStep = (this.currentStep + 1) % 32;

    this.musicTimer = setTimeout(() => {
      this.scheduleNextBeat();
    }, stepDuration * 1000);
  }

  playStep(step) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Bassline pattern in F# minor / A major synthwave (F#1=46.25Hz, A1=55Hz, B1=61.74Hz, C#2=69.30Hz, E2=82.41Hz)
    const bassScale = [46.25, 46.25, 55.0, 61.74, 46.25, 46.25, 69.30, 55.0];
    const bassNote = bassScale[Math.floor(step / 4) % bassScale.length];

    // Bass synth hits on 8th notes (0, 2, 4, 6...)
    if (step % 2 === 0) {
      this.playSynthBass(bassNote, now);
    }

    // Drum beat:
    // Kick on steps 0, 8, 16, 24 (four on the floor)
    if (step % 8 === 0) {
      this.playKick(now);
    }
    // Snare / Clack on steps 4, 12, 20, 28 (backbeat)
    if (step % 8 === 4) {
      this.playSnare(now);
    }
    // Cyber Hi-hat on every odd 16th note (off-beat syncopation)
    if (step % 2 === 1) {
      this.playHiHat(now, step % 4 === 1 ? 0.08 : 0.04);
    }

    // Arpeggiated melody line (cyberpunk synth sequence)
    const arpNotes = [
      185.0, 220.0, 277.18, 369.99, // F#3, A3, C#4, F#4
      220.0, 277.18, 369.99, 440.0, // A3, C#4, F#4, A4
      246.94, 293.66, 369.99, 493.88, // B3, D4, F#4, B4
      277.18, 329.63, 440.0, 554.37  // C#4, E4, A4, C#5
    ];
    const arpNote = arpNotes[step % arpNotes.length];
    if (step % 2 === 0) {
      this.playArpSynth(arpNote, now);
    }
  }

  playSynthBass(freq, time) {
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, time);
      filter.frequency.exponentialRampToValueAtTime(140, time + 0.12);

      gain.gain.setValueAtTime(0.24, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + 0.18);
    } catch {
      // Audio fallback
    }
  }

  playArpSynth(freq, time) {
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, time);
      filter.frequency.exponentialRampToValueAtTime(450, time + 0.1);

      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + 0.14);
    } catch {
      // Audio fallback
    }
  }

  playKick(time) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(35, time + 0.1);

      gain.gain.setValueAtTime(0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + 0.16);
    } catch {
      // Audio fallback
    }
  }

  playSnare(time) {
    try {
      // Tone body
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, time);
      osc.frequency.exponentialRampToValueAtTime(70, time + 0.08);

      oscGain.gain.setValueAtTime(0.15, time);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

      osc.connect(oscGain);
      oscGain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.1);

      // Noise body
      const bufferSize = this.ctx.sampleRate * 0.1;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + 0.12);
    } catch {
      // Audio fallback
    }
  }

  playHiHat(time, vol = 0.06) {
    try {
      const bufferSize = this.ctx.sampleRate * 0.04;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + 0.045);
    } catch {
      // Audio fallback
    }
  }

  canPlaySound() {
    this.ensureContext();
    return this.isInitialized && !this.muted && this.ctx && this.ctx.state === 'running';
  }
}
