export function arrayEqual(array1: any[], array2: any[]): boolean {
  // if the other array is a falsy value, return
  if (!array2) {
    return false;
  }

  // compare lengths - can save a lot of time
  if (array1.length !== array2.length) {
    return false;
  }

  for (let i = 0, l = array1.length; i < l; i++) {
    // Check if we have nested arrays
    if (Array.isArray(array1[i]) && Array.isArray(array2[i])) {
      // recurse into the nested arrays
      if (!array1[i].equals(array2[i])) {
        return false;
      }
    } else if (array1[i] !== array2[i]) {
      // Warning - two different object instances will never be equal: {x:20} !=={x:20}
      return false;
    }
  }
  return true;
}
