import { resumeIfSuspended } from './context.js';

// The hold-swap swoosh (product brief §9.1): a short burst of white noise
// through a bandpass whose centre sweeps upward while the gain swells and
// decays — a rising "whoosh" rather than a flat hiss. One shot: the buffer
// source starts once and stops at `durationMs`, so it can neither loop nor
// overlap itself, and every Web Audio call sits in the same try/catch as the
// tone primitives so a refusing browser only means silence.
export function playSwoosh({
  audioContext,
  durationMs = 100,
  gainValue = 0.15,
  random = Math.random,
} = {}) {
  if (!audioContext) {
    return;
  }
  try {
    resumeIfSuspended(audioContext);
    const now = audioContext.currentTime;
    const durationS = durationMs / 1000;
    const frameCount = Math.max(1, Math.round(audioContext.sampleRate * durationS));
    const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
    const frames = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      frames[i] = random() * 2 - 1;
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    // Low → high sweep gives the upward swoosh; the gain attacks to `gainValue`
    // early in the window and decays to silence exactly at its end.
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + durationS);
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gainValue, now + durationS * 0.35);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationS);
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(now);
    source.stop(now + durationS);
  } catch {
    // silent — audio failures must never break the game
  }
}
