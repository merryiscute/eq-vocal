// Pure, deterministic voice analysis. Same samples in -> same numbers out.
// No Web Audio dependency, so it runs (and is tested) in Node.
import { fft, hann } from './fft.js';

export const F0_MIN = 70;
export const F0_MAX = 1000;
// A frame counts as voiced when its normalized autocorrelation peak reaches this.
export const VOICING_R = 0.45;

const EPS = 1e-12;
const db = (p) => 10 * Math.log10(p + EPS);
const ampDb = (a) => 20 * Math.log10(a + EPS);

function frameSizeFor(sampleRate) {
  // ~80 ms window: at least 3 periods of F0_MIN, as Boersma (1993) recommends for Hann.
  let n = 1;
  while (n < sampleRate * 0.08) n <<= 1;
  return n;
}

// Autocorrelation of a real signal via |FFT|^2 -> FFT (power spectrum is real and even).
function autocorr(frame, size) {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re.set(frame);
  fft(re, im);
  for (let i = 0; i < size; i++) {
    re[i] = re[i] * re[i] + im[i] * im[i];
    im[i] = 0;
  }
  fft(re, im);
  for (let i = 0; i < size; i++) re[i] /= size;
  return re;
}

// Pitch + periodicity of one frame (Boersma 1993: windowed autocorrelation divided by
// the window's own autocorrelation).
function framePitch(frame, win, winAc, sampleRate) {
  const n = frame.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += frame[i];
  mean /= n;
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = (frame[i] - mean) * win[i];
  const ac = autocorr(w, n * 2);
  if (ac[0] <= EPS) return { f0: 0, r: 0 };

  const lagMin = Math.floor(sampleRate / F0_MAX);
  const lagMax = Math.min(Math.ceil(sampleRate / F0_MIN), n >> 1);
  const r = new Float64Array(lagMax + 2);
  for (let k = 0; k <= lagMax + 1; k++) r[k] = ac[k] / ac[0] / (winAc[k] / winAc[0]);

  const peaks = [];
  let best = 0;
  for (let k = Math.max(lagMin, 1); k <= lagMax; k++) {
    if (r[k] > r[k - 1] && r[k] >= r[k + 1] && r[k] > 0) {
      peaks.push(k);
      if (r[k] > best) best = r[k];
    }
  }
  if (!peaks.length) return { f0: 0, r: 0 };
  // Earliest peak close to the best one: guards against picking 2T (octave-down errors).
  const k = peaks.find((p) => r[p] >= 0.9 * best);
  const a = r[k - 1];
  const b = r[k];
  const c = r[k + 1];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  // Interpolated peak height: an integer lag undershoots when the period isn't a whole number of samples.
  const peakR = b - 0.25 * (a - c) * shift;
  return { f0: sampleRate / (k + shift), r: Math.min(peakR, 0.9999) };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function std(xs) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

export function bandPower(ltasPow, binHz, lo, hi) {
  const a = Math.max(1, Math.ceil(lo / binHz));
  const b = Math.min(ltasPow.length - 1, Math.floor(hi / binHz));
  let p = 0;
  for (let k = a; k <= b; k++) p += ltasPow[k];
  return p;
}

export function bandPeakDb(ltasDb, binHz, lo, hi) {
  const a = Math.max(1, Math.ceil(lo / binHz));
  const b = Math.min(ltasDb.length - 1, Math.floor(hi / binHz));
  let m = -Infinity;
  for (let k = a; k <= b; k++) m = Math.max(m, ltasDb[k]);
  return m;
}

/**
 * Analyze a mono recording (ideally a sustained vowel).
 * @param {Float32Array|number[]} samples  -1..1
 * @param {number} sampleRate
 */
export function analyze(samples, sampleRate) {
  const len = samples.length;
  const n = frameSizeFor(sampleRate);
  const hop = n >> 1;
  const win = hann(n);
  const winAc = autocorr(win, n * 2);
  const binHz = sampleRate / n;

  let peak = 0;
  let clipped = 0;
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    sumSq += samples[i] * samples[i];
  }

  const input = {
    durationSec: len / sampleRate,
    peakDb: ampDb(peak),
    rmsDb: ampDb(Math.sqrt(sumSq / Math.max(len, 1))),
    clipRatio: clipped / Math.max(len, 1),
  };

  // Frame energies, to drop silence before and after the note.
  const starts = [];
  const rms = [];
  for (let s = 0; s + n <= len; s += hop) {
    let e = 0;
    for (let i = 0; i < n; i++) e += samples[s + i] * samples[s + i];
    starts.push(s);
    rms.push(Math.sqrt(e / n));
  }
  const maxRms = rms.length ? Math.max(...rms) : 0;
  const gate = Math.max(10 ** (-55 / 20), maxRms * 10 ** (-25 / 20));

  const half = n / 2 + 1;
  const ltasPow = new Float64Array(half);
  const f0s = [];
  const hnrs = [];
  let active = 0;
  const frame = new Float64Array(n);

  for (let f = 0; f < starts.length; f++) {
    if (rms[f] < gate) continue;
    active++;
    for (let i = 0; i < n; i++) frame[i] = samples[starts[f] + i];

    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = frame[i] * win[i];
    fft(re, im);
    for (let k = 0; k < half; k++) ltasPow[k] += re[k] * re[k] + im[k] * im[k];

    const { f0, r } = framePitch(frame, win, winAc, sampleRate);
    if (r >= VOICING_R && f0 > 0) {
      f0s.push(f0);
      hnrs.push(10 * Math.log10(r / (1 - r)));
    }
  }

  if (active) for (let k = 0; k < half; k++) ltasPow[k] /= active;
  const ltasDb = Array.from(ltasPow, db);

  const f0Median = f0s.length ? median(f0s) : 0;
  // Drop octave jumps (> 6 semitones from median) before measuring wobble.
  const cents = f0s.map((f) => 1200 * Math.log2(f / f0Median)).filter((c) => Math.abs(c) < 600);

  const nyq = sampleRate / 2;
  const top = Math.min(nyq, 8000);
  const pLow = bandPower(ltasPow, binHz, 50, 1000);
  const pHigh = bandPower(ltasPow, binHz, 1000, Math.min(5000, nyq));

  return {
    input,
    frames: { total: starts.length, active, voiced: f0s.length },
    voicedRatio: active ? f0s.length / active : 0,
    pitch: {
      f0Hz: f0Median,
      centsSd: cents.length > 1 ? std(cents) : null,
      octaveJumps: f0s.length - cents.length,
    },
    // Harmonics-to-noise ratio, mean of per-frame dB (as Praat reports it).
    hnrDb: hnrs.length ? hnrs.reduce((a, b) => a + b, 0) / hnrs.length : null,
    // Singing Power Ratio (Omori et al. 1996): peak 2-4 kHz minus peak 0-2 kHz.
    sprDb: active && nyq > 4000 ? bandPeakDb(ltasDb, binHz, 2000, 4000) - bandPeakDb(ltasDb, binHz, 50, 2000) : null,
    // Alpha ratio (Frokjaer-Jensen & Prytz 1976): energy 1-5 kHz vs 50 Hz-1 kHz.
    alphaDb: active ? db(pHigh) - db(pLow) : null,
    bandsDb: {
      low: db(bandPower(ltasPow, binHz, 80, 200)),
      mud: db(bandPower(ltasPow, binHz, 200, 500)),
      mid: db(bandPower(ltasPow, binHz, 500, 2000)),
      ring: db(bandPower(ltasPow, binHz, 2000, 4000)),
      presence: db(bandPower(ltasPow, binHz, 4000, top)),
    },
    ltas: { binHz, db: ltasDb },
  };
}

// LTAS summed into 1/3-octave bands, so small pitch differences between takes
// (harmonics landing in different bins) don't dominate the comparison.
export function thirdOctaveDb(ltas, lo = 200, hi = 4000) {
  const pow = ltas.db.map((d) => 10 ** (d / 10));
  const out = [];
  for (let fc = lo; fc <= hi; fc *= 2 ** (1 / 3)) {
    out.push({ fc, db: db(bandPower(pow, ltas.binHz, fc / 2 ** (1 / 6), fc * 2 ** (1 / 6))) });
  }
  return out;
}

/**
 * Spectral shape distance between two takes (e.g. normal vs nose pinched), level-normalized:
 * RMS of the 1/3-octave dB difference in lo..hi after removing the mean offset.
 */
export function ltasDistanceDb(a, b, lo = 200, hi = 4000) {
  const ba = thirdOctaveDb(a, lo, hi);
  const bb = thirdOctaveDb(b, lo, hi);
  const diffs = ba.map((x, i) => x.db - bb[i].db);
  const m = diffs.reduce((x, y) => x + y, 0) / diffs.length;
  return Math.sqrt(diffs.reduce((x, y) => x + (y - m) ** 2, 0) / diffs.length);
}
