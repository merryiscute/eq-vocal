// EQ -> vocal diagnosis. The user shapes an EQ until their voice sounds right; the EQ is then
// read as the gap between the raw voice and their target: a boost = something missing,
// a cut = something in excess. Pure and deterministic, like analysis.js and rules.js.
import { responseDb } from './eq.js';
import { THRESHOLDS } from './rules.js';

// |zone dB| at or above these counts as a deliberate move.
export const EQ_LIMITS = { info: 2, warn: 5, extreme: 10 };

const fmt = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));

/**
 * Zone table. Per direction:
 *   cause      'voice' (발성) | 'mic' (마이크·환경) | 'articulation' (발음) | 'style' (취향)
 *   check      which recorded measurement can confirm it (see crossCheck)
 *   basis      'research' | 'heuristic' — how well the band<->voice link is supported
 */
export const ZONES = [
  {
    id: 'sub', name: '초저역', lo: 20, hi: 90,
    cut: { cause: 'mic', title: '초저역 정리', meaning: '마이크 진동·바닥 소음을 지우는 일반적인 믹스 처리입니다. 발성과는 무관합니다.', basis: 'heuristic' },
    boost: { cause: 'style', title: '초저역 강조', meaning: '목소리에는 이 대역 성분이 거의 없어 웅웅거리는 잡음만 커집니다. 발성과는 무관합니다.', basis: 'heuristic' },
  },
  {
    id: 'body', name: '몸통', lo: 90, hi: 250,
    cut: {
      cause: 'mic', title: '저역 붕붕거림',
      meaning: '가장 흔한 원인은 지향성 마이크에 너무 가까이 대서 생기는 근접 효과입니다. 약 20 cm 거리에서 다시 들어 보고, 그래도 필요하면 흉성을 과하게 누르는 발성일 수 있습니다.',
      basis: 'heuristic',
    },
    boost: {
      cause: 'voice', title: '소리가 얇음',
      meaning: '흉성 공명이 부족하거나 후두가 높이 올라간 발성일 가능성이 있습니다 (추정). 마이크와의 거리가 너무 멀어도 저역이 줄어듭니다.',
      exercises: ['yawnOpen'], basis: 'heuristic',
    },
  },
  {
    id: 'mud', name: '먹먹함', lo: 250, hi: 600,
    cut: {
      cause: 'voice', title: '먹먹하고 막힌 소리', check: 'dark',
      meaning: '혀뿌리가 뒤로 밀렸거나 후두를 과하게 내린 발성일 가능성이 있습니다 (추정). 작은 방의 울림도 이 대역을 키웁니다.',
      exercises: ['tongueForward', 'hummingOpen'], basis: 'heuristic',
    },
    boost: {
      cause: 'voice', title: '소리가 가볍고 납작함',
      meaning: '입안 공간을 좁게 쓰는 발성일 가능성이 있습니다 (추정).',
      exercises: ['yawnOpen'], basis: 'heuristic',
    },
  },
  {
    id: 'nasal', name: '콧소리·honk', lo: 700, hi: 1500,
    cut: {
      cause: 'voice', title: '콧소리 / 코맹맹이', check: 'nasal',
      meaning: '"아"에서 연구개가 덜 닫혀 코로 소리가 새고 있을 가능성이 있습니다. 다만 이 대역은 모음 자체의 포먼트와도 겹쳐서 EQ만으로는 확정할 수 없습니다 — 코 막기 녹음으로 확인하세요.',
      exercises: ['nosePinch'], basis: 'heuristic',
    },
    boost: {
      cause: 'voice', title: '소리가 뒤로 숨음',
      meaning: '중역이 부족하면 가사 전달력이 떨어집니다. 입을 덜 열거나 소리를 목 뒤쪽에 두는 발성일 가능성이 있습니다 (추정).',
      exercises: ['hummingOpen'], basis: 'heuristic',
    },
  },
  {
    id: 'ring', name: '울림(가수 포먼트)', lo: 2000, hi: 4000,
    cut: {
      cause: 'voice', title: '날카롭고 쏘는 소리', check: 'bright',
      meaning: '소리를 밀어붙이는(press) 발성일 가능성이 있습니다 (추정). 밝은 마이크나 이어폰이 원인일 수도 있습니다.',
      exercises: ['softer', 'straw'], basis: 'heuristic',
    },
    boost: {
      cause: 'voice', title: '울림 부족', check: 'ring',
      meaning: '2–4 kHz 에너지는 소리가 반주를 뚫고 멀리 가게 하는 가수 포먼트 대역입니다. 이 대역을 올렸다면 원래 소리에 그 울림이 부족하다는 뜻입니다.',
      exercises: ['twang', 'hummingOpen'], basis: 'research', source: 'sundberg1974',
    },
  },
  {
    id: 'sibilance', name: '치찰음', lo: 5000, hi: 9000,
    cut: {
      cause: 'articulation', title: '치찰음(ㅅ·ㅆ) 과다',
      meaning: '발음 습관이 원인인 경우가 많고, 마이크를 입 정면에 두어도 심해집니다. 마이크를 입에서 살짝 비껴 두는 것도 함께 시도해 보세요.',
      exercises: ['sibilant'], basis: 'heuristic',
    },
    boost: {
      cause: 'articulation', title: '발음이 뭉개짐',
      meaning: '자음이 약해 가사가 또렷하지 않을 가능성이 있습니다. 멀거나 어두운 마이크도 이 대역을 깎습니다.',
      exercises: ['consonant'], basis: 'heuristic',
    },
  },
  {
    id: 'air', name: '공기감', lo: 10000, hi: 16000,
    cut: {
      cause: 'voice', title: '숨소리·잡음 과다', check: 'breath',
      meaning: '숨이 섞인 발성일 수도 있고, 마이크·환경 잡음(히스)일 수도 있습니다. 녹음이 있으면 HNR로 구분합니다.',
      exercises: ['balancedOnset'], basis: 'heuristic',
    },
    boost: {
      cause: 'style', title: '공기감 추가',
      meaning: '숨이 섞인 반짝이는 음색은 스타일 선택입니다. 의도한 거라면 발성 문제가 아닙니다.',
      basis: 'heuristic',
    },
  },
];

export const CAUSE_LABEL = { voice: '발성', mic: '마이크·환경', articulation: '발음', style: '취향' };

function logPoints(lo, hi, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(lo * (hi / lo) ** (i / (n - 1)));
  return out;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Average EQ gain per zone, relative to the EQ's median gain over 100 Hz–8 kHz,
 * so turning everything up (= just louder) doesn't read as a tonal change.
 */
export function zoneGains(bands, sampleRate = 48000) {
  const nyq = sampleRate / 2;
  const ref = median(logPoints(100, Math.min(8000, nyq * 0.9), 48).map((f) => responseDb(bands, f, sampleRate)));
  return ZONES.filter((z) => z.lo < nyq * 0.9).map((z) => {
    const pts = logPoints(z.lo, Math.min(z.hi, nyq * 0.9), 16);
    const avg = pts.reduce((s, f) => s + responseDb(bands, f, sampleRate), 0) / pts.length;
    return { id: z.id, name: z.name, lo: z.lo, hi: z.hi, db: avg - ref };
  });
}

/**
 * Compare the ear (EQ move) with the measurement from a recording, when one exists.
 * Returns { agree: true | false | null, text }.
 */
export function crossCheck(check, metrics, pinch, t = THRESHOLDS) {
  if (!check) return { agree: null, text: '' };
  if (!metrics) return { agree: null, text: '녹음이 있으면 실제 측정값과 교차 확인합니다.' };
  switch (check) {
    case 'ring':
      return metrics.sprDb < t.sprDb.info
        ? { agree: true, text: `측정 SPR ${fmt(metrics.sprDb)} dB도 울림 부족을 가리킵니다.` }
        : { agree: false, text: `측정 SPR ${fmt(metrics.sprDb)} dB는 정상 범위입니다 — 듣는 기기(이어폰·스피커)의 특성이나 취향일 수 있습니다.` };
    case 'bright':
      return metrics.alphaDb > t.alphaDb.bright
        ? { agree: true, text: `측정 Alpha ratio ${fmt(metrics.alphaDb)} dB도 고역이 우세합니다.` }
        : { agree: false, text: `측정 Alpha ratio ${fmt(metrics.alphaDb)} dB는 밝은 편이 아닙니다 — 듣는 기기가 밝을 수 있습니다.` };
    case 'dark':
      return metrics.alphaDb < t.alphaDb.dark
        ? { agree: true, text: `측정 Alpha ratio ${fmt(metrics.alphaDb)} dB도 저역이 우세합니다.` }
        : { agree: false, text: `측정 Alpha ratio ${fmt(metrics.alphaDb)} dB는 어두운 편이 아닙니다 — 방 울림이나 듣는 기기 탓일 수 있습니다.` };
    case 'breath':
      return metrics.hnrDb < t.hnrDb.info
        ? { agree: true, text: `측정 HNR ${fmt(metrics.hnrDb)} dB도 숨 섞인 소리를 가리킵니다.` }
        : { agree: false, text: `측정 HNR ${fmt(metrics.hnrDb)} dB는 정상입니다 — 숨소리보다 마이크·환경 잡음일 가능성이 큽니다.` };
    case 'nasal':
      if (pinch == null) return { agree: null, text: '코 막고 녹음을 추가하면 확인할 수 있습니다.' };
      return pinch >= t.nasalDistDb.info
        ? { agree: true, text: `코 막기 전후 차이 ${fmt(pinch)} dB — 콧길이 열려 있습니다.` }
        : { agree: false, text: `코 막기 전후 차이 ${fmt(pinch)} dB — 콧소리는 아닙니다. 모음 포먼트나 방 울림일 수 있습니다.` };
    default:
      return { agree: null, text: '' };
  }
}

/**
 * @param {object[]} bands
 * @param {object} [o]
 * @param {number} [o.sampleRate]
 * @param {object|null} [o.metrics]  analyze() output of a usable recording, for cross-checks
 * @param {number|null} [o.pinch]    nose-pinch distance in dB
 */
export function diagnoseEq(bands, { sampleRate = 48000, metrics = null, pinch = null, limits = EQ_LIMITS } = {}) {
  const zones = zoneGains(bands, sampleRate);
  const findings = [];

  zones.forEach((z, i) => {
    const mag = Math.abs(z.db);
    if (mag < limits.info) return;
    // Spill-over: a shelf or wide bell also moves the next zone a bit. If a neighbour moved the
    // same way by more, this zone is riding along — attribute the move to the neighbour only.
    const spill = [zones[i - 1], zones[i + 1]].some((n) => n && Math.sign(n.db) === Math.sign(z.db) && Math.abs(n.db) > mag);
    if (spill) return;
    const dir = z.db > 0 ? 'boost' : 'cut';
    const rule = ZONES.find((x) => x.id === z.id)[dir];
    // Non-voice causes never escalate past "참고": they aren't a singing problem.
    const severity = rule.cause !== 'voice' ? 'info' : mag >= limits.warn ? 'warn' : 'info';
    findings.push({
      id: `${z.id}-${dir}`,
      zone: z.id,
      dir,
      db: z.db,
      severity,
      title: rule.title,
      evidence: `${z.name} ${z.lo >= 1000 ? z.lo / 1000 + 'k' : z.lo}–${z.hi >= 1000 ? z.hi / 1000 + 'k' : z.hi} Hz를 ${dir === 'boost' ? '+' : ''}${fmt(z.db)} dB ${dir === 'boost' ? '올림 → 원래 부족' : '깎음 → 원래 과함'}`,
      meaning: rule.meaning,
      cause: rule.cause,
      exercises: rule.exercises ?? [],
      basis: rule.basis,
      source: rule.source,
      check: crossCheck(rule.check, metrics, pinch),
    });
  });

  // Strongest moves first: they say the most about the voice.
  findings.sort((a, b) => Math.abs(b.db) - Math.abs(a.db));

  const notes = [];
  // Sub-bass is excluded: a steep high-pass there is routine and says nothing about the setup.
  const maxMag = Math.max(0, ...zones.filter((z) => z.id !== 'sub').map((z) => Math.abs(z.db)));
  if (maxMag >= limits.extreme) {
    notes.push({
      severity: 'warn',
      text: `한 대역을 ${fmt(maxMag)} dB나 바꿨습니다. 이 정도 차이는 발성보다 녹음 환경(마이크 종류·위치·방 울림)이 원인일 가능성이 큽니다. 환경부터 확인하세요.`,
    });
  }
  if (!findings.length) {
    notes.push({ severity: 'ok', text: `EQ를 거의 쓰지 않았습니다 (모든 대역 ±${limits.info} dB 미만). 지금 원음이 원하는 소리에 가깝다는 뜻입니다.` });
  }
  const voiceCount = findings.filter((f) => f.cause === 'voice').length;

  return { zones, findings, notes, voiceCount };
}

// ---------- DAW preset text -> bands ----------

const TYPE_WORDS = {
  highpass: ['hpf', 'hp', 'highpass', 'lowcut', 'low-cut', 'locut'],
  lowpass: ['lpf', 'lp', 'lowpass', 'highcut', 'high-cut', 'hicut'],
  lowshelf: ['ls', 'lowshelf', 'low-shelf', 'lshelf'],
  highshelf: ['hs', 'highshelf', 'high-shelf', 'hshelf'],
  peaking: ['bell', 'peak', 'peaking', 'pk', 'eq'],
};
const TYPE_OF = Object.fromEntries(Object.entries(TYPE_WORDS).flatMap(([t, ws]) => ws.map((w) => [w, t])));

/**
 * Parse one band per line, e.g. "HPF 80Hz", "300Hz -3dB Q1", "3k +4 1.4", "HS 10k +2".
 * Bare numbers fill frequency, then gain, then Q. Commas separate tokens (no decimal commas).
 * @returns {{ bands: object[], errors: { line: number, text: string, reason: string }[] }}
 */
export function parsePreset(text) {
  const bands = [];
  const errors = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    const err = (reason) => errors.push({ line: i + 1, text: line, reason });
    const toks = line.toLowerCase().split(/[\s,;|]+/).filter(Boolean);
    let type = null, freq = null, gain = null, q = null;
    for (let k = 0; k < toks.length; k++) {
      const tk = toks[k];
      let m;
      if (TYPE_OF[tk]) type = TYPE_OF[tk];
      else if (tk === 'q' && k + 1 < toks.length && /^\d+(\.\d+)?$/.test(toks[k + 1])) q = Number(toks[++k]);
      else if ((m = tk.match(/^q[=:]?(\d+(?:\.\d+)?)$/))) q = Number(m[1]);
      else if ((m = tk.match(/^([+-]?\d+(?:\.\d+)?)db$/))) gain = Number(m[1]);
      else if ((m = tk.match(/^(\d+(?:\.\d+)?)(k|khz|hz)$/))) freq = Number(m[1]) * (m[2] === 'hz' ? 1 : 1000);
      else if (/^[+-]\d+(\.\d+)?$/.test(tk)) gain = Number(tk);
      else if (/^\d+(\.\d+)?$/.test(tk)) {
        if (freq == null) freq = Number(tk);
        else if (gain == null) gain = Number(tk);
        else if (q == null) q = Number(tk);
        else return err(`숫자가 너무 많음: "${tk}"`);
      } else return err(`알 수 없는 표기: "${tk}"`);
    }
    type ??= 'peaking';
    if (freq == null) return err('주파수가 없음');
    if (freq < 20 || freq > 20000) return err(`주파수 범위(20 Hz–20 kHz) 밖: ${freq} Hz`);
    gain ??= 0;
    if (Math.abs(gain) > 24) return err(`게인이 ±24 dB를 넘음: ${gain} dB`);
    q ??= type === 'peaking' ? 1 : 0.71;
    if (q < 0.1 || q > 20) return err(`Q 범위(0.1–20) 밖: ${q}`);
    bands.push({ type, freq, gain: type === 'highpass' || type === 'lowpass' ? 0 : gain, q });
  });
  return { bands, errors };
}
