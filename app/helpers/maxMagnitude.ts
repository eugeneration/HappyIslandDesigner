export function maxMagnitude(...array: number[]) {
  let maxIndex: null | number = null;
  let maxValue = -1;
  for (let i = 0; i < arguments.length; i++) {
    const abs = Math.abs(array[i]);
    if (abs > maxValue) {
      maxIndex = i;
      maxValue = abs;
    }
  }

  if (maxIndex === null) {
    return null;
  }
  return array[maxIndex];
}
