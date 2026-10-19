import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseEq, parsePreset, zoneGains, crossCheck, ZONES } from '../src/eqdiag.js';
import { flatBands, responseDb } from '../src/eq.js';
import { analyze } from '../src/analysis.js';
import { EXERCISES, SOURCES } from '../src/knowledge.js';
import { vowel } from './synth.js';

const bell = (freq, gain, q = 1) => ({ type: 'peaking', freq, gain, q });
const ids = (r) => r.findings.map((f) => f.id);

test('flat EQ: no findings, an "ok" note', () => {
  const r = diagnoseEq(flatBands());
  assert.deepEqual(r.findings, []);
  assert.equal(r.notes[0].severity, 'ok');
  for (const z of r.zones) assert.ok(Math.abs(z.db) < 1e-9);
});

test('+5 dB at 3 kHz reads as missing ring, with twang', () => {
  const r = diagnoseEq([bell(3000, 5, 1.4)]);
  assert.deepEqual(ids(r), ['ring-boost']);
  const f = r.findings[0];
  assert.equal(f.cause, 'voice');
  assert.equal(f.severity, 'info'); // zone average of a +5 dB bell is below 5 dB
  assert.ok(f.exercises.includes('twang'));
});

test('a strong 300 Hz cut reads as muddy voice at warn level', () => {
  const r = diagnoseEq([bell(380, -9, 0.8)]);
  const f = r.findings.find((x) => x.id === 'mud-cut');
  assert.ok(f, ids(r).join());
  assert.equal(f.severity, 'warn');
});

test('an 80 Hz high-pass is ordinary mix cleanup, never a voice problem', () => {
  const r = diagnoseEq([{ type: 'highpass', freq: 80, gain: 0, q: 0.71 }]);
  assert.ok(r.findings.every((f) => f.cause !== 'voice'), ids(r).join());
  assert.equal(r.voiceCount, 0);
  assert.ok(!r.notes.some((n) => n.severity === 'warn'), 'a routine HPF must not trigger the setup warning');
});

test('turning every band up equally is not a tonal change', () => {
  const louder = [
    { type: 'lowshelf', freq: 20000, gain: 6, q: 0.7 }, // shelf above everything = broadband +6 dB
  ];
  assert.ok(Math.abs(responseDb(louder, 1000, 48000) - 6) < 0.1);
  assert.deepEqual(ids(diagnoseEq(louder)), []);
});

test('a huge move triggers the "check your recording setup" note', () => {
  const r = diagnoseEq([bell(3000, 15, 0.7)]);
  assert.ok(r.notes.some((n) => n.severity === 'warn'));
});

test('shelf spill-over is attributed to the zone it was aimed at', () => {
  const air = diagnoseEq([{ type: 'highshelf', freq: 10000, gain: 3, q: 0.71 }]);
  assert.deepEqual(ids(air), ['air-boost']);
  const sib = diagnoseEq([bell(7000, 6, 1.2)]);
  assert.deepEqual(ids(sib), ['sibilance-boost']);
  const wide = diagnoseEq([bell(3000, 8, 0.7)]);
  assert.deepEqual(ids(wide), ['ring-boost'], 'neighbours of a wide bell are not separate findings');
});

test('findings are sorted by size', () => {
  const r = diagnoseEq([bell(3000, 3, 1), bell(400, -8, 1)]);
  assert.deepEqual(ids(r).slice(0, 2), ['mud-cut', 'ring-boost']);
});

test('cross-check: ear and measurement agree or disagree', () => {
  const m = analyze(vowel({ f0: 220 }), 44100);
  assert.equal(crossCheck('ring', { ...m, sprDb: -35 }, null).agree, true);
  assert.equal(crossCheck('ring', { ...m, sprDb: -10 }, null).agree, false);
  assert.equal(crossCheck('breath', { ...m, hnrDb: 25 }, null).agree, false);
  assert.equal(crossCheck('nasal', m, null).agree, null);
  assert.equal(crossCheck('nasal', m, 4).agree, true);
  assert.equal(crossCheck('ring', null, null).agree, null);
  const r = diagnoseEq([bell(3000, 6, 1)], { metrics: { ...m, sprDb: -35 } });
  assert.equal(r.findings[0].check.agree, true);
});

test('every zone rule points at real exercises and sources', () => {
  for (const z of ZONES) {
    for (const dir of ['cut', 'boost']) {
      for (const e of z[dir].exercises ?? []) assert.ok(EXERCISES[e], `${z.id}.${dir}: ${e}`);
      if (z[dir].source) assert.ok(SOURCES[z[dir].source]);
    }
  }
});

test('zones above Nyquist are dropped at low sample rates', () => {
  const zs = zoneGains(flatBands(), 16000);
  assert.ok(!zs.some((z) => z.id === 'air'));
});

test('preset parser: common DAW notations', () => {
  const { bands, errors } = parsePreset(`
    # my vocal chain
    HPF 80Hz
    300Hz -3dB Q1
    3k +4 1.4
    HS 10kHz +2
    bell, 1.2k, -2.5, q=2
  `);
  assert.deepEqual(errors, []);
  assert.deepEqual(bands, [
    { type: 'highpass', freq: 80, gain: 0, q: 0.71 },
    { type: 'peaking', freq: 300, gain: -3, q: 1 },
    { type: 'peaking', freq: 3000, gain: 4, q: 1.4 },
    { type: 'highshelf', freq: 10000, gain: 2, q: 0.71 },
    { type: 'peaking', freq: 1200, gain: -2.5, q: 2 },
  ]);
});

test('preset parser: reports bad lines with line numbers, keeps good ones', () => {
  const { bands, errors } = parsePreset('3k +4\nfoo 200\n30000 +2\n500 +40\n-3dB');
  assert.equal(bands.length, 1);
  assert.deepEqual(errors.map((e) => e.line), [2, 3, 4, 5]);
});

test('EQ diagnosis is deterministic', () => {
  const b = [bell(3000, 4), bell(350, -5), { type: 'highpass', freq: 100, gain: 0, q: 0.7 }];
  assert.deepEqual(diagnoseEq(b), diagnoseEq(b));
});
