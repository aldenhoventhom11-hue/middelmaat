/* Geluidseffecten via de WebAudio API — geen audiobestanden, geen autoplay-gedoe.
   De AudioContext wordt pas bij de eerste user-gesture gestart (mobiel-vriendelijk). */
(function () {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Speel een toon met envelope.
  function tone(freq, dur, type, when, gain) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + (when || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Ruis (voor knal/beer).
  function noise(dur, gain) {
    const c = ensure();
    if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = gain || 0.3;
    src.connect(g);
    g.connect(c.destination);
    src.start();
  }

  const effects = {
    button: () => tone(420, 0.08, 'square', 0, 0.12),
    join: () => {
      tone(523, 0.1, 'triangle');
      tone(784, 0.12, 'triangle', 0.08);
    },
    start: () => {
      tone(392, 0.12, 'sawtooth');
      tone(523, 0.12, 'sawtooth', 0.1);
      tone(659, 0.16, 'sawtooth', 0.2);
    },
    tick: () => tone(880, 0.05, 'square', 0, 0.08),
    pop: () => {
      tone(1200, 0.05, 'square');
      noise(0.18, 0.35);
    },
    bear: () => {
      tone(110, 0.3, 'sawtooth', 0, 0.25);
      noise(0.3, 0.2);
    },
    reveal: () => {
      tone(659, 0.1, 'triangle');
      tone(880, 0.12, 'triangle', 0.09);
    },
    tap: () => tone(660, 0.03, 'square', 0, 0.07),
    win: () => {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.2, 'triangle', i * 0.12, 0.2)
      );
    },
    error: () => tone(160, 0.2, 'sawtooth', 0, 0.15),
  };

  window.Sound = {
    play(name) {
      if (muted) return;
      const fx = effects[name];
      if (fx) {
        try {
          fx();
        } catch (e) {
          /* stil falen */
        }
      }
    },
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
})();
