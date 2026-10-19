// Deterministic synthetic "voices" for tests: harmonic series + seeded noise.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

/**
 * @param {object} o
 * @param {number} o.f0            Hz
 * @param {number} [o.seconds]
 * @param {number} [o.sr]
 * @param {number} [o.noise]       white-noise amplitude
 * @param {number} [o.vibCents]    vibrato depth (± cents)
 * @param {(f:number)=>number} [o.shape]  extra linear gain per harmonic frequency
 */
export function vowel({ f0, seconds = 3, sr = 44100, noise = 0, vibCents = 0, shape = () => 1, amp = 0.3 }) {
  const n = Math.round(seconds * sr);
  const out = new Float32Array(n);
  const rand = rng(7);
  const harmonics = Math.floor(8000 / f0);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = f0 * 2 ** ((vibCents * Math.sin(2 * Math.PI * 5.5 * t)) / 1200);
    phase += (2 * Math.PI * f) / sr;
    let s = 0;
    for (let h = 1; h <= harmonics; h++) s += (shape(h * f0) / h) * Math.sin(h * phase);
    out[i] = amp * s * 0.5 + noise * rand();
  }
  return out;
}
