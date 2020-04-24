export function addObjectArray(object, key, value) {
  if (!object.hasOwnProperty(key)) {
    // eslint-disable-next-line no-param-reassign
    object[key] = [];
  }
  object[key].push(value);
}
