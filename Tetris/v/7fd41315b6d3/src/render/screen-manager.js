// The screen manager is the render-layer component that owns which screen is
// visible. It reads the engine's `phase` once a frame and mirrors it onto
// <body data-phase="...">; CSS attribute selectors do the actual show/hide
// (`body[data-phase="menu"] .menu`, `body[data-phase="game_over"]
// .overlay--game-over`, …). One attribute drives every screen, so a phase
// without a dedicated screen (e.g. `paused`, before its overlay exists) still
// leaves the board visible behind the chrome. The diff is remembered so the
// attribute is written once per phase change, never on a repeated frame
// (AGENTS.md §5).
export function createScreenManager({ document = globalThis.document } = {}) {
  const body = document.body;
  let lastPhase = null;

  return {
    render(phase) {
      if (phase === lastPhase) {
        return;
      }
      lastPhase = phase;
      body.dataset.phase = phase;
    },
  };
}
