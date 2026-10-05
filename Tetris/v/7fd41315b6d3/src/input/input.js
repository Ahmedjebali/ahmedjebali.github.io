import { createDas } from "./das.js";
import { createTouchGesture } from "./touch.js";

// One-shot action keys: each is single-press by contract (product brief §4.1).
// A physical press dispatches its command exactly once, and the OS auto-repeat
// of a held key is dropped in `handleKeydown` — a held Space must not re-hard-
// drop, a held C must not re-hold, and a held P must not bounce the pause
// toggle (brief §10.6 rapid pause/unpause). These keys are not tracked, unlike
// the movement keys: a press is complete the moment it dispatches.
const KEY_COMMANDS = {
  ArrowUp: "rotate_cw",
  KeyW: "rotate_cw",
  KeyZ: "rotate_ccw",
  Space: "hard_drop",
  KeyC: "hold",
  ShiftLeft: "hold",
  ShiftRight: "hold",
  KeyP: "pause",
  Escape: "pause",
};

// Movement keys are DAS-tracked (product brief §4.1): the input layer records
// their press/release and turns held state into a timed stream of commands.
// A and D mirror the arrows, S mirrors soft drop. Each entry names only the
// gesture it drives; the gesture, in turn, owns the action and DAS timing.
const MOVEMENT_KEYS = {
  ArrowLeft: { gesture: "left" },
  KeyA: { gesture: "left" },
  ArrowRight: { gesture: "right" },
  KeyD: { gesture: "right" },
  ArrowDown: { gesture: "down" },
  KeyS: { gesture: "down" },
};

const SCROLL_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

// Tab is exempt from the any-key splash start: it must keep moving focus to
// the menu's buttons, not begin a game the player never asked for.
const NAVIGATION_KEYS = new Set(["Tab"]);

// Every on-screen control is a real <button> that dispatches the same command
// the keyboard uses (frontend-rules §5). Each is blurred after a click so
// Space/Enter cannot re-trigger it mid-game.
const BUTTON_COMMANDS = [
  { selector: ".js-start", action: "start_game" },
  { selector: ".js-open-how-to-play", action: "how_to_play" },
  { selector: ".js-open-high-scores", action: "show_high_scores" },
  { selector: ".js-close-high-scores", action: "dismiss_overlay" },
  { selector: ".js-clear-records", action: "confirm_clear_scores" },
  { selector: ".js-cancel-clear", action: "dismiss_overlay" },
  { selector: ".js-confirm-clear-action", action: "clear_scores" },
  { selector: ".js-pause-how-to-play", action: "how_to_play" },
  { selector: ".js-close-how-to-play", action: "dismiss_overlay" },
  { selector: ".js-play-again", action: "play_again" },
  { selector: ".js-quit-to-menu", action: "quit_to_menu" },
  { selector: ".js-pause-quit-to-menu", action: "confirm_quit_to_menu" },
  { selector: ".js-cancel-quit", action: "dismiss_overlay" },
  { selector: ".js-confirm-quit-action", action: "quit_to_menu" },
  { selector: ".js-touch-rotate", action: "rotate_cw" },
  { selector: ".js-touch-hard-drop", action: "hard_drop" },
  { selector: ".js-touch-hold", action: "hold" },
];

// DAS touch buttons use Pointer Events for hold-to-repeat (§4.1):
// pointerdown fires the initial command and starts the DAS timer;
// pointerup/pointercancel/lostpointercapture stops the repeat — mirroring
// keyboard press/release. Pointer Events unify mouse, touch, and pen input
// and handle capture loss, release outside, and cancellation reliably.
const DAS_TOUCH_BUTTONS = [
  { selector: ".js-touch-left", gesture: "left" },
  { selector: ".js-touch-right", gesture: "right" },
  { selector: ".js-touch-down", gesture: "down" },
];

export function createInput(engine, { document = globalThis.document } = {}) {
  // DAS runs on main.js's single rAF loop: `step()` receives the same frame
  // delta as `engine.step()`, so held movement repeats without a timer of the
  // input layer's own (AGENTS.md §2, adr/0001).
  const dispatch = (action) => engine.command({ action });
  const das = createDas({ dispatch });
  const touchGesture = createTouchGesture({ dispatch, document, now: Date.now });

  // Tab-hide auto-pause (brief §10.6): a browser Page Visibility API listener
  // reports the page losing visibility as the distinct `auto_pause` command,
  // not the `pause` toggle — the input layer knows nothing about phases, so the
  // engine alone decides that hiding pauses a live game and never resumes one
  // (AGENTS.md §2). Checking `=== "hidden"` ignores the matching event fired on
  // regain, which is the whole "return to the tab and the game stays paused".
  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      engine.command({ action: "auto_pause" });
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // A focused <button> is activated by the browser on Space/Enter, so those two
  // keydowns must not also dispatch a command — pressing Space on "How to Play"
  // would start the game instead of opening the overlay. Every other key on a
  // focused button still reaches the engine: Escape must close the how-to-play
  // overlay even when the Close button has focus (frontend-rules §5).
  function handleKeydown(event) {
    if (
      (event.code === "Space" || event.code === "Enter") &&
      event.target?.closest?.("button")
    ) {
      return;
    }
    const movement = MOVEMENT_KEYS[event.code];
    if (movement) {
      // The OS auto-repeats a held key as a stream of keydowns; DAS owns that
      // repetition with its own delay and cadence, so repeat events are ignored
      // completely (honouring them would double the rate and re-fire the
      // one-per-press tap move).
      if (event.repeat) {
        return;
      }
      if (SCROLL_KEYS.has(event.code)) {
        event.preventDefault();
      }
      das.press(movement.gesture);
      return;
    }
    const action = KEY_COMMANDS[event.code];
    if (action) {
      // Single-press keys: drop OS key-repeat events so a held key never
      // streams. This is what keeps a held P a single toggle instead of a
      // bounce, and a held Space a one-shot hard drop (brief §4.1, §10.6).
      if (event.repeat) {
        return;
      }
      if (SCROLL_KEYS.has(event.code)) {
        event.preventDefault();
      }
      engine.command({ action });
      return;
    }
    // The menu is a splash screen (brief §2.9): any key starts the game. Input
    // knows nothing about phases, so an unmatched key becomes a distinct
    // `any_key` action the engine phase-gates — from `menu` it starts the game,
    // elsewhere it is silently ignored.
    if (!NAVIGATION_KEYS.has(event.code)) {
      engine.command({ action: "any_key" });
    }
  }

  // A held movement key must be releasable (frontend-rules §5): keyup hands
  // the held state back to Das, which stops the repeats — and, when the last
  // key of a direction lifts, either resumes the still-held opposite direction
  // or goes silent.
  function handleKeyup(event) {
    const movement = MOVEMENT_KEYS[event.code];
    if (movement) {
      das.release(movement.gesture);
    }
  }

  const unbindButtons = BUTTON_COMMANDS.flatMap(({ selector, action }) => {
    const element = document.querySelector(selector);
    if (!element) {
      return [];
    }
    function handleClick() {
      engine.command({ action });
      element.blur();
    }
    element.addEventListener("click", handleClick);
    return () => element.removeEventListener("click", handleClick);
  });

  const unbindDasButtons = DAS_TOUCH_BUTTONS.flatMap(({ selector, gesture }) => {
    const element = document.querySelector(selector);
    if (!element) {
      return [];
    }
    // Track which pointerId owns this gesture so pointerup + lostpointercapture
    // (both fired by Chrome for captured pointers released outside) only release
    // the DAS hold once, keeping keyboard DAS intact.
    let activePointerId = null;
     function handlePointerDown(event) {
       if (activePointerId !== null) {
         return;
       }
       event.preventDefault();
       activePointerId = event.pointerId;
       element.setPointerCapture(event.pointerId);
       das.press(gesture);
     }
    function releaseIfOwned(event) {
      if (activePointerId === null) {
        return;
      }
      if (
        event.pointerId !== undefined &&
        event.pointerId !== activePointerId
      ) {
        return;
      }
      activePointerId = null;
      das.release(gesture);
    }
    function handleClick(e) {
      e.preventDefault();
    }
    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointerup", releaseIfOwned);
    element.addEventListener("pointercancel", releaseIfOwned);
    element.addEventListener("lostpointercapture", releaseIfOwned);
    element.addEventListener("click", handleClick);
    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointerup", releaseIfOwned);
      element.removeEventListener("pointercancel", releaseIfOwned);
      element.removeEventListener("lostpointercapture", releaseIfOwned);
      element.removeEventListener("click", handleClick);
    };
  });

  // The two informational overlays share one backdrop handler: a click whose
  // target is the overlay element itself — not its panel — closes it. Neither
  // confirmation dialog is on that list: a stray click on the dim backdrop must
  // not be able to answer a question about an irreversible action, so those
  // close on their own Cancel, their own action, or Escape only.
  const dismissibleOverlays = [".js-how-to-play", ".js-high-scores"]
    .map((selector) => document.querySelector(selector))
    .filter((el) => el !== null);
  function handleBackdropClick(event) {
    if (dismissibleOverlays.includes(event.target)) {
      engine.command({ action: "dismiss_overlay" });
    }
  }
  for (const overlayEl of dismissibleOverlays) {
    overlayEl.addEventListener("click", handleBackdropClick);
  }

  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);

  return {
    // Advance the DAS timers by the frame delta. Called from the same loop in
    // main.js that steps the engine; the engine phase-gates whatever commands
    // the repeats produce, so the input layer never needs to know the phase.
    step(deltaMs) {
      das.step(deltaMs);
    },
    destroy() {
      for (const unbind of unbindButtons) {
        unbind();
      }
      for (const unbind of unbindDasButtons) {
        unbind();
      }
      das.reset();
      touchGesture.destroy();
      for (const overlayEl of dismissibleOverlays) {
        overlayEl.removeEventListener("click", handleBackdropClick);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("keyup", handleKeyup);
    },
  };
}