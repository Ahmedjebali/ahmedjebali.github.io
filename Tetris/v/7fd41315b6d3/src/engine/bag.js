import { PIECE_TYPES } from "./pieces.js";

export const QUEUE_SIZE = 6;

export function createBag(random = Math.random) {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function refillBagIfEmpty(state, random) {
  if (state.bag.length === 0) {
    state.bag = createBag(random);
  }
}

export function topUpQueue(state, random) {
  if (state.queue.length < QUEUE_SIZE) {
    refillBagIfEmpty(state, random);
    state.queue.push(state.bag.shift());
  }
}

export function fillQueue(state, random) {
  while (state.queue.length < QUEUE_SIZE) {
    topUpQueue(state, random);
  }
}

export function drawNext(state, random) {
  fillQueue(state, random);
  const piece = state.queue.shift();
  topUpQueue(state, random);
  return piece;
}
