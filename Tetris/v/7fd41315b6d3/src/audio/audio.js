import { getAudioContext } from './context.js';
import { playGlide, playTone, playSequence } from './tones.js';
import { playSwoosh } from './noise.js';

// Equal temperament around middle C — the line-clear reward ladder from
// product brief §9.1: single C→E, extended chime C→E→G, Tetris C→E→G→C.
const C4 = 261.63;
const E4 = 329.63;
const G4 = 392.0;
const C5 = 523.25;

// The level-up fanfare one octave up (product brief §9.1: four notes, 400 ms),
// and the game-over descent (A2→A1, 800 ms).
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const A2 = 110.0;
const A1 = 55.0;

// One entry per engine event action; `kind` picks the player in `playSound`.
// Durations and frequencies are the product brief's table (§9.1).
const SOUND_MAP = {
  move_left: { kind: 'tone', frequency: 440, durationMs: 30 },
  move_right: { kind: 'tone', frequency: 440, durationMs: 30 },
  rotate_cw: { kind: 'tone', frequency: 523, durationMs: 40 },
  rotate_ccw: { kind: 'tone', frequency: 523, durationMs: 40 },
  soft_drop: { kind: 'tone', frequency: 440, durationMs: 20 },
  lock: { kind: 'tone', frequency: 440, durationMs: 40 },
  hard_drop: { kind: 'tone', frequency: 110, durationMs: 50 },
  hold: { kind: 'swoosh', durationMs: 100 },
};

// The reward chime per api-spec `ClearType`, keyed exactly as the engine
// publishes it in `lastClearEvent.clearType`. The `t_spin*` variants are not
// listed on purpose: any T-Spin plays the ping below instead (PROJ-28), and a
// `none` clear reaches neither this map nor the ping — a lock that cleared
// nothing plays no reward at all.
const CLEAR_CHIMES = {
  single: { kind: 'sequence', notes: [C4, E4], durationMs: 100 },
  double: { kind: 'sequence', notes: [C4, E4, G4], durationMs: 200 },
  triple: { kind: 'sequence', notes: [C4, E4, G4], durationMs: 200 },
  tetris: { kind: 'sequence', notes: [C4, E4, G4, C5], durationMs: 300 },
};

// Square, not sine: the odd harmonics give the metallic edge the brief asks
// for ("distinctive metallic ping").
const T_SPIN_PING = { kind: 'tone', frequency: 800, durationMs: 150, waveform: 'square' };

// The level-up fanfare (product brief §9.1): four ascending notes over 400 ms,
// one octave above the line-clear ladder so it reads as a celebration, not a
// fifth chime. The game-over descent: a single sine gliding A2→A1 over 800 ms.
const LEVEL_UP_ARPEGGIO = { kind: 'sequence', notes: [C5, E5, G5, C6], durationMs: 400 };
const GAME_OVER_GLIDE = { kind: 'glide', fromFrequency: A2, toFrequency: A1, durationMs: 800 };

function playSound(audioContext, sound) {
  switch (sound.kind) {
    case 'sequence': {
      playSequence({
        audioContext,
        notes: sound.notes,
        durationMs: sound.durationMs,
        delayMs: sound.delayMs,
      });
      break;
    }
    case 'glide': {
      playGlide({
        audioContext,
        fromFrequency: sound.fromFrequency,
        toFrequency: sound.toFrequency,
        durationMs: sound.durationMs,
        delayMs: sound.delayMs,
      });
      break;
    }
    case 'swoosh': {
      playSwoosh({ audioContext, durationMs: sound.durationMs });
      break;
    }
    default: {
      // 'tone' — the plain single-note path every blip, click, thump and ping
      // takes, with `waveform` falling back to a sine when the entry omits it.
      playTone({
        audioContext,
        frequency: sound.frequency,
        durationMs: sound.durationMs,
        waveform: sound.waveform,
        delayMs: sound.delayMs,
      });
    }
  }
}

// The reward for one lock, read from the one-tick `lastClearEvent` the engine
// published for exactly this lock: a T-Spin plays the ping whatever it
// cleared, a row clear plays its chime, and a lock that cleared nothing (null
// event, or `clearType: "none"`) earns silence.
function clearReward(clearEvent) {
  if (!clearEvent) {
    return null;
  }
  if (clearEvent.tSpinDetected) {
    return T_SPIN_PING;
  }
  return CLEAR_CHIMES[clearEvent.clearType] ?? null;
}

export function createAudio({
  AudioContext = globalThis.AudioContext,
} = {}) {
  const audioContext = getAudioContext({ AudioContext });
  // The level the board had reached the last time a lock was heard. Compared
  // against `state.level` on every lock: a rise means the 10-line boundary was
  // just crossed (the engine only ever raises the level inside a scoring lock),
  // so the arpeggio fires exactly once per level-up, and a fall (a fresh game
  // resetting to 1) just re-arms the baseline silently.
  let lastLevel = 1;
  // The game-over descent is a one-shot per game: set on the first
  // playing→game_over transition, re-armed by any live `playing` event so a
  // Play-Again game can sound its own descent while repeats inside one
  // game-over stay silent.
  let gameOverPlayed = false;

  function subscribe(event) {
    const phase = event.phase ?? event.state.phase;
    if (phase !== 'playing') {
      return;
    }
    if (event.state.phase === 'playing') {
      gameOverPlayed = false;
    }
    const sound = SOUND_MAP[event.action];
    if (sound) {
      playSound(audioContext, sound);
    }
    if (event.action === 'lock') {
      const reward = clearReward(event.state.lastClearEvent);
      if (reward) {
        playSound(audioContext, reward);
      }
      // A level-up always lands in the same lock as its line clear (levels
      // move only inside `startLineClear`), so the fanfare queues behind the
      // reward's window via the shared scheduler's `delayMs` instead of
      // stacking on top of it. With no reward the delay is zero — the run
      // starts immediately, which cannot happen today but keeps the ordering
      // rule total.
      const leveledUp = event.state.level > lastLevel;
      lastLevel = event.state.level;
      if (leveledUp) {
        playSound(audioContext, {
          ...LEVEL_UP_ARPEGGIO,
          delayMs: reward ? reward.durationMs : 0,
        });
      }
      // The lock that tops the game out notifies with the prior `playing`
      // phase (so the click above still passes the gate) while `state.phase`
      // already reads `game_over` — that split is the transition signal. The
      // descent queues behind whatever this lock already scheduled (reward,
      // then fanfare) so the three never overlap.
      if (!gameOverPlayed && event.state.phase === 'game_over') {
        playSound(audioContext, {
          ...GAME_OVER_GLIDE,
          delayMs:
            (reward ? reward.durationMs : 0) +
            (leveledUp ? LEVEL_UP_ARPEGGIO.durationMs : 0),
        });
        gameOverPlayed = true;
      }
    }
  }

  return { subscribe };
}
