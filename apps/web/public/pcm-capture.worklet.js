// Microphone samples for voice input (src/app/kassandra/voice/mic-capture.ts): mono Float32 blocks of 1920 samples
// (40 ms at 48 kHz; divisible by 2, 3 and 6, so the page can average them down to 16 kHz without a remainder).
// A file of its own because the app's Content-Security-Policy allows scripts from 'self' only (no blob: worklets).
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.block = new Float32Array(1920);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.block[this.filled++] = channel[i];
      if (this.filled === this.block.length) {
        this.port.postMessage(this.block.slice(0));
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCapture);
