// Level advancement and the gravity speed table (product brief §2.8).
// Level derives from total lines cleared; gravity derives from level. The
// render layer consumes the `levelUp` flag for the LEVEL UP! animation.

const LEVEL_UP_LINES = 10;
const MAX_LEVEL = 30;

// How long the level-up flag stays set. Mirrored as the `--level-up-duration`
// design token in main.css; the two must change together
// (design/frontend-rules.md §1).
export const LEVEL_UP_MS = 1500;

// Gravity in milliseconds per automatic drop cell, indexed by level (level 1
// at index 0). The brief's table caps at 33 ms from level 15 — the practical
// limit of human reaction — so the final entry serves every level from 15 up.
const GRAVITY_SPEED_TABLE = [1000, 800, 600, 470, 380, 300, 220, 160, 110, 80, 60, 50, 50, 50, 33];

export function gravityForLevel(level) {
  const index = Math.min(level, GRAVITY_SPEED_TABLE.length) - 1;
  return GRAVITY_SPEED_TABLE[index];
}

// One level per 10 lines, capped at MAX_LEVEL: lines 0–9 are level 1, 10–19
// level 2, and so on; 290 lines and up stay at level 30.
export function levelForLines(lines) {
  return Math.min(Math.floor(lines / LEVEL_UP_LINES) + 1, MAX_LEVEL);
}
