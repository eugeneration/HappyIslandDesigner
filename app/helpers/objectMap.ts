export function objectMap(object: Record<string, any>, mapFn) {
  return Object.keys(object).reduce((result, key) => {
    const value = mapFn(object[key], key);
    if (value !== null) {
      result[key] = value;
    }
    return result;
  }, {});
}
