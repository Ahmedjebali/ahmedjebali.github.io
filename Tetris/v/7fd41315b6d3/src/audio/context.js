export function getAudioContext({ AudioContext = globalThis.AudioContext } = {}) {
  try {
    if (!AudioContext) {
      return null;
    }
    return new AudioContext();
  } catch {
    return null;
  }
}

// Browsers create the AudioContext in `suspended` state until a user gesture,
// so tones scheduled on it would be silent. Resume first — but only when it is
// actually suspended: `resume()` returns a promise that can reject (e.g. the
// gesture policy still refuses), so swallow that rejection and any synchronous
// throw alike. Shared by every playback primitive (tones.js, noise.js) so the
// guard lives in exactly one place (AGENTS.md §8.3).
export function resumeIfSuspended(audioContext) {
  if (audioContext.state !== 'suspended') {
    return;
  }
  try {
    const resuming = audioContext.resume();
    resuming?.catch(() => {});
  } catch {
    // silent — audio failures must never break the game
  }
}
