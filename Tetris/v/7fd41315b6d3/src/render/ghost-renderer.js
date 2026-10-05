import { getCellsFor, PIECE_COLORS } from "../engine/pieces.js";

// The ghost outline to draw at the piece's landing position, or null when
// nothing should be drawn: no active piece, no projection yet, or a ghost that
// sits at or above the piece's own row (its cells would coincide with the
// piece and must not paint over it). The render layer owns this derivation;
// the engine only ever publishes `ghostRow`.
export function computeGhostProjection(piece, ghostRow) {
  if (!piece || ghostRow === null || ghostRow <= piece.row) {
    return null;
  }
  return {
    color: PIECE_COLORS[piece.type],
    cells: getCellsFor(piece.type, piece.rotation, piece.col, ghostRow),
  };
}
