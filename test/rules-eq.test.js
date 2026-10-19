import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/analysis.js';
import { diagnose, suggestedEq, THRESHOLDS } from '../src/rules.js';
import { applyMoves, flatBands, responseDb } from '../src/eq.js';
import { EXERCISES, SOURCES } from '../src/knowledge.js';
import { vowel } from './synth.js';

const SR = 44100;
const byId = (r, id) => r.findings.find((f) => f.id === id);

test('unusable input returns only blocking findings', () => {
  const r = diagnose(analyze(vowel({ f0: 220, seconds: 1 }), SR));
  assert.equal(r.usable, false);
  assert.deepEqual(r.findings.map((f) => f.id), ['tooShort']);
});

test('clean steady tone: pitch and HNR ok', () => {
  const r = diagnose(analyze(vowel({ f0: 220 }), SR));
  assert.equal(r.usable, true);
  assert.equal(byId(r, 'pitch').severity, 'ok');
  assert.equal(byId(r, 'hnr').severity, 'ok');
  assert.equal(byId(r, 'nasal'), undefined, 'no pinch take -> no nasal finding');
});

test('wobbly, breathy tone gets warnings with exercises', () => {
  const r = diagnose(analyze(vowel({ f0: 220, vibCents: 90, noise: 0.3 }), SR));
  assert.equal(byId(r, 'pitch').severity, 'warn');
  assert.notEqual(byId(r, 'hnr').severity, 'ok');
  assert.ok(byId(r, 'pitch').exercises.includes('longTone'));
});

test('nose-pinch distance maps onto severity', () => {
  const m = analyze(vowel({ f0: 220 }), SR);
  assert.equal(byId(diagnose(m, { pinch: 0.5 }), 'nasal').severity, 'ok');
  assert.equal(byId(diagnose(m, { pinch: 2 }), 'nasal').severity, 'info');
  assert.equal(byId(diagnose(m, { pinch: 5 }), 'nasal').severity, 'warn');
});

test('every referenced exercise and source exists', () => {
  const m = analyze(vowel({ f0: 220, vibCents: 90, noise: 0.3 }), SR);
  const r = diagnose({ ...m, sprDb: -40, alphaDb: -40 }, { pinch: 5 });
  for (const f of r.findings) {
    for (const e of f.exercises ?? []) assert.ok(EXERCISES[e], `missing exercise ${e}`);
    if (f.source) assert.ok(SOURCES[f.source], `missing source ${f.source}`);
  }
  for (const e of Object.values(EXERCISES)) if (e.source) assert.ok(SOURCES[e.source]);
});

test('suggested EQ: one move per band, from weak ring + dark tone', () => {
  const m = analyze(vowel({ f0: 220 }), SR);
  const r = diagnose({ ...m, sprDb: THRESHOLDS.sprDb.warn - 5, alphaDb: THRESHOLDS.alphaDb.dark - 5 });
  const moves = suggestedEq(r.findings);
  assert.deepEqual(moves.map((x) => x.band).sort(), [1, 3]);
});

test('EQ math: flat is 0 dB, a peaking band hits its gain at center', () => {
  assert.equal(responseDb(flatBands(), 1000, 48000), 0);
  const bands = applyMoves([{ band: 3, freq: 3000, gain: 5, q: 1.4 }]);
  assert.ok(Math.abs(responseDb(bands, 3000, 48000) - 5) < 1e-6);
  assert.ok(Math.abs(responseDb(bands, 100, 48000)) < 0.05);
});

test('EQ math: shelves reach their gain far into the shelf, half at the corner', () => {
  const low = flatBands();
  low[0].gain = 6;
  assert.ok(Math.abs(responseDb(low, 20, 48000) - 6) < 0.2);
  assert.ok(Math.abs(responseDb(low, 100, 48000) - 3) < 0.1);
  const high = flatBands();
  high[4].gain = -6;
  assert.ok(Math.abs(responseDb(high, 20000, 48000) + 6) < 0.3);
});
