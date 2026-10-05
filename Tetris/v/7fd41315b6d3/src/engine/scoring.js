// The hard cap on the score. The product brief says the score "wraps" at this
// value, but this slice's acceptance criteria are explicit that points beyond
// it are discarded, not carried around to 0 — the ticket wins (AGENTS.md §10).
export const MAX_SCORE = 9999999;

// NES-style points per line clear before the level multiplier. Indexed by the
// number of rows cleared, so a tetris is `LINE_CLEAR_BASE_POINTS[4] × level`.
export const LINE_CLEAR_BASE_POINTS = [0, 100, 300, 500, 800];

// Points per T-Spin before the level multiplier (product brief §6). Indexed by
// the number of rows cleared: a T-Spin that clears nothing still scores, and
// the T piece can complete at most three rows, so the table stops at 1600.
export const T_SPIN_BASE_POINTS = [400, 800, 1200, 1600];

// Whether a clear arms the back-to-back chain. Only a Tetris (4 rows) or a
// T-Spin qualifies; singles, doubles and triples never do. `rowsCleared` 0 can
// qualify too, because a T-Spin that clears no lines still counts (product
// brief §6).
export function isQualifyingClear(rowsCleared, isTSpin = false) {
  return isTSpin || rowsCleared === 4;
}

// The 1.5× back-to-back bonus. Integer math: floor(base × 1.5), so a Tetris
// (800) becomes 1200 exactly. One home for the multiplier — the T-Spin slice
// reuses it for "Back-to-Back T-Spin (any)" rather than copying the formula.
export function backToBackMultiplier(base) {
  return Math.floor(base * 1.5);
}

// The points a clear of `rowsCleared` rows earns at `level`. The 0 entry and
// the `?? 0` guard keep the function total: a lock that clears nothing never
// calls this, but out-of-range counts still score 0 rather than NaN. The
// `isTSpin` option switches the point table — a T-Spin Single is 800, not the
// standard single's 100 — and the `backToBack` option multiplies the base by
// 1.5; the engine passes it only for a qualifying clear that follows a
// qualifying clear, never for a single, double or triple.
export function lineClearPoints(rowsCleared, level, { backToBack = false, isTSpin = false } = {}) {
  const table = isTSpin ? T_SPIN_BASE_POINTS : LINE_CLEAR_BASE_POINTS;
  let base = table[rowsCleared] ?? 0;
  if (backToBack) {
    base = backToBackMultiplier(base);
  }
  return base * level;
}

// Combo bonus: 50 × combo × level, awarded on each consecutive line-clearing lock.
export function comboPoints(combo, level) {
  return 50 * combo * level;
}

// The `clearType` value a clear of `rowsCleared` rows earns (api-spec
// `ClearType`). A T-Spin indexes the T-Spin table (0 rows → plain `t_spin`);
// any other clear indexes the NES table (0 → `none`, 4 → `tetris`). Out-of-range
// counts fall back to `none` so the function stays total.
const STANDARD_CLEAR_TYPES = ["none", "single", "double", "triple", "tetris"];
const T_SPIN_CLEAR_TYPES = ["t_spin", "t_spin_single", "t_spin_double", "t_spin_triple"];

export function clearTypeFor(rowsCleared, isTSpin) {
  const table = isTSpin ? T_SPIN_CLEAR_TYPES : STANDARD_CLEAR_TYPES;
  return table[rowsCleared] ?? "none";
}

// The single home for score mutation (AGENTS.md §8.3). Every award — line
// clear, T-Spin, hard drop, and the combo award — flows through here so
// nothing can push the score past the 9,999,999 cap or below 0, whatever order
// the awards arrive in.
export function addScore(state, points) {
  state.score = Math.min(MAX_SCORE, Math.max(0, state.score + points));
}
