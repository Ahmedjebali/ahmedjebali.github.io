import { resumeIfSuspended } from './context.js';

// Schedules one oscillator/gain pair: `frequency` starting at `startAt` for
// `durationMs`, fading exponentially to silence at the end. The shared core of
// `playTone` (a single note) and `playSequence` (a run of notes), so a blip
// and a chime envelope exactly the same way (AGENTS.md §8.1 — extend, never
// replace).
function scheduleTone(audioContext, { frequency, startAt, durationMs, gainValue, waveform }) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = waveform;
  oscillator.frequency.value = frequency;
  gainNode.gain.setValueAtTime(gainValue, startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + durationMs / 1000);
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + durationMs / 1000);
}

export function playTone({
  audioContext,
  frequency,
  durationMs,
  gainValue = 0.15,
  waveform = 'sine',
  delayMs = 0,
} = {}) {
  if (!audioContext) {
    return;
  }
  try {
    resumeIfSuspended(audioContext);
    scheduleTone(audioContext, {
      frequency,
      startAt: audioContext.currentTime + delayMs / 1000,
      durationMs,
      gainValue,
      waveform,
    });
  } catch {
    // silent — audio failures must never break the game
  }
}

// Plays `notes` as a run spread evenly across `durationMs`: note i starts at
// i × (durationMs / notes.length) and lasts exactly one slot, so the run fills
// the whole window — no gap between notes, no note overlapping the next, and
// every oscillator stops at the end of its slot. One shot: the run is scheduled
// once per call and can neither loop nor repeat itself (PROJ-28).
// `delayMs` shifts the whole run later without changing its shape, so a caller
// can queue one run after another sound's window ends instead of stacking them
// (PROJ-29: the level-up arpeggio starts where the line-clear chime stops).
export function playSequence({
  audioContext,
  notes,
  durationMs,
  gainValue = 0.15,
  waveform = 'sine',
  delayMs = 0,
} = {}) {
  if (!audioContext || !notes?.length) {
    return;
  }
  try {
    resumeIfSuspended(audioContext);
    const firstNoteAt = audioContext.currentTime + delayMs / 1000;
    const slotMs = durationMs / notes.length;
    notes.forEach((frequency, index) => {
      scheduleTone(audioContext, {
        frequency,
        startAt: firstNoteAt + (index * slotMs) / 1000,
        durationMs: slotMs,
        gainValue,
        waveform,
      });
    });
  } catch {
    // silent — audio failures must never break the game
  }
}

// A single oscillator whose pitch glides from `fromFrequency` to `toFrequency`
// across `durationMs` (an exponential frequency ramp, so the slide sounds even
// to the ear) under the same gain envelope `scheduleTone` gives every other
// cue — one shot, started once and stopped at the window end, like the swoosh.
// `delayMs` shifts the slide later, the same queueing knob `playSequence` has.
// (PROJ-29: the game-over A2→A1 descent.)
export function playGlide({
  audioContext,
  fromFrequency,
  toFrequency,
  durationMs,
  gainValue = 0.15,
  waveform = 'sine',
  delayMs = 0,
} = {}) {
  if (!audioContext) {
    return;
  }
  try {
    resumeIfSuspended(audioContext);
    const startAt = audioContext.currentTime + delayMs / 1000;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(fromFrequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(toFrequency, startAt + durationMs / 1000);
    gainNode.gain.setValueAtTime(gainValue, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + durationMs / 1000);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + durationMs / 1000);
  } catch {
    // silent — audio failures must never break the game
  }
}
