// High-scores viewer (PROJ-32): the render-layer component that paints the
// persisted top-5 board inside the `.js-high-scores` overlay.
//
// This module holds zero storage knowledge (AGENTS.md §2 — `src/main.js` is
// the only place layers meet): the loader is injected as `loadScores`, and
// the wiring point passes `() => loadHighScores()`. The default answers an
// empty list so a viewer created without a loader renders the empty state
// rather than throwing. Sorting and trimming live in storage
// (`loadHighScores` returns highest-first, max 5); this module only formats
// and paints.
//
// Visibility is phase-driven like every other screen: `screenManager` mirrors
// `phase` onto `body[data-phase]` and CSS shows `.overlay--high-scores` only
// for `high_scores`, so this module never toggles visibility itself. The
// list is read once per opening — on the frame the phase enters
// `high_scores` — never on a repeated frame: scores can only change at game
// over and at a confirmed clear, and both hand back control to this phase, so
// a per-frame localStorage read would be work behind a diff that discards it
// (AGENTS.md §5). A missing hook (older test shims) renders nothing rather
// than throwing.

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatHighScoreTime(timeSeconds) {
  const total = Math.max(0, Math.floor(timeSeconds ?? 0));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// The board to paint, read once per opening. A confirmed clear answers from
// the engine's own flag instead of asking storage: the player has just been
// told the records are gone, so showing them again — even when the localStorage
// write failed silently — would contradict the action they confirmed.
function readBoard(state, loadScores) {
  if (state.highScoresCleared) {
    return [];
  }
  try {
    return loadScores() ?? [];
  } catch {
    return [];
  }
}

function buildRow(document, entry, rank) {
  const row = document.createElement("li");
  row.className = "high-scores__row";

  const rankEl = document.createElement("span");
  rankEl.className = "high-scores__rank";
  rankEl.textContent = String(rank);
  row.appendChild(rankEl);

  const scoreEl = document.createElement("span");
  scoreEl.className = "high-scores__score";
  scoreEl.textContent = String(entry.score);
  row.appendChild(scoreEl);

  const detailEl = document.createElement("span");
  detailEl.className = "high-scores__detail";
  detailEl.textContent = `Lv ${entry.level} · ${entry.lines} lines`;
  row.appendChild(detailEl);

  const dateEl = document.createElement("span");
  dateEl.className = "high-scores__date";
  dateEl.textContent = entry.date;
  row.appendChild(dateEl);

  const timeEl = document.createElement("span");
  timeEl.className = "high-scores__time";
  timeEl.textContent = formatHighScoreTime(entry.timeSeconds);
  row.appendChild(timeEl);

  return row;
}

export function createHighScoresRenderer({
  document = globalThis.document,
  loadScores = () => [],
} = {}) {
  const listEl = document.querySelector(".js-high-scores-list");
  const emptyEl = document.querySelector(".js-high-scores-empty");
  let lastPhase = null;

  return {
    render(state) {
      if (!listEl || !emptyEl) {
        return;
      }
      const isOpen = state.phase === "high_scores";
      const entered = isOpen && lastPhase !== "high_scores";
      lastPhase = state.phase;
      if (!entered) {
        return;
      }
      const scores = readBoard(state, loadScores);
      listEl.replaceChildren();
      for (let i = 0; i < scores.length; i++) {
        listEl.appendChild(buildRow(document, scores[i], i + 1));
      }
      // The message itself is authored once in index.html; the viewer only
      // toggles its visibility, exactly like the game-over badge.
      emptyEl.hidden = scores.length !== 0;
    },
  };
}
