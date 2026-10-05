import { canPlace } from "./collision.js";
import { getCellsFor } from "./pieces.js";
import { ROWS } from "./state.js";

// The anchor row of the lowest valid position for a piece, or null when there
// is no active piece. A piece that cannot drop projects onto its own row; the
// render layer treats that as "no ghost" because the ghost would sit under the
// piece itself.
export function computeGhostRow(grid, piece) {
  if (!piece) {
    return null;
  }
  let validRow = piece.row;
  for (let row = piece.row + 1; row < ROWS; row++) {
    const cells = getCellsFor(piece.type, piece.rotation, piece.col, row);
    if (!canPlace(grid, cells)) {
      break;
    }
    validRow = row;
  }
  return validRow;
}
