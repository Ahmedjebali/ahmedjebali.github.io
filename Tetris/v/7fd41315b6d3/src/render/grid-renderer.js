import { COLS, ROWS, BUFFER_ROWS } from "../engine/state.js";
import { FLASH_COLOR } from "./flash-renderer.js";

const EMPTY_KEY = "empty:";

function buildBoard(document, container) {
  const rows = [];
  for (let row = 0; row < ROWS; row++) {
    const rowEl = document.createElement("div");
    rowEl.className = `board__row${row < BUFFER_ROWS ? " board__row--buffer" : ""}`;
    const cells = [];
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      cell.className = "board__cell";
      cell.dataset.state = "empty";
      rowEl.appendChild(cell);
      cells.push(cell);
    }
    container.appendChild(rowEl);
    rows.push(cells);
  }
  return rows;
}

// The diff key must capture everything that affects a cell's appearance,
// including the ghost outline, or a cell that becomes a ghost without changing
// its model state would never repaint (AGENTS.md §5).
function cellKey(state, color) {
  return `${state}:${color ?? ""}`;
}

// Applies a cell's appearance to the DOM only when its key changed, and
// returns the key for the renderer's remembered diff. Shared by the board and
// the previews so there is one implementation of "paint one cell".
export function syncCell(el, key, lastKey, state, color) {
  if (key === lastKey) {
    return key;
  }
  el.dataset.state = state;
  if (color) {
    el.style.setProperty("--cell-color", color);
  } else {
    el.style.removeProperty("--cell-color");
  }
  return key;
}

function cellIndexes(projection) {
  const indexes = new Set();
  for (const cell of projection.cells) {
    indexes.add(cell.row * COLS + cell.col);
  }
  return indexes;
}

// Precedence (AGENTS.md §8.4): during a hard-drop flash the landing cells (still
// `active` on the model) render white; a clearing row renders white for its
// dissolve window; the hold swap's two halves render as the piece arriving on
// the board and the piece leaving it; both outrank the ghost, which only paints
// on an `empty` model cell the projection covers. The flash, the clear and the
// swap can never coincide — a clear starts only after a lock, the ghost needs an
// active piece, which is null while a clear plays, and a hold is refused while a
// flash freezes the world — but the guards make the precedence explicit rather
// than accidental. Within the swap the arriving piece wins: the two can overlap
// (the held piece respawns at the top of the board), and the piece the player
// is actually holding must not be painted as the one leaving. Clearing cells
// keep their piece colour on the model; the renderer paints them with the shared
// flash white, and the CSS shrinks them to zero height (design §7).
function diffGrid(grid, projections, cells, lastGrid) {
  const ghost = projections.ghost;
  const flash = projections.flash;
  const ghostIndexes = ghost ? cellIndexes(ghost) : null;
  const flashIndexes = flash ? cellIndexes(flash) : null;
  const swapOut = projections.holdSwap?.out ?? null;
  const swapIn = projections.holdSwap?.in ?? null;
  const swapOutIndexes = swapOut ? cellIndexes(swapOut) : null;
  const swapInIndexes = swapIn ? cellIndexes(swapIn) : null;
  for (let row = 0; row < ROWS; row++) {
    const gridRow = grid[row];
    const cellRow = cells[row];
    const lastRow = lastGrid[row];
    for (let col = 0; col < COLS; col++) {
      const model = gridRow[col];
      const index = row * COLS + col;
      const isClearing = model.state === "clearing";
      const isFlashing =
        !isClearing && flashIndexes?.has(index) && model.state === "active";
      const isSwappingIn =
        !isClearing && !isFlashing && swapInIndexes?.has(index) && model.state === "active";
      // The departing piece was legally placed, so it shares no cell with the
      // stack: it only ever claims a cell the model has already handed back.
      const isSwappingOut =
        !isClearing &&
        !isFlashing &&
        !isSwappingIn &&
        swapOutIndexes?.has(index) &&
        model.state === "empty";
      const isGhost =
        !isClearing &&
        !isFlashing &&
        !isSwappingIn &&
        !isSwappingOut &&
        ghostIndexes?.has(index) &&
        model.state === "empty";
      const state = isClearing
        ? "clearing"
        : isFlashing
          ? "flash"
          : isSwappingIn
            ? "swap-in"
            : isSwappingOut
              ? "swap-out"
              : isGhost
                ? "ghost"
                : model.state;
      const color = isClearing
        ? FLASH_COLOR
        : isFlashing
          ? flash.color
          : isSwappingIn
            ? swapIn.color
            : isSwappingOut
              ? swapOut.color
              : isGhost
                ? ghost.color
                : model.color;
      const key = cellKey(state, color);
      lastRow[col] = syncCell(cellRow[col], key, lastRow[col], state, color);
    }
  }
}

// The board-frame glow while lock delay runs is a board-level visual, so it
// gets the same remembered-key diff as the cells: the attribute and the
// piece-colour custom property are written only when the resting state
// changes, never on a repeated frame (AGENTS.md §5).
function syncLockDelay(boardEl, lockDelay, color, wasActive) {
  const active = lockDelay !== null && color !== null;
  if (active === wasActive) {
    return wasActive;
  }
  if (active) {
    boardEl.dataset.lockDelay = "active";
    boardEl.style.setProperty("--cell-color", color);
  } else {
    delete boardEl.dataset.lockDelay;
    boardEl.style.removeProperty("--cell-color");
  }
  return active;
}

export function createGridRenderer({ document = globalThis.document } = {}) {
  const boardEl = document.querySelector(".js-board");
  const cells = buildBoard(document, boardEl);
  const lastGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY_KEY));
  let lockDelayActive = false;

  return {
    // `projections` carries the transient render-layer overlays for this frame —
    // the ghost outline, the hard-drop flash and the hold swap — so the paint
    // precedence in `diffGrid` is decided in one place instead of spread over a
    // growing argument list.
    render(grid, projections, lockDelay = null, color = null) {
      diffGrid(grid, projections, cells, lastGrid);
      lockDelayActive = syncLockDelay(boardEl, lockDelay, color, lockDelayActive);
    },
  };
}
