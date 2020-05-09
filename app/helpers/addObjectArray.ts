export function addObjectArray(object, key, value) {
  if (!Object.prototype.hasOwnProperty.call(object, key)) {
    // eslint-disable-next-line no-param-reassign
    object[key] = [];
  }
  object[key].push(value);
}
