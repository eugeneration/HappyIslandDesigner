export function clamp(num: number, min: number, max: number) {
  if (num <= min) {
    return min;
  }

  return num >= max ? max : num;
}
