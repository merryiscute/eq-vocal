// Deterministic diagnosis: metrics -> findings. Every threshold lives in THRESHOLDS so it
// can be tuned in one place. `provisional: true` marks cut-offs that are NOT clinical norms
// (mic, room and distance shift them) — the UI says so and pushes self-comparison instead.

export const THRESHOLDS = {
  minDurationSec: 2,
  minRmsDb: -45,
  maxClipRatio: 0.001,
  minVoicedRatio: 0.5,
  // Pitch wobble: SD in cents over voiced frames of a straight (no vibrato) tone.
  pitchSdCents: { info: 20, warn: 40, provisional: true },
  // Praat manual: healthy sustained [a] is around 20 dB.
  hnrDb: { info: 20, warn: 13, provisional: true },
  sprDb: { info: -20, warn: -28, provisional: true },
  alphaDb: { dark: -25, bright: -5, provisional: true },
  // Nose-pinch test: 1/3-octave shape change between normal and pinched takes.
  nasalDistDb: { info: 1.5, warn: 3, provisional: true },
};

// EQ moves used to *preview* a target sound. Band index matches DEFAULT_BANDS in eq.js.
const EQ = {
  ring: { band: 3, freq: 3000, gain: 5, q: 1.4 },
  dark: { band: 1, freq: 300, gain: -4, q: 1.0 },
  bright: { band: 3, freq: 3500, gain: -3, q: 1.2 },
  nasal: { band: 2, freq: 1000, gain: -4, q: 1.4 },
};

const fmt = (x, d = 1) => (x == null ? '—' : x.toFixed(d));

function level(value, { info, warn }, higherIsBetter) {
  if (value == null) return null;
  if (higherIsBetter) return value < warn ? 'warn' : value < info ? 'info' : 'ok';
  return value > warn ? 'warn' : value > info ? 'info' : 'ok';
}

/** Returns { usable, findings[] }. When !usable, only input-quality findings are returned. */
export function diagnose(m, { pinch = null, t = THRESHOLDS } = {}) {
  const gate = [];
  if (m.input.durationSec < t.minDurationSec) {
    gate.push({
      id: 'tooShort', severity: 'block', title: '녹음이 너무 짧음',
      evidence: `${fmt(m.input.durationSec)}초 < ${t.minDurationSec}초`,
      meaning: '측정할 프레임이 부족합니다. "아—"를 5초 정도 유지해 다시 녹음하세요.',
    });
  }
  if (m.input.clipRatio > t.maxClipRatio) {
    gate.push({
      id: 'clipping', severity: 'block', title: '입력이 찌그러짐 (클리핑)',
      evidence: `클리핑 샘플 ${fmt(m.input.clipRatio * 100, 2)}%`,
      meaning: '마이크에서 조금 떨어지거나 입력 볼륨을 낮추세요. 찌그러진 소리는 고역 수치를 부풀립니다.',
    });
  }
  if (m.input.rmsDb < t.minRmsDb) {
    gate.push({
      id: 'tooQuiet', severity: 'block', title: '소리가 너무 작음',
      evidence: `평균 ${fmt(m.input.rmsDb)} dBFS < ${t.minRmsDb} dBFS`,
      meaning: '주변 소음이 수치를 오염시킵니다. 마이크에 15–30 cm 거리로 다가가세요.',
    });
  }
  if (m.voicedRatio < t.minVoicedRatio) {
    gate.push({
      id: 'unvoiced', severity: 'block', title: '지속 모음이 감지되지 않음',
      evidence: `유성 프레임 ${fmt(m.voicedRatio * 100, 0)}%`,
      meaning: '자음·노래 가사·소음이 섞이면 측정이 불안정합니다. 한 음으로 "아—"만 내 주세요.',
    });
  }
  if (gate.length) return { usable: false, findings: gate };

  const out = [];

  const pitchLv = level(m.pitch.centsSd, t.pitchSdCents, false);
  out.push({
    id: 'pitch', severity: pitchLv, title: '음정 안정성',
    evidence: `F0 ${fmt(m.pitch.f0Hz, 0)} Hz, 흔들림 SD ${fmt(m.pitch.centsSd)} cent`,
    meaning: pitchLv === 'ok'
      ? '음이 곧게 유지됩니다.'
      : '음이 흔들립니다. 비브라토를 넣었다면 빼고 곧게 다시 재 보세요 — 비브라토도 이 수치를 올립니다.',
    exercises: pitchLv === 'ok' ? [] : ['longTone', 'straw'],
    basis: 'research', source: 'boersma1993', provisional: t.pitchSdCents.provisional,
  });

  const hnrLv = level(m.hnrDb, t.hnrDb, true);
  out.push({
    id: 'hnr', severity: hnrLv, title: '숨소리 / 성대 접촉',
    evidence: `HNR ${fmt(m.hnrDb)} dB (참고: 건강한 "아" ≈ 20 dB)`,
    meaning: hnrLv === 'ok'
      ? '배음 대비 잡음이 적어 소리가 선명합니다.'
      : '배음 대비 잡음(숨 새는 소리·거친 소리)이 많습니다. EQ로는 흉내 낼 수 없는 영역 — 발성 연습이 필요합니다.',
    exercises: hnrLv === 'ok' ? [] : ['balancedOnset', 'straw'],
    basis: 'research', source: 'praatHarmonicity', provisional: t.hnrDb.provisional,
  });

  const sprLv = level(m.sprDb, t.sprDb, true);
  out.push({
    id: 'ring', severity: sprLv, title: '울림 (2–4 kHz, 가수 포먼트)',
    evidence: `SPR ${fmt(m.sprDb)} dB (0에 가까울수록 울림이 강함)`,
    meaning: sprLv === 'ok'
      ? '2–4 kHz 대역에 에너지가 모여 소리가 멀리 갑니다.'
      : '2–4 kHz 울림이 약해 소리가 묻히기 쉽습니다. "제안 EQ 듣기"로 목표 음색을 먼저 귀에 익히세요.',
    exercises: sprLv === 'ok' ? [] : ['twang', 'hummingOpen'],
    eq: sprLv === 'ok' ? null : EQ.ring,
    basis: 'research', source: 'omori1996', provisional: t.sprDb.provisional,
  });

  let tone = 'ok';
  let toneMeaning = '저역과 고역의 균형이 중간 범위입니다.';
  let toneEx = [];
  let toneEq = null;
  if (m.alphaDb < t.alphaDb.dark) {
    tone = 'info';
    toneMeaning = '저역이 우세한 어둡고 먹먹한 쪽입니다. 혀뿌리 긴장이나 과하게 내린 후두일 가능성이 있습니다 (추정).';
    toneEx = ['tongueForward', 'hummingOpen'];
    toneEq = EQ.dark;
  } else if (m.alphaDb > t.alphaDb.bright) {
    tone = 'info';
    toneMeaning = '고역이 우세한 밝고 날카로운 쪽입니다. 밀어붙이는 발성일 가능성이 있습니다 (추정).';
    toneEx = ['softer', 'straw'];
    toneEq = EQ.bright;
  }
  out.push({
    id: 'tone', severity: tone, title: '음색 밝기',
    evidence: `Alpha ratio ${fmt(m.alphaDb)} dB`,
    meaning: toneMeaning, exercises: toneEx, eq: toneEq,
    basis: 'research', source: 'frokjaer1975', provisional: t.alphaDb.provisional,
  });

  if (pinch != null) {
    const lv = level(pinch, t.nasalDistDb, false);
    out.push({
      id: 'nasal', severity: lv, title: '콧소리 (코 막기 비교)',
      evidence: `코 막기 전후 스펙트럼 차이 ${fmt(pinch)} dB`,
      meaning: lv === 'ok'
        ? '코를 막아도 음색이 거의 같습니다 — 콧길로 새는 소리가 적습니다.'
        : '코를 막으면 음색이 달라집니다 — "아"에서 콧길이 열려 있을 가능성이 큽니다.',
      exercises: lv === 'ok' ? [] : ['nosePinch'],
      eq: lv === 'ok' ? null : EQ.nasal,
      basis: 'heuristic', provisional: t.nasalDistDb.provisional,
    });
  }

  return { usable: true, findings: out };
}

/** EQ moves suggested by the findings (one per band; first one wins). */
export function suggestedEq(findings) {
  const seen = new Set();
  const moves = [];
  for (const f of findings) {
    if (f.eq && !seen.has(f.eq.band)) {
      seen.add(f.eq.band);
      moves.push(f.eq);
    }
  }
  return moves;
}
