export function canPlace(grid, cells) {
  const rows = grid.length;
  const cols = grid[0].length;
  return cells.every(
    (cell) =>
      cell.row >= 0 &&
      cell.row < rows &&
      cell.col >= 0 &&
      cell.col < cols &&
      grid[cell.row][cell.col].state !== "locked"
  );
}
