import { QUEUE_SIZE } from "../engine/bag.js";
import { PIECE_COLORS, PIECE_ROTATIONS } from "../engine/pieces.js";
import { createGridRenderer, syncCell } from "./grid-renderer.js";
import { computeGhostProjection } from "./ghost-renderer.js";
import { computeFlashProjection } from "./flash-renderer.js";
import { computeHoldSwapProjection } from "./hold-swap-renderer.js";
import { createLevelUpRenderer } from "./level-up-renderer.js";
import { createHighScoresRenderer } from "./high-scores-renderer.js";
import { createScreenManager } from "./screen-manager.js";

const NEXT_PREVIEWS = QUEUE_SIZE;
const PREVIEW_SIZE = 4;

const EMPTY_KEY = "empty:";

function buildPreviews(document, container, count) {
  const previews = [];
  for (let i = 0; i < count; i++) {
    const preview = document.createElement("div");
    preview.className = "preview";
    const cells = [];
    for (let j = 0; j < PREVIEW_SIZE * PREVIEW_SIZE; j++) {
      const cell = document.createElement("div");
      cell.className = "preview__cell";
      cell.dataset.state = "empty";
      preview.appendChild(cell);
      cells.push(cell);
    }
    container.appendChild(preview);
    previews.push({ preview, cells });
  }
  return previews;
}

function pad(value, width) {
  return String(value).padStart(width, "0");
}

function formatElapsed(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${pad(minutes, 2)}:${pad(totalSeconds % 60, 2)}`;
}

function isPreviewCellFilled(type, rotation, row, col) {
  if (!type) {
    return false;
  }
  return PIECE_ROTATIONS[type][rotation].some(
    (offset) => offset.row === row && offset.col === col
  );
}

// The preview diff key must capture the rotation as well as the type: the hold
// slot preserves a piece's rotation state, so a held piece can change rotation
// without changing type, and that repaint must not be skipped (AGENTS.md §5).
function syncPreview(type, rotation, cells, lastCells) {
  for (let i = 0; i < cells.length; i++) {
    const row = Math.floor(i / PREVIEW_SIZE);
    const col = i % PREVIEW_SIZE;
    const filled = isPreviewCellFilled(type, rotation, row, col);
    const key = filled ? `${type}:${rotation}` : EMPTY_KEY;
    lastCells[i] = syncCell(
      cells[i],
      key,
      lastCells[i],
      filled ? "filled" : "empty",
      filled ? PIECE_COLORS[type] : null
    );
  }
}

function syncPreviews(queue, previews, lastPreviews) {
  for (let i = 0; i < previews.length; i++) {
    syncPreview(queue[i] ?? null, 0, previews[i].cells, lastPreviews[i]);
  }
}

// The hold slot's dashed "empty" outline is a container-level state, so it gets
// the same remembered-value diff as the cells: the attribute is written only
// when the slot empties or fills, never on a repeated frame (AGENTS.md §5).
function syncEmptySlot(previewEl, empty, wasEmpty) {
  if (empty === wasEmpty) {
    return wasEmpty;
  }
  if (empty) {
    previewEl.dataset.empty = "true";
  } else {
    delete previewEl.dataset.empty;
  }
  return empty;
}

export function createRenderer({ document = globalThis.document, loadScores } = {}) {
  const scoreEl = document.querySelector(".js-score");
  const levelEl = document.querySelector(".js-level");
  const linesEl = document.querySelector(".js-lines");
  const finalScoreEl = document.querySelector(".js-final-score");
  const newHighScoreEl = document.querySelector(".js-new-high-score");
  const finalLinesEl = document.querySelector(".js-game-over-lines");
  const finalLevelEl = document.querySelector(".js-game-over-level");
  const tetrisesEl = document.querySelector(".js-game-over-tetrises");
  const tSpinsEl = document.querySelector(".js-game-over-t-spins");
  const maxComboEl = document.querySelector(".js-game-over-max-combo");
  const piecesPlacedEl = document.querySelector(".js-game-over-pieces");
  const elapsedEl = document.querySelector(".js-game-over-elapsed");
  const apmEl = document.querySelector(".js-game-over-apm");

  // Under prefers-reduced-motion the hard-drop flash is not drawn: the piece
  // still teleports and locks on the same timer, but the cells keep their own
  // colour for the 80 ms instead of flashing white.
  const reducedMotion =
    document.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

  const gridRenderer = createGridRenderer({ document });
  const levelUpRenderer = createLevelUpRenderer({ document });
  // `loadScores` is injected by the wiring point (src/main.js); when it is
  // undefined the viewer's own empty-list default applies.
  const highScoresRenderer = createHighScoresRenderer({ document, loadScores });
  const screenManager = createScreenManager({ document });
  const hold = buildPreviews(document, document.querySelector(".js-hold"), 1)[0];
  const next = buildPreviews(document, document.querySelector(".js-next"), NEXT_PREVIEWS);

  const last = {
    score: null,
    level: null,
    lines: null,
    finalScore: null,
    isNewHighScore: null,
    finalLines: null,
    finalLevel: null,
    tetrises: null,
    tSpins: null,
    maxCombo: null,
    piecesPlaced: null,
    elapsed: null,
    apm: null,
    hold: Array(PREVIEW_SIZE * PREVIEW_SIZE).fill(EMPTY_KEY),
    holdEmpty: null,
    next: Array.from({ length: NEXT_PREVIEWS }, () =>
      Array(PREVIEW_SIZE * PREVIEW_SIZE).fill(EMPTY_KEY)
    ),
  };

  function syncValue(el, value, key, formatter) {
    if (value !== last[key]) {
      last[key] = value;
      el.textContent = formatter(value);
    }
  }

  // The "NEW HIGH SCORE!" badge beside the final score (product brief §13).
  // Like every other per-frame mark it is diffed against a remembered value so
  // the DOM is touched once per change, never on a repeated frame
  // (AGENTS.md §5). A missing hook (older test shims) renders nothing rather
  // than throwing.
  function syncNewHighScoreBadge(show) {
    if (!newHighScoreEl || show === last.isNewHighScore) {
      return;
    }
    last.isNewHighScore = show;
    newHighScoreEl.hidden = !show;
    newHighScoreEl.textContent = show ? "NEW HIGH SCORE!" : "";
  }

  return {
    render(state) {
      screenManager.render(state.phase);
      syncValue(scoreEl, state.score, "score", (v) => pad(v, 7));
      syncValue(levelEl, state.level, "level", (v) => pad(v, 2));
      syncValue(linesEl, state.lines, "lines", (v) => pad(v, 3));
      syncValue(finalScoreEl, state.score, "finalScore", (v) => pad(v, 7));
      syncNewHighScoreBadge(state.isNewHighScore === true);
      syncValue(finalLinesEl, state.lines, "finalLines", String);
      syncValue(finalLevelEl, state.level, "finalLevel", String);
      syncValue(tetrisesEl, state.stats.tetrises, "tetrises", String);
      syncValue(tSpinsEl, state.stats.tSpins, "tSpins", String);
      syncValue(maxComboEl, state.stats.maxCombo, "maxCombo", String);
      syncValue(piecesPlacedEl, state.stats.piecesPlaced, "piecesPlaced", String);
      syncValue(elapsedEl, state.elapsedMs, "elapsed", formatElapsed);
      syncValue(apmEl, state.stats.apm, "apm", (v) => v.toFixed(1));
      gridRenderer.render(
        state.grid,
        {
          ghost: computeGhostProjection(state.activePiece, state.ghostRow),
          flash: computeFlashProjection(state.activePiece, state.dropFlash, { reducedMotion }),
          holdSwap: computeHoldSwapProjection(state.activePiece, state.holdSwap, { reducedMotion }),
        },
        state.lockDelay,
        state.activePiece ? PIECE_COLORS[state.activePiece.type] : null
      );
      syncPreviews(state.queue, next, last.next);
      const held = state.holdPiece;
      syncPreview(held?.type ?? null, held?.rotation ?? 0, hold.cells, last.hold);
      last.holdEmpty = syncEmptySlot(hold.preview, held === null, last.holdEmpty);
      levelUpRenderer.render(state.levelUp);
      highScoresRenderer.render(state);
    },
  };
}
