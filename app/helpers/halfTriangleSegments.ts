export function halfTriangleSegments(x0, y0, x1, y1, offsetX, offsetY) {
  const xMid = (x0 + x1) / 2;
  const yMid = (y0 + y1) / 2;
  return [
    [x0 + offsetX, y0 + offsetY],
    [
      xMid + offsetX - Math.sign(offsetX) * 0.5,
      yMid + offsetY - Math.sign(offsetY) * 0.5,
    ],
    [x1 + offsetX, y1 + offsetY],
  ];
}
