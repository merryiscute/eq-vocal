// Parametric EQ: band model, RBJ-cookbook magnitude math (pure, testable) and a Web Audio chain.
// Web Audio's BiquadFilterNode implements the same cookbook formulas; shelves ignore Q (S = 1).

export const DEFAULT_BANDS = [
  { type: 'lowshelf', freq: 100, gain: 0, q: 0.7 },
  { type: 'peaking', freq: 300, gain: 0, q: 1.0 },
  { type: 'peaking', freq: 1000, gain: 0, q: 1.0 },
  { type: 'peaking', freq: 3000, gain: 0, q: 1.0 },
  { type: 'highshelf', freq: 8000, gain: 0, q: 0.7 },
];

export const flatBands = () => DEFAULT_BANDS.map((b) => ({ ...b }));

export function applyMoves(moves) {
  const bands = flatBands();
  for (const m of moves) Object.assign(bands[m.band], { freq: m.freq, gain: m.gain, q: m.q });
  return bands;
}

export function coefficients({ type, freq, gain, q }, sampleRate) {
  const A = 10 ** (gain / 40);
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  if (type === 'peaking') {
    const alpha = sin / (2 * q);
    return {
      b: [1 + alpha * A, -2 * cos, 1 - alpha * A],
      a: [1 + alpha / A, -2 * cos, 1 - alpha / A],
    };
  }
  if (type === 'highpass' || type === 'lowpass') {
    // 12 dB/oct; gain is ignored, as in BiquadFilterNode.
    const alpha = sin / (2 * q);
    const hp = type === 'highpass';
    const b0 = hp ? (1 + cos) / 2 : (1 - cos) / 2;
    return { b: [b0, hp ? -(1 + cos) : 1 - cos, b0], a: [1 + alpha, -2 * cos, 1 - alpha] };
  }
  const alpha = (sin / 2) * Math.SQRT2; // shelf slope S = 1
  const k = 2 * Math.sqrt(A) * alpha;
  if (type === 'lowshelf') {
    return {
      b: [A * (A + 1 - (A - 1) * cos + k), 2 * A * (A - 1 - (A + 1) * cos), A * (A + 1 - (A - 1) * cos - k)],
      a: [A + 1 + (A - 1) * cos + k, -2 * (A - 1 + (A + 1) * cos), A + 1 + (A - 1) * cos - k],
    };
  }
  if (type === 'highshelf') {
    return {
      b: [A * (A + 1 + (A - 1) * cos + k), -2 * A * (A - 1 + (A + 1) * cos), A * (A + 1 + (A - 1) * cos - k)],
      a: [A + 1 - (A - 1) * cos + k, 2 * (A - 1 - (A + 1) * cos), A + 1 - (A - 1) * cos - k],
    };
  }
  throw new Error(`unknown band type ${type}`);
}

function biquadDb({ b, a }, f, sampleRate) {
  const w = (2 * Math.PI * f) / sampleRate;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b[0] + b[1] * c1 + b[2] * c2, ni = -(b[1] * s1 + b[2] * s2);
  const dr = a[0] + a[1] * c1 + a[2] * c2, di = -(a[1] * s1 + a[2] * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

export const isPass = (band) => band.type === 'highpass' || band.type === 'lowpass';

/** Total EQ gain in dB at frequency f. */
export function responseDb(bands, f, sampleRate) {
  return bands.reduce(
    (sum, band) => sum + (band.gain || isPass(band) ? biquadDb(coefficients(band, sampleRate), f, sampleRate) : 0),
    0,
  );
}

/** Series chain of BiquadFilterNodes. Connect input -> ... -> output. */
export function createChain(ctx, bands) {
  const nodes = bands.map((b) => {
    const n = ctx.createBiquadFilter();
    n.type = b.type;
    return n;
  });
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  const chain = {
    input: nodes[0],
    output: nodes[nodes.length - 1],
    update(next) {
      next.forEach((b, i) => {
        nodes[i].frequency.value = b.freq;
        nodes[i].gain.value = b.gain;
        nodes[i].Q.value = b.q;
      });
    },
  };
  chain.update(bands);
  return chain;
}
