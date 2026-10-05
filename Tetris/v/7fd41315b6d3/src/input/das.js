// Delayed Auto Shift (product brief §4.1, §10.6) turns a held movement key
// into a timed stream of commands: one move on press, then a charging pause
// before the first auto-repeat, then a steady cadence until the key is
// released. This is a pure input-layer concern — the engine only ever receives
// the resulting commands and never learns that keys exist (frontend-rules §5,
// adr/0001). The timer is fed by the single rAF loop: `main.js` hands the same
// frame delta to both `engine.step()` and the input layer's `step()`.
export const DAS_DELAY_MS = 170;
export const DAS_REPEAT_MS = 50;
export const SOFT_DROP_DELAY_MS = 150;
export const SOFT_DROP_REPEAT_MS = 50;

// Lateral movement and soft drop each get their own delay (the soft drop's
// charge is shorter), the repeat cadence is shared.
const GESTURES = {
  left: { action: "move_left", delayMs: DAS_DELAY_MS, repeatMs: DAS_REPEAT_MS },
  right: { action: "move_right", delayMs: DAS_DELAY_MS, repeatMs: DAS_REPEAT_MS },
  down: { action: "soft_drop", delayMs: SOFT_DROP_DELAY_MS, repeatMs: SOFT_DROP_REPEAT_MS },
};

export function createDas({ dispatch }) {
  const states = {
    left: { keysHeld: 0, timerMs: 0, repeatAtMs: 0 },
    right: { keysHeld: 0, timerMs: 0, repeatAtMs: 0 },
    down: { keysHeld: 0, timerMs: 0, repeatAtMs: 0 },
  };
  // Only one horizontal direction moves at a time; keysHeld remembers how many
  // physical keys are down for each side so a release can hand the wheel to
  // whichever side still has keys held.
  let activeHorizontal = null;

  function press(gesture) {
    const slot = states[gesture];
    slot.keysHeld += 1;
    slot.timerMs = 0;
    slot.repeatAtMs = GESTURES[gesture].delayMs;
    if (gesture !== "down") {
      activeHorizontal = gesture;
    }
    dispatch(GESTURES[gesture].action);
  }

  function release(gesture) {
    const slot = states[gesture];
    if (slot.keysHeld === 0) {
      return;
    }
    slot.keysHeld -= 1;
    if (gesture === "down" || activeHorizontal !== gesture || slot.keysHeld > 0) {
      return;
    }
    // The winning key let go: the last-pressed rule hands control to whichever
    // opposite key is still held, which resumes from its frozen DAS charge —
    // releasing it fires no immediate counter-move (product brief §10.6).
    activeHorizontal = otherHeldHorizontal(gesture);
  }

  function otherHeldHorizontal(released) {
    if (released === "left") {
      return states.right.keysHeld > 0 ? "right" : null;
    }
    return states.left.keysHeld > 0 ? "left" : null;
  }

  // Each charge is the gravity accumulator pattern in miniature: only the
  // actually-moving gesture accumulates, it fires once per full interval, and
  // the remainder carries so the cadence stays exact across frame boundaries.
  function charge(gesture, deltaMs) {
    const slot = states[gesture];
    slot.timerMs += deltaMs;
    while (slot.timerMs >= slot.repeatAtMs) {
      slot.timerMs -= slot.repeatAtMs;
      slot.repeatAtMs = GESTURES[gesture].repeatMs;
      dispatch(GESTURES[gesture].action);
    }
  }

  return {
    press,
    release,
    step(deltaMs) {
      if (activeHorizontal) {
        charge(activeHorizontal, deltaMs);
      }
      if (states.down.keysHeld > 0) {
        charge("down", deltaMs);
      }
    },
    reset() {
      for (const slot of Object.values(states)) {
        slot.keysHeld = 0;
        slot.timerMs = 0;
      }
      activeHorizontal = null;
    },
  };
}