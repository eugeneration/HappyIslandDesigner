export function createRemap(
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) {
  return function remap(x: number) {
    return ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  };
}
