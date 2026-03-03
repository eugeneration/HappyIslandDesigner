// @ts-nocheck
// Legacy V1 save/load functions
import paper from 'paper';

import { state, objectCreateCommand, applyCommand } from './state';
import { layers } from './layers';
import { colors, getColorDataFromEncodedName } from './colors';
import { objectMap } from './helpers/objectMap';
import { toolCategoryDefinition } from './tools';

function removeFloatingPointError(f) {
  return Math.round((f + Number.EPSILON) * 100) / 100;
}

function encodePoint(p) {
  return [removeFloatingPointError(p.x), removeFloatingPointError(p.y)];
}

function decodeObject(encodedData, encodingVersion) {
  const position = new paper.Point(encodedData.position);
  const objectData = {
    category: encodedData.category,
    type: encodedData.type,
  };
  // for legacy or renamed objects, rename them
  if (
    toolCategoryDefinition[encodedData.category].tools &&
    toolCategoryDefinition[encodedData.category].tools.value
  ) {
    const objectDefinition =
      toolCategoryDefinition[encodedData.category].tools.value[objectData.type];
    if (objectDefinition.legacy) {
      objectData.type = objectDefinition.legacy;
    }
    if (objectDefinition.legacyCategory) {
      objectData.category = objectDefinition.legacyCategory;
    }
    if (objectDefinition.rename) {
      if (encodingVersion <= objectDefinition.rename[0]) {
        objectData.type = objectDefinition.rename[1];
      }
    }
  }

  applyCommand(objectCreateCommand(objectData, position), true);
  return {
    position,
    category: encodedData.category,
    type: encodedData.type,
  };
}

export function encodeObjectGroups(objects) {
  const objectGroups = {};
  Object.values(objects).forEach((object) => {
    const key = `${object.data.category}_${object.data.type}`;
    if (!objectGroups[key]) {
      objectGroups[key] = [];
    }
    const encodedPoint = encodePoint(object.position);
    objectGroups[key].push(encodedPoint[0], encodedPoint[1]);
  });
  return objectGroups;
}

function decodeObjectGroups(objectGroups, encodingVersion) {
  if (objectGroups == null) return {};
  if (encodingVersion === 0) {
    return objectMap(objectGroups, (encodedData) => {
      return decodeObject(encodedData, paper.version);
    });
  }

  const objects = {};
  Object.keys(objectGroups).forEach((key) => {
    const keySplit = key.split('_');
    const category = keySplit[0];
    const type = keySplit[1];
    const positionArray = objectGroups[key];
    for (let i = 0; i < positionArray.length; i += 2) {
      decodeObject(
        {
          category,
          type,
          position: [positionArray[i], positionArray[i + 1]],
        },
        encodingVersion,
      );
    }
  });
  return objects;
}

function encodePath(p) {
  const positions: number[] = [];
  p.segments.forEach((s) => {
    const encodedPoint = encodePoint(s.point);
    positions.push(encodedPoint[0], encodedPoint[1]);
  });
  return positions;
}

function decodePath(positionArray) {
  const points: paper.Point[] = [];
  for (let i = 0; i < positionArray.length; i += 2) {
    points.push(new paper.Point(positionArray[i], positionArray[i + 1]));
  }
  return points;
}

export function encodeDrawing(drawing) {
  const encodedDrawing = {};
  Object.keys(drawing).forEach((colorKey) => {
    const pathItem = drawing[colorKey];
    let p;
    if (pathItem.children) {
      p = pathItem.children.map((path) => {
        return encodePath(path);
      });
    } else {
      p = encodePath(pathItem);
    }
    const encodedColorName = colors[colorKey].name;
    encodedDrawing[encodedColorName] = p;
  });
  return encodedDrawing;
}

function decodeDrawing(encodedDrawing, version) {
  // colors translated from encoded name => keys
  const decodedDrawing = {};
  Object.keys(encodedDrawing).forEach((colorName) => {
    const colorData = getColorDataFromEncodedName(colorName);
    const pathData = encodedDrawing[colorName];
    // if array of arrays, make compound path
    let p;
    if (pathData.length === 0) {
      p = new paper.Path();
    } else if (version === 0) {
      if (typeof pathData[0][0] === 'number') {
        // normal path
        p = new paper.Path(
          pathData.map((p) => {
            return new paper.Point(p);
          }),
        );
      } else {
        p = new paper.CompoundPath({
          children: pathData.map((pathData) => {
            return new paper.Path(
              pathData.map((p) => {
                return new paper.Point(p);
              }),
            );
          }),
        });
      }
    } else if (typeof pathData[0] === 'number') {
      // normal path
      p = new paper.Path(decodePath(pathData));
    } else {
      p = new paper.CompoundPath({
        children: pathData.map((pathData) => {
          return new paper.Path(decodePath(pathData));
        }),
      });
    }
    p.locked = true;
    p.fillColor = colorData.color;
    decodedDrawing[colorData.key] = p;
  });
  return decodedDrawing;
}

export function encodeMapV1() {
  // colors translated from keys => encoded name
  const o = {
    version: 1,
    objects: encodeObjectGroups(state.objects),
    drawing: encodeDrawing(state.drawing),
  };
  if (Object.keys(o.objects).length === 0) {
    delete o.objects;
  }
  return JSON.stringify(o);
}

export function decodeMapV1(json) {
  layers.mapLayer.activate();

  // older versions would encode drawings incorrectly
  // if the objects field was empty
  // level1/2/3 would be encoded as ØoveØ1
  if (json == null) return;
  if (json.version == 1 && json.drawing && json.objects && Object.keys(json.objects).length == 0) {

    let index = 0;
    Object.keys(json.drawing).forEach(function(colorName) {
      if (colorName.match(/ØoveØ[0-9]/)) {
        const newKey = ('level' + colorName.slice(-1));
        json.drawing[newKey] = json.drawing[colorName];

        // retain order by reordering indices in front
        delete json.drawing[colorName];

        const keys = Object.keys(json.drawing);
        for (let i = index; i < keys.length - 1; i++) {
          const key = keys[i];
          const data = json.drawing[key];
          delete json.drawing[key];
          json.drawing[key] = data;
        }
      }
      index++;
    })
  }

  const { version } = json;
  return {
    version: json.version,
    drawing: decodeDrawing(json.drawing, version),
    objects: decodeObjectGroups(json.objects, version),
  };
}
