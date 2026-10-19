// Web Audio plumbing: raw recording, file decoding, playback through the EQ chain.
import { createChain } from './eq.js';

let ctx = null;
let workletReady = null;
let playing = null;

export function audioContext() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/**
 * Record `seconds` of raw mono PCM from the mic.
 * Browser voice processing (AGC, noise suppression, echo cancel) is turned off:
 * it reshapes the spectrum and would corrupt every measurement.
 */
export async function recordTake({ seconds, onLevel, onTick }) {
  const ac = audioContext();
  await ac.resume();
  workletReady ??= ac.audioWorklet.addModule(new URL('./recorder-worklet.js', import.meta.url));
  await workletReady;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  });
  const src = ac.createMediaStreamSource(stream);
  const rec = new AudioWorkletNode(ac, 'recorder');
  const mute = ac.createGain();
  mute.gain.value = 0;
  src.connect(rec).connect(mute).connect(ac.destination);

  const target = Math.round(seconds * ac.sampleRate);
  const chunks = [];
  let got = 0;
  try {
    await new Promise((resolve) => {
      rec.port.onmessage = (e) => {
        const c = e.data;
        chunks.push(c);
        got += c.length;
        let peak = 0;
        for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
        onLevel?.(peak);
        onTick?.(Math.min(got / ac.sampleRate, seconds));
        if (got >= target) resolve();
      };
    });
  } finally {
    rec.port.onmessage = null;
    src.disconnect();
    rec.disconnect();
    mute.disconnect();
    stream.getTracks().forEach((t) => t.stop());
  }

  const samples = new Float32Array(Math.min(got, target));
  let off = 0;
  for (const c of chunks) {
    const n = Math.min(c.length, samples.length - off);
    samples.set(c.subarray(0, n), off);
    off += n;
    if (off >= samples.length) break;
  }
  return { samples, sampleRate: ac.sampleRate };
}

/** Decode an uploaded audio file to mono. */
export async function decodeFile(file) {
  const ac = audioContext();
  const buf = await ac.decodeAudioData(await file.arrayBuffer());
  const samples = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) samples[i] += d[i] / buf.numberOfChannels;
  }
  return { samples, sampleRate: buf.sampleRate };
}

export function stop() {
  if (playing) {
    try { playing.source.stop(); } catch { /* already stopped */ }
    playing = null;
  }
}

/** Play a take; with `bands` it goes through the EQ chain (live-updatable via setLiveBands). */
export async function play({ samples, sampleRate }, bands, onEnd) {
  stop();
  const ac = audioContext();
  await ac.resume();
  const buf = ac.createBuffer(1, samples.length, sampleRate);
  buf.copyToChannel(samples, 0);
  const source = ac.createBufferSource();
  source.buffer = buf;
  let chain = null;
  if (bands) {
    chain = createChain(ac, bands);
    source.connect(chain.input);
    chain.output.connect(ac.destination);
  } else {
    source.connect(ac.destination);
  }
  const me = { source, chain };
  source.onended = () => {
    if (playing === me) playing = null;
    onEnd?.();
  };
  playing = me;
  source.start();
}

export function setLiveBands(bands) {
  playing?.chain?.update(bands);
}
