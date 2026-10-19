import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, ltasDistanceDb } from '../src/analysis.js';
import { vowel } from './synth.js';

const SR = 44100;

test('F0 of a steady 220 Hz tone is found within 0.5%', () => {
  const m = analyze(vowel({ f0: 220 }), SR);
  assert.ok(Math.abs(m.pitch.f0Hz - 220) / 220 < 0.005, `f0=${m.pitch.f0Hz}`);
  assert.ok(m.pitch.centsSd < 2, `sd=${m.pitch.centsSd}`);
});

test('F0 tracks low and high voices without octave errors', () => {
  for (const f0 of [98, 147, 330, 523, 784]) {
    const m = analyze(vowel({ f0 }), SR);
    assert.ok(Math.abs(m.pitch.f0Hz - f0) / f0 < 0.01, `want ${f0}, got ${m.pitch.f0Hz}`);
  }
});

test('vibrato raises pitch SD in proportion to its depth', () => {
  const sd30 = analyze(vowel({ f0: 220, vibCents: 30 }), SR).pitch.centsSd;
  const sd80 = analyze(vowel({ f0: 220, vibCents: 80 }), SR).pitch.centsSd;
  // A sine of depth D has SD D/sqrt(2); the 80 ms window smooths it somewhat.
  assert.ok(sd30 > 10 && sd30 < 30 / Math.SQRT2 + 3, `sd30=${sd30}`);
  assert.ok(sd80 > sd30 * 2, `sd80=${sd80}`);
});

test('HNR matches the true harmonic-to-noise power ratio', () => {
  // Ground truth: harmonic power = (0.3*0.5)^2 * sum(1/h^2) / 2, uniform noise power = a^2 / 12.
  const H = Math.floor(8000 / 200);
  let s = 0;
  for (let h = 1; h <= H; h++) s += 1 / h ** 2;
  const sigPow = 0.15 ** 2 * s / 2;
  for (const noise of [0.05, 0.25]) {
    const truth = 10 * Math.log10(sigPow / (noise ** 2 / 12));
    const got = analyze(vowel({ f0: 200, noise }), SR).hnrDb;
    assert.ok(Math.abs(got - truth) < 1, `noise ${noise}: truth ${truth.toFixed(2)}, got ${got.toFixed(2)}`);
  }
  assert.ok(analyze(vowel({ f0: 200 }), SR).hnrDb > 30);
});

test('boosting 2-4 kHz harmonics raises SPR and alpha ratio', () => {
  const flat = analyze(vowel({ f0: 220 }), SR);
  const ring = analyze(vowel({ f0: 220, shape: (f) => (f >= 2000 && f <= 4000 ? 8 : 1) }), SR);
  assert.ok(ring.sprDb > flat.sprDb + 10, `${flat.sprDb} -> ${ring.sprDb}`);
  assert.ok(ring.alphaDb > flat.alphaDb, `${flat.alphaDb} -> ${ring.alphaDb}`);
});

test('input checks: duration, clipping, level', () => {
  const short = analyze(vowel({ f0: 220, seconds: 1 }), SR);
  assert.ok(Math.abs(short.input.durationSec - 1) < 1e-9);
  const hot = analyze(vowel({ f0: 220, amp: 3 }).map((x) => Math.max(-1, Math.min(1, x))), SR);
  assert.ok(hot.input.clipRatio > 0.01);
  const quiet = analyze(vowel({ f0: 220, amp: 0.001 }), SR);
  assert.ok(quiet.input.rmsDb < -50);
});

test('leading/trailing silence is gated out of the voiced measurements', () => {
  const v = vowel({ f0: 220, seconds: 2 });
  const padded = new Float32Array(v.length + SR * 2);
  padded.set(v, SR);
  const m = analyze(padded, SR);
  assert.ok(m.frames.active < m.frames.total);
  assert.ok(m.voicedRatio > 0.9, `voiced=${m.voicedRatio}`);
});

test('analysis is deterministic', () => {
  const x = vowel({ f0: 180, noise: 0.03 });
  assert.deepEqual(analyze(x, SR), analyze(x, SR));
});

test('LTAS distance: ~0 for same shape, large when a band changes', () => {
  const a = analyze(vowel({ f0: 220 }), SR).ltas;
  const louder = analyze(vowel({ f0: 220, amp: 0.15 }), SR).ltas;
  const nasal = analyze(vowel({ f0: 220, shape: (f) => (f >= 700 && f <= 1400 ? 0.25 : 1) }), SR).ltas;
  assert.ok(ltasDistanceDb(a, louder) < 0.2, 'level change alone must not count');
  assert.ok(ltasDistanceDb(a, nasal) > 3);
});
