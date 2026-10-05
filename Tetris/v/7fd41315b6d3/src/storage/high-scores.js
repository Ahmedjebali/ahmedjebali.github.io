// Storage layer: top-5 high-score persistence (product brief §13).
//
// The engine never touches `localStorage` (AGENTS.md §2) and this module never
// touches game state (frontend-rules §8.8): it serialises plain entry objects
// under `tetris_high_scores` and answers the one question the wiring point
// needs at game over — "does this score make the top 5, and what is the new
// list?". Every function is total: unavailable or corrupt storage degrades to
// an empty list / a skipped write, never a throw, so a private-browsing game
// still runs and still earns its badge.

export const HIGH_SCORES_KEY = "tetris_high_scores";
export const MAX_HIGH_SCORES = 5;

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function hasStorageApi(storage) {
  return (
    storage !== null &&
    storage !== undefined &&
    typeof storage.getItem === "function" &&
    typeof storage.setItem === "function"
  );
}

function isValidEntry(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    value.score >= 0 &&
    typeof value.level === "number" &&
    Number.isFinite(value.level) &&
    value.level >= 1 &&
    typeof value.lines === "number" &&
    Number.isFinite(value.lines) &&
    value.lines >= 0 &&
    typeof value.date === "string" &&
    typeof value.timeSeconds === "number" &&
    Number.isFinite(value.timeSeconds) &&
    value.timeSeconds >= 0
  );
}

function compareScores(a, b) {
  return b.score - a.score;
}

// A persisted entry mirrors api-spec `HighScoreEntry`: the final score, level
// and lines plus the ISO date achieved and the game duration in seconds.
export function createHighScoreEntry({ score, level, lines, elapsedMs, date } = {}) {
  const timeSeconds = Math.max(0, Math.floor((elapsedMs ?? 0) / 1000));
  const day =
    typeof date === "string"
      ? date
      : new Date().toISOString().slice(0, 10);
  return {
    score: Math.max(0, Math.floor(score ?? 0)),
    level: Math.max(1, Math.floor(level ?? 1)),
    lines: Math.max(0, Math.floor(lines ?? 0)),
    date: day,
    timeSeconds,
  };
}

export function loadHighScores(storage = defaultStorage()) {
  try {
    if (!hasStorageApi(storage)) {
      return [];
    }
    const raw = storage.getItem(HIGH_SCORES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidEntry).sort(compareScores).slice(0, MAX_HIGH_SCORES);
  } catch {
    return [];
  }
}

export function saveHighScores(storage, scores) {
  try {
    if (!hasStorageApi(storage)) {
      return false;
    }
    storage.setItem(HIGH_SCORES_KEY, JSON.stringify(scores.slice(0, MAX_HIGH_SCORES)));
    return true;
  } catch {
    return false;
  }
}

// A score makes the board while there is room, otherwise only by strictly
// beating the current 5th place — a tie keeps the earlier entry.
export function qualifiesForHighScores(scores, score) {
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    return false;
  }
  if (scores.length < MAX_HIGH_SCORES) {
    return true;
  }
  return score > scores[scores.length - 1].score;
}

// Sorted-insert without mutating the input; ties keep existing entries first
// (stable sort over `[...scores, entry]`) and the list is trimmed to 5.
export function insertHighScore(scores, entry) {
  return [...scores, entry].sort(compareScores).slice(0, MAX_HIGH_SCORES);
}

export function clearHighScores(storage = defaultStorage()) {
  try {
    if (!hasStorageApi(storage) || typeof storage.removeItem !== "function") {
      return false;
    }
    storage.removeItem(HIGH_SCORES_KEY);
    return true;
  } catch {
    return false;
  }
}

// The single game-over call the wiring point (`src/main.js`) makes: load the
// board, build this game's entry, and — when it qualifies — persist the
// inserted + trimmed list. `isNewHighScore` is computed from the loaded board
// first, so an unavailable storage (load → []) still reports the badge while
// the write below silently no-ops instead of throwing.
export function recordGameOver(storage = defaultStorage(), { score, level, lines, elapsedMs } = {}) {
  try {
    const entry = createHighScoreEntry({ score, level, lines, elapsedMs });
    // No storage to talk to (private browsing, non-browser context): answer
    // from an empty board without invoking a single storage method — no read
    // attempted, no write attempted — while the badge still reflects whether
    // the score would make the top 5.
    if (!hasStorageApi(storage)) {
      const qualifies = qualifiesForHighScores([], entry.score);
      return {
        scores: qualifies ? [entry] : [],
        isNewHighScore: qualifies,
        entry: qualifies ? entry : null,
      };
    }
    const scores = loadHighScores(storage);
    if (!qualifiesForHighScores(scores, entry.score)) {
      return { scores, isNewHighScore: false, entry: null };
    }
    const updated = insertHighScore(scores, entry);
    saveHighScores(storage, updated);
    return { scores: updated, isNewHighScore: true, entry };
  } catch {
    return { scores: [], isNewHighScore: false, entry: null };
  }
}
