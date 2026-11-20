import { InjectionToken } from '@angular/core';
import { decimation, loudness, smooth, toPcm16 } from './pcm';

/** An open microphone: its loudness for the orb, and its audio as PCM for transcription. */
export interface MicCapture {
  /** The rate of the 16-bit mono PCM handed to `onPcm`. */
  readonly sampleRate: number;
  /** Set it to receive the audio, about 25 chunks a second. */
  onPcm: ((chunk: ArrayBuffer) => void) | null;
  /** Smoothed loudness 0..1. Call once per animation frame. */
  level(): number;
  /** The spectrum in `count` bands, low to high, each 0..1. */
  bands(count: number): number[];
  stop(): void;
}

/** Why the microphone could not be opened: there is none here, or the person or the page's policy said no. */
export type MicFailure = 'none' | 'blocked';

export function micFailure(error: unknown): MicFailure {
  const name = (error as { name?: string } | null)?.name ?? '';
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : 'none';
}

export type MicOpener = () => Promise<MicCapture>;

const WORKLET_URL = 'pcm-capture.worklet.js';

/** Opens the microphone. Call it from a click: the browser asks for permission and audio may start. */
export async function openMic(): Promise<MicCapture> {
  if (!globalThis.navigator?.mediaDevices?.getUserMedia) throw Object.assign(new Error('No microphone API'), { name: 'NotFoundError' });
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const audio = new AudioContext();
  await audio.resume().catch(() => undefined);
  const source = audio.createMediaStreamSource(stream);
  const analyser = audio.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.7;
  source.connect(analyser);

  const factor = decimation(audio.sampleRate);
  const time = new Float32Array(analyser.fftSize);
  const spectrum = new Uint8Array(analyser.frequencyBinCount);
  let level = 0;
  let last = performance.now();
  let stopped = false;

  const capture: MicCapture = {
    sampleRate: audio.sampleRate / factor,
    onPcm: null,
    level() {
      const now = performance.now();
      analyser.getFloatTimeDomainData(time);
      level = smooth(level, loudness(time), Math.min(0.1, (now - last) / 1000));
      last = now;
      return level;
    },
    bands(count) {
      analyser.getByteFrequencyData(spectrum);
      // Speech lives below about 6 kHz: spread the bands over that part, wider towards the top.
      const top = Math.min(spectrum.length, Math.ceil((6000 / (audio.sampleRate / 2)) * spectrum.length));
      const out: number[] = [];
      for (let band = 0; band < count; band++) {
        const from = Math.floor(top * (band / count) ** 2);
        const to = Math.max(from + 1, Math.floor(top * ((band + 1) / count) ** 2));
        let sum = 0;
        for (let i = from; i < to; i++) sum += spectrum[i]!;
        out.push(sum / (to - from) / 255);
      }
      return out;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      capture.onPcm = null;
      stream.getTracks().forEach((track) => track.stop());
      void audio.close().catch(() => undefined);
    },
  };

  const deliver = (samples: Float32Array) => {
    if (!stopped) capture.onPcm?.(toPcm16(samples, factor));
  };
  // Nothing is played back: the capture nodes end in a silent gain so the graph keeps pulling audio.
  const sink = audio.createGain();
  sink.gain.value = 0;
  sink.connect(audio.destination);
  try {
    await audio.audioWorklet.addModule(WORKLET_URL);
    const node = new AudioWorkletNode(audio, 'pcm-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
    node.port.onmessage = (event: MessageEvent<Float32Array>) => deliver(event.data);
    source.connect(node).connect(sink);
  } catch {
    // Older browsers, or the worklet file did not load: the deprecated node still works everywhere.
    const node = audio.createScriptProcessor(4096, 1, 1);
    let carry = new Float32Array(0);
    node.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const joined = new Float32Array(carry.length + input.length);
      joined.set(carry);
      joined.set(input, carry.length);
      const usable = joined.length - (joined.length % factor);
      deliver(joined.subarray(0, usable));
      carry = joined.slice(usable);
    };
    source.connect(node).connect(sink);
  }
  return capture;
}

/** How the microphone is opened. Tests provide a fake. */
export const MIC_OPENER = new InjectionToken<MicOpener>('MIC_OPENER', { providedIn: 'root', factory: () => openMic });
