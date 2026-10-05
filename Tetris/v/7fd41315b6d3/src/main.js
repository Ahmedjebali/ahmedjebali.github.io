import { createInitialState } from "./engine/state.js";
import { createEngine } from "./engine/engine.js";
import { createRenderer } from "./render/renderer.js";
import { createInput } from "./input/input.js";
import { createAudio } from "./audio/audio.js";
import { clearHighScores, loadHighScores, recordGameOver } from "./storage/high-scores.js";

const engine = createEngine(createInitialState());
const renderer = createRenderer({ loadScores: () => loadHighScores() });
const input = createInput(engine);
const audio = createAudio();

// The confirmed half of high-score persistence (PROJ-33): the engine owns the
// phase change that means "the player cleared the records", storage owns the
// delete, and this subscriber is the only place the two meet (AGENTS.md §2).
// `clearHighScores` is total — an unavailable or throwing localStorage reports
// false rather than throwing — and the render layer empties the view from the
// engine's `highScoresCleared` flag, so the two answers can never disagree.
function persistHighScoreClear(event) {
  if (event.action === "clear_scores") {
    clearHighScores();
  }
}

engine.subscribe(audio.subscribe);
engine.subscribe(persistHighScoreClear);

let lastTime = performance.now();

// High-score persistence lives here — the only place layers meet (AGENTS.md
// §2). The engine never touches storage and storage never mutates state, so
// the game-over transition is recorded exactly once per game: the first frame
// that sees `phase === "game_over"` persists the entry (if it qualifies) and
// caches the badge flag; leaving game_over re-arms for the next game. The
// renderer receives a shallow view carrying `isNewHighScore` — the engine's
// own object is never written outside the engine. The render layer likewise
// holds no storage import: the high-scores viewer's loader is injected here
// as `loadScores`, so reading the persisted board stays a wiring-point
// concern.
let gameOverHandled = false;
let isNewHighScore = false;

function renderCurrent() {
  const state = engine.getState();
  if (state.phase !== "game_over") {
    gameOverHandled = false;
    isNewHighScore = false;
    renderer.render(state);
    return;
  }
  if (!gameOverHandled) {
    gameOverHandled = true;
    isNewHighScore = recordGameOver(undefined, {
      score: state.score,
      level: state.level,
      lines: state.lines,
      elapsedMs: state.elapsedMs,
    }).isNewHighScore;
  }
  renderer.render(isNewHighScore ? { ...state, isNewHighScore: true } : state);
}

function frame(now) {
  const deltaMs = now - lastTime;
  lastTime = now;

  engine.step(deltaMs);
  // The same delta feeds the input layer's DAS timers: held movement keys
  // auto-repeat off this one loop and hold no timer of their own (adr/0001).
  input.step(deltaMs);
  renderCurrent();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
