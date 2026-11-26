// Merpati Nusantara — synthesised sound only (WebAudio, no audio files).
// Engine drone follows the throttle, wind noise follows speed, and the
// ring chime and landing thud are short synth blips. Audio is created
// on the first user gesture (the Start button) and stays silent until then.

const AudioSys = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineOsc2: null,
  engineGain: null,
  engineFilter: null,
  windGain: null,
  muted: false,
  started: false,

  // Create the audio graph. Call from a user gesture only.
  init() {
    if (AudioSys.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    AudioSys.ctx = ctx;
    AudioSys.master = ctx.createGain();
    AudioSys.master.gain.value = AudioSys.muted ? 0 : 0.9;
    AudioSys.master.connect(ctx.destination);

    // Engine: two detuned sawtooths through a low-pass filter.
    AudioSys.engineFilter = ctx.createBiquadFilter();
    AudioSys.engineFilter.type = 'lowpass';
    AudioSys.engineFilter.frequency.value = 420;
    AudioSys.engineGain = ctx.createGain();
    AudioSys.engineGain.gain.value = 0;
    AudioSys.engineOsc = ctx.createOscillator();
    AudioSys.engineOsc.type = 'sawtooth';
    AudioSys.engineOsc.frequency.value = 62;
    AudioSys.engineOsc2 = ctx.createOscillator();
    AudioSys.engineOsc2.type = 'sawtooth';
    AudioSys.engineOsc2.frequency.value = 93;
    AudioSys.engineOsc.connect(AudioSys.engineFilter);
    AudioSys.engineOsc2.connect(AudioSys.engineFilter);
    AudioSys.engineFilter.connect(AudioSys.engineGain);
    AudioSys.engineGain.connect(AudioSys.master);
    AudioSys.engineOsc.start();
    AudioSys.engineOsc2.start();

    // Wind: a looped noise buffer through a band-pass filter.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    AudioSys.windGain = ctx.createGain();
    AudioSys.windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(AudioSys.windGain);
    AudioSys.windGain.connect(AudioSys.master);
    noise.start();

    AudioSys.started = true;
  },

  // Call every frame: engine pitch follows throttle, wind follows speed.
  update(throttle, speed, flying) {
    if (!AudioSys.started) return;
    const t = AudioSys.ctx.currentTime;
    const target = flying ? 0.05 + throttle * 0.16 : 0;
    AudioSys.engineGain.gain.setTargetAtTime(target, t, 0.12);
    const freq = 58 + throttle * 95;
    AudioSys.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    AudioSys.engineOsc2.frequency.setTargetAtTime(freq * 1.5, t, 0.1);
    AudioSys.engineFilter.frequency.setTargetAtTime(320 + throttle * 700, t, 0.15);
    const wind = flying ? Math.min(0.22, (speed / CFG.maxSpeed) * 0.22) : 0;
    AudioSys.windGain.gain.setTargetAtTime(wind, t, 0.2);
  },

  // Two-note chime when a ring is collected.
  chime() {
    if (!AudioSys.started) return;
    const ctx = AudioSys.ctx;
    const notes = [659.25, 880.0];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.28, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(AudioSys.master);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  },

  // Low thud for a landing or a crash.
  thud(hard) {
    if (!AudioSys.started) return;
    const ctx = AudioSys.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hard ? 150 : 110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.28);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(hard ? 0.5 : 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.connect(gain);
    gain.connect(AudioSys.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  },

  toggleMute() {
    AudioSys.muted = !AudioSys.muted;
    if (AudioSys.master) {
      AudioSys.master.gain.value = AudioSys.muted ? 0 : 0.9;
    }
    return AudioSys.muted;
  },
};
