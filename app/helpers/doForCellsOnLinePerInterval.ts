// interval = 0.2
export function doForCellsOnLinePerInterval(
  x0,
  y0,
  x1,
  y1,
  interval,
  setPixel,
) {
  if (Math.abs(x0 - x1) + Math.abs(y0 - y1) < 0.2) {
    setPixel(x0, y0);
    return;
  }

  let p0 = new paper.Point(x0, y0);
  const p1 = new paper.Point(x1, y1);
  const delta = p1.subtract(p0);
  const slope = delta.normalize().multiply(interval);

  let prevCellPoint;
  const totalLength = delta.length;
  let length = 0;

  do {
    const cellPoint = p0.floor();
    if (prevCellPoint !== cellPoint) {
      setPixel(cellPoint.x, cellPoint.y);
      prevCellPoint = cellPoint;
    }
    p0 = p0.add(slope);
    length += interval;
  } while (length < totalLength);
}
