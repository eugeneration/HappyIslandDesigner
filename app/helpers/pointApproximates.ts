export function pointApproximates(p0, p1) {
  return Math.abs(p0.x - p1.x) < 0.001 && Math.abs(p0.y - p1.y) < 0.001;
}
