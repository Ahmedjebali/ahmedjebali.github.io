import { getPieceCells, PIECE_COLORS } from "../engine/pieces.js";

// The two halves of the hold-swap slide (product brief §8.4): the piece leaving
// the board slides off to the left and the piece coming out of the hold slot
// slides in from it, both over the 150 ms the engine's `holdSwap` window is
// open. Like the ghost outline and the hard-drop flash this is a render-layer
// projection — the engine owns the timing, records where the departing piece
// stood (`holdSwap.outgoing`, the geometry the board no longer has), and the
// arriving piece is simply the live `activePiece`. Returns null when there is
// nothing to animate: no open window, or a player who prefers reduced motion —
// they get the same instant exchange, unmoved.
export function computeHoldSwapProjection(
  activePiece,
  holdSwap,
  { reducedMotion = false } = {}
) {
  if (!holdSwap || reducedMotion) {
    return null;
  }
  const outgoing = holdSwap.outgoing;
  return {
    out: {
      color: PIECE_COLORS[outgoing.type],
      cells: getPieceCells(outgoing),
    },
    // The arriving piece is normally the held one, but a hard drop issued in the
    // same frame as the swap locks it inside the window, so it can be gone
    // before the first frame is drawn. The departing half still slides out.
    in: activePiece
      ? { color: PIECE_COLORS[activePiece.type], cells: getPieceCells(activePiece) }
      : null,
  };
}