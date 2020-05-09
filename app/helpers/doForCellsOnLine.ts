/* eslint-disable no-param-reassign */
export function doForCellsOnLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  setPixel: (x: number, y: number) => void,
) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  for (;;) {
    setPixel(x0, y0); // Do what you need to for this

    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
      x0 = Math.round(x0);
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
      y0 = Math.round(y0);
    }
  }
}
