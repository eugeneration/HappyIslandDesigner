import paper from 'paper';

import { clearMap, setNewMapData, state, objectCreateCommand } from './state';
import { downloadDataURL } from './helpers/download';
import { layers } from './layers';
import { colors, getColorDataFromEncodedName } from './colors';
import { getGridRaster } from './grid';
import { objectMap } from './helpers/objectMap';
import { toolCategoryDefinition } from './tools';

const editor = {
  autosaveMap: null,
  clearAutosave: null,
};

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

function encodeObjectGroups(objects) {
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
  if (encodingVersion === 0) {
    return objectMap(objectGroups, (encodedData) =>
      decodeObject(encodedData, version),
    );
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
  const positions = [];
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

function encodeDrawing(drawing) {
  const encodedDrawing = {};
  Object.keys(drawing).forEach((colorKey) => {
    const pathItem = drawing[colorKey];
    let p;
    if (pathItem.children) {
      p = pathItem.children.map((path) => encodePath(path));
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
        p = new paper.Path(pathData.map((p) => new paper.Point(p)));
      } else {
        p = new paper.CompoundPath({
          children: pathData.map(
            (pathData) =>
              new paper.Path(pathData.map((p) => new paper.Point(p))),
          ),
        });
      }
    } else if (typeof pathData[0] === 'number') {
      // normal path
      p = new paper.Path(decodePath(pathData));
    } else {
      p = new paper.CompoundPath({
        children: pathData.map(
          (pathData) => new paper.Path(decodePath(pathData)),
        ),
      });
    }
    p.locked = true;
    p.fillColor = colorData.color;
    decodedDrawing[colorData.key] = p;
  });
  return decodedDrawing;
}

function encodeMap() {
  // colors translated from keys => encoded name
  const o = {
    version: 1,
    objects: encodeObjectGroups(state.objects),
    drawing: encodeDrawing(state.drawing),
  };
  return JSON.stringify(o);
}

export function decodeMap(json) {
  layers.mapLayer.activate();
  const { version } = json;
  return {
    version: json.version,
    drawing: decodeDrawing(json.drawing, version),
    objects: decodeObjectGroups(json.objects, version),
  };
}

export function autosaveMap() {
  if (localStorage) {
    localStorage.setItem('autosave', encodeMap());
    state.actionsSinceSave = 0;
    return true;
  }
  console.log('Cannot autosave: your browser does not support local storage.');
  return false;
}
editor.autosaveMap = autosaveMap;

export function tryLoadAutosaveMap() {
  document.cookie = '';
  if (localStorage) {
    const autosave = localStorage.getItem('autosave');
    if (autosave != null) {
      clearMap();
      setNewMapData(decodeMap(JSON.parse(autosave)));
      return true;
    }
  }
  return false;
}

function clearAutosave() {
  if (localStorage) {
    localStorage.removeItem('autosave');
  }
}

editor.clearAutosave = clearAutosave;

export function saveMapToFile() {
  let mapJson = encodeMap();
  mapJson = LZString.compress(mapJson);

  const saveMargins = new paper.Point(10, 10);

  layers.uiLayer.activate();
  const mapRaster = layers.mapLayer.rasterize();
  const mapPositionDelta = layers.mapLayer.globalToLocal(
    layers.mapLayer.bounds.topLeft,
  );

  const iconsRaster = layers.mapIconLayer.rasterize();
  const iconsPositionDelta = layers.mapIconLayer.globalToLocal(
    layers.mapIconLayer.bounds.topLeft,
  );

  const gridRaster = getGridRaster();

  const gridClone = gridRaster.clone();

  const mapBounds = gridRaster.bounds.clone();
  mapBounds.size.add(saveMargins);
  mapBounds.point.subtract(saveMargins.divide(2));
  const mapBoundsClippingMask = new paper.Path.Rectangle(mapBounds);

  const background = mapBoundsClippingMask.clone();
  background.fillColor = colors.water.color;

  mapBoundsClippingMask.clipMask = true;

  const text = new paper.PointText(
    mapBounds.bottomRight.subtract(new paper.Point(2, 2)),
  );
  text.justification = 'right';
  text.content = 'made at eugeneration.github.io/HappyIslandDesigner';
  text.fontFamily = 'TTNorms, sans-serif';
  text.fillColor = colors.oceanDark.color;
  text.strokeWidth = 0;
  text.fontSize = 2;
  text.selected = true;

  const group = new paper.Group();
  group.clipped = true;

  group.addChildren([
    mapBoundsClippingMask,
    background,
    mapRaster,
    iconsRaster,
    gridClone,
    text,
  ]);

  // the raster doesn't scale for some reason, so manually scale it;
  mapRaster.scaling.divide(layers.mapLayer.scaling);
  mapRaster.bounds.topLeft = mapPositionDelta;

  iconsRaster.scaling.divide(layers.mapLayer.scaling);
  iconsRaster.bounds.topLeft = iconsPositionDelta;

  const combinedImage = group.rasterize(708.5);
  combinedImage.position.x += 200;
  combinedImage.remove();
  group.remove();

  const mapRasterSize = combinedImage.size;
  let mapRasterData = combinedImage.toDataURL();

  const shadowCanvas = document.createElement('canvas');
  // const shadowCtx = shadowCanvas.getContext('2d');
  shadowCanvas.style.display = 'none';
  const image = new Image();
  image.src = mapRasterData;
  image.addEventListener(
    'load',
    () => {
      mapRasterData = steg.encode(mapJson, mapRasterData, {
        height: mapRasterSize.height,
        width: mapRasterSize.width,
      });

      const filename = `HappyIslandDesigner_${Date.now()}.png`;
      downloadDataURL(filename, mapRasterData);
    },
    false,
  );

  autosaveMap();
}
