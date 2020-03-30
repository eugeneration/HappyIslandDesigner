export function createRemap(inMin, inMax, outMin, outMax) {
  return function remap(x) {
    return ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  };
}
