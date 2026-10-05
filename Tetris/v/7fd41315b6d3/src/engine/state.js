export const COLS = 10;
export const ROWS = 22;
export const BUFFER_ROWS = 2;
export const VISIBLE_ROWS = ROWS - BUFFER_ROWS;

export function createEmptyCell() {
  return { color: null, state: "empty" };
}

export function createEmptyRow() {
  return Array.from({ length: COLS }, createEmptyCell);
}

export function createEmptyGrid() {
  return Array.from({ length: ROWS }, createEmptyRow);
}

export function createInitialState() {
  return {
    phase: "menu",
    overlayReturnPhase: null,
    score: 0,
    level: 1,
    lines: 0,
    grid: createEmptyGrid(),
    activePiece: null,
    ghostRow: null,
    holdPiece: null,
    holdUsed: false,
    queue: [],
    bag: [],
    lockDelay: null,
    dropFlash: null,
    clearAnimation: null,
    levelUp: null,
    holdSwap: null,
    combo: 0,
    backToBack: false,
    softDropDistance: 0,
    gravityMs: 1000,
    gravityAccumMs: 0,
    elapsedMs: 0,
    stats: {
      piecesPlaced: 0,
      tetrises: 0,
      tSpins: 0,
      maxCombo: 0,
      totalInputActions: 0,
      apm: 0,
    },
    lastClearEvent: null,
    isNewHighScore: false,
    highScoresCleared: false,
  };
}
