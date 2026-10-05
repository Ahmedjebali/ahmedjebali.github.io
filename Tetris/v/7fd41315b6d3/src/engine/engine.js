import { fillQueue, drawNext } from "./bag.js";
import {
  createActivePiece,
  getCellsFor,
  getPieceCells,
  PIECE_COLORS,
  PIECE_ROTATIONS,
  spawnRowFor,
  WALL_KICKS,
} from "./pieces.js";
import { canPlace } from "./collision.js";
import { computeGhostRow } from "./ghost.js";
import {
  LINE_CLEAR_MS,
  collapseClearedRows,
  findFullRows,
  markClearingRows,
} from "./line-clearing.js";
import { addScore, clearTypeFor, comboPoints, isQualifyingClear, lineClearPoints } from "./scoring.js";
import { createInitialState } from "./state.js";
import { LEVEL_UP_MS, gravityForLevel, levelForLines } from "./level.js";
import { detectTSpin } from "./t-spin.js";

const LOCK_DELAY_MS = 500;
const MAX_LOCK_RESETS = 15;
const DROP_FLASH_MS = 80;
const HOLD_SWAP_MS = 150;
const HARD_DROP_POINTS_PER_CELL = 2;
const SOFT_DROP_POINTS_PER_CELL = 1;
const APM_ACTIONS = new Set([
  "move_left",
  "move_right",
  "soft_drop",
  "rotate_cw",
  "rotate_ccw",
  "hard_drop",
]);

function syncApm(state) {
  const elapsedMinutes = state.elapsedMs / 60000;
  state.stats.apm = elapsedMinutes > 0
    ? state.stats.totalInputActions / elapsedMinutes
    : 0;
}

function advanceElapsed(state, deltaMs) {
  state.elapsedMs += deltaMs;
  syncApm(state);
}

function recordInputAction(state, action) {
  if (!APM_ACTIONS.has(action)) {
    return;
  }
  state.stats.totalInputActions += 1;
  syncApm(state);
}

// Ghost projection depends on the piece's position, so it is refreshed at the
// two choke points every mutation flows through: after each command and at the
// end of each tick. This is what keeps `ghostRow` current after a move, rotate
// or drop rather than only on the gravity tick (AGENTS.md §8.6).
function syncGhostRow(state) {
  state.ghostRow = computeGhostRow(state.grid, state.activePiece);
}

function syncActiveCells(state) {
  const { grid } = state;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.state === "active") {
        cell.state = "empty";
        cell.color = null;
      }
    }
  }
  if (!state.activePiece) {
    return;
  }
  const color = PIECE_COLORS[state.activePiece.type];
  for (const cell of getPieceCells(state.activePiece)) {
    if (
      cell.row >= 0 &&
      cell.row < grid.length &&
      cell.col >= 0 &&
      cell.col < grid[0].length
    ) {
      grid[cell.row][cell.col].state = "active";
      grid[cell.row][cell.col].color = color;
    }
  }
}

function spawnNextPiece(state, random) {
  const type = drawNext(state, random);
  const piece = createActivePiece(type);
  // A spawn hands the board to a new piece, so a hold-swap slide still running
  // belonged to the piece that just left: close it here rather than slide the
  // new piece in from the left (the same reset point as `holdUsed`, AGENTS.md
  // §4 — the swap path sets a window and never spawns).
  state.holdSwap = null;
  if (!canPlace(state.grid, getPieceCells(piece))) {
    state.phase = "game_over";
    // APM is totalInputActions ÷ elapsed minutes, recomputed here so the
    // game-over summary reads the final value even if play time was set
    // without passing through a tick or command (AGENTS.md §4 — stats live
    // on state, and the engine is their only writer).
    syncApm(state);
    // A pending level-up banner has nothing to celebrate over a frozen board:
    // it is cleared with the game so it cannot linger on the game-over screen.
    state.levelUp = null;
    return;
  }
  state.activePiece = piece;
  state.softDropDistance = 0;
  state.holdUsed = false;
  state.gravityAccumMs = 0;
  state.lockDelay = null;
}

function canMoveDown(state) {
  const piece = state.activePiece;
  const below = getCellsFor(piece.type, piece.rotation, piece.col, piece.row + 1);
  return canPlace(state.grid, below);
}

// Two visual windows run alongside play instead of freezing it: the level-up
// banner and the hold-swap slide. Both count down in parallel with gravity and
// with piece commands; paused time is excluded because `step()` calls this
// behind the phase gate.
function advanceVisualWindows(state, deltaMs) {
  if (state.levelUp) {
    state.levelUp.timerMs -= deltaMs;
    if (state.levelUp.timerMs <= 0) {
      state.levelUp = null;
    }
  }
  if (state.holdSwap) {
    state.holdSwap.timerMs -= deltaMs;
    if (state.holdSwap.timerMs <= 0) {
      state.holdSwap = null;
    }
  }
}

function advanceGravity(state, deltaMs) {
  if (!state.activePiece) {
    return;
  }
  state.gravityAccumMs += deltaMs;
  while (state.gravityAccumMs >= state.gravityMs) {
    state.gravityAccumMs -= state.gravityMs;
    const piece = state.activePiece;
    const below = getCellsFor(piece.type, piece.rotation, piece.col, piece.row + 1);
    if (!canPlace(state.grid, below)) {
      state.gravityAccumMs = 0;
      return;
    }
    piece.row += 1;
  }
}

function lockPiece(state, random, notify) {
  // Captured before the merge: `spawnNextPiece` below can end the game (the
  // next piece cannot spawn), and the lock click must still play — the lock
  // itself happened while `playing`, whatever phase the spawn failure leaves
  // behind (see the `phase` fallback in the audio subscriber).
  const priorPhase = state.phase;
  const piece = state.activePiece;
  const isTSpin = detectTSpin(state.grid, piece);
  const color = PIECE_COLORS[piece.type];
  for (const cell of getPieceCells(piece)) {
    state.grid[cell.row][cell.col].state = "locked";
    state.grid[cell.row][cell.col].color = color;
  }
  state.activePiece = null;
  state.lockDelay = null;
  state.stats.piecesPlaced += 1;
  // Soft-drop points are awarded once, at lock, alongside any line-clear
  // points, through the same clamped setter every other award uses so the
  // score can never exceed the 9,999,999 cap; the accumulator then resets for
  // the next piece (AGENTS.md §4).
  addScore(state, state.softDropDistance * SOFT_DROP_POINTS_PER_CELL);
  state.softDropDistance = 0;
  // A lock that completes a row opens the 120 ms dissolve window instead of
  // spawning immediately; the next piece waits until the rows collapse.
  // If no rows were cleared, the combo chain is broken and resets to 0, and
  // the back-to-back flag is disarmed — a qualifying clear (Tetris or T-Spin)
  // is the only way to re-arm it.
  if (!startLineClear(state, isTSpin)) {
    state.combo = 0;
    state.backToBack = false;
    spawnNextPiece(state, random);
    if (notify) notify({ action: "lock", state, phase: priorPhase });
    return;
  }
  // A T-Spin that cleared nothing opens no dissolve window, so its next piece
  // spawns immediately rather than waiting for a collapse.
  if (!state.clearAnimation) {
    spawnNextPiece(state, random);
  }
  if (notify) notify({ action: "lock", state, phase: priorPhase });
}

// Level derives from total lines cleared. When a clear crosses a 10-line
// boundary the level ticks up, gravity follows the speed table, and the
// 1.5 s level-up window opens so the render layer can play the flash and
// "LEVEL UP!" banner. The flag is cleared when the window expires in `step()`.
function advanceLevel(state) {
  const nextLevel = levelForLines(state.lines);
  if (nextLevel <= state.level) {
    return;
  }
  state.level = nextLevel;
  state.gravityMs = gravityForLevel(nextLevel);
  state.levelUp = { timerMs: LEVEL_UP_MS };
}

// Marks every full row as clearing and opens the dissolve window. Awards the
// NES-style table value (× the current level) at the moment of detection and
// returns whether the caller should defer the spawn — true when a dissolve
// window opened, false for a plain no-clear lock. Also handles combo chain
// scoring: increments the combo counter, updates maxCombo, and awards
// 50 × combo × level bonus points. Back-to-back scoring: a qualifying clear
// (Tetris, or a T-Spin — the three-corner test already ran in `lockPiece`)
// arms the flag, and the *next* qualifying clear earns 1.5× its base points.
// The multiplier is computed from the flag's prior value, so the first
// qualifying clear of a run scores full value and the flag is re-armed for the
// next; a non-qualifying clear re-arms nothing, and a no-clear lock disarms in
// `lockPiece`.
// A T-Spin that clears no rows scores its 400 × level and arms the flag but
// opens no dissolve window — no rows to collapse — and is not a line clear, so
// it resets the combo chain (product brief §6). Every scoring lock publishes a
// `lastClearEvent` for Audio/Render to consume for one tick.
function startLineClear(state, isTSpin) {
  const rows = findFullRows(state.grid);
  if (rows.length === 0 && !isTSpin) {
    return false;
  }
  if (rows.length === 4) {
    state.stats.tetrises += 1;
  }
  if (isTSpin) {
    state.stats.tSpins += 1;
  }
  const qualifies = isQualifyingClear(rows.length, isTSpin);
  const points = lineClearPoints(rows.length, state.level, {
    isTSpin,
    backToBack: qualifies && state.backToBack,
  });
  addScore(state, points);
  state.backToBack = qualifies;
  if (rows.length === 0) {
    state.combo = 0;
  } else {
    state.combo += 1;
    if (state.combo > state.stats.maxCombo) {
      state.stats.maxCombo = state.combo;
    }
    addScore(state, comboPoints(state.combo, state.level));
    markClearingRows(state.grid, rows);
    state.lines += rows.length;
    advanceLevel(state);
    state.clearAnimation = { timerMs: LINE_CLEAR_MS, rows };
  }
  state.lastClearEvent = {
    clearType: clearTypeFor(rows.length, isTSpin),
    rowsCleared: rows,
    comboCount: state.combo,
    backToBack: qualifies,
    pointsAwarded: points,
    tSpinDetected: isTSpin,
  };
  return true;
}

function startLockDelay(state) {
  state.lockDelay = { active: true, timerMs: LOCK_DELAY_MS, resetsUsed: 0 };
}

// Counts a resting piece's window down each playing step and locks on expiry.
// An airborne piece never holds a window.
function updateLockDelay(state, deltaMs, random, notify) {
  if (canMoveDown(state)) {
    state.lockDelay = null;
    return;
  }
  if (!state.lockDelay) {
    startLockDelay(state);
    return;
  }
  state.lockDelay.timerMs -= deltaMs;
  if (state.lockDelay.timerMs <= 0) {
    lockPiece(state, random, notify);
  }
}

// A successful move or rotate may change whether the piece rests: an airborne
// placement clears the window, a freshly resting one starts it, and a resting
// piece inside its window gets the timer reset, capped at 15 resets.
function reconcileLockDelay(state) {
  if (canMoveDown(state)) {
    state.lockDelay = null;
    return;
  }
  if (!state.lockDelay) {
    startLockDelay(state);
    return;
  }
  if (state.lockDelay.resetsUsed < MAX_LOCK_RESETS) {
    state.lockDelay.timerMs = LOCK_DELAY_MS;
    state.lockDelay.resetsUsed += 1;
  }
}

function applyMove(state, dCol, dRow) {
  const piece = state.activePiece;
  const cells = getCellsFor(piece.type, piece.rotation, piece.col + dCol, piece.row + dRow);
  if (!canPlace(state.grid, cells)) {
    return false;
  }
  piece.col += dCol;
  piece.row += dRow;
  reconcileLockDelay(state);
  return true;
}

// Returns whether the rotation was applied: true when a kick position fits,
// false when all five candidates collide (adr/0002 — "rejected (state
// unchanged)").
function applyRotation(state, direction) {
  const piece = state.activePiece;
  const from = piece.rotation;
  const to = (from + direction + 4) % 4;
  const kicks = WALL_KICKS[piece.type][direction === 1 ? "cw" : "ccw"][from];
  for (const [dCol, dRow] of kicks) {
    const cells = getCellsFor(piece.type, to, piece.col + dCol, piece.row + dRow);
    if (canPlace(state.grid, cells)) {
      piece.rotation = to;
      piece.col += dCol;
      piece.row += dRow;
      piece.cells = PIECE_ROTATIONS[piece.type][to].map((offset) => ({ ...offset }));
      reconcileLockDelay(state);
      return true;
    }
  }
  return false;
}

// A hard drop teleports the piece straight to its landing row — the same row
// the ghost projects — scores 2 points per cell travelled (through the clamped
// score setter, so a near-cap drop cannot push the score past 9,999,999), and
// opens the 80 ms flash window. The merge into the grid happens when the
// window expires in `step()`, not here: the piece sits active at the landing
// row while it flashes white, and the engine owns that timer (AGENTS.md §4).
// Any resting lock-delay window is superseded: the drop schedules the lock
// itself, so the pulsing glow has nothing left to count down and must not
// linger on the piece.
function hardDrop(state) {
  const piece = state.activePiece;
  const landingRow = computeGhostRow(state.grid, piece);
  const distance = landingRow - piece.row;
  addScore(state, distance * HARD_DROP_POINTS_PER_CELL);
  piece.row = landingRow;
  state.lockDelay = null;
  state.dropFlash = { timerMs: DROP_FLASH_MS };
  return true;
}

// A fresh-state transition: the whole object is replaced with a pristine game
// and dropped into the given phase. Both entry points — a fresh game and a quit
// to menu — must reset every field, and sharing one helper keeps them identical.
function resetTo(state, phase) {
  Object.assign(state, createInitialState(), { phase });
}

function startGame(state) {
  resetTo(state, "playing");
  return true;
}

function quitToMenu(state) {
  resetTo(state, "menu");
  return true;
}

function openHowToPlay(state) {
  state.overlayReturnPhase = state.phase;
  state.phase = "how_to_play";
  return true;
}

function openConfirmQuit(state) {
  state.overlayReturnPhase = state.phase;
  state.phase = "confirm_quit";
  return true;
}

// The high-scores viewer (PROJ-32) follows the how-to-play overlay pattern:
// it records where it was opened from and returns there on dismiss. It opens
// from the main menu only. Opening it also re-arms the clear flag: a board the
// player emptied earlier in this session must be read from storage again, or a
// score won since the clear would never appear.
function openHighScores(state) {
  state.overlayReturnPhase = state.phase;
  state.phase = "high_scores";
  state.highScoresCleared = false;
  return true;
}

// "Clear All Records" is a two-step action (product brief §13), so the ask is a
// phase of its own like the quit-confirmation dialog: it records the viewer it
// covers and a dismiss returns to it. Nothing is destroyed here — only the
// confirmed half below deletes.
function openConfirmClearScores(state) {
  state.overlayReturnPhase = state.phase;
  state.phase = "confirm_clear_scores";
  return true;
}

// The confirmed half: returning to the viewer is the same transition Cancel
// makes, plus the flag that empties the view. Persisting the clear is the
// wiring point's job — the engine never touches storage (AGENTS.md §2) — and
// the flag is what makes the view agree with the player's choice even when the
// localStorage write fails silently.
function applyClearScores(state) {
  dismissOverlay(state);
  state.highScoresCleared = true;
  return true;
}

function dismissOverlay(state) {
  state.phase = state.overlayReturnPhase ?? "menu";
  state.overlayReturnPhase = null;
  return true;
}

// Hold stores the active piece (its type and rotation) in the hold slot. An
// empty slot then draws the next queue piece; a filled slot swaps the two
// pieces instead, each keeping the rotation it held. Only the swap opens the
// 150 ms slide window — with an empty slot nothing comes back onto the board
// (the next queue piece spawns from the top), so there is no exchange to show.
// A swap whose held piece would overlap a locked cell at its spawn position is
// rejected outright — the active piece continues and `holdUsed` is left
// untouched. `holdUsed` is the once-per-drop gate: only a piece that spawned
// from the queue may be held, so a successful hold always sets it true and
// `spawnNextPiece` is the only place it ever resets (AGENTS.md §4 — reset it
// only on a queue spawn, not on a swap). Returns whether the hold was applied:
// `false` for the twice-gated cases (already held this piece, or the held piece
// cannot spawn), `true` otherwise.
function applyHold(state, random) {
  if (state.holdUsed) {
    return false;
  }
  const current = state.activePiece;
  if (!state.holdPiece) {
    state.holdPiece = { type: current.type, rotation: current.rotation };
    state.activePiece = null;
    spawnNextPiece(state, random);
    state.holdUsed = true;
    return true;
  }
  const held = createActivePiece(state.holdPiece.type, state.holdPiece.rotation);
  held.row = spawnRowFor(held.type, held.rotation);
  if (!canPlace(state.grid, getPieceCells(held))) {
    return false;
  }
  state.holdPiece = { type: current.type, rotation: current.rotation };
  state.activePiece = held;
  state.softDropDistance = 0;
  state.holdUsed = true;
  state.gravityAccumMs = 0;
  state.lockDelay = null;
  // The exchange is visible for 150 ms (product brief §8.4): the departing piece
  // slides off the board to the left while the piece out of the hold slot slides
  // in from it. The window is engine-owned like the drop flash and the level-up
  // banner, and it does not freeze the world — the swap itself is already
  // applied above, so play continues under the slide. `outgoing` records where
  // the departing piece stood because the board now belongs to the held piece:
  // by the first frame that sees this window the model no longer knows.
  state.holdSwap = {
    timerMs: HOLD_SWAP_MS,
    outgoing: {
      type: current.type,
      rotation: current.rotation,
      row: current.row,
      col: current.col,
    },
  };
  return true;
}

// Pause is the player's "step out of the current screen" key (P or Escape).
// While playing it freezes the world, while paused it resumes, and inside the
// how-to-play, high-scores or confirm-quit overlays it is the Escape-close the
// brief's §3.2 calls for — the overlay returns to the phase it was opened from.
// Inside the clear-confirmation it is Escape = Cancel: no records are touched.
function togglePause(state) {
  if (
    state.phase === "how_to_play" ||
    state.phase === "high_scores" ||
    state.phase === "confirm_quit" ||
    state.phase === "confirm_clear_scores"
  ) {
    dismissOverlay(state);
    return true;
  }
  state.phase = state.phase === "playing" ? "paused" : "playing";
  return true;
}

// Tab-hide auto-pause (brief §10.6 "Tab hidden / visibility change") is a
// one-way transition, deliberately not `togglePause`: the tab backgrounding a
// live game pauses it, but regaining visibility must never auto-resume — the
// player resumes with P or Escape. The phase gate to `playing` alone makes it
// a no-op from `paused`, `menu`, an overlay or `game_over`, so no duplicate
// toggle can fire when the tab hides a game the player already paused.
function autoPause(state) {
  state.phase = "paused";
  return true;
}

// The menu is a splash screen (brief §2.9): any key starts the game. The
// gameplay actions and `pause` are remapped to `start_game` when issued from
// the menu, and every other key arrives as the distinct `any_key` action
// (dispatched by the input layer, which never asks which screen is showing) —
// so the engine stays the only place that knows phase rules.
const SPLASH_START_ACTIONS = new Set([
  "move_left",
  "move_right",
  "soft_drop",
  "rotate_cw",
  "rotate_ccw",
  "hard_drop",
  "hold",
  "pause",
]);

const COMMANDS = {
  move_left: {
    phases: ["playing"],
    requiresPiece: true,
    run: (state) => applyMove(state, -1, 0),
  },
  move_right: {
    phases: ["playing"],
    requiresPiece: true,
    run: (state) => applyMove(state, 1, 0),
  },
  soft_drop: {
    phases: ["playing"],
    requiresPiece: true,
    run: (state) => {
      // Each cell the move actually travels counts toward the piece's soft-drop
      // distance; a rejected drop adds nothing (AGENTS.md §8.2). The move's
      // outcome is the command's: a drop with no cell below is rejected
      // (adr/0002) and must not reach subscribers.
      const moved = applyMove(state, 0, 1);
      if (moved) {
        state.softDropDistance += 1;
      }
      return moved;
    },
  },
  rotate_cw: {
    phases: ["playing"],
    requiresPiece: true,
    run: (state) => applyRotation(state, 1),
  },
  rotate_ccw: {
    phases: ["playing"],
    requiresPiece: true,
    run: (state) => applyRotation(state, -1),
  },
  hard_drop: {
    phases: ["playing"],
    requiresPiece: true,
    run: (state) => hardDrop(state),
  },
  hold: {
    phases: ["playing"],
    requiresPiece: true,
    run: (state, random) => applyHold(state, random),
  },
  start_game: { phases: ["menu", "playing"], run: startGame },
  // The catch-all for the splash screen: the input layer turns every unmapped
  // key (letters, Enter, digits, …) into `any_key`, and from `menu` that is a
  // start; everywhere else it is silently ignored (brief §10.1 "any key").
  any_key: { phases: ["menu"], run: startGame },
  play_again: { phases: ["game_over"], run: startGame },
  quit_to_menu: {
    phases: ["game_over", "confirm_quit"],
    run: quitToMenu,
  },
  confirm_quit_to_menu: { phases: ["paused"], run: openConfirmQuit },
  how_to_play: { phases: ["menu", "paused"], run: openHowToPlay },
  show_high_scores: { phases: ["menu"], run: openHighScores },
  confirm_clear_scores: { phases: ["high_scores"], run: openConfirmClearScores },
  clear_scores: { phases: ["confirm_clear_scores"], run: applyClearScores },
  dismiss_overlay: {
    phases: ["how_to_play", "high_scores", "confirm_quit", "confirm_clear_scores"],
    run: dismissOverlay,
  },
  pause: {
    phases: ["playing", "paused", "how_to_play", "high_scores", "confirm_quit", "confirm_clear_scores"],
    run: togglePause,
  },
  // Synthesised by the input layer when the tab loses visibility; the engine
  // gates it to `playing` so the same "tab hid" event cannot resume a game the
  // player already paused or start one from the menu (AGENTS.md §2 — input
  // reports the browser fact, the engine owns the phase rule).
  auto_pause: { phases: ["playing"], run: autoPause },
};

// Returns whether the command was applied. Every handler reports that itself:
// a move blocked by a wall or floor, a rotation whose wall kicks all fail, a
// soft drop with no cell below, and a rejected hold return `false`; every other
// handler returns `true`. `command` notifies subscribers only on this path —
// adr/0002 contracts a rejected command as "ignored (state unchanged)", so an
// event for one would describe a move or drop that never happened. Past the
// phase/piece gates above, `recordInputAction` still counts the attempt before
// the handler runs: APM measures input, not board changes.
function applyCommand(state, command, random) {
  const action =
    state.phase === "menu" && SPLASH_START_ACTIONS.has(command.action)
      ? "start_game"
      : command.action;
  const entry = COMMANDS[action];
  if (!entry || !entry.phases.includes(state.phase)) {
    return false;
  }
  if (entry.requiresPiece && (!state.activePiece || state.dropFlash)) {
    // Nothing to act on, or the piece is frozen mid hard-drop flash and is no
    // longer controllable until it locks.
    return false;
  }
  recordInputAction(state, action);
  const applied = entry.run(state, random);
  syncActiveCells(state);
  syncGhostRow(state);
  return applied;
}

export function createEngine(initialState, { random = Math.random } = {}) {
  const state = initialState;
  const subscribers = [];

  function subscribe(fn) {
    subscribers.push(fn);
    return () => {
      const i = subscribers.indexOf(fn);
      if (i !== -1) subscribers.splice(i, 1);
    };
  }

  function notify(event) {
    for (const fn of subscribers) {
      try {
        fn(event);
      } catch {
        // silent — audio failures must never break the engine
      }
    }
  }

  return {
    getState() {
      return state;
    },

    command(command) {
      const priorPhase = state.phase;
      const accepted = applyCommand(state, command, random);
      if (accepted) {
        notify({ action: command.action, state, phase: priorPhase });
      }
      return state;
    },

    step(deltaMs) {
      if (state.phase !== "playing") {
        return;
      }
      // lastClearEvent is a one-tick flag (api-spec `ClearEvent`): whatever
      // clear the previous tick detected was read by the render that followed
      // it, so this tick starts fresh. Only a scoring lock inside this tick can
      // set it again.
      state.lastClearEvent = null;
      // The level-up banner and the hold-swap slide float over live play, so
      // their windows count down in parallel with gravity and with the
      // freeze-and-wait clear/flash windows below instead of stopping the world.
      // Paused time is still excluded — this line sits behind the phase gate.
      advanceVisualWindows(state, deltaMs);
      // A line-clear dissolve freezes the world for its 120 ms just like the
      // hard-drop flash does: no gravity, no lock delay, no queue filling, and
      // no commands that need a piece (there is none). When the window expires
      // the cleared rows collapse and the next queue piece spawns.
      if (state.clearAnimation) {
        advanceElapsed(state, deltaMs);
        state.clearAnimation.timerMs -= deltaMs;
        if (state.clearAnimation.timerMs <= 0) {
          state.grid = collapseClearedRows(state.grid, state.clearAnimation.rows);
          state.clearAnimation = null;
          spawnNextPiece(state, random);
        }
        syncGhostRow(state);
        syncActiveCells(state);
        notify({ step: true, state });
        return;
      }
      // A hard-drop flash freezes the world for its 80 ms: gravity and lock
      // delay stay off, no queue fills, and piece commands are ignored. When
      // the window expires the piece locks and the next piece spawns.
      if (state.dropFlash) {
        advanceElapsed(state, deltaMs);
        state.dropFlash.timerMs -= deltaMs;
        if (state.dropFlash.timerMs <= 0) {
          state.dropFlash = null;
          lockPiece(state, random, notify);
        }
        syncGhostRow(state);
        syncActiveCells(state);
        notify({ step: true, state });
        return;
      }
      fillQueue(state, random);
      if (!state.activePiece) {
        spawnNextPiece(state, random);
      }
      if (state.phase === "playing") {
        advanceElapsed(state, deltaMs);
        advanceGravity(state, deltaMs);
        if (state.activePiece) {
          updateLockDelay(state, deltaMs, random, notify);
        }
      }
      syncGhostRow(state);
      syncActiveCells(state);
      notify({ step: true, state });
    },
    subscribe,
  };
}
