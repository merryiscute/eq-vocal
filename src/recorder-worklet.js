// Copies raw mic PCM (channel 0) to the main thread — no codec, so measurements stay clean.
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('recorder', RecorderProcessor);
