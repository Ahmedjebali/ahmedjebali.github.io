import { createEmptyRow } from "./state.js";

// The dissolve window between a lock that completes a row and the collapse.
// Mirrored as the `--clear-dissolve-duration` design token in main.css; the
// two must change together (design/frontend-rules.md §1).
export const LINE_CLEAR_MS = 120;

// The rows whose every cell is locked. Scanned at lock time, so a row filled
// by the just-merged piece — and any other full row already on the board —
// clears in the same pass.
export function findFullRows(grid) {
  const rows = [];
  for (let row = 0; row < grid.length; row++) {
    if (grid[row].every((cell) => cell.state === "locked")) {
      rows.push(row);
    }
  }
  return rows;
}

// Flags the rows for the dissolve animation. Cells keep their piece colour;
// the render layer paints them white and the CSS shrinks them to zero height.
export function markClearingRows(grid, rows) {
  for (const row of rows) {
    for (const cell of grid[row]) {
      cell.state = "clearing";
    }
  }
}

// Removes the cleared rows and shifts every remaining row down by the number
// of cleared rows, filling the vacated top of the board with fresh empty rows.
// Rows below the cleared band keep their positions; a kept row lands at index
// `original + clearedBelow`, which can never go negative because cleared rows
// are dropped rather than copied over — a locked cell in the buffer zone
// (row 0–1) simply shifts down into the new space (AGENTS.md §8.5).
export function collapseClearedRows(grid, rows) {
  const cleared = new Set(rows);
  const remaining = grid.filter((_, row) => !cleared.has(row));
  const clearedCount = grid.length - remaining.length;
  const collapsed = [];
  for (let i = 0; i < clearedCount; i++) {
    collapsed.push(createEmptyRow());
  }
  return collapsed.concat(remaining);
}
