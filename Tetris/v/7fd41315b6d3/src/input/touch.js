const TAP_MAX_MS = 300;
const TAP_MAX_PX = 10;

export function createTouchGesture({ dispatch, document = globalThis.document, now = Date.now } = {}) {
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let tracking = false;

  function handleTouchstart(event) {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = now();
    tracking = true;
    event.preventDefault();
  }

  function handleTouchmove(event) {
    if (!tracking) {
      return;
    }
    event.preventDefault();
  }

  function handleTouchend(event) {
    if (!tracking) {
      return;
    }
    tracking = false;

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const elapsed = now() - startTime;

    if (elapsed < TAP_MAX_MS && Math.abs(dx) < TAP_MAX_PX && Math.abs(dy) < TAP_MAX_PX) {
      dispatch("rotate_cw");
      return;
    }

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx >= absDy) {
      dispatch(dx < 0 ? "move_left" : "move_right");
    } else {
      dispatch(dy < 0 ? "hard_drop" : "soft_drop");
    }
  }

  const board = document.querySelector(".js-board");
  if (board) {
    board.addEventListener("touchstart", handleTouchstart, { passive: false });
    board.addEventListener("touchmove", handleTouchmove, { passive: false });
    board.addEventListener("touchend", handleTouchend, { passive: false });
  }

  return {
    destroy() {
      if (board) {
        board.removeEventListener("touchstart", handleTouchstart, { passive: false });
        board.removeEventListener("touchmove", handleTouchmove, { passive: false });
        board.removeEventListener("touchend", handleTouchend, { passive: false });
      }
    },
  };
}
