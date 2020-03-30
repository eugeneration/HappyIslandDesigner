export function objectMap(object, mapFn) {
  return Object.keys(object).reduce((result, key) => {
    const value = mapFn(object[key], key);
    if (value != null) result[key] = value;
    return result;
  }, {});
}
