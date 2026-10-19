import { analyze, ltasDistanceDb } from './analysis.js';
import { diagnose, suggestedEq } from './rules.js';
import { applyMoves, flatBands, responseDb } from './eq.js';
import { EXERCISES, SOURCES, DISCLAIMER } from './knowledge.js';
import * as audio from './audio.js';

const RECORD_SECONDS = 6;
const F_MIN = 40;
const F_MAX = 16000;
const G_RANGE = 15;
const HISTORY_KEY = 'eqvocal.history.v1';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));

const state = {
  takes: { main: null, pinch: null }, // { samples, sampleRate, metrics }
  result: null,
  bands: flatBands(),
  selected: 3,
};

// ---------- Step 1: takes ----------

function takeEl(name) {
  return $(`.take[data-take="${name}"]`);
}

function setStatus(name, text) {
  $('.status', takeEl(name)).textContent = text;
}

async function loadTake(name, take) {
  setStatus(name, '분석 중…');
  await new Promise((r) => setTimeout(r, 0)); // let the status paint before the heavy work
  const metrics = analyze(take.samples, take.sampleRate);
  state.takes[name] = { ...take, metrics };
  $('[data-action="play-raw"]', takeEl(name)).disabled = false;
  setStatus(name, `${fmt(metrics.input.durationSec)}초 · 최대 ${fmt(metrics.input.peakDb)} dBFS`);
  refresh(name === 'main');
}

for (const name of ['main', 'pinch']) {
  const el = takeEl(name);
  const btn = $('[data-action="record"]', el);
  const fill = $('.meter-fill', el);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.classList.add('recording');
    try {
      const take = await audio.recordTake({
        seconds: RECORD_SECONDS,
        onLevel: (p) => {
          fill.style.width = `${Math.min(100, p * 100)}%`;
          fill.style.background = p > 0.98 ? 'var(--warn)' : 'var(--ok)';
        },
        onTick: (t) => setStatus(name, `녹음 중… ${(RECORD_SECONDS - t).toFixed(1)}초 남음`),
      });
      fill.style.width = '0';
      await loadTake(name, take);
    } catch (err) {
      setStatus(name, `마이크를 열 수 없음: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.classList.remove('recording');
    }
  });

  $('[data-action="file"]', el).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await loadTake(name, await audio.decodeFile(file));
    } catch (err) {
      setStatus(name, `파일을 읽을 수 없음: ${err.message}`);
    }
    e.target.value = '';
  });

  $('[data-action="play-raw"]', el).addEventListener('click', () => {
    if (state.takes[name]) audio.play(state.takes[name], null);
  });
}

// ---------- Step 2: diagnosis ----------

function refresh(saveHistory) {
  const main = state.takes.main;
  if (!main) return;
  const pinch = state.takes.pinch && main.metrics.ltas
    ? ltasDistanceDb(main.metrics.ltas, state.takes.pinch.metrics.ltas)
    : null;
  state.result = diagnose(main.metrics, { pinch });
  renderResult();
  $('#step-eq').hidden = !state.result.usable;
  if (state.result.usable) {
    drawEq();
    if (saveHistory) addHistory(main.metrics);
  }
}

const SEVERITY = { ok: '좋음', info: '참고', warn: '연습 필요', block: '다시 녹음' };

function renderResult() {
  const { metrics } = state.takes.main;
  const { usable, findings } = state.result;
  $('#step-result').hidden = false;

  const cards = usable
    ? [
        ['기본 주파수', fmt(metrics.pitch.f0Hz, 0), 'Hz'],
        ['음정 흔들림', fmt(metrics.pitch.centsSd), 'cent'],
        ['HNR', fmt(metrics.hnrDb), 'dB'],
        ['SPR (울림)', fmt(metrics.sprDb), 'dB'],
        ['Alpha ratio', fmt(metrics.alphaDb), 'dB'],
      ]
    : [];
  $('#metrics').innerHTML = cards
    .map(([k, v, u]) => `<div class="metric"><div class="k">${k}</div><span class="v">${v}</span><span class="u">${u}</span></div>`)
    .join('');

  $('#findings').innerHTML = findings.map(renderFinding).join('');
}

function renderFinding(f) {
  const tags = [];
  if (f.basis === 'research') tags.push('<span class="badge tag">측정법: 연구 근거</span>');
  if (f.basis === 'heuristic') tags.push('<span class="badge tag">경험칙 · 미검증</span>');
  if (f.provisional) tags.push('<span class="badge tag">기준값: 임시</span>');
  const ex = (f.exercises ?? []).map((id) => {
    const e = EXERCISES[id];
    const src = e.source ? ` · ${esc(SOURCES[e.source].label)}` : '';
    const basis = e.basis === 'research' ? '연구 근거' : '경험칙';
    return `<div class="exercise"><b>${esc(e.name)} <span class="badge tag">${basis}${src}</span></b>${esc(e.how)}<div class="why">${esc(e.why)}</div></div>`;
  }).join('');
  const src = f.source ? SOURCES[f.source] : null;
  const cite = src
    ? `<div class="cite" title="${esc(src.cite)}">근거: ${src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)}</a>` : esc(src.label)}</div>`
    : '';
  const eq = f.eq ? `<div class="cite">EQ 미리듣기: ${f.eq.freq} Hz ${f.eq.gain > 0 ? '+' : ''}${f.eq.gain} dB</div>` : '';
  return `<div class="finding ${f.severity}">
    <h3>${esc(f.title)} <span class="badge ${f.severity}">${SEVERITY[f.severity]}</span>${tags.join('')}</h3>
    <div class="evidence">${esc(f.evidence)}</div>
    <p>${esc(f.meaning)}</p>${ex}${eq}${cite}</div>`;
}

// ---------- Step 3: EQ ----------

const canvas = $('#eq-canvas');
const g2d = canvas.getContext('2d');
const fToX = (f, w) => (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * w;
const xToF = (x, w) => F_MIN * (F_MAX / F_MIN) ** Math.min(1, Math.max(0, x / w));
const gToY = (g, h) => h / 2 - (g / G_RANGE) * (h / 2 - 12);
const yToG = (y, h) => Math.max(-G_RANGE, Math.min(G_RANGE, ((h / 2 - y) / (h / 2 - 12)) * G_RANGE));
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function drawEq() {
  const main = state.takes.main;
  if (!main) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width;
  const h = rect.height;
  const sr = main.sampleRate;
  g2d.clearRect(0, 0, w, h);

  // 2-4 kHz ring band
  g2d.fillStyle = css('--accent-soft');
  g2d.fillRect(fToX(2000, w), 0, fToX(4000, w) - fToX(2000, w), h);

  // grid
  g2d.strokeStyle = css('--line');
  g2d.fillStyle = css('--muted');
  g2d.font = '11px sans-serif';
  g2d.lineWidth = 1;
  for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
    const x = fToX(f, w);
    g2d.beginPath(); g2d.moveTo(x, 0); g2d.lineTo(x, h); g2d.stroke();
    g2d.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 3, h - 4);
  }
  for (const g of [-12, -6, 0, 6, 12]) {
    const y = gToY(g, h);
    g2d.beginPath(); g2d.moveTo(0, y); g2d.lineTo(w, y); g2d.stroke();
    g2d.fillText(`${g > 0 ? '+' : ''}${g}`, 3, y - 3);
  }

  // LTAS background (top 60 dB, own scale), with the current EQ applied so you see its effect
  const { binHz, db } = main.metrics.ltas;
  const maxDb = Math.max(...db.slice(1));
  g2d.beginPath();
  g2d.moveTo(0, h);
  for (let px = 0; px <= w; px += 2) {
    const f = xToF(px, w);
    const k = Math.min(db.length - 1, Math.round(f / binHz));
    const v = Math.max(-60, db[k] - maxDb + responseDb(state.bands, f, sr));
    g2d.lineTo(px, h - ((v + 60) / 60) * (h - 16));
  }
  g2d.lineTo(w, h);
  g2d.closePath();
  g2d.fillStyle = css('--ltas');
  g2d.fill();

  // EQ curve
  g2d.strokeStyle = css('--curve');
  g2d.lineWidth = 2;
  g2d.beginPath();
  for (let px = 0; px <= w; px += 2) {
    const y = gToY(responseDb(state.bands, xToF(px, w), sr), h);
    px === 0 ? g2d.moveTo(px, y) : g2d.lineTo(px, y);
  }
  g2d.stroke();

  // band handles
  state.bands.forEach((b, i) => {
    const x = fToX(b.freq, w);
    const y = gToY(b.gain, h);
    g2d.beginPath();
    g2d.arc(x, y, i === state.selected ? 8 : 6, 0, Math.PI * 2);
    g2d.fillStyle = i === state.selected ? css('--curve') : css('--card');
    g2d.strokeStyle = css('--curve');
    g2d.lineWidth = 2;
    g2d.fill();
    g2d.stroke();
    g2d.fillStyle = i === state.selected ? '#fff' : css('--curve');
    g2d.font = 'bold 10px sans-serif';
    g2d.fillText(String(i + 1), x - 3, y + 3.5);
  });
  syncControls();
}

const BAND_NAMES = { lowshelf: '로우 셸프', peaking: '피킹', highshelf: '하이 셸프' };
const freqToSlider = (f) => Math.round((Math.log(f / 20) / Math.log(16000 / 20)) * 1000);
const sliderToFreq = (v) => 20 * (16000 / 20) ** (v / 1000);

function syncControls() {
  const b = state.bands[state.selected];
  $('#band-tabs').innerHTML = state.bands
    .map((x, i) => `<button data-band="${i}" class="${i === state.selected ? 'active' : ''}">${i + 1}. ${BAND_NAMES[x.type]}</button>`)
    .join('');
  $('#ctl-freq').value = freqToSlider(b.freq);
  $('#ctl-gain').value = b.gain;
  $('#ctl-q').value = b.q;
  $('#ctl-q').disabled = b.type !== 'peaking';
  $('#out-freq').textContent = `${b.freq >= 1000 ? (b.freq / 1000).toFixed(2) + 'k' : Math.round(b.freq)} Hz`;
  $('#out-gain').textContent = `${b.gain > 0 ? '+' : ''}${b.gain.toFixed(1)} dB`;
  $('#out-q').textContent = b.type === 'peaking' ? b.q.toFixed(1) : '—';
}

function bandsChanged() {
  audio.setLiveBands(state.bands);
  drawEq();
}

$('#band-tabs').addEventListener('click', (e) => {
  const i = e.target.dataset.band;
  if (i != null) { state.selected = Number(i); drawEq(); }
});
$('#ctl-freq').addEventListener('input', (e) => { state.bands[state.selected].freq = sliderToFreq(Number(e.target.value)); bandsChanged(); });
$('#ctl-gain').addEventListener('input', (e) => { state.bands[state.selected].gain = Number(e.target.value); bandsChanged(); });
$('#ctl-q').addEventListener('input', (e) => { state.bands[state.selected].q = Number(e.target.value); bandsChanged(); });

let dragging = false;
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  let best = -1;
  let bestD = 24;
  state.bands.forEach((b, i) => {
    const d = Math.hypot(fToX(b.freq, r.width) - x, gToY(b.gain, r.height) - y);
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best < 0) return;
  state.selected = best;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  drawEq();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const r = canvas.getBoundingClientRect();
  const b = state.bands[state.selected];
  b.freq = Math.min(16000, Math.max(20, xToF(e.clientX - r.left, r.width)));
  b.gain = Math.round(yToG(e.clientY - r.top, r.height) * 2) / 2;
  bandsChanged();
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => {
  const b = state.bands[state.selected];
  if (b.type !== 'peaking') return;
  e.preventDefault();
  b.q = Math.min(8, Math.max(0.3, b.q * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  bandsChanged();
}, { passive: false });

$('#btn-suggest').addEventListener('click', () => {
  const moves = suggestedEq(state.result?.findings ?? []);
  state.bands = applyMoves(moves);
  if (moves.length) state.selected = moves[0].band;
  bandsChanged();
  $('#btn-suggest').textContent = moves.length ? '제안 EQ 적용됨' : '제안할 EQ 없음';
  setTimeout(() => { $('#btn-suggest').textContent = '제안 EQ 적용'; }, 1500);
});
$('#btn-flat').addEventListener('click', () => { state.bands = flatBands(); bandsChanged(); });
$('#btn-play-raw').addEventListener('click', () => state.takes.main && audio.play(state.takes.main, null));
$('#btn-play-eq').addEventListener('click', () => state.takes.main && audio.play(state.takes.main, state.bands));
$('#btn-stop').addEventListener('click', () => audio.stop());
window.addEventListener('resize', () => { if (!$('#step-eq').hidden) drawEq(); });

// ---------- Step 4: history (per-browser convenience only) ----------

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? []; } catch { return []; }
}

function addHistory(m) {
  const list = loadHistory();
  list.push({
    at: new Date().toISOString(),
    f0: m.pitch.f0Hz, sd: m.pitch.centsSd, hnr: m.hnrDb, spr: m.sprDb, alpha: m.alphaDb,
  });
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-50))); } catch { /* storage unavailable */ }
  renderHistory(list);
}

// +1: higher is better, -1: lower is better, 0: neutral
const COLS = [['f0', 'F0', 0, 0], ['sd', '흔들림', -1, 1], ['hnr', 'HNR', 1, 1], ['spr', 'SPR', 1, 1], ['alpha', 'Alpha', 0, 1]];

function renderHistory(list = loadHistory()) {
  if (!list.length) {
    $('#history').innerHTML = '<p class="note">아직 기록이 없습니다. 기본 녹음을 하면 자동으로 쌓입니다 (이 브라우저에만 저장).</p>';
    return;
  }
  const first = list[0];
  const rows = list.slice(-10).reverse().map((r) => {
    const d = new Date(r.at);
    const cells = COLS.map(([k, , dir, dec]) => {
      const v = r[k];
      if (r === first || dir === 0 || v == null || first[k] == null) return `<td>${fmt(v, dec)}</td>`;
      const delta = v - first[k];
      const cls = Math.abs(delta) < 0.05 ? '' : delta * dir > 0 ? 'up' : 'down';
      return `<td>${fmt(v, dec)} <span class="${cls}">(${delta > 0 ? '+' : ''}${fmt(delta, dec)})</span></td>`;
    }).join('');
    return `<tr><td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>${cells}</tr>`;
  }).join('');
  $('#history').innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>시각</th>${COLS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>
    <p class="hint">괄호 = 첫 기록 대비. 초록은 좋아진 방향, 빨강은 나빠진 방향.</p>
    <button id="btn-clear-history">기록 지우기</button>`;
  $('#btn-clear-history').addEventListener('click', () => {
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
    renderHistory([]);
  });
}

renderHistory();
const ds = SOURCES[DISCLAIMER.source];
$('#disclaimer').innerHTML = `${esc(DISCLAIMER.text)} <span title="${esc(ds.cite)}">(${esc(ds.label)})</span>`;
