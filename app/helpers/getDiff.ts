import { layerDefinition } from '../layerDefinition';
import { pathDefinition } from '../pathDefinition';
import { state } from '../state';
import { correctPath } from './correctPath';

export function getDiff(path: paper.Path, colorKey: string) {
  if (!path.children && path.segments.length < 3) {
    return {};
  }

  // figure out which layers to add and subtract from
  const definition = layerDefinition[colorKey] || pathDefinition[colorKey];

  // // limit the path to the union of the shape on each layer
  // if (definition.requireLayer) {
  //   const union = path.intersect(state.drawing[definition.requireLayer]);
  //   path.remove();
  //   // eslint-disable-next-line no-param-reassign
  //   path = union;
  // }

  const editLayers = {};
  if (definition.addLayers) {
    definition.addLayers.forEach((ck) => {
      editLayers[ck] = true;
    });
  }
  if (definition.cutLayers) {
    definition.cutLayers.forEach((ck) => {
      editLayers[ck] = false;
    });
  }

  function isPath(item: paper.Item): item is paper.Path {
    return (item as paper.Path).segments !== undefined;
  }

  const diff = {};
  Object.keys(editLayers).forEach((ck) => {
    const isAdd = editLayers[ck];

    const delta = isAdd
      ? path.subtract(state.drawing[ck])
      : path.intersect(state.drawing[ck]);

    // search for invalid points caused by overlapping diagonals
    // todo: for free drawing, remove this check
    const deltaSubPaths = delta.children ? delta.children : [delta];
    deltaSubPaths.forEach((p) => {
      if (isPath(p)) {
        correctPath(p, state.drawing[ck]);
      }
    });

    if ((delta.children && delta.children.length > 0) || (isPath(delta) && delta.segments && delta.segments.length > 0)) {  
      diff[ck] = {
        isAdd,
        path: delta,
      };
    }
    delta.remove();
  });

  return diff;
}
