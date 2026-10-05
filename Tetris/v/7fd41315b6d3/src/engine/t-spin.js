// The three-corner T-Spin test (product brief §2.7). Run at lock time on the
// just-placed T piece: the four diagonal corners around the piece's rotation
// centre are examined, and exactly three of them must be occupied for the lock
// to count as a T-Spin. The engine owns detection; the scoring slice consumes
// the boolean.

// The T piece's rotation centre, in anchor offsets. Every T rotation in
// pieces.js is the four-cell cross built around `{col: 1, row: 1}`, so the
// centre is always the anchor plus this offset — for any of the four rotations.
const T_CENTRE = { col: 1, row: 1 };

// The four diagonal corners around the centre, as [dRow, dCol] offsets.
const CORNER_OFFSETS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

// A corner counts as occupied when it holds a locked cell or lies outside the
// board — the walls and the floor are solid, so a T-Spin can lean on them (a
// T resting on the bottom row, or flush against a wall, still fills corners).
function isCornerOccupied(grid, row, col) {
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) {
    return true;
  }
  return grid[row][col].state === "locked";
}

// The three-corner T-Spin test. Only a T can T-Spin; the four diagonal corners
// around its rotation centre are counted, and exactly three must be occupied
// (locked, or off-board). "Exactly three" per the ticket — a slot that walls
// in all four corners is not flagged.
export function detectTSpin(grid, piece) {
  if (!piece || piece.type !== "T") {
    return false;
  }
  const centreRow = piece.row + T_CENTRE.row;
  const centreCol = piece.col + T_CENTRE.col;
  let occupied = 0;
  for (const [dRow, dCol] of CORNER_OFFSETS) {
    if (isCornerOccupied(grid, centreRow + dRow, centreCol + dCol)) {
      occupied += 1;
    }
  }
  return occupied === 3;
}
