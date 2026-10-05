// The LEVEL UP! overlay the render layer shows while the engine's level-up
// window is open. The engine owns the 1.5 s timer (`levelUp` on the model)
// exactly like the drop-flash and line-clear windows; this module only flips
// the `data-active` hook the CSS animates. The diff is remembered so the
// attribute is written once per activation, never on a repeated frame
// (AGENTS.md §5). Under prefers-reduced-motion the CSS shows the banner
// statically and skips the flash.
export function createLevelUpRenderer({ document = globalThis.document } = {}) {
  const overlay = document.querySelector(".js-level-up");
  let wasActive = false;

  return {
    render(levelUp) {
      const active = levelUp !== null;
      if (active === wasActive) {
        return;
      }
      wasActive = active;
      if (active) {
        overlay.dataset.active = "true";
      } else {
        delete overlay.dataset.active;
      }
    },
  };
}
