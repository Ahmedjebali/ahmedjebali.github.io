import { getPieceCells } from "../engine/pieces.js";

// The colour the four landing cells flash for the 80 ms after a hard drop.
// Mirrored as the `--color-drop-flash` design token in main.css; the two must
// change together (design/frontend-rules.md §1).
export const FLASH_COLOR = "#ffffff";

// The white flash to paint over the piece at its landing row while a hard-drop
// flash window is open, or null when nothing should flash: no active piece, no
// window, or the player prefers reduced motion. Like the ghost outline, this is
// a render-layer projection — the model cells stay `active`, and the engine
// owns the timing via `dropFlash`.
export function computeFlashProjection(
  piece,
  dropFlash,
  { reducedMotion = false } = {}
) {
  if (!piece || !dropFlash || reducedMotion) {
    return null;
  }
  return {
    color: FLASH_COLOR,
    cells: getPieceCells(piece),
  };
}
