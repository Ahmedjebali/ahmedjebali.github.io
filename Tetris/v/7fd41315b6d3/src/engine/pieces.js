export const PIECE_TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

export const PIECE_COLORS = {
  I: "#00E5FF",
  O: "#FFD600",
  T: "#AA00FF",
  S: "#00E676",
  Z: "#FF1744",
  J: "#2979FF",
  L: "#FF9100",
};

export const SPAWN_ANCHOR = {
  I: { col: 3, row: -1 },
  O: { col: 3, row: -1 },
  T: { col: 3, row: 0 },
  S: { col: 3, row: 0 },
  Z: { col: 3, row: 0 },
  J: { col: 3, row: 0 },
  L: { col: 3, row: 0 },
};

const O_SQUARE = [
  { col: 1, row: 1 },
  { col: 2, row: 1 },
  { col: 1, row: 2 },
  { col: 2, row: 2 },
];

export const PIECE_ROTATIONS = {
  I: [
    [
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 3, row: 1 },
    ],
    [
      { col: 2, row: 0 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
      { col: 2, row: 3 },
    ],
    [
      { col: 0, row: 2 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
      { col: 3, row: 2 },
    ],
    [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ],
  ],
  O: [O_SQUARE, O_SQUARE, O_SQUARE, O_SQUARE],
  T: [
    [
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ],
    [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
    ],
    [
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
    ],
    [
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
    ],
  ],
  S: [
    [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ],
    [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
    ],
    [
      { col: 0, row: 2 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 1 },
    ],
    [
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
    ],
  ],
  Z: [
    [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ],
    [
      { col: 2, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
    ],
    [
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ],
    [
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 0, row: 2 },
    ],
  ],
  J: [
    [
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ],
    [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
    ],
    [
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
    ],
    [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 0, row: 2 },
      { col: 1, row: 2 },
    ],
  ],
  L: [
    [
      { col: 2, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ],
    [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ],
    [
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 0, row: 2 },
    ],
    [
      { col: 1, row: 0 },
      { col: 0, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
    ],
  ],
};

export const PIECE_SHAPES = Object.fromEntries(
  Object.entries(PIECE_ROTATIONS).map(([type, states]) => [type, states[0]])
);

const IDENTITY_KICKS = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
];

const JLSTZ_KICKS = {
  cw: [
    [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  ],
  ccw: [
    [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  ],
};

const I_KICKS = {
  cw: [
    [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  ],
  ccw: [
    [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  ],
};

export const WALL_KICKS = {
  I: I_KICKS,
  O: { cw: [IDENTITY_KICKS, IDENTITY_KICKS, IDENTITY_KICKS, IDENTITY_KICKS], ccw: [IDENTITY_KICKS, IDENTITY_KICKS, IDENTITY_KICKS, IDENTITY_KICKS] },
  T: JLSTZ_KICKS,
  S: JLSTZ_KICKS,
  Z: JLSTZ_KICKS,
  J: JLSTZ_KICKS,
  L: JLSTZ_KICKS,
};

export function createActivePiece(type, rotation = 0) {
  const anchor = SPAWN_ANCHOR[type];
  return {
    type,
    rotation,
    col: anchor.col,
    row: anchor.row,
    cells: PIECE_ROTATIONS[type][rotation].map((offset) => ({ ...offset })),
  };
}

// The first row at which a rotation's cells sit fully on the board: the
// spawn anchor is only valid for rotation 0 (the I's vertical rotations start
// at offset row 0, so the bare anchor at row -1 would hang a cell above the
// board). A clamp — never a search — so every other placement is unchanged.
export function spawnRowFor(type, rotation) {
  const offsets = PIECE_ROTATIONS[type][rotation];
  let minRow = offsets[0].row;
  for (let i = 1; i < offsets.length; i += 1) {
    if (offsets[i].row < minRow) {
      minRow = offsets[i].row;
    }
  }
  const row = Math.max(SPAWN_ANCHOR[type].row, -minRow);
  // Normalise -0 (from -minRow when the rotation starts at offset row 0) to
  // +0: strict equality distinguishes the two and a row is never negative zero.
  return row === 0 ? 0 : row;
}

export function getCellsFor(type, rotation, col, row) {
  return PIECE_ROTATIONS[type][rotation].map((offset) => ({
    col: col + offset.col,
    row: row + offset.row,
  }));
}

export function getPieceCells(piece) {
  return getCellsFor(piece.type, piece.rotation, piece.col, piece.row);
}
