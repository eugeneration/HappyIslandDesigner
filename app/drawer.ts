import {
  Layer,
  Point,
  Group,
  project,
  Path,
  Rectangle,
  PointText,
  Raster,
  version,
  view,
  Size,
  Key,
  CompoundPath,
} from 'paper/dist/paper-core';
import { EventEmitter } from './EventEmitter';

const backgroundLayer = project.activeLayer;
const mapLayer = new Layer();
const mapIconLayer = new Layer();
const mapOverlayLayer = new Layer();
const uiLayer = new Layer();
const fixedLayer = new Layer();
const cloudLayer = new Layer();
const modalLayer = new Layer();
backgroundLayer.applyMatrix = false;
cloudLayer.applyMatrix = false;
fixedLayer.applyMatrix = false;
modalLayer.applyMatrix = false;

mapLayer.applyMatrix = false;
mapLayer.pivot = new Point(0, 0);
mapIconLayer.applyMatrix = false;
mapIconLayer.pivot = new Point(0, 0);
mapOverlayLayer.applyMatrix = false;
mapOverlayLayer.pivot = new Point(0, 0);

const emitter = new EventEmitter();

// if you want to rename a color, you must add a name parameter with the old name
// otherwise backwards compatibility for encoding/decoding will break
const colors = {
  invisible: { color: 'rgba(0, 0, 0, 0.00001)' },

  // terrain color
  water: { color: '#83e1c3' },
  sand: { color: '#eee9a9' },
  level1: { color: '#347941' },
  level2: { color: '#35a043' },
  level3: { color: '#4ac34e' },
  rock: { color: '#737a89' },
  campground: { color: '#b0a280' },
  townsquare: { color: '#E2AA78' },

  // paths
  pathDirt: { color: '#d5ac71' },
  pathSand: { color: '#f9df96' },
  pathStone: { color: '#999a8c' },
  pathBrick: { color: '#e38f68' },
  pathEraser: { color: '#f1b2c1' },

  // structures
  special: { color: '#ffffff' },
  dock: { color: '#a9926e' },
  amenity: { color: '#514d40' },
  amenityWhite: { color: '#efedd5' },
  human: { color: '#F078B0' },
  npc: { color: '#f8bd26' },
  selected: { color: '#ed772f' },
  pin: { color: '#e75a2e' },

  // Map drawer UI
  selection: { color: '#50EEFF' },

  // UI
  white: { color: '#f9f7ed' },
  paper: { color: '#f5f3e5' }, // general white
  paperOverlay: { color: '#ecebd5' },
  paperOverlay2: { color: '#e4e2d0' },

  // colors from nookPhone (colors are hued towards red/yellow)
  purple: { color: '#be84f0' },
  blue: { color: '#8c97ec' },
  lightBlue: { color: '#b4bdfd' },
  orange: { color: '#df8670' },
  magenta: { color: '#f550ab' },
  pink: { color: '#f09eb3' },
  cyan: { color: '#63d5bf' },
  turquoise: { color: '#86e0bb' },
  green: { color: '#8dd08a' },
  lime: { color: '#d2e541' },
  red: { color: '#ee666e' },
  offBlack: { color: '#4b3b32' },
  offWhite: { color: '#f6f2e0' },
  lightText: { color: '#dcd8ca' },
  text: { color: '#726a5a' },
  yellow: { color: '#f5d830' },
  lightYellow: { color: '#f7e676' },
  lightBrown: { color: '#bfab76' },

  // generic colors
  firetruck: { color: '#ef3c1d' },
  flamingo: { color: '#f8ad82' },
  brick: { color: '#ab4f46' },

  safetyOrange: { color: '#f56745' },
  lifeguardOrange: { color: '#f59447' },

  frogYellow: { color: '#f7d00e' },
  lightBannerYellow: { color: '#fdf252' },
  darkBannerYellow: { color: '#c7b451' },

  tentGreen: { color: '#22b759' },
  darkBlueGreen: { color: '#11a972' },
  lightGreen: { color: '#5aeb89' },
  jaybird: { color: '#42bbf3' },

  darkGreyBlue: { color: '#7c8da6' },
  lightGreyBlue: { color: '#9cbbce' },

  highlightCircle: { color: '#2adbb8' },

  // Water UI
  oceanPanel: { color: '#39ba9c' }, // game trailer had this color panel
  oceanPanelDark: { color: '39ba9c' },
  oceanText: { color: '#57b499' }, // text on ocean
  oceanDarker: { color: '#77d6bd' }, // dark overlay
  oceanDark: { color: '#70cfb6' }, // dark overlay
  oceanLighter: { color: '#d7fef1' }, // light overlay
  oceanLight: { color: '#a3f8dd' }, // light overlay
  oceanWave: { color: '#63d4b2' },
};
Object.keys(colors).forEach((colorKey) => {
  const colorData = colors[colorKey];
  if (!colorData.name) {
    // if it has a custom encoded name, make sure to use that
    colorData.name = colorKey;
  }
  colorData.key = colorKey;
});

function getColorDataFromEncodedName(encodedColorName) {
  if (!encodedColorName) return null;
  return Object.values(colors).find((c) => c.name == encodedColorName);
}

const pathDefinition = {};
pathDefinition[colors.pathDirt.key] = {
  priority: 100,
  addLayers: [colors.pathDirt.key],
  cutLayers: [colors.pathBrick.key, colors.pathSand.key, colors.pathStone.key],
  // requireLayer: colors.sand.key, // sand is always drawn below everything else
};
pathDefinition[colors.pathStone.key] = {
  priority: 100,
  addLayers: [colors.pathStone.key],
  cutLayers: [colors.pathBrick.key, colors.pathDirt.key, colors.pathSand.key],
  // requireLayer: colors.sand.key, // sand is always drawn below everything else
};
pathDefinition[colors.pathBrick.key] = {
  priority: 100,
  addLayers: [colors.pathBrick.key],
  cutLayers: [colors.pathDirt.key, colors.pathSand.key, colors.pathStone.key],
  // requireLayer: colors.sand.key, // sand is always drawn below everything else
};
pathDefinition[colors.pathSand.key] = {
  priority: 100,
  addLayers: [colors.pathSand.key],
  cutLayers: [colors.pathBrick.key, colors.pathDirt.key, colors.pathStone.key],
  // requireLayer: colors.sand.key, // sand is always drawn below everything else
};
pathDefinition[colors.pathEraser.key] = {
  cutLayers: [
    colors.pathBrick.key,
    colors.pathDirt.key,
    colors.pathSand.key,
    colors.pathStone.key,
  ],
};

const layerDefinition = {};
// layerDefinition[colors.water] = {
//  elevation: -5,
//  addLayers: [colors.water],
//  cutLayers: [colors.rock],
//  limit: true,
// };
layerDefinition[colors.level3.key] = {
  priority: 50,
  elevation: 40,
  addLayers: [
    colors.sand.key,
    colors.level1.key,
    colors.level2.key,
    colors.level3.key,
  ],
  cutLayers: [colors.rock.key, colors.water.key],
};
layerDefinition[colors.level2.key] = {
  priority: 40,
  elevation: 30,
  addLayers: [colors.sand.key, colors.level1.key, colors.level2.key],
  cutLayers: [colors.rock.key, colors.level3.key, colors.water.key],
};
layerDefinition[colors.level1.key] = {
  priority: 30,
  elevation: 20,
  addLayers: [colors.sand.key, colors.level1.key],
  cutLayers: [
    colors.rock.key,
    colors.level2.key,
    colors.level3.key,
    colors.water.key,
  ],
};
layerDefinition[colors.rock.key] = {
  priority: 20,
  elevation: 5,
  addLayers: [colors.rock.key, colors.sand.key],
  cutLayers: [
    colors.level1.key,
    colors.level2.key,
    colors.level3.key,
    colors.water.key,
  ],
};
layerDefinition[colors.sand.key] = {
  priority: 10,
  elevation: 10,
  addLayers: [colors.sand.key],
  cutLayers: [
    colors.rock.key,
    colors.level1.key,
    colors.level2.key,
    colors.level3.key,
    colors.water.key,
  ],
};
layerDefinition[colors.water.key] = {
  priority: 0,
  elevation: 0,
  addLayers: [],
  cutLayers: [
    colors.sand.key,
    colors.rock.key,
    colors.level1.key,
    colors.level2.key,
    colors.level3.key,
    colors.water.key,
  ],
};
// layerDefinition[colors.eraser.key] = {
//  elevation: 0,
//  addLayers: [],
//  cutLayers: [colors.sand.key, colors.rock.key, colors.level1.key, colors.level2.key, colors.level3.key, colors.water.key],
// };

// load assets
const svgPath = 'svg/';
const imgPath = 'img/';
const treePrefix = 'tree-';
const toolPrefix = 'tool-';
let numSvgToLoad = 0;
let numSvgLoaded = 0;
function OnLoaded() {
  numSvgLoaded++;
  if (numSvgToLoad == numSvgLoaded) {
    // all done loading
  }
}

const domParser = new DOMParser();
const loadSvg = function (filename, itemCallback) {
  numSvgToLoad++;
  project.importSVG(`${svgPath + filename}.svg`, {
    onLoad(item, svg) {
      item.remove();
      item.position = new Point(0, 0);
      itemCallback(item);
      OnLoaded();
    },
  });
};

// menuOptions
// spacing: float
// columnSpacing: float
// perColumn: int
// horizontal: bool
// menuWidth: float
// noPointer: bool
// margin : float
// extraColumns: bool
// extraRows: bool

function createMenu(items, options) {
  const itemsCount = Object.keys(items).length;
  const spacing = options.spacing == null ? 50 : options.spacing;
  const perColumn = options.perColumn == null ? itemsCount : options.perColumn;
  const extraColumns = options.extraColumns == null ? 0 : options.extraColumns;
  const extraRows = options.extraRows == null ? 0 : options.extraRows;
  const columnSpacing =
    options.columnSpacing == null ? 60 : options.columnSpacing;
  const horizontal = options.horizontal == null ? false : options.horizontal;
  const noPointer = options.noPointer == null ? false : options.noPointer;
  const margin = options.margin == null ? 35 : options.margin;
  let i = 0;
  const iconMenu = new Group();

  const columns = Math.ceil(itemsCount / perColumn) + extraColumns;

  const menuLongPosition = -margin;
  const menuShortPosition = -0.5 * columnSpacing;
  const menuLongDimension = 2 * margin + spacing * (perColumn - 1 + extraRows);
  const menuShortDimension = columnSpacing * columns;
  const backing = new Path.Rectangle(
    new Rectangle(
      horizontal ? menuLongPosition : menuShortPosition,
      horizontal ? menuShortPosition : menuLongPosition,
      horizontal ? menuLongDimension : menuShortDimension,
      horizontal ? menuShortDimension : menuLongDimension
    ),
    Math.min(columnSpacing / 2, 30)
  );
  backing.fillColor = colors.paper.color;

  let triangle;
  if (!noPointer) {
    triangle = new Path.RegularPolygon(new Point(0, 0), 3, 14);
    triangle.fillColor = colors.paper.color;
    triangle.rotate(-90);
    triangle.scale(0.5, 1);
    // respond to horizontal
    triangle.position -= new Point(30 + 3.5, 0);
  } else {
    triangle = new Path();
  }
  iconMenu.addChildren([backing, triangle]);

  const buttonMap = objectMap(items, (item, name) => {
    const column = Math.floor(i / perColumn);
    const buttonLongDimension = spacing * (i - column * perColumn);
    const buttonShortDimension = columnSpacing * (column + extraColumns);
    item.position = new Point(
      horizontal ? buttonLongDimension : buttonShortDimension,
      horizontal ? buttonShortDimension : buttonLongDimension
    );
    iconMenu.addChild(item);
    i++;
    return item;
  });

  iconMenu.data = {
    buttonMap,
    update(selectedButton) {
      Object.keys(buttonMap).forEach((name) => {
        buttonMap[name].data.select(name == selectedButton);
      });
    },
    setPointer(distance) {
      triangle.position += new Point(0, distance);
    },
  };

  return iconMenu;
}

let brushSizeUI;
function showBrushSizeUI(isShown) {
  if (brushSizeUI == null) {
    const group = new Group();
    group.applyMatrix = false;
    const brushPreview = new Path();
    if (brushSegments) {
      brushPreview.segments = brushSegments;
    }
    brushPreview.fillColor = paintColor.color;
    brushPreview.strokeColor = colors.lightText.color;
    brushPreview.strokeWidth = 0.1;

    brushSizeText = new PointText(0, 28);
    brushSizeText.fontFamily = 'TTNorms, sans-serif';
    brushSizeText.fontSize = 14;
    brushSizeText.fillColor = colors.text.color;
    brushSizeText.justification = 'center';

    emitter.on('updateBrush', update);
    function update() {
      if (brushSegments) {
        brushPreview.segments = brushSegments;
        brushPreview.bounds.height = Math.min(
          30,
          5 * brushPreview.bounds.height
        );
        brushPreview.bounds.width = Math.min(30, 5 * brushPreview.bounds.width);
        brushPreview.position = new Point(0, 0);
      }
      brushSizeText.content = brushSize;
    }
    update();

    function brushButton(path, onPress) {
      const icon = new Raster(path);
      icon.scaling = 0.45;
      return createButton(icon, 20, onPress, {
        highlightedColor: colors.paperOverlay.color,
        selectedColor: colors.paperOverlay2.color,
      });
    }
    function brushLineButton(path, onPress) {
      const icon = new Raster(path);
      icon.scaling = 0.45;
      return createButton(icon, 20, onPress, {
        highlightedColor: colors.paperOverlay.color,
        selectedColor: colors.yellow.color,
      });
    }

    const increaseButton = brushButton('img/ui-plus.png', incrementBrush);
    const decreaseButton = brushButton('img/ui-minus.png', decrementBrush);
    increaseButton.position = new Point(0, 70);
    decreaseButton.position = new Point(0, 110);

    const drawLineButton = brushLineButton('img/menu-drawline.png', () => {
      setBrushLineForce(true);
    });
    const drawBrushButton = brushLineButton('img/menu-drawbrush.png', () => {
      setBrushLineForce(false);
    });
    emitter.on('updateBrushLineForce', updateBrushLineButton);
    function updateBrushLineButton(isBrushLine) {
      drawLineButton.data.select(isBrushLine);
      drawBrushButton.data.select(!isBrushLine);
    }
    updateBrushLineButton(brushLineForce);

    drawLineButton.position = new Point(0, 210);
    drawBrushButton.position = new Point(0, 170);

    const backingWidth = 42;
    const brushSizeBacking = new Path.Rectangle(
      -backingWidth / 2,
      0,
      backingWidth,
      153,
      backingWidth / 2
    );
    brushSizeBacking.strokeColor = colors.paperOverlay2.color;
    brushSizeBacking.strokeWidth = 2;
    brushSizeBacking.position += new Point(0, -22);

    const brushLineBacking = new Path.Rectangle(
      -backingWidth / 2,
      0,
      backingWidth,
      82,
      backingWidth / 2
    );
    brushLineBacking.strokeColor = colors.paperOverlay2.color;
    brushLineBacking.strokeWidth = 2;
    brushLineBacking.position += new Point(0, 149);

    group.addChildren([
      brushPreview,
      brushSizeText,
      brushSizeBacking,
      increaseButton,
      decreaseButton,
      brushLineBacking,
      drawLineButton,
      drawBrushButton,
    ]);
    group.pivot = new Point(0, 0);
    group.position = new Point(105, 55);
    brushSizeUI = group;
  }
  brushSizeUI.bringToFront();
  brushSizeUI.visible = isShown;
}

let atomicObjectId = 0;

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
  if (encodingVersion == 0) {
    return objectMap(objectGroups, (encodedData) =>
      decodeObject(encodedData, version)
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
        encodingVersion
      );
    }
  });
  return objects;
}

function decodeObject(encodedData, encodingVersion) {
  const position = new Point(encodedData.position);
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

function getObjectData(objectDefinition) {
  return {
    category: objectDefinition.category,
    type: objectDefinition.type,
  };
}

function createObjectIcon(objectDefinition, itemData) {
  const item = objectDefinition.icon.clone({ insert: false });
  if (objectDefinition.colorData) {
    item.fillColor = objectDefinition.colorData.color;
  }
  return item;
}

function createObjectBase(objectDefinition, itemData) {
  let item = createObjectIcon(objectDefinition, itemData);
  item.scaling = objectDefinition.scaling;

  if (item.resolution) {
    item = new Group(item);
  }

  item.pivot = item.bounds.bottomCenter;
  item.pivot += objectDefinition.offset;
  item.position = new Point(0, 0);

  const group = new Group();

  const bound = new Path.Rectangle(
    new Rectangle(item.position, objectDefinition.size),
    0.15
  );
  bound.strokeColor = 'white';
  bound.strokeColor.alpha = 0;
  bound.strokeWidth = 0.1;
  bound.fillColor = 'white';
  bound.fillColor.alpha = 0.0001;
  group.addChildren([item, bound]);
  group.pivot = bound.bounds.topLeft;

  group.elements = {
    icon: item,
    bound,
  };
  group.data = itemData;
  group.definition = objectDefinition;

  return group;
}

function createObjectPreview(objectDefinition, itemData) {
  mapOverlayLayer.activate();
  const group = createObjectBase(objectDefinition, itemData);
  return group;
}

function createObject(objectDefinition, itemData) {
  mapIconLayer.activate();

  const group = createObjectBase(objectDefinition, itemData);
  if (objectDefinition.extraObject) {
    group.insertChild(0, objectDefinition.extraObject());
  }

  group.state = {
    selected: false,
    focused: false,
  };
  group.onDelete = function () {
    const command = objectDeleteCommand(group.data, group.position);
    applyCommand(command, true);
    addToHistory(command);
  };
  group.showDeleteButton = function (show) {
    var { deleteButton } = group.data;

    if (show && deleteButton == null) {
      const icon = new Raster('img/ui-x.png');
      icon.scaling = 0.03;

      const buttonBacking = new Path.Circle(0, 0, 0.9);
      buttonBacking.fillColor = colors.offWhite.color;
      const button = createButton(icon, 0.8, (event) => {
        group.onDelete();
        event.stopPropagation();
      });
      var deleteButton = new Group();
      deleteButton.applyMatrix = false;
      deleteButton.addChildren([buttonBacking, button]);
      group.addChild(deleteButton);
      deleteButton.position = this.elements.bound.bounds.topRight;
      group.data.deleteButton = deleteButton;
    }
    if (!show && deleteButton != null) {
      deleteButton.remove();
      group.data.deleteButton = null;
    }
  };
  group.onSelect = function (isSelected) {
    if (group.state.selected != isSelected) {
      this.state.selected = isSelected;
      this.elements.bound.strokeWidth = isSelected ? 0.2 : 0.1;
      this.elements.bound.strokeColor = isSelected
        ? colors.selection.color
        : 'white';
      this.elements.bound.strokeColor.alpha = group.state.focused ? 1 : 0;

      group.showDeleteButton(isSelected);
    }
  };
  group.onMouseEnter = function (event) {
    this.state.focused = true;
    this.elements.bound.strokeColor.alpha = this.state.selected ? 1 : 0.6;
  };
  group.onMouseLeave = function (event) {
    this.state.focused = false;
    this.elements.bound.strokeColor.alpha = this.state.selected ? 1 : 0;
  };
  group.onMouseDown = function (event) {
    // if (Key.isDown('alt')) {
    //  toolState.switchTool(toolState.toolMapValue(
    //    toolCategoryDefinition[this.definition.category],
    //    this.definition,
    //    {}));
    //  return;
    // }

    this.elements.bound.strokeColor.alpha = 1;
    const coordinate = mapOverlayLayer.globalToLocal(event.point);
    this.data.prevPosition = this.position;
    this.data.wasMoved = false;
    this.data.clickPivot = coordinate - this.pivot;
    grabObject(coordinate, this);
  };
  group.onMouseDrag = function (event) {
    const coordinate = mapOverlayLayer.globalToLocal(event.point);
    this.position = (coordinate - this.data.clickPivot).round();
    if (this.position.getDistance(this.data.prevPosition, true) > 0.1) {
      this.data.wasMoved = true;
    }
    dragObject(coordinate, this);
  };
  group.onMouseUp = function (event) {
    this.elements.bound.strokeColor.alpha = this.state.selected ? 1 : 0.6;
    const { prevPosition } = this.data;
    if (!prevPosition) return;
    const coordinate = mapOverlayLayer.globalToLocal(event.point);

    // if the object was clicked, not dragged
    if (!this.data.wasMoved) {
      toolState.selectObject(this);
    }

    delete this.data.prevPosition;
    delete this.data.clickPivot;
    if (prevPosition != coordinate.position) {
      dropObject(coordinate, this, prevPosition);
    }
  };

  return group;
}

function createObjectPreviewAsync(objectData, callback) {
  toolCategoryDefinition[objectData.category].tools.getAsyncValue((tools) => {
    callback(createObjectPreview(tools[objectData.type], objectData));
  });
}

function createObjectAsync(objectData, callback) {
  toolCategoryDefinition[objectData.category].tools.getAsyncValue((tools) => {
    callback(createObject(tools[objectData.type], objectData));
  });
}

mapLayer.activate();

// ===============================================
// GLOBAL FUNCTIONS

function onResize(event) {
  // Whenever the window is resized, recenter the path:
  resizeCoordinates();
  drawBackground();
  emitter.emit('resize', event);
}

tool.minDistance = 1;

let prevViewMatrix = view.matrix.clone();

const inverted = view.matrix.inverted();
fixedLayer.activate();

//  cloudLayer.matrix = view.matrix.inverted();
//  cloudLayer.scale(2, view.projectToView(new Point(0, 0)));
//  cloudLayer.bounds.topLeft = view.projectToView(new Point(0, 0));
function onFrame() {
  if (!view.matrix.equals(prevViewMatrix)) {
    const inverted = view.matrix.inverted();
    backgroundLayer.matrix = inverted;

    fixedLayer.matrix = inverted;
    modalLayer.matrix = inverted;
    prevViewMatrix = view.matrix.clone();

    //      // clouds shift w/ parallax while scrolling
    //      cloudLayer.matrix = inverted;
    //      cloudLayer.scale(2, view.projectToView(new Point(0, 0)));
    //      cloudLayer.bounds.topLeft = view.projectToView(new Point(0, 0));
  }
  // fixedLayer.pivot = new Point(0, 0);
  // fixedLayer.position = view.viewSize.topLeft;
  // var inverseZoom = 1 / view.zoom;

  // fixedLayer.scaling = new Point(inverseZoom, inverseZoom);
}
mapLayer.activate();

// ===============================================
// BACKGROUND

//  cloudLayer.activate();
//  for (var i = 0; i < 20; i ++) {
//    var cloud = new Raster('img/cloud1.png');
//    cloud.position = new Point((i % 2 + 2) * 120, (i % 2 + 3) * 120);
//  }

backgroundLayer.activate();
const backgroundRect = new Path();
backgroundRect.fillColor = colors.water.color;
backgroundRect.onMouseEnter = function (event) {
  toolState.focusOnCanvas(true);
};
backgroundRect.onMouseLeave = function (event) {
  toolState.focusOnCanvas(false);
};

onMouseDown = function onMouseDown(event) {
  if (isSpaceDown) return;
  toolState.onDown(event);
  if (toolState.toolIsActive)
    toolState.activeTool.definition.onMouseDown(event);
};
onMouseMove = function onMouseMove(event) {
  if (toolState.toolIsActive) {
    toolState.activeTool.definition.onMouseMove(event);
  }
};
onMouseDrag = function onMouseDrag(event) {
  if (isSpaceDown) return;
  if (toolState.toolIsActive)
    toolState.activeTool.definition.onMouseDrag(event);
};
onMouseUp = function onMouseUp(event) {
  if (isSpaceDown) return;
  toolState.onUp(event);
  if (toolState.toolIsActive) toolState.activeTool.definition.onMouseUp(event);
};

function drawBackground() {
  const topLeft = new Point(0, 0); // + view.bounds.topLeft;
  const center = new Point(
    view.bounds.width,
    (view.bounds.height * view.scaling.y) / 2
  ); // + view.bounds.topLeft * 2;
  const bottomRight = new Point(
    view.bounds.width * view.scaling.x,
    view.bounds.height * view.scaling.y
  ); // + view.bounds.topLeft * 2;

  backgroundRect.segments = [
    new Point(0, 0),
    new Point(view.size.width * view.scaling.x, 0),
    new Point(
      view.size.width * view.scaling.x,
      view.size.height * view.scaling.y
    ),
    new Point(0, view.size.height * view.scaling.y),
  ];
  mapLayer.activate();
}

function jumpTween(item) {
  item.Tween();
}

// ===============================================
// MAIN UI
window.addEventListener('beforeunload', (e) => {
  if (actionsSinceSave == 0) {
    return undefined;
  }

  const confirmationMessage =
    'It looks like you have been editing something. ' +
    'If you leave before saving, your changes will be lost.';
  (e || window.event).returnValue = confirmationMessage; // Gecko + IE
  return confirmationMessage; // Gecko + Webkit, Safari, Chrome etc.
});

function downloadText(filename, text) {
  downloadDataURL(
    filename,
    `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
  );
}

function downloadDataURL(filename, data) {
  const element = document.createElement('a');
  element.setAttribute('href', data);
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function autosaveMap() {
  if (localStorage) {
    localStorage.setItem('autosave', encodeMap());
    actionsSinceSave = 0;
    return true;
  }
  console.log('Cannot autosave: your browser does not support local storage.');
  return false;
}
editor.autosaveMap = autosaveMap;
function tryLoadAutosaveMap() {
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

function saveMapToFile() {
  let mapJson = encodeMap();
  mapJson = LZString.compress(mapJson);

  const saveMargins = new Point(10, 10);

  uiLayer.activate();
  const mapRaster = mapLayer.rasterize();
  const mapPositionDelta = mapLayer.globalToLocal(mapLayer.bounds.topLeft);

  const iconsRaster = mapIconLayer.rasterize();
  const iconsPositionDelta = mapIconLayer.globalToLocal(
    mapIconLayer.bounds.topLeft
  );

  const gridClone = gridRaster.clone();

  const mapBounds = gridRaster.bounds.clone();
  mapBounds.size += saveMargins;
  mapBounds.point -= saveMargins / 2;
  const mapBoundsClippingMask = new Path.Rectangle(mapBounds);

  const background = mapBoundsClippingMask.clone();
  background.fillColor = colors.water.color;

  mapBoundsClippingMask.clipMask = true;

  const text = new PointText(mapBounds.bottomRight - new Point(2, 2));
  text.justification = 'right';
  text.content = 'made at eugeneration.github.io/HappyIslandDesigner';
  text.fontFamily = 'TTNorms, sans-serif';
  text.fillColor = colors.oceanDark.color;
  text.strokeWidth = 0;
  text.fontSize = 2;
  text.selected = true;

  const group = new Group();
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
  mapRaster.scaling /= mapLayer.scaling;
  mapRaster.bounds.topLeft = mapPositionDelta;

  iconsRaster.scaling /= mapLayer.scaling;
  iconsRaster.bounds.topLeft = iconsPositionDelta;

  const combinedImage = group.rasterize(708.5);
  combinedImage.position.x += 200;
  combinedImage.remove();
  group.remove();

  const mapRasterSize = combinedImage.size;
  let mapRasterData = combinedImage.toDataURL();

  const shadowCanvas = document.createElement('canvas');
  const shadowCtx = shadowCanvas.getContext('2d');
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
    false
  );

  autosaveMap();
}

function loadMapFromFile() {
  readFile = function (e) {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      const dataURL = e.target.result;

      const image = new Image();
      image.src = dataURL;
      image.addEventListener(
        'load',
        () => {
          const mapJSONString = steg.decode(dataURL, {
            height: image.height,
            width: image.width,
          });
          clearMap();

          var json;
          try {
            var json = JSON.parse(mapJSONString);
          } catch (e) {
            var json = JSON.parse(LZString.decompress(mapJSONString));
          }
          const map = decodeMap(json);

          setNewMapData(map);
        },
        false
      );
    };
    reader.readAsDataURL(file);
  };
  fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  fileInput.onchange = readFile;
  clickElem(fileInput);
}

function clickElem(elem) {
  // Thx user1601638 on Stack Overflow (6/6/2018 - https://stackoverflow.com/questions/13405129/javascript-create-and-save-file )
  const eventMouse = document.createEvent('MouseEvents');
  eventMouse.initMouseEvent(
    'click',
    true,
    false,
    window,
    0,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null
  );
  elem.dispatchEvent(eventMouse);
}

// ===============================================
// UI ELEMENTS

// highlightedColor: string
// selectedColor: string

function createButton(item, buttonSize, onClick, options) {
  const highlightedColor =
    !options || options.highlightedColor == null
      ? colors.sand.color
      : options.highlightedColor;
  const selectedColor =
    !options || options.selectedColor == null
      ? colors.npc.color
      : options.selectedColor;

  const group = new Group();

  const button = new Path.Circle(0, 0, buttonSize);

  group.applyMatrix = false;
  group.addChildren([button, item]);

  function updateColor() {
    button.fillColor =
      group.data.selected || group.data.pressed
        ? selectedColor
        : highlightedColor;
    button.fillColor.alpha = group.data.selected
      ? 1
      : group.data.pressed
      ? 0.5
      : group.data.hovered
      ? 1
      : 0.0001;
  }
  updateColor();

  group.data = {
    selected: false,
    hovered: false,
    pressed: false,
    disabled: false,
    select(isSelected) {
      group.data.selected = isSelected;
      updateColor();
    },
    hover(isHover) {
      group.data.hovered = isHover;
      updateColor();
    },
    press(isPressed) {
      group.data.pressed = isPressed;
      updateColor();
    },
    disable(isDisabled) {
      group.data.disabled = isDisabled;
      item.opacity = isDisabled ? 0.5 : 1;
      if (isDisabled) group.data.hover(false);
    },
  };
  group.onMouseEnter = function (event) {
    if (group.data.disabled) return;
    group.data.hover(true);
  };
  group.onMouseLeave = function (event) {
    if (group.data.disabled) return;
    group.data.press(false);
    group.data.hover(false);
  };
  group.onMouseDown = function (event) {
    if (group.data.disabled) return;
    group.data.press(true);
  };
  group.onMouseUp = function (event) {
    if (group.data.disabled) return;
    if (group.data.pressed) onClick(event, group);
    group.data.press(false);
  };
  return group;
}

// ===============================================
// TOOLS

fixedLayer.activate();

// var menuButton = new Path();
// menuButton.strokeColor = colors.selected.color;
// //menuButton.strokeColor *= 0.9;
// menuButton.strokeWidth = 120;
// menuButton.strokeCap = 'round';
// menuButton.segments = [
//  new Point(-20, 0),
//  new Point(0, 0),
// ];

function renderModal(name, width, height, onDismiss) {
  const topLeft = new Point(0, 0); // + view.bounds.topLeft;
  const center = new Point(
    (view.bounds.width * view.scaling.x) / 2,
    (view.bounds.height * view.scaling.y) / 2
  ); // + view.bounds.topLeft * 2;
  const bottomRight = new Point(
    view.bounds.width * view.scaling.x,
    view.bounds.height * view.scaling.y
  ); // + view.bounds.topLeft * 2;

  modalLayer.activate();

  const group = new Group();

  const darkFill = new Path.Rectangle(new Rectangle(topLeft, bottomRight));
  darkFill.fillColor = colors.offBlack.color;
  darkFill.fillColor.alpha = 0.3;
  darkFill.onMouseUp = onDismiss;

  const modal = new Path.Rectangle(
    new Rectangle(center.x - width / 2, center.y - height / 2, width, height),
    60
  );
  modal.fillColor = colors.paper.color;
  modal.onMouseEnter = function (event) {
    group.data.text.content = name;
  };

  const modalContents = new Group();
  modalContents.applyMatrix = false;
  modalContents.pivot = new Point(0, 0);
  modalContents.position = modal.bounds.topLeft + new Point(40, 120);
  modalContents.data = {
    addElement() {},
  };

  group.data = {
    width: modal.bounds.width - 40 * 2,
    height: modal.bounds.height - 120 - 40,
    contents: modalContents,
  };

  emitter.on('resize', () => {
    const topLeft = new Point(0, 0); // + view.bounds.topLeft;
    const center = new Point(
      (view.bounds.width * view.scaling.x) / 2,
      (view.bounds.height * view.scaling.y) / 2
    ); // + view.bounds.topLeft * 2;
    const bottomRight = new Point(
      view.bounds.width * view.scaling.x,
      view.bounds.height * view.scaling.y
    ); // + view.bounds.topLeft * 2;

    // var topLeft = view.viewToProject(view.projectToView(new Point(0, 0)));// + view.bounds.topLeft;
    // var center = view.viewToProject(view.projectToView(new Point(view.bounds.width / 2, view.bounds.height / 2)));// + view.bounds.topLeft * 2;
    // var bottomRight = view.viewToProject(view.projectToView(new Point(view.bounds.width, view.bounds.height)));// + view.bounds.topLeft * 2;

    darkFill.bounds = new Rectangle(topLeft, bottomRight);
    modal.position = center;
    modalContents.position = modal.bounds.topLeft + new Point(40, 135);
  });

  const text = new PointText(new Point(group.data.width / 2, -50));
  text.justification = 'center';
  (text.content = name), (text.fontSize = 20);
  text.fontFamily = 'TTNorms, sans-serif';
  text.fillColor = colors.text.color;
  modalContents.addChild(text);

  const statusBar = new Raster('img/ui-phonestatus.png');
  statusBar.scaling = 0.35;
  statusBar.position = new Point(group.data.width / 2 - 10, -93);
  modalContents.addChild(statusBar);

  const time = new PointText(new Point(group.data.width / 2, -90));
  time.justification = 'center';
  time.fontSize = 12;
  time.fontFamily = 'TTNorms, sans-serif';
  time.fillColor = colors.lightText.color;
  time.content = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  setInterval(() => {
    time.content = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, 10000);
  modalContents.addChild(time);

  group.addChildren([darkFill, modal, modalContents]);

  group.data.text = text;

  return group;
}

let helpMenu;
function showHelpMenu(isShown) {
  if (helpMenu == null) {
    helpMenu = renderModal('Hotkeys', 340, 560, () => {
      showHelpMenu(false);
    });
    helpMenu.onMouseUp = function () {
      showHelpMenu(false);
    };

    const helpText = new PointText(new Point(80, -10));
    helpText.justification = 'right';
    helpText.fontSize = 16;
    helpText.fontFamily = 'TTNorms, sans-serif';
    helpText.fillColor = colors.oceanText.color;
    helpText.content =
      'space+drag\n' +
      'alt+scroll\n' +
      '\\\n' +
      'shift+drag\n' +
      '[ ]\n' +
      'p\n' +
      'alt+click\n' +
      'delete\n' +
      'ctrl + z\n' +
      'ctrl + y\n' +
      '\n' +
      'v\n' +
      'b\n' +
      'n\n' +
      'm\n' +
      '\n' +
      'ctrl + s\n' +
      'ctrl + o\n' +
      'esc\n' +
      '?\n' +
      '';

    const helpText2 = new PointText(new Point(100, -10));
    helpText2.justification = 'left';
    helpText2.fontSize = 16;
    helpText2.fontFamily = 'TTNorms, sans-serif';
    helpText2.fillColor = colors.text.color;
    helpText2.content =
      'pan\n' +
      'zoom\n' +
      'toggle grid\n' +
      'draw line\n' +
      'adjust brush size\n' +
      'square/circle brush\n' +
      'color pick\n' +
      'delete selection\n' +
      'undo\n' +
      'redo\n' +
      '\n' +
      'terrain tool \n' +
      'path tool\n' +
      'building tool\n' +
      'amenities tool\n' +
      '\n' +
      'save\n' +
      'open map file\n' +
      'main menu\n' +
      'hotkeys\n' +
      '';

    const helpTextRaster = helpText.rasterize();
    const helpText2Raster = helpText2.rasterize();
    helpText.remove();
    helpText2.remove();

    const versionCode = new PointText(
      helpMenu.data.width / 2,
      helpMenu.data.height
    );
    versionCode.justification = 'center';
    versionCode.fontSize = 12;
    versionCode.fontFamily = 'TTNorms, sans-serif';
    versionCode.fillColor = colors.lightText.color;
    versionCode.content = 'v0.2.1';

    helpMenu.data.contents.addChildren([
      helpTextRaster,
      helpText2Raster,
      versionCode,
    ]);

    helpMenu.opacity = 0;
  }
  helpMenu.tweenTo({ opacity: isShown ? 1 : 0 }, 200);
  helpMenu.locked = !isShown;
}

let mainMenu;

function showMainMenu(isShown) {
  if (mainMenu == null) {
    if (!isShown) return;
    mainMenu = renderModal('Main Menu', 260, 370, () => {
      showMainMenu(false);
    });

    const hitSizeHalf = new Point(35, 35);
    const hitSize = new Size(70, 70);
    function createMenuButton(name, img, index, onMouseDown, onMouseEnter) {
      const buttonGroup = new Group();

      const button = new Raster(img);
      button.scaling = new Point(0.4, 0.4);
      button.locked = true;

      const hitTarget = new Path.Rectangle(
        button.position - hitSizeHalf,
        hitSize
      );
      hitTarget.fillColor = colors.invisible.color;

      buttonGroup.applyMatrix = false;
      buttonGroup.addChildren([hitTarget, button]);
      buttonGroup.position = new Point(20 + index * 70, 0);

      buttonGroup.onMouseDown = function (event) {
        onMouseDown();
      };

      buttonGroup.onMouseEnter = function (event) {
        mainMenu.data.text.content = name;

        button.position = new Point(0, 0);
        button.animate([
          {
            properties: {
              position: { y: '-5' },
              scale: 1.1,
            },
            settings: {
              duration: 60,
              easing: 'linear',
            },
          },
          {
            properties: {
              position: { y: '+7' },
            },
            settings: {
              duration: 60,
              easing: 'linear',
            },
          },
          {
            properties: {
              position: { y: '-2' },
            },
            settings: {
              duration: 120,
              easing: 'linear',
            },
          },
        ]);
      };
      buttonGroup.onMouseLeave = function (event) {
        button.animate({
          properties: {
            scale: 1,
          },
          settings: {
            duration: 60,
            easing: 'linear',
          },
        });
      };

      return buttonGroup;
    }

    const saveButton = createMenuButton(
      'Save as Image',
      'img/menu-save.png',
      0,
      () => {
        saveMapToFile();
      }
    );
    const loadButton = createMenuButton(
      'Load Map',
      'img/menu-open.png',
      1,
      () => {
        loadMapFromFile();
      }
    );
    const newButton = createMenuButton('New Map', 'img/menu-new.png', 2, () => {
      const r = confirm('Clear your map? You will lose all unsaved changes.');
      if (r == true) {
        loadTemplate();
      } else {
      }
    });

    const twitterButton = createMenuButton(
      'Twitter',
      'img/menu-twitt.png',
      0,
      () => {
        window.open('https://twitter.com/island_designer', '_blank');
      }
    );
    twitterButton.position = new Point(0, 210);

    mainMenu.data.contents.addChildren([
      saveButton,
      loadButton,
      newButton,
      twitterButton,
    ]);
    mainMenu.opacity = 0;
  }
  mainMenu.tweenTo({ opacity: isShown ? 1 : 0 }, 200);
  mainMenu.locked = !isShown;
}

const leftToolMenu = new Group();
leftToolMenu.applyMatrix = false;
leftToolMenu.position = [30, 0];

const leftToolMenuBacking = new Path();
leftToolMenuBacking.strokeColor = colors.paper.color;
leftToolMenuBacking.strokeWidth = 120;
leftToolMenuBacking.strokeCap = 'round';
leftToolMenuBacking.segments = [new Point(-30, -0), new Point(-30, 480)];
leftToolMenu.addChild(leftToolMenuBacking);

const leftToolMenuPosition = new Point(0, 100);
const leftToolMenuIconHeight = 50;

function addToLeftToolMenu(icon) {
  if (icon == null) {
    //      // create spacer
    //      icon = new Path.Rectangle(0, 0, 40, 2);
    //      icon.fillColor = colors.lightText.color;
    //      icon.position = leftToolMenuPosition - new Point(0, leftToolMenuIconHeight / 4);
    //      leftToolMenu.addChild(icon);
    leftToolMenuPosition.y += leftToolMenuIconHeight / 2;
    return;
  }

  icon.position = leftToolMenuPosition;
  leftToolMenu.addChild(icon);
  leftToolMenuPosition.y += leftToolMenuIconHeight;
}

const redoButton = undoMenuButton('img/menu-redo.png', () => {
  redo();
});
const undoButton = undoMenuButton('img/menu-undo.png', () => {
  undo();
});
const undoMenu = createMenu(
  {
    undo: undoButton,
    redo: redoButton,
  },
  {
    spacing: 38,
    columnSpacing: 45,
    margin: 23,
    horizontal: true,
    noPointer: true,
  }
);

function undoMenuButton(path, onPress) {
  const icon = new Raster(path);
  icon.scaling = 0.45;
  return createButton(icon, 20, onPress);
}
emitter.on('historyUpdate', updateUndoButtonState);
function updateUndoButtonState() {
  undoButton.data.disable(!canUndo());
  redoButton.data.disable(!canRedo());
}
updateUndoButtonState();

emitter.on('resize', () => {
  positionUndoMenu();
});
function positionUndoMenu() {
  undoMenu.position =
    new Point(view.bounds.width * view.scaling.x, 0) + new Point(-50, 30);
}
positionUndoMenu();

// layout for mobile version
// var mainMenuButton = new Path.Circle(new Point(view.center.x, 0), 40);
// mainMenuButtonIcon.position = new Point(view.center.x, 20);

const mainMenuButton = new Path.Circle(new Point(30, 30), 24);
mainMenuButton.fillColor = colors.pink.color;
mainMenuButton.opacity = 0.00001;
mainMenuButtonIcon = new Group();
mainMenuButtonIcon.applyMatrix = false;
mainMenuButtonIcon.position = new Point(30, 30);
mainMenuButtonIcon.addChildren([
  new Path.Rectangle({ point: [-10, -10], size: [20, 4] }),
  new Path.Rectangle({ point: [-10, -2], size: [20, 4] }),
  new Path.Rectangle({ point: [-10, 6], size: [20, 4] }),
]);
mainMenuButtonIcon.fillColor = colors.text.color;
mainMenuButtonIcon.locked = true;

mainMenuButton.onMouseEnter = function (event) {
  mainMenuButton.tweenTo({ opacity: 1 }, 150);
  mainMenuButtonIcon.tweenTo({ fillColor: colors.offWhite.color }, 150);
};
mainMenuButton.onMouseLeave = function (event) {
  mainMenuButton.tweenTo({ opacity: 0.00001 }, 150);
  mainMenuButtonIcon.tweenTo({ fillColor: colors.text.color }, 150);
};
mainMenuButton.onMouseDown = function (event) {
  mainMenuButtonIcon.fillColor = colors.yellow.color;
};
mainMenuButton.onMouseUp = function (event) {
  showMainMenu(true);
  mainMenuButton.onMouseLeave(event);
};

// =======================================
// TOOLS

// =======================================
// STRUCTURE TOOL
const AsyncObjectDefinition = ES3Class({
  constructor() {
    this.loadedCount = 0;
    this.targetCount = function () {
      return Object.keys(this.value).length;
    };
    this.onLoad = function () {
      this.loadedCount++;
      if (this.loadedCount == this.targetCount()) {
        this.loadingCallbacks.forEach((callback) => {
          callback(this.value);
        });
        this.loadingCallbacks = [];
      }
    };
    this.loadingCallbacks = [];
    this.getAsyncValue = function (callback) {
      if (this.loadedCount == this.targetCount()) {
        callback(this.value);
        return true; // returns whether the value was returned immediately
      }
      this.loadingCallbacks.push(callback);
      return false;
    };
  },
});

const asyncAmenitiesDefinition = new AsyncObjectDefinition();
asyncAmenitiesDefinition.value = {
  dock: {
    colorData: colors.dock,
    size: new Size(7, 2),
    menuScaling: new Point(0.2, 0.2),
    offset: new Point(-3.5, -1.85),
  },
  airport: {},
  center: {
    extraObject() {
      const baseGround = new Path.Rectangle(new Rectangle(0, 0, 12, 10), 1);
      baseGround.fillColor = colors.campground.color;
      baseGround.position = new Point(1, 7);
      return baseGround;
    },
  },
  townhallSprite: {
    img: 'sprite/building-townhall.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.023, 0.023),
    size: new Size(6, 4),
    offset: new Point(-3, -3.6),
    extraObject() {
      const baseGround = new Path.Rectangle(new Rectangle(0, 0, 12, 10), 1);
      baseGround.fillColor = colors.townsquare.color;
      baseGround.position = new Point(3, 5);
      return baseGround;
    },
  },
  campsiteSprite: {
    img: 'sprite/building-campsite.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.017, 0.017),
    size: new Size(4, 3),
    offset: new Point(-2, -2.6),
  },
  museumSprite: {
    img: 'sprite/building-museum.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.028, 0.028),
    size: new Size(7, 4),
    offset: new Point(-3.5, -4),
  },
  nookSprite: {
    img: 'sprite/building-nook.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.02, 0.02),
    size: new Size(7, 4),
    offset: new Point(-3.6, -3.6),
  },
  ableSprite: {
    img: 'sprite/building-able.png',
    menuScaling: new Point(0.16, 0.16),
    scaling: new Point(0.021, 0.021),
    size: new Size(5, 4),
    offset: new Point(-2.5, -3.9),
  },
  lighthouseSprite: {
    img: 'sprite/structure-lighthouse.png',
    size: new Size([2, 2]),
    scaling: new Point(0.015, 0.015),
    menuScaling: new Point(0.14, 0.14),
    offset: new Point(-1, -1.85),
  },
  lighthouse: {
    colorData: colors.pin,
    size: new Size([2, 2]),
    menuScaling: new Point(0.3, 0.3),
    offset: new Point(-1, -1.6),
  },
  airportBlue: {
    img: 'sprite/structure/airport.png',
    size: new Size([10, 6]),
    scaling: new Point(0.03, 0.03),
    menuScaling: new Point(0.14, 0.14),
    offset: new Point(-5, -5.5),
  },
  airportRed: {
    img: 'sprite/structure/airport-red.png',
    size: new Size([10, 6]),
    scaling: new Point(0.03, 0.03),
    menuScaling: new Point(0.14, 0.14),
    offset: new Point(-5, -5.5),
  },
  airportYellow: {
    img: 'sprite/structure/airport-yellow.png',
    size: new Size([10, 6]),
    scaling: new Point(0.03, 0.03),
    menuScaling: new Point(0.14, 0.14),
    offset: new Point(-5, -5.5),
  },
  airportGreen: {
    img: 'sprite/structure/airport-green.png',
    size: new Size([10, 6]),
    scaling: new Point(0.03, 0.03),
    menuScaling: new Point(0.14, 0.14),
    offset: new Point(-5, -5.5),
  },

  // legacy
  bridgeVerticalSprite: {
    legacyCategory: 'construction',
    img: 'sprite/structure-bridge-vertical.png',
  },
  bridgeHorizontalSprite: {
    legacyCategory: 'construction',
    img: 'sprite/structure-bridge-horizontal.png',
  },
  rampSprite: {
    legacy: 'stairsStoneLeft',
    legacyCategory: 'construction',
    img: 'sprite/structure-ramp.png',
  },
};
Object.keys(asyncAmenitiesDefinition.value).forEach((type) => {
  const def = asyncAmenitiesDefinition.value[type];
  def.category = 'amenities';
  def.type = type;
  def.scaling = def.scaling || new Point(0.03, 0.03);
  def.menuScaling = def.menuScaling || new Point(0.14, 0.14);
  def.size = def.size || new Size([8, 8]);
  def.offset = def.offset || new Point(-4, -7.6);
  def.onSelect = function (isSelected) {};
  // imnmediately load the assets
  if (def.img) {
    const img = new Raster(def.img);
    def.icon = img;
    def.icon.onLoad = function () {
      asyncAmenitiesDefinition.onLoad();
    };
    img.remove();
  } else {
    loadSvg(`amenity-${type}`, (item) => {
      // item.pivot += new Point(-2, -3.6);
      def.icon = item;
      asyncAmenitiesDefinition.onLoad();
    });
  }
});

const asyncConstructionDefinition = new AsyncObjectDefinition();
asyncConstructionDefinition.value = {
  bridgeStoneHorizontal: {
    img: 'sprite/construction/bridge-stone-horizontal.png',
    size: new Size(6, 4),
  },
  bridgeStoneVertical: {
    img: 'sprite/construction/bridge-stone-vertical.png',
    size: new Size(4, 6),
  },
  bridgeStoneTLBR: {
    img: 'sprite/construction/bridge-stone-tlbr.png',
    size: new Size(6, 6),
  },
  bridgeStoneTRBL: {
    img: 'sprite/construction/bridge-stone-trbl.png',
    size: new Size(6, 6),
  },
  bridgeWoodHorizontal: {
    img: 'sprite/construction/bridge-wood-horizontal.png',
    size: new Size(6, 4),
  },
  bridgeWoodVertical: {
    img: 'sprite/construction/bridge-wood-vertical.png',
    size: new Size(4, 6),
  },
  bridgeWoodTLBR: {
    img: 'sprite/construction/bridge-wood-tlbr.png',
    size: new Size(6, 6),
  },
  bridgeWoodTRBL: {
    img: 'sprite/construction/bridge-wood-trbl.png',
    size: new Size(6, 6),
  },
  bridgeVerticalSprite: {
    img: 'sprite/structure-bridge-vertical.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.026, 0.026),
    size: new Size(4, 6),
    offset: new Point(-1.5, -5),
  },
  stairsStoneUp: {
    img: 'sprite/construction/stairs-stone-up.png',
    size: new Size(2, 4),
  },
  stairsStoneDown: {
    img: 'sprite/construction/stairs-stone-down.png',
    size: new Size(2, 4),
  },
  stairsStoneLeft: {
    img: 'sprite/construction/stairs-stone-left.png',
    size: new Size(4, 2),
  },
  stairsStoneRight: {
    img: 'sprite/construction/stairs-stone-right.png',
    size: new Size(4, 2),
  },
  stairsWoodUp: {
    img: 'sprite/construction/stairs-wood-up.png',
    size: new Size(2, 4),
  },
  stairsWoodDown: {
    img: 'sprite/construction/stairs-wood-down.png',
    size: new Size(2, 4),
  },
  stairsWoodLeft: {
    img: 'sprite/construction/stairs-wood-left.png',
    size: new Size(4, 2),
  },
  stairsWoodRight: {
    img: 'sprite/construction/stairs-wood-right.png',
    size: new Size(4, 2),
  },
  // legacy
  bridgeHorizontalSprite: {
    img: 'sprite/structure-bridge-horizontal.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.026, 0.026),
    size: new Size(5, 3),
    offset: new Point(-2.8, -2.7),
  },
  rampSprite: {
    legacy: 'stairsStoneRight',
    img: 'sprite/structure-ramp.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.026, 0.026),
    size: new Size(5, 3),
    offset: new Point(-2.8, -2.7),
  },
};
Object.keys(asyncConstructionDefinition.value).forEach((type) => {
  const def = asyncConstructionDefinition.value[type];
  def.category = 'construction';
  def.type = type;
  def.scaling = def.scaling || new Point(0.029, 0.029);
  def.menuScaling = def.menuScaling || new Point(0.18, 0.18);
  def.size = def.size;
  def.offset = def.offset || new Point(-def.size.width / 2, -def.size.height);
  def.onSelect = function (isSelected) {};
  // imnmediately load the assets
  if (def.img) {
    const img = new Raster(def.img);
    def.icon = img;
    def.icon.onLoad = function () {
      asyncConstructionDefinition.onLoad();
    };
    img.remove();
  }
});

const asyncTreeDefinition = new AsyncObjectDefinition();
asyncTreeDefinition.value = {
  tree: {
    img: 'sprite/tree/tree.png',
  },
  treeApple: {
    img: 'sprite/tree/tree-apple.png',
  },
  treeCherry: {
    img: 'sprite/tree/tree-cherry.png',
  },
  treeOrange: {
    img: 'sprite/tree/tree-orange.png',
  },
  treePear: {
    img: 'sprite/tree/tree-pear.png',
  },
  treePeach: {
    img: 'sprite/tree/tree-peach.png',
  },
  treeAutumn: {
    img: 'sprite/tree/tree-autumn.png',
  },
  treeSakura: {
    img: 'sprite/tree/tree-sakura.png',
  },
  pine: {
    rename: [0, 'flatPine'],
    img: 'sprite/tree/pine.png',
  },
  palm: {
    rename: [0, 'flatPalm'],
    img: 'sprite/tree/palm.png',
  },
  bamboo: {
    img: 'sprite/tree-bamboo.png',
    menuScaling: new Point(0.26, 0.26),
    scaling: new Point(0.02, 0.02),
    offset: new Point(-0.6, -0.75),
  },

  flatBush: {
    svg: 'bush',
  },
  flatTree: {
    svg: 'fruit',
  },
  flatPalm: {
    svg: 'palm',
  },
  flatPine: {
    svg: 'pine',
  },
};
Object.keys(asyncTreeDefinition.value).forEach((type) => {
  const def = asyncTreeDefinition.value[type];
  def.category = 'tree';
  def.type = type;
  def.scaling = def.scaling || new Point(0.014, 0.014);
  def.menuScaling = def.menuScaling || new Point(0.2, 0.2);
  def.size = new Size(1, 1);
  def.offset =
    def.offset || new Point(-def.size.width / 2, -def.size.height + 0.2);
  def.onSelect = function (isSelected) {};
  // imnmediately load the assets
  if (def.svg) {
    def.colorData = colors.level3;
    def.scaling = new Point(0.03, 0.03);
    def.menuScaling = new Point(0.6, 0.6);
    def.size = def.size || new Size([1, 1]);
    def.offset = def.offset || new Point(-1, -0.75);
    def.onSelect = function (isSelected) {};
    // imnmediately load the assets
    {
      loadSvg(`tree-${def.svg}`, (item) => {
        // item.pivot += new Point(-2, -3.6);
        def.icon = item;
        asyncTreeDefinition.onLoad();
      });
    }
  } else if (def.img) {
    const img = new Raster(def.img);
    def.icon = img;
    def.icon.onLoad = function () {
      asyncTreeDefinition.onLoad();
    };
    img.remove();
  }
});

const asyncFlowerDefinition = new AsyncObjectDefinition();
asyncFlowerDefinition.value = {
  chrysanthemumWhite: {
    img: 'sprite/flower/chrysanthemum-white.png',
  },
  hyacinthRed: {
    img: 'sprite/flower/hyacinth-red.png',
  },
  hyacinthWhite: {
    img: 'sprite/flower/hyacinth-white.png',
  },
  lilyWhite: {
    img: 'sprite/flower/lily-white.png',
  },
  pansyPurple: {
    img: 'sprite/flower/pansy-purple.png',
  },
  pansyRed: {
    img: 'sprite/flower/pansy-red.png',
  },
  pansyYellow: {
    img: 'sprite/flower/pansy-yellow.png',
  },
  poppyOrange: {
    img: 'sprite/flower/poppy-orange.png',
  },
  poppyRed: {
    img: 'sprite/flower/poppy-red.png',
  },
  poppyWhite: {
    img: 'sprite/flower/poppy-white.png',
  },
  tulipRed: {
    img: 'sprite/flower/tulip-red.png',
  },
  tulipWhite: {
    img: 'sprite/flower/tulip-white.png',
  },
  tulipYellow: {
    img: 'sprite/flower/tulip-yellow.png',
  },
  //    weedBush: {
  //      img: 'sprite/flower/weed-bush.png',
  //    },
  //    weedBrush: {
  //      img: 'sprite/flower/weed-brush.png',
  //    },
  weedClover: {
    img: 'sprite/flower/weed-clover.png',
  },
  //    weedCattail: {
  //      img: 'sprite/flower/weed-cattail.png',
  //    },
  //    weedDandelion: {
  //      img: 'sprite/flower/weed-dandelion.png',
  //    },
};
Object.keys(asyncFlowerDefinition.value).forEach((type) => {
  const def = asyncFlowerDefinition.value[type];
  def.category = 'flower';
  def.type = type;
  def.scaling = def.scaling || new Point(0.016, 0.016);
  def.menuScaling = def.menuScaling || new Point(0.65, 0.65);
  def.size = new Size(1, 1);
  def.offset =
    def.offset || new Point(-def.size.width / 2, -def.size.height + 0.2);
  def.onSelect = function (isSelected) {};
  if (def.img) {
    const img = new Raster(def.img);
    def.icon = img;
    def.icon.onLoad = function () {
      asyncFlowerDefinition.onLoad();
    };
    img.remove();
  }
});

const asyncStructureDefinition = new AsyncObjectDefinition();
asyncStructureDefinition.value = {
  tentRound: {},
  tentTriangle: {},
  tentTrapezoid: {},
  hut: {},
  house: {},
  building: {},
  tentSprite: {
    img: 'sprite/building-tent.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.022, 0.022),
    size: new Size([5, 4]),
    offset: new Point(-2.5, -3.6),
  },
  playerhouseSprite: {
    img: 'sprite/building-playerhouse.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.022, 0.022),
    size: new Size([5, 4]),
    offset: new Point(-2.5, -3.6),
  },
  houseSprite: {
    img: 'sprite/building-house.png',
    menuScaling: new Point(0.17, 0.17),
    scaling: new Point(0.02, 0.02),
  },
  //    houseFlatSprite: {
  //      img: 'sprite/building-flathouse.png',
  //      menuScaling: new Point(.17, .17),
  //      scaling: new Point(.014, .014),
  //    },
  //    houseOutlineFlatSprite: {
  //      img: 'sprite/building-flathouseoutline.png',
  //      menuScaling: new Point(.17, .17),
  //      scaling: new Point(.014, .014),
  //    },
  treePineSprite: {
    legacy: 'pine',
    legacyCategory: 'tree',
    img: 'sprite/tree-pine.png',
  },
  treePalmSprite: {
    legacy: 'palm',
    legacyCategory: 'tree',
    img: 'sprite/tree-palm.png',
  },
  treeFruitSprite: {
    legacy: 'treeOrange',
    legacyCategory: 'tree',
    img: 'sprite/tree-fruit.png',
  },
  // legacy
  bush: {
    img: 'sprite/tree-fruit.png',
    legacy: 'flatBush',
    legacyCategory: 'tree',
  },
  fruit: {
    img: 'sprite/tree-fruit.png',
    legacy: 'flatTree',
    legacyCategory: 'tree',
  },
  palm: {
    img: 'sprite/tree-fruit.png',
    legacy: 'flatPalm',
    legacyCategory: 'tree',
  },
  pine: {
    img: 'sprite/tree-fruit.png',
    legacy: 'flatPine',
    legacyCategory: 'tree',
  },
};
// set up the definitions programatically because they are all the same
Object.keys(asyncStructureDefinition.value).forEach((structureType) => {
  const def = asyncStructureDefinition.value[structureType];
  def.category = 'structures';
  def.type = structureType;

  {
    def.colorData = colors.npc;
    def.scaling = def.scaling || new Point(0.032, 0.032);
    def.menuScaling = def.menuScaling || new Point(0.3, 0.3);
    def.size = def.size || new Size(4, 4);
    def.offset = def.offset || new Point(-2, -3.6);
    def.onSelect = function (isSelected) {};
    // imnmediately load the assets
    if (def.img) {
      const img = new Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function () {
        asyncStructureDefinition.onLoad();
      };
      img.remove();
    } else {
      loadSvg(`structure-${structureType}`, (item) => {
        // item.pivot += new Point(-2, -3.6);
        def.icon = item;
        asyncStructureDefinition.onLoad();
      });
    }
  }
});

// var asyncTreeDefinition = Object.create(asyncObjectDefinition);
// asyncTreeDefinition.value = {
//
// }

// =======================================
// BASE LEVEL TOOLS

const baseToolCategoryDefinition = {
  onSelect(subclass, isSelected, isReselected) {
    subclass.icon.data.select(isSelected);

    if (isReselected) this.toggleMenu(subclass);
    else this.openMenu(subclass, isSelected);

    if (!isSelected) subclass.enablePreview(isSelected);
  },
  onMouseMove(subclass, event) {
    updateCoordinateLabel(event);
  },
  onMouseDown(subclass, event) {
    updateCoordinateLabel(event);
  },
  onMouseDrag(subclass, event) {
    updateCoordinateLabel(event);
  },
  onMouseUp(subclass, event) {
    updateCoordinateLabel(event);
  },
  onKeyDown(subclass, event) {},
  enablePreview(subclass, isEnabled) {},
  toggleMenu(subclass) {
    if (subclass.openMenu) {
      subclass.openMenu(!(subclass.iconMenu && subclass.iconMenu.visible));
    }
  },
  openMenu(subclass, isSelected) {
    if (subclass.openMenu) {
      subclass.openMenu(isSelected);
    }
  },
  updateTool(subclass, prevToolData, nextToolData, isToolTypeSwitch) {
    const sameToolType =
      prevToolData &&
      prevToolData.definition.type === nextToolData.definition.type;
    if (!sameToolType) {
      if (prevToolData) {
        prevToolData.definition.onSelect(false);
      }
      nextToolData.definition.onSelect(true);
    } else if (isToolTypeSwitch) {
      // user pressed the tool menu button - toggle the menu visibility
      prevToolData.definition.onSelect(true, true);
    }
    {
      const prevTool =
        prevToolData && prevToolData.tool ? prevToolData.tool.type : null;
      const nextTool =
        nextToolData && nextToolData.tool ? nextToolData.tool.type : null;
      const sameTool = sameToolType && prevTool === nextTool;
      if (!sameTool) {
        if (prevToolData && prevToolData.tool && prevToolData.tool.onSelect)
          prevToolData.tool.onSelect(false);
        if (nextToolData && nextToolData.tool && nextToolData.tool.onSelect)
          nextToolData.tool.onSelect(true);
        // todo: decouple view from logic
        if (
          subclass.iconMenu &&
          (nextToolData.type == 'structures' ||
            nextToolData.type == 'amenities' ||
            nextToolData.type == 'construction' ||
            nextToolData.type == 'tree' ||
            nextToolData.type == 'flower')
        ) {
          subclass.iconMenu.data.update(nextTool);
          updateObjectPreview();
        }
      }
    }
  },
};

const baseObjectCategoryDefinition = {
  base: baseToolCategoryDefinition,
  // type: 'tree', // filled in by base class
  // icon: "amenities",
  // tools: asyncTreeDefinition,
  // menuOptions: {},
  // yPos: 185
  layer: mapIconLayer,
  defaultTool: null,
  modifiers: {},
  defaultModifiers: {},
  onSelect(isSelected, isReselected) {
    this.base.onSelect(this, isSelected, isReselected);
  },
  onMouseMove(event) {
    this.base.onMouseMove(this, event);
  },
  onMouseDown(event) {
    placeObject(event);
    this.base.onMouseDown(this, event);
  },
  onMouseDrag(event) {
    this.base.onMouseDrag(this, event);
  },
  onMouseUp(event) {
    this.base.onMouseUp(this, event);
  },
  onKeyDown(event) {
    this.base.onKeyDown(this, event);
  },
  enablePreview(isEnabled) {
    this.base.enablePreview(this, isEnabled);
    if (objectPreviewOutline) objectPreviewOutline.visible = isEnabled;
    if (objectPreview) objectPreview.visible = isEnabled;
  },
  openMenu(isSelected) {
    if (this.iconMenu == null) {
      this.tools.getAsyncValue((definitions) => {
        fixedLayer.activate();
        const categoryDefinition = this;
        this.iconMenu = createMenu(
          objectMap(definitions, (def, name) => {
            if (def.legacy || def.legacyCategory) return null;
            const icon = createObjectIcon(def, getObjectData(def));
            icon.scaling = def.menuScaling;
            return createButton(icon, 20, (event, button) => {
              toolState.switchTool(
                toolState.toolMapValue(categoryDefinition, def, {})
              );
            });
          }),
          this.menuOptions
        );
        this.iconMenu.data.setPointer(this.yPos);
        this.iconMenu.pivot = new Point(0, 0);
        this.iconMenu.position = new Point(100, 45);
        // this is a little messy
        if (toolState.activeTool && toolState.activeTool.tool) {
          this.iconMenu.data.update(toolState.activeTool.tool.type);
        }
        this.iconMenu.visible = isSelected;
      });
    } else {
      this.iconMenu.visible = isSelected;
    }
  },
};

var toolCategoryDefinition = {
  //    pointer: {
  //      base: baseToolCategoryDefinition,
  //      type: 'pointer',
  //      layer: mapIconLayer,
  //      icon: "pointer",
  //      tools: {},
  //      defaultTool: null,
  //      modifiers: {},
  //      defaultModifiers: {
  //      },
  //      onSelect: function(isSelected) {
  //        this.base.onSelect(this, isSelected);
  //      },
  //      onMouseMove: function(event) {
  //        this.base.onMouseMove(this, event);
  //      },
  //      onMouseDown: function(event) {
  //        this.base.onMouseDown(this, event);
  //      },
  //      onMouseDrag: function(event) {
  //        this.base.onMouseDrag(this, event);
  //      },
  //      onMouseUp: function(event) {
  //        this.base.onMouseUp(this, event);
  //      },
  //      onKeyDown: function(event) {
  //        this.base.onKeyDown(this, event);
  //      },
  //      enablePreview: function(isEnabled) {
  //        this.base.enablePreview(this, isEnabled);
  //      },
  //    },
  terrain: {
    base: baseToolCategoryDefinition,
    type: 'terrain',
    layer: mapLayer,
    icon: 'color',
    modifiers: {},
    defaultModifiers: {},
    data: {
      paintColorData: colors.level1,
    },
    onSelect(isSelected, isReselected) {
      this.base.onSelect(this, isSelected, isReselected);
    },
    onMouseMove(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDown(event) {
      this.base.onMouseDown(this, event);
      if (Key.isDown('alt')) {
        const rawCoordinate = mapOverlayLayer.globalToLocal(event.point);
        updatePaintColor(getColorAtCoordinate(rawCoordinate));
      }
      startDraw(event);
    },
    onMouseDrag(event) {
      this.base.onMouseDrag(this, event);
      draw(event);
    },
    onMouseUp(event) {
      this.base.onMouseUp(this, event);
      endDraw(event);
    },
    onKeyDown(event) {
      this.base.onKeyDown(this, event);
    },
    enablePreview(isEnabled) {
      this.base.enablePreview(this, isEnabled);
      brushOutline.visible = isEnabled;
      brush.visible = isEnabled;
    },
    openMenu(isSelected) {
      if (this.iconMenu == null) {
        fixedLayer.activate();
        updatePaintColor(this.data.paintColorData);
        this.iconMenu = createMenu(
          objectMap(layerDefinition, (definition, colorKey) => {
            const colorData = colors[colorKey];
            const paintCircle = new Path.Circle(new Point(0, 0), 16);
            paintCircle.fillColor = colorData.color;
            paintCircle.locked = true;
            return createButton(paintCircle, 20, (event, button) => {
              updatePaintColor(colorData);
              this.data.paintColorData = colorData;
            });
          }),
          { spacing: 45, extraColumns: 1 }
        );
        this.iconMenu.data.setPointer(60);
        this.iconMenu.pivot = new Point(0, 0);
        this.iconMenu.position = new Point(100, 45);
        // this is a little messy
        this.iconMenu.data.update(this.data.paintColorData.key);
      }
      this.iconMenu.visible = isSelected;
      const adjusterUI = showBrushSizeUI(isSelected);
    },
  },
  path: {
    base: baseToolCategoryDefinition,
    type: 'path',
    layer: mapLayer,
    icon: 'path',
    modifiers: {},
    defaultModifiers: {},
    data: {
      paintColorData: colors.pathDirt,
    },
    onSelect(isSelected, isReselected) {
      this.base.onSelect(this, isSelected, isReselected);
    },
    onMouseMove(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDown(event) {
      this.base.onMouseDown(this, event);
      if (Key.isDown('alt')) {
        const rawCoordinate = mapOverlayLayer.globalToLocal(event.point);
        updatePaintColor(getColorAtCoordinate(rawCoordinate));
      }
      startDraw(event);
    },
    onMouseDrag(event) {
      this.base.onMouseDrag(this, event);
      draw(event);
    },
    onMouseUp(event) {
      this.base.onMouseUp(this, event);
      endDraw(event);
    },
    onKeyDown(event) {
      this.base.onKeyDown(this, event);
    },
    enablePreview(isEnabled) {
      this.base.enablePreview(this, isEnabled);
      brushOutline.visible = isEnabled;
      brush.visible = isEnabled;
    },
    openMenu(isSelected) {
      if (this.iconMenu == null) {
        fixedLayer.activate();
        updatePaintColor(this.data.paintColorData);
        const pathColorButtons = objectMap(
          pathDefinition,
          (definition, colorKey) => {
            let buttonIcon;
            const colorData = colors[colorKey];
            if (colorKey == colors.pathEraser.key) {
              buttonIcon = new Group();
              eraserImg = new Raster(`${imgPath + toolPrefix}eraser.png`);
              eraserImg.scaling = new Point(0.35, 0.35);
              buttonIcon.addChildren([eraserImg]);
            } else {
              const paintCircle = new Path.Circle(new Point(0, 0), 16);
              paintCircle.fillColor = colorData.color;
              paintCircle.locked = true;
              buttonIcon = paintCircle;
            }

            return createButton(buttonIcon, 20, (event, button) => {
              updatePaintColor(colorData);
              this.data.paintColorData = colorData;
            });
          }
        );
        this.iconMenu = createMenu(pathColorButtons, {
          spacing: 45,
          extraColumns: 1,
          extraRows: 1,
        });
        this.iconMenu.data.setPointer(110);
        this.iconMenu.pivot = new Point(0, 0);
        this.iconMenu.position = new Point(100, 45);
        // this is a little messy
        this.iconMenu.data.update(this.data.paintColorData.key);
      }
      this.iconMenu.visible = isSelected;
      const adjusterUI = showBrushSizeUI(isSelected);
    },
  },
  structures: Object.assign(Object.create(baseObjectCategoryDefinition), {
    type: 'structures',
    icon: 'structure',
    tools: asyncStructureDefinition,
    menuOptions: { spacing: 50, perColumn: 9 },
    yPos: 160,
  }),
  amenities: Object.assign(Object.create(baseObjectCategoryDefinition), {
    type: 'amenities',
    icon: 'amenities',
    tools: asyncAmenitiesDefinition,
    menuOptions: { spacing: 50, perColumn: 8 },
    yPos: 208,
  }),

  construction: Object.assign(Object.create(baseObjectCategoryDefinition), {
    type: 'construction',
    icon: 'construction',
    tools: asyncConstructionDefinition,
    menuOptions: { spacing: 50, perColumn: 9 },
    yPos: 260,
  }),

  tree: Object.assign(Object.create(baseObjectCategoryDefinition), {
    type: 'tree',
    icon: 'tree',
    tools: asyncTreeDefinition,
    menuOptions: { spacing: 50, perColumn: 8 },
    yPos: 310,
  }),
  flower: Object.assign(Object.create(baseObjectCategoryDefinition), {
    type: 'flower',
    icon: 'flower',
    tools: asyncFlowerDefinition,
    menuOptions: { spacing: 50, perColumn: 9 },
    yPos: 360,
  }),

  //  shovel: {

  // },
  //  sprite: {
  //    type: 'sprite',
  //    targetLayers: [mapIconLayer],
  //  },
};
// add additional sub functions to all definitions
Object.keys(toolCategoryDefinition).forEach((toolType) => {
  const def = toolCategoryDefinition[toolType];
  def.updateTool = function (prevToolData, nextToolData, isToolTypeSwitch) {
    def.base.updateTool(def, prevToolData, nextToolData, isToolTypeSwitch);
  };
});

// Todo: make state use a Listener paradigm rather than triggering method calls
var toolState = {
  activeTool: null,
  toolMap: {},

  selected: {},
  isSomethingSelected() {
    return Object.keys(this.selected).length > 0;
  },
  isCanvasFocused: false,
  toolIsActive: false,
  isDown: false,
  toolMapValue(definition, tool, modifiers) {
    return {
      type: definition.type,
      definition,
      tool,
      modifiers,
    };
  },
  defaultToolMapValue(toolType) {
    const def = toolCategoryDefinition[toolType];
    return this.toolMapValue(def, def.defaultTool, def.defaultModifiers);
  },
  switchToolType(toolType) {
    if (!this.toolMap.hasOwnProperty(toolType)) {
      this.switchTool(this.defaultToolMapValue(toolType), true);
    } else {
      this.switchTool(this.toolMap[toolType], true);
    }
  },
  switchTool(toolData, isToolTypeSwitch) {
    const prevTool = this.activeTool;
    this.activeTool = toolData;
    this.toolMap[toolData.type] = toolData;
    if (prevTool)
      prevTool.definition.updateTool(prevTool, toolData, isToolTypeSwitch);
    else if (toolData)
      toolData.definition.updateTool(prevTool, toolData, isToolTypeSwitch);
  },
  deleteSelection() {
    Object.keys(this.selected).forEach((objectId) => {
      const object = this.selected[objectId];
      object.onDelete();
    });
    this.deselectAll();
  },
  selectObject(object) {
    this.deselectAll();
    this.selected[object.data.id] = object;
    object.onSelect(true);
  },
  deselectObject(object) {
    delete this.selected[object.data.id];
    object.onSelect(false);
  },
  deselectAll() {
    Object.keys(this.selected).forEach((objectId) => {
      const object = this.selected[objectId];
      object.onSelect(false);
    });
    this.selected = {};
  },
  onDown(event) {
    // deactivate the tool when something is selected or dragging an object
    this.isDown = true;

    // if we didn't click on one of the selected objects, deselect them
    let clickedOnSelected = false;
    Object.keys(this.selected).forEach((objectId) => {
      const object = this.selected[objectId];
      if (object.contains(mapOverlayLayer.globalToLocal(event.point))) {
        clickedOnSelected = true;
      }
    });
    if (!clickedOnSelected) {
      this.deselectAll();
    }
  },
  onUp(event) {
    this.isDown = false;

    const isActive = this.isCanvasFocused && !this.isSomethingSelected();
    if (this.toolIsActive != isActive) {
      this.toolIsActive = isActive;
      if (this.activeTool) this.activeTool.definition.enablePreview(isActive);
    }
  },
  focusOnCanvas(isFocused) {
    this.isCanvasFocused = isFocused;
    if (!this.isDown) {
      const isActive = this.isCanvasFocused && !this.isSomethingSelected();
      if (this.toolIsActive != isActive) {
        this.toolIsActive = isActive;
        if (this.activeTool) this.activeTool.definition.enablePreview(isActive);
      }
    }
  },
};

// function squircle (size){ // squircle=square+circle
//  var hsize = size / 2; // half size
//
//  var squircle = new Path();
//
//  squircle.add(
//    new Segment(new Point(0,0), new Point(0,0), new Point(0,hsize)),
//    new Segment(new Point(0,size), new Point(0,size), new Point(hsize,size)),
//    new Segment(new Point(size,size), new Point(size,size), new Point(size,hsize)),
//    new Segment(new Point(size,0), new Point(size,0), new Point(hsize,0))
//  );
//  squircle.closed = true;
//
//  return squircle;
// }
// fixedLayer.activate();
// var box = squircle(100);
// box.fillColor = colors.npc;
// box.position = new Point(300, 300);
// box.selected = true;
//
// var d = new Path.Rectangle(300, 300, 10, 10);
// d.fillColor = colors.npc;

// var activeToolIndicator = new Path.Rectangle(0, 100, 5, 40);
// var activeToolIndicator = new Path.Circle(30, 120, 20);
// activeToolIndicator.fillColor = colors.npc;

Object.keys(toolCategoryDefinition).forEach((toolType) => {
  const def = toolCategoryDefinition[toolType];
  const tool = new Raster(`${imgPath + toolPrefix + def.icon}.png`);

  const button = createButton(tool, 20, () => {
    toolState.switchToolType(toolType);
  });
  switch (def.icon) {
    case 'color':
      tool.position = new Point(-8, 0);
      break;
  }
  tool.scaling = new Point(0.4, 0.4);

  addToLeftToolMenu(button);
  def.icon = button;
});
addToLeftToolMenu(); // spacer

var tool = new Raster(`${imgPath}menu-help.png`);
tool.scaling = new Point(0.3, 0.3);
tool.position = new Point(0, 4);
const button = createButton(tool, 20, () => {});
button.onMouseUp = function () {
  showHelpMenu(true);
};
addToLeftToolMenu(button);

// add gap
leftToolMenuPosition.y += 60;

// var activeColor = new Path.Circle([20, 20], 16);
// activeColor.fillColor = paintColor;
// addToLeftToolMenu(activeColor);

// function updateColorTools() {
//  activeColor
// }

var paintColor = colors.level1;
function updatePaintColor(colorData) {
  paintColor = colorData;
  brush.fillColor = colorData.color;
  // activeColor.fillColor = paintColor;

  // todo: separate viewfrom logic
  if (
    (toolState.activeTool &&
      toolState.activeTool.type == toolCategoryDefinition.terrain.type) ||
    toolState.activeTool.type == toolCategoryDefinition.path.type
  ) {
    if (toolState.activeTool.definition.iconMenu) {
      let toolCategory;
      if (layerDefinition[colorData.key]) {
        toolCategory = toolCategoryDefinition.terrain.type;
      } else if (pathDefinition[colorData.key]) {
        toolCategory = toolCategoryDefinition.path.type;
      }
      if (toolState.activeTool.type != toolCategory) {
        toolState.switchToolType(toolCategory);
      }

      toolState.activeTool.definition.iconMenu.data.update(colorData.key);
    }
  }
}

fixedLayer.activate();

const toolsPosition = new Point(40, 80);

// var pointerToolButton = new Raster('../img/pointer.png');
// pointerToolButton.position = toolsPosition + new Point(0, 0);
// pointerToolButton.scaling = new Point(0.2, 0.2);

var isSpaceDown = false;

function onKeyUp(event) {
  switch (event.key) {
    case 'space':
      isSpaceDown = false;
      break;
  }
}

function onKeyDown(event) {
  const shift = Key.isDown('shift');
  const control = Key.isDown('control') || Key.isDown('meta');

  const prevActiveTool = toolState.activeTool;
  switch (event.key) {
    case 'space':
      isSpaceDown = true;
      break;
    case '0':
      updatePaintColor(colors.eraser);
      break;
    case '1':
      updatePaintColor(colors.sand);
      break;
    case '2':
      updatePaintColor(colors.rock);
      break;
    case '3':
      updatePaintColor(colors.level1);
      break;
    case '4':
      updatePaintColor(colors.level2);
      break;
    case '5':
      updatePaintColor(colors.level3);
      break;
    case '6':
      updatePaintColor(colors.water);
      break;
    /*    case 'q':
        changePaintTool(paintTools.grid);
        break;
      case 'w':
        changePaintTool(paintTools.diagonals);
        break;
      case 'e':
        changePaintTool(paintTools.freeform);
        break; */
    case 's':
      if (control) {
        saveMapToFile();
        event.preventDefault();
      }
      break;
    case 'o':
      if (control) {
        loadMapFromFile();
        event.preventDefault();
      }
      break;
    case '[':
    case '{':
      decrementBrush();
      break;
    case ']':
    case '}':
      incrementBrush();
      break;
    //      case 'l':
    //        brushSweep = !brushSweep;
    //        break;
    case 'p':
      cycleBrushHead();
      break;
    //      case 'v':
    //        toolState.switchToolType(toolCategoryDefinition.pointer.type);
    //        break;
    case 'b':
      toolState.switchToolType(toolCategoryDefinition.terrain.type);
      break;
    case 'n':
      toolState.switchToolType(toolCategoryDefinition.path.type);
      break;
    case 'm':
      toolState.switchToolType(toolCategoryDefinition.structures.type);
      break;
    case ',':
      toolState.switchToolType(toolCategoryDefinition.amenities.type);
      break;
    case 'backspace':
    case 'delete':
      toolState.deleteSelection();
      break;
    case 'escape':
      var isMainMenuShown = !!(mainMenu != null && mainMenu.opacity > 0.8);
      showMainMenu(!isMainMenuShown);
      var isHelpMenuShown = !!(helpMenu != null && helpMenu.opacity > 0.8);
      if (isHelpMenuShown == true) showHelpMenu(false);
      break;
    case '?':
      var isHelpMenuShown = !!(helpMenu != null && helpMenu.opacity > 0.8);
      var isMainMenuShown = !!(mainMenu != null && mainMenu.opacity > 0.8);
      showHelpMenu(!isHelpMenuShown);
      if (isMainMenuShown == true) showMainMenu(false);
      break;
    case '\\':
      toggleGrid();
      break;
    case '/':
      console.log(encodeMap());
      break;
    case 'z':
      if (control && shift) {
        redo();
      } else if (control) {
        undo();
      }
      break;
    case 'y':
      if (control) {
        redo();
        event.preventDefault();
      }
      break;

    // temp
    //    case 'u':
    //      tracemap.opacity = Math.min(1, tracemap.opacity + 0.2);
    //      break;
    //    case 'h':
    //      tracemap.visible = !tracemap.visible;
    //      break;
    //    case 'j':
    //      tracemap.opacity = Math.max(0, tracemap.opacity -0.2);
    //      break;
    case 'k':
      Object.values(state.drawing).forEach((path) => {
        path.selected = !path.selected;
      });
      break;
  }
  if (prevActiveTool == toolState.activeTool) {
    toolState.activeTool.definition.onKeyDown(event);
  }
}

// mapOverlayLayer.activate();
// var tracemap = new Raster('img/tracemap.png');
// tracemap.locked = true;
// tracemap.position = new Point(55.85, 52.2);
// tracemap.scaling = new Point(0.082, .082);
// tracemap.opacity = 0.3;

function removeFloatingPointError(f) {
  return Math.round((f + Number.EPSILON) * 100) / 100;
}
function encodePoint(p) {
  return [removeFloatingPointError(p.x), removeFloatingPointError(p.y)];
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
  const points = [];
  for (let i = 0; i < positionArray.length; i += 2) {
    points.push(new Point(positionArray[i], positionArray[i + 1]));
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
    if (pathData.length == 0) {
      p = new Path();
    } else if (version == 0) {
      if (typeof pathData[0][0] === 'number') {
        // normal path
        p = new Path(pathData.map((p) => new Point(p)));
      } else {
        p = new CompoundPath({
          children: pathData.map(
            (pathData) => new Path(pathData.map((p) => new Point(p)))
          ),
        });
      }
    } else if (typeof pathData[0] === 'number') {
      // normal path
      p = new Path(decodePath(pathData));
    } else {
      p = new CompoundPath({
        children: pathData.map((pathData) => new Path(decodePath(pathData))),
      });
    }
    p.locked = true;
    p.fillColor = colorData.color;
    decodedDrawing[colorData.key] = p;
  });
  return decodedDrawing;
}

function encodeMap(compress) {
  // colors translated from keys => encoded name
  const o = {
    version: 1,
    objects: encodeObjectGroups(state.objects),
    drawing: encodeDrawing(state.drawing),
  };
  return JSON.stringify(o);
}

function decodeMap(json) {
  mapLayer.activate();
  const { version } = json;
  return {
    version: json.version,
    drawing: decodeDrawing(json.drawing, version),
    objects: decodeObjectGroups(json.objects, version),
  };
}

// ===============================================
// PATH DRAWING

const paintTools = {
  grid: 'grid',
  marquee: 'marquee',
  marqueeDiagonal: 'marqueeDiagonal',
  freeform: 'freeform',
};
let paintTool = paintTools.grid;

// Create a new path once, when the script is executed:
let myPath;

function startDraw(event) {
  switch (paintTool) {
    case paintTools.grid:
      startDrawGrid(event.point);
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      myPath = new Path();
      myPath.strokeColor = paintColor.color;
      myPath.strokeWidth = 10;
      break;
  }
}

function draw(event) {
  switch (paintTool) {
    case paintTools.grid:
      var isShift = Key.isDown('shift');
      if (!brushLine && (isShift || brushLineForce)) {
        startDrawGrid(event.point);
      } else if (brushLine && !(isShift || brushLineForce)) {
        drawGrid(event.point);
        stopGridLinePreview();
      }
      brushLine = isShift || brushLineForce;

      if (brushLine) {
        drawGridLinePreview(event.point);
      } else {
        drawGrid(event.point);
      }
      break;
    case paintTools.marquee:
      break;
    case paintTools.marqueeDiagonal:
      break;
    case paintTools.freeform:
      // Add a segment to the path at the position of the mouse:
      myPath.add(event.point);
      myPath.smooth({
        type: 'catmull-rom',
      });
      break;
  }
}

function endDraw(event) {
  switch (paintTool) {
    case paintTools.grid:
      var isShift = Key.isDown('shift');
      if (isShift || brushLineForce) {
        drawGrid(event.point);
      }
      endDrawGrid(event.point);
      stopGridLinePreview();
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      break;
  }
}

function changePaintTool(newPaintTool) {
  paintTool = newPaintTool;
}

function placeObject(event) {
  const coordinate = mapOverlayLayer.globalToLocal(event.point);
  if (toolState.activeTool && toolState.activeTool.tool) {
    const objectData = getObjectData(toolState.activeTool.tool);
    const command = objectCreateCommand(
      objectData,
      getObjectCenteredCoordinate(coordinate, toolState.activeTool.tool)
    );
    applyCommand(command, true);
    addToHistory(command);
  }
}

function deleteObject(event, object) {
  const command = objectDeleteCommand(object.data, object.position);
  applyCommand(command, true);
  addToHistory(command);
}

function applyCreateObject(isCreate, createCommand) {
  if (isCreate) {
    createObjectAsync(createCommand.data, (object) => {
      object.position = createCommand.position;
      object.data.id = atomicObjectId++;
      // immediately grab the structure with the start position of creation
      state.objects[object.data.id] = object;
    });
  } else {
    const { id } = createCommand.data;
    const object = state.objects[id];
    object.remove();
    delete state.objects[id];
  }
}

function grabObject(coordinate, object) {}

function dragObject(coordinate, object) {}

function dropObject(coordinate, object, prevPos) {
  addToHistory(objectPositionCommand(object.data.id, prevPos, object.position));
}

function applyMoveCommand(isApply, moveCommand) {
  state.objects[moveCommand.id].position = isApply
    ? moveCommand.position
    : moveCommand.prevPosition;
}

// ===============================================
// PIXEL FITTING
// TODO: have a way to convert back to the original path
// - save the original strokes, the pixelation is basically a filter on top
function fitToPixels() {}

// ===============================================
// SHAPE DRAWING

// Draw a specified shape on the pixel grid

// ===============================================
// PIXEL COORDINATE HELPERS

const mapMargin = 0.1;
const horizontalBlocks = 7;
const verticalBlocks = 6;
const horizontalDivisions = 16;
const verticalDivisions = 16;
const verticalRatio = 1; // 0.767;

let cellWidth = 0;
let cellHeight = 0;
let marginX = 0;
let marginY = 0;

// var remapX = function(i) {
//  return i
// };
// var remapY = function(i) {
//  return i
// };
// var remapInvX = function(i) {
//  return i
// };
// var remapInvY = function(i) {
//  return i
// };
resizeCoordinates();

const mapRatio =
  (horizontalBlocks * horizontalDivisions) /
  (verticalBlocks * verticalDivisions) /
  verticalRatio;
function resizeCoordinates() {
  const screenRatio = view.size.width / view.size.height;
  const horizontallyContrained = screenRatio <= mapRatio;

  const viewWidth = view.size.width * view.scaling.x;
  const viewHeight = view.size.height * view.scaling.y;

  // todo - clean this up with less code duplication
  if (horizontallyContrained) {
    marginX = view.size.width * 0.1;

    var width = viewWidth - marginX * 2;
    var blockWidth = width / horizontalBlocks;
    cellWidth = blockWidth / horizontalDivisions;
    cellHeight = cellWidth * verticalRatio;
    var blockHeight = cellHeight * verticalDivisions;
    var height = blockHeight * verticalBlocks;

    marginY = (viewHeight - height) / 2;

    // var xView = view.size.width - marginX;
    // var xCoord = horizontalBlocks * horizontalDivisions;

    // var yView = height + marginX;
    // var yCoord = verticalBlocks * verticalDivisions;

    // remapX = createRemap(marginX, xView, 0, xCoord);
    // remapY = createRemap(marginY, yView, 0, yCoord);
    // remapInvX = createRemap(0, xCoord, marginX, xView);
    // remapInvY = createRemap(0, yCoord, marginY, yView);
  } else {
    marginY = viewHeight * 0.1;

    var height = viewHeight - marginY * 2;
    var blockHeight = height / verticalBlocks;
    cellHeight = blockHeight / verticalDivisions;
    cellWidth = cellHeight / verticalRatio;
    var blockWidth = cellWidth * horizontalDivisions;
    var width = blockWidth * horizontalBlocks;

    marginX = (viewWidth - width) / 2;
  }

  mapLayer.position = new Point(marginX, marginY);
  mapLayer.scaling = new Point(cellWidth, cellHeight);

  mapOverlayLayer.position = new Point(marginX, marginY);
  mapOverlayLayer.scaling = new Point(cellWidth, cellHeight);

  mapIconLayer.position = new Point(marginX, marginY);
  mapIconLayer.scaling = new Point(cellWidth, cellHeight);
}

function viewToMap(viewCoordinate) {
  return new Coordinate(remapX(viewCoordinate.x), remapY(viewCoordinate.y));
}

function mapToView(canvasCoordinate) {
  return new Point(
    remapInvX(canvasCoordinate.x),
    remapInvY(canvasCoordinate.y)
  );
}

// ===============================================
// GRID overlay

mapOverlayLayer.activate();
let gridRaster;
createGrid();

function toggleGrid() {
  gridRaster.visible = !gridRaster.visible;
}

function createGrid() {
  mapOverlayLayer.activate();
  if (gridRaster) gridRaster.remove();
  const grid = [];
  for (var i = 0; i < horizontalBlocks * horizontalDivisions; i++) {
    var line = createGridLine(i, true, i != 0 && i % horizontalDivisions == 0);
    grid.push(line);
  }
  for (var i = 0; i < verticalBlocks * verticalDivisions; i++) {
    var line = createGridLine(i, false, i != 0 && i % verticalDivisions == 0);
    grid.push(line);
  }
  const gridGroup = new Group(grid);

  // it starts counting from the second block
  for (var i = 0; i < horizontalBlocks; i++) {
    var gridLabel = new PointText(
      (i + 0.5) * horizontalDivisions,
      verticalBlocks * verticalDivisions + 4
    );
    gridLabel.justification = 'center';
    gridLabel.fontFamily = 'TTNorms, sans-serif';
    gridLabel.fontSize = 3;
    gridLabel.fillColor = colors.oceanText.color;
    gridLabel.content = 1 + i;
    gridGroup.addChild(gridLabel);
  }

  for (var i = 0; i < verticalBlocks; i++) {
    var gridLabel = new PointText(-4, (i + 0.5) * verticalDivisions + 1);
    gridLabel.justification = 'center';
    gridLabel.fontFamily = 'TTNorms, sans-serif';
    gridLabel.fontSize = 3;
    gridLabel.fillColor = colors.oceanText.color;
    gridLabel.content = String.fromCharCode(65 + i); // A = 65
    gridGroup.addChild(gridLabel);
  }

  gridRaster = gridGroup.rasterize(view.resolution * 10);
  gridGroup.remove();
  mapLayer.activate();
  gridRaster.locked = true;
}

function createGridLine(i, horizontal, blockEdge) {
  const gridNegativeMarginLeft = blockEdge ? 4 : 0;
  const gridNegativeMarginRight = blockEdge ? 4 : 0;
  const gridNegativeMarginTop = blockEdge ? 0 : 0;
  const gridNegativeMarginBottom = blockEdge ? 4 : 0;
  const segment = horizontal
    ? [
        new Point(i, -gridNegativeMarginTop),
        new Point(
          i,
          verticalBlocks * verticalDivisions +
            gridNegativeMarginTop +
            gridNegativeMarginBottom
        ),
      ]
    : [
        new Point(-gridNegativeMarginLeft, i),
        new Point(
          horizontalBlocks * horizontalDivisions +
            gridNegativeMarginLeft +
            gridNegativeMarginRight,
          i
        ),
      ];

  line = new Path(segment);
  line.strokeColor = '#ffffff';
  line.strokeWidth = blockEdge ? 0.2 : 0.1;
  line.strokeCap = 'round';
  // line.dashArray = blockEdge ? [4, 6] : null;
  line.opacity = blockEdge ? 0.5 : 0.2;
  return line;
}

/* function updateSegments() {
      for (var i = 0; i < horizontalBlocks * horizontalDivisions; i++) {
          var segmentPoints = getSegment(i, true);
          grid[i].segments[0].point = segmentPoints[0];
          grid[i].segments[1].point = segmentPoints[1];
      }
      for (var v = 0; v < verticalBlocks * verticalDivisions; v++) {
          var segmentPoints = getSegment(v, false);
          grid[i + v].segments[0].point = segmentPoints[0];
          grid[i + v].segments[1].point = segmentPoints[1];
      }
  } */

// ===============================================
// COORDINATE LABEL

mapOverlayLayer.activate();
// var coordinateLabel = new PointText(new Point(0, 0));
// coordinateLabel.fontSize = 3;

function centerBrushOffset(width, height) {
  return new Point(width * 0.5 * cellWidth, height * 0.5 * cellHeight);
}

var brushSize = 2;
let brushSegments;
var brush = new Path();
var brushOutline = new Path();

let objectPreview;
let objectPreviewOutline;

const brushTypes = {
  rounded: 'rounded',
  square: 'square',
};
const brushSweep = true;
var brushLine = false;
var brushLineForce = false;
let brushType = brushTypes.rounded;
updateBrush();

function setBrushLineForce(isLine) {
  brushLineForce = isLine;
  emitter.emit('updateBrushLineForce', brushLineForce);
}
setBrushLineForce(false);

function cycleBrushHead() {
  const heads = Object.keys(brushTypes).sort((a, b) =>
    a == b ? 0 : a < b ? -1 : 1
  );
  const index = heads.indexOf(brushType);
  brushType = heads[(index + 1) % heads.length];
  updateBrush();
}

function getObjectCenteredCoordinate(rawCoordinate, objectDefinition) {
  // hack for even sized brushes
  const sizeX = objectDefinition.size.width / 2;
  const sizeY = objectDefinition.size.height / 2;
  return (
    rawCoordinate -
    new Point(sizeX, sizeY) +
    new Point(0.5, 0.5)
  ).floor();
}

function getBrushCenteredCoordinate(rawCoordinate) {
  // hack for even sized brushes
  if (brushSize % 2 == 0)
    return (rawCoordinate + new Point(0.5, 0.5)).floor() - new Point(0.5, 0.5);
  return rawCoordinate.floor();
}

function decrementBrush() {
  brushSize = Math.max(brushSize - 1, 1);
  updateBrush();
}
function incrementBrush() {
  brushSize = Math.max(brushSize + 1, 1);
  updateBrush();
}
function updateBrush() {
  brushSegments = getBrushSegments(brushSize);

  const prevPosOutline = brushOutline.position;

  brush.layer = uiLayer;
  brush.segments = brushSegments;
  brush.pivot = new Point(brushSize / 2 - 0.5, brushSize / 2 - 0.5);
  brush.position = getBrushCenteredCoordinate(prevPosOutline);
  brush.opacity = 0.6;
  brush.closed = true;
  brush.fillColor = paintColor.color;
  brush.locked = true;

  brushOutline.segments = brushSegments;
  brushOutline.position = prevPosOutline;
  brushOutline.closed = true;
  brushOutline.strokeColor = '#fff';
  brushOutline.strokeWidth = 0.1;
  brushOutline.locked = true;

  emitter.emit('updateBrush');
}

function updateObjectPreview() {
  if (toolState.activeTool && toolState.activeTool.tool) {
    let prevPos;
    let prevPosOutline;
    if (objectPreview && objectPreviewOutline) {
      objectPreview.remove();
      objectPreviewOutline.remove();
      prevPos = objectPreview.position;
      prevPosOutline = objectPreviewOutline.position;
    } else {
      prevPos = new Point(0, 0);
      prevPosOutline = new Point(0, 0);
    }

    const objectData = getObjectData(toolState.activeTool.tool);
    createObjectPreviewAsync(objectData, (object) => {
      objectPreview = object;
      object.locked = true;
      object.elements.bound.strokeColor.alpha = 0.6;
      object.opacity = 0.5;

      objectPreviewOutline = object.elements.bound.clone();
      objectPreviewOutline.strokeColor.alpha = 1;

      // todo: have a function that gets the most recent position of the mouse at any time
      objectPreview.position = prevPos;
      objectPreviewOutline.position = prevPosOutline;
    });
  }
}

function updateCoordinateLabel(event) {
  const coordinate = mapOverlayLayer.globalToLocal(event.point);
  // coordinateLabel.content = '' + event.point + '\n' + coordinate.toString();
  // coordinateLabel.position = rawCoordinate;

  brushOutline.position = coordinate;
  brush.position = getBrushCenteredCoordinate(coordinate);

  if (objectPreview)
    objectPreview.position = getObjectCenteredCoordinate(
      coordinate,
      objectPreview.definition
    );
  if (objectPreviewOutline) objectPreviewOutline.position = coordinate;
}

function getBrushSegments(size) {
  // square
  const sizeX = size;
  const sizeY = size;
  const offset = new Point(0, 0);
  if (size == 0) {
    return [new Point(0, 0), new Point(0, 1), new Point(1, 0)];
  }
  switch (brushType) {
    default:
    case brushTypes.square:
      return [
        offset.add([0, 0]),
        offset.add([0, sizeY]),
        offset.add([sizeX, sizeY]),
        offset.add([sizeX, 0]),
      ];
    case brushTypes.rounded:
      // return diamond if 2
      if (size == 1) {
        return [
          new Point(0, 0),
          new Point(0, 1),
          new Point(1, 1),
          new Point(1, 0),

          // new Point(0, 0),
          // new Point(0, 10),
          // new Point(10, 10),
          // new Point(10, 9),
          // new Point(1, 9),
          // new Point(1, 1),
          // new Point(10, 1),
          // new Point(10, 0),
        ];
      }
      // return diamond if 2
      if (size == 2) {
        return [
          new Point(1, 0),
          new Point(2, 1),
          new Point(1, 2),
          new Point(0, 1),
        ];
      }

      // add straight edges if odd number
      var ratio = 0.67;
      var diagonalSize = Math.floor((size / 2) * ratio);
      var straightSize = size - 2 * diagonalSize;

      var minPoint = diagonalSize;
      var maxPoint = diagonalSize + straightSize;

      return [
        offset.add([minPoint, 0]),
        offset.add([maxPoint, 0]),
        offset.add([size, minPoint]),
        offset.add([size, maxPoint]),
        offset.add([maxPoint, size]),
        offset.add([minPoint, size]),
        offset.add([0, maxPoint]),
        offset.add([0, minPoint]),
      ];
  }
}

// ===============================================
// STATE AND HISTORY

// command pattern
// draw {
//   contains delta segments for each affected layer
// }
//

mapLayer.activate();
var state = {
  index: -1,
  // TODO: max history
  history: [],
  drawing: {},
  objects: {},
};
if (!tryLoadAutosaveMap()) {
  loadTemplate();
}

function loadTemplate() {
  clearMap();
  setNewMapData(decodeMap(template));
}

const maxHistoryIndex = 99; // max length is one greater than this

function addToHistory(command) {
  state.index += 1;
  // remove future history if went back in time and made an edit
  if (state.index < state.history.length) {
    var removeNum = state.history.length - state.index;
    state.history.splice(-removeNum, removeNum);
  }

  // limit the amount of saved history to reduce memory
  if (state.index > maxHistoryIndex) {
    var removeNum = state.index - maxHistoryIndex;
    state.history.splice(0, removeNum);
    state.index -= removeNum;
  }
  state.history[state.index] = command;

  // autosave
  actionsCount++;
  actionsSinceSave++;
  clearTimeout(autosaveTimeout);
  if (actionsCount % autosaveActionsInterval == 0) {
    // every few actions
    autosaveMap();
  } else {
    // or if a new action hasn't been made in a while
    autosaveTimeout = setTimeout(() => {
      autosaveMap();
    }, autosaveInactivityTimer);
  }

  emitter.emit('historyUpdate', 'add');
}
var actionsSinceSave = 0;
var actionsCount = 0;
var autosaveActionsInterval = 20;
var autosaveInactivityTimer = 10000;
let autosaveTimeout;

function clearMap() {
  Object.keys(state.drawing).forEach((p) => {
    state.drawing[p].remove();
  });
  state.drawing = {};
  Object.keys(state.objects).forEach((p) => {
    state.objects[p].remove();
  });
  state.objects = {};
}

function setNewMapData(mapData) {
  // state.objects = mapData.objects; // objects are loaded asynchronously
  state.drawing = mapData.drawing;
}

function smoothMap() {
  Object.values(state.drawing).forEach((path) => {
    path.smooth({ type: 'catmull-rom', factor: 0.9 });
  });
}

function canRedo() {
  return state == null ? 0 : state.index < state.history.length - 1;
}

function canUndo() {
  return state == null ? 0 : state.index >= 0;
}

function undo() {
  if (canUndo()) {
    applyCommand(state.history[state.index], false);
    state.index -= 1;
    emitter.emit('historyUpdate', 'undo');
  } else {
    console.log('Nothing to undo');
  }
}

function redo() {
  if (canRedo()) {
    state.index += 1;
    applyCommand(state.history[state.index], true);
    emitter.emit('historyUpdate', 'redo');
  } else {
    console.log('Nothing to redo');
  }
}

function applyCommand(command, isApply) {
  if (isApply == null) {
    throw 'exception: applyCommand called without an apply direction';
  }
  // if (draw command)
  switch (command.type) {
    case 'draw':
      applyDiff(isApply, command.data);
      break;
    case 'object':
      switch (command.action) {
        case 'create':
          applyCreateObject(isApply, command);
          break;
        case 'delete':
          applyCreateObject(!isApply, command);
          break;
        case 'position':
          applyMoveCommand(isApply, command);
          break;
        case 'color':
          break;
      }
      break;
  }
}

function drawCommand(drawData) {
  return {
    type: 'draw',
    data: drawData,
  };
}

function objectCommand(action, position, objectData) {
  return {
    type: 'object',
    action,
    data: objectData,
    position,
  };
}

function objectCreateCommand(objectData, position) {
  return objectCommand('create', position.clone(), objectData);
}

function objectDeleteCommand(objectData, position) {
  return objectCommand('delete', position.clone(), objectData);
}

function objectPositionCommand(objectId, prevPosition, position) {
  return {
    type: 'object',
    action: 'position',
    id: objectId,
    position: position.clone(),
    prevPosition: prevPosition.clone(),
  };
}

function objectColorCommand(objectId, prevColor, color) {
  return {
    type: 'object',
    action: 'color',
    id: objectId,
    color,
    prevColor,
  };
}

function getColorAtCoordinate(coordinate) {
  // choose the highest elevation color
  // todo - this logic should be elsewhere
  if (toolState.activeTool) {
    var bestColor;

    if (
      toolState.activeTool.type == toolCategoryDefinition.terrain.type ||
      toolState.activeTool.type == toolCategoryDefinition.path.type
    ) {
      var bestColor = colors.water;

      let bestPriority = 0;
      Object.keys(state.drawing).forEach((colorKey) => {
        let toolCategory;

        const definition =
          layerDefinition[colorKey] || pathDefinition[colorKey];
        if (!definition) {
          console.log('Unknown color in drawing!');
          return;
        }
        const priority = (definition && definition.priority) || 0;

        const layer = state.drawing[colorKey];
        if (layer) {
          if (layer.contains(coordinate)) {
            if (priority > bestPriority) {
              bestPriority = priority;
              bestColor = colors[colorKey];
            }
          }
        }
      });
    }
    return bestColor;
  }
}

// ===============================================
// DRAWING METHODS

// var drawPoints = [];

let startGridCoordinate;
let prevGridCoordinate;
let prevDrawCoordinate;

let diffCollection = {};

function halfTriangleSegments(x0, y0, x1, y1, offsetX, offsetY) {
  const xMid = (x0 + x1) / 2;
  const yMid = (y0 + y1) / 2;
  return [
    [x0 + offsetX, y0 + offsetY],
    [
      xMid + offsetX - Math.sign(offsetX) * 0.5,
      yMid + offsetY - Math.sign(offsetY) * 0.5,
    ],
    [x1 + offsetX, y1 + offsetY],
  ];
}

// assumes convex simple polygon with clockwise orientation
// otherwise I have to simplify the polygon after stretching points
function sweepPath(path, sweepVector) {
  // find the lines w/ segment normals > 0
  const allFrontEdges = [];
  let frontEdge = [];
  const sweepDirection = sweepVector.normalize();

  if (sweepVector.x == 0 && sweepVector.y == 0) return path;

  let isFirstFront = false;
  let isLastFront = false;

  let potentialPoints = [];
  // go backwards so when I add indices I don't affect the index order
  for (let i = path.segments.length - 1; i >= 0; i--) {
    const p0 = path.segments[i];
    const p1 =
      path.segments[(i - 1 + path.segments.length) % path.segments.length];
    const normal = path.clockwise
      ? new Point(p0.point.y - p1.point.y, p1.point.x - p0.point.x).normalize()
      : new Point(p1.point.y - p0.point.y, p0.point.x - p1.point.x).normalize();
    const dot = normal.dot(sweepDirection);

    if (dot > 0) {
      if (i == path.segments.length - 1) isFirstFront = true;
      if (i == 0) isLastFront = true;

      if (potentialPoints.length > 0) {
        frontEdge.concat(potentialPoints);
        potentialPoints = [];
      }
      if (frontEdge.length == 0) {
        // if this is the first point found in this edge, also add the start point
        frontEdge.push(p0);
      }
      frontEdge.push(p1);
    }
    // include lines w/ normals == 0 if connected to line > 0
    else if (dot == 0) {
      if (frontEdge.length > 0) {
        potentialPoints.push(p1);
      }
    } else {
      if (frontEdge.length > 0) {
        allFrontEdges.push(frontEdge);
        frontEdge = [];
      }
      if (potentialPoints.length > 0) {
        potentialPoints = [];
      }
    }
  }
  if (frontEdge.length > 0) {
    allFrontEdges.push(frontEdge);
  }

  if (allFrontEdges.length == 0) {
    console.log('Did not find any points to sweep!');
    return path;
  }

  // check if there was a wrap around
  const isWrapped = isFirstFront && isLastFront;
  const skipFirst = allFrontEdges[0].length > 1;
  const skipLast = allFrontEdges[allFrontEdges.length - 1].length > 1;

  let first = true;
  allFrontEdges.forEach((frontEdge) => {
    // duplicate the first and last point in the edge
    // segments are in reverse index order

    const s0 = frontEdge[0];
    const s1 = frontEdge[frontEdge.length - 1];
    const s0Clone = s0.clone();
    const s1Clone = s1.clone();
    if (!(isWrapped && skipFirst && first)) {
      path.insert(s0.index + 1, s0Clone);
    }
    if (!(isWrapped && skipLast && s1.index == path.segments.length - 1)) {
      path.insert(s1.index, s1Clone);
    }
    frontEdge.forEach((s) => {
      // there is a duplicate when it wraps around
      if (isWrapped && first) {
        first = false;
      } else {
        s.point += sweepVector;
      }
    });
  });
  return path;
}

// start/end: lattice Point
// return: unioned Path/CompoundPath

// var q = [];
// q.forEach(function(s){s.remove()});
// q.push(drawPaths[drawPaths.length - 1].clone());
// q[q.length - 1].selected = true;

function drawLine(start, end, sweep) {
  const drawPaths = [];
  if (brushSweep) {
    let p = null;
    let prevDelta = null;
    var prevDrawCoordinate = null;
    let prevDrawLineCoordinate = null;
    doForCellsOnLine(
      Math.round(start.x),
      Math.round(start.y),
      Math.round(end.x),
      Math.round(end.y),
      (x, y) => {
        p = new Point(x, y);
        if (prevDrawLineCoordinate == null) {
          prevDrawLineCoordinate = p;
        } else if (p != prevDrawCoordinate) {
          const delta = p - prevDrawCoordinate;
          if (prevDelta != null && delta != prevDelta) {
            path = getDrawPath(prevDrawCoordinate);
            drawPaths.push(
              sweepPath(path, prevDrawLineCoordinate - prevDrawCoordinate)
            );
            prevDrawLineCoordinate = prevDrawCoordinate;
          }
          prevDelta = delta;
        }
        prevDrawCoordinate = p;
      }
    );
    path = getDrawPath(p);
    drawPaths.push(sweepPath(path, prevDrawLineCoordinate - p));
  } else {
    // stamping
    doForCellsOnLine(
      Math.round(start.x),
      Math.round(start.y),
      Math.round(end.x),
      Math.round(end.y),
      (x, y) => {
        const p = new Point(x, y);
        if (p != prevDrawCoordinate) {
          drawPaths.push(getDrawPath(p));
          prevDrawCoordinate = p;
        }
      }
    );
  }
  let linePath;
  if (drawPaths.length == 1) {
    linePath = drawPaths[0];
  } else if (drawPaths.length > 1) {
    const compound = new CompoundPath({ children: drawPaths });
    linePath = uniteCompoundPath(compound);
  }
  return linePath;
}

// todo: merge this with the other preview code
let drawPreview;
function drawGridLinePreview(viewPosition) {
  const rawCoordinate = new Point(mapLayer.globalToLocal(viewPosition));
  coordinate = getBrushCenteredCoordinate(rawCoordinate);

  mapLayer.activate();
  if (drawPreview) {
    drawPreview.remove();
  }
  if (startGridCoordinate == null) startDrawGrid(viewPosition);
  drawPreview = drawLine(coordinate, startGridCoordinate);
  if (drawPreview) {
    drawPreview.locked = true;
    drawPreview.opacity = 0.6;
    drawPreview.fillColor = paintColor.color;
  }
}

function stopGridLinePreview() {
  if (drawPreview) drawPreview.remove();
}

function startDrawGrid(viewPosition) {
  mapLayer.activate();
  let coordinate = new Point(mapLayer.globalToLocal(viewPosition));
  coordinate = getBrushCenteredCoordinate(coordinate);
  startGridCoordinate = coordinate;
  prevGridCoordinate = coordinate;
  drawGrid(viewPosition);
}

function drawGrid(viewPosition) {
  mapLayer.activate();
  const rawCoordinate = new Point(mapLayer.globalToLocal(viewPosition));
  coordinate = getBrushCenteredCoordinate(rawCoordinate);

  if (prevGridCoordinate == null) startDrawGrid(viewPosition);
  const path = drawLine(coordinate, prevGridCoordinate);
  if (path) {
    const diff = getDiff(path, paintColor.key);

    Object.keys(diff).forEach((colorKey) => {
      const colorDiff = diff[colorKey];
      if (!diffCollection.hasOwnProperty(colorKey)) {
        diffCollection[colorKey] = { isAdd: colorDiff.isAdd, path: [] };
      }
      diffCollection[colorKey].path.push(colorDiff.path);
      if (diffCollection[colorKey].isAdd != colorDiff.isAdd) {
        console.error(`Simultaneous add and remove for ${colorKey}`);
      }
    });
    applyDiff(true, diff);
  }

  prevGridCoordinate = coordinate;
}

function endDrawGrid(viewPosition) {
  const mergedDiff = {};
  prevGridCoordinate = null;
  startGridCoordinate = null;
  Object.keys(diffCollection).forEach((k) => {
    mergedDiff[k] = {
      isAdd: diffCollection[k].isAdd,
      path: uniteCompoundPath(
        new CompoundPath({ children: diffCollection[k].path })
      ),
    };
  });
  diffCollection = {};
  if (Object.keys(mergedDiff).length > 0) {
    addToHistory(drawCommand(mergedDiff));
  }
}

function uniteCompoundPath(compound) {
  let p = new Path();
  compound.children.forEach((c) => {
    const u = p.unite(c);
    p.remove();
    p = u;
  });
  compound.remove();
  return p;
}

function getDrawPath(coordinate) {
  const p = new Path(brushSegments);
  p.pivot = new Point(brushSize / 2 - 0.5, brushSize / 2 - 0.5);
  p.position = getBrushCenteredCoordinate(coordinate);
  return p;
}

// use for the vertex based drawing method for later
/*
  function drawGridCoordinate(coordinate) {
    var newDrawPoints = transformSegments(brushSegments, coordinate);

    if (!newDrawPoints.equals(drawPoints)) {
      drawPoints = newDrawPoints;
      addDrawPoints(drawPoints, paintColor);
    }
  } */

function getDistanceFromWholeNumber(f) {
  return Math.abs(f - Math.round(f));
}

function pointApproximates(p0, p1) {
  return Math.abs(p0.x - p1.x) < 0.001 && Math.abs(p0.y - p1.y) < 0.001;
}

function getDiff(path, colorKey) {
  if (!path.children && path.segments.length < 3) return {};

  // figure out which layers to add and subtract from
  const definition = layerDefinition[colorKey] || pathDefinition[colorKey];

  // limit the path to the union of the shape on each layer
  if (definition.requireLayer) {
    const union = path.intersect(state.drawing[definition.requireLayer]);
    path.remove();
    path = union;
  }

  const editLayers = {};
  if (definition.addLayers)
    definition.addLayers.forEach((colorKey) => {
      editLayers[colorKey] = true;
    });
  if (definition.cutLayers)
    definition.cutLayers.forEach((colorKey) => {
      editLayers[colorKey] = false;
    });

  const diff = {};
  Object.keys(editLayers).forEach((colorKey) => {
    const isAdd = editLayers[colorKey];

    const delta = isAdd
      ? path.subtract(state.drawing[colorKey])
      : path.intersect(state.drawing[colorKey]);

    // search for invalid points caused by overlapping diagonals
    // todo: for free drawing, remove this check
    const deltaSubPaths = delta.children ? delta.children : [delta];
    deltaSubPaths.forEach((p) => {
      correctPath(p, state.drawing[colorKey]);
    });

    if (delta.children || (delta.segments && delta.segments.length > 0)) {
      diff[colorKey] = {
        isAdd,
        path: delta,
      };
    }
    delta.remove();
  });

  return diff;
}

function correctPath(path, receivingPath) {
  path.segments.forEach((segment) => {
    const { point } = segment;
    const isSegmentInvalid =
      getDistanceFromWholeNumber(point.x) > 0.1 ||
      getDistanceFromWholeNumber(point.y) > 0.1;
    if (!isSegmentInvalid) return;

    const prevIndex =
      (segment.index - 1 + path.segments.length) % path.segments.length;
    const nextIndex = (segment.index + 1) % path.segments.length;
    const prevPoint = path.segments[prevIndex].point;
    const nextPoint = path.segments[nextIndex].point;

    // todo: this assumes the problem point is always at .5, which may not be true in degenerate cases
    const possiblePoint1 =
      point -
      new Point(
        0.5 * Math.sign(prevPoint.x - point.x),
        0.5 * Math.sign(prevPoint.y - point.y)
      );
    const possiblePoint2 =
      point -
      new Point(
        0.5 * Math.sign(nextPoint.x - point.x),
        0.5 * Math.sign(nextPoint.y - point.y)
      );

    if (
      pointApproximates(
        receivingPath.getNearestPoint(possiblePoint1),
        possiblePoint1
      )
    ) {
      var crossPoint =
        possiblePoint2 -
        new Point(
          Math.sign(possiblePoint2.x - point.x),
          Math.sign(possiblePoint2.y - point.y)
        );
      path.insert(nextIndex, crossPoint);
      segment.point = possiblePoint1;
    } else {
      var crossPoint =
        possiblePoint1 -
        new Point(
          Math.sign(possiblePoint1.x - point.x),
          Math.sign(possiblePoint1.y - point.y)
        );
      path.insert(prevIndex + 1, crossPoint);
      segment.point = possiblePoint2;
    }
  });
}

function applyDiff(isApply, diff) {
  // todo: weird location
  if (isApply) prevDrawCoordinate = null;
  Object.keys(diff).forEach((colorKey) => {
    const colorDiff = diff[colorKey];
    let { isAdd } = colorDiff;
    if (!isApply) isAdd = !isAdd; // do the reverse operation
    addPath(isAdd, colorDiff.path, colorKey);
  });
}

function addPath(isAdd, path, colorKey) {
  mapLayer.activate();
  if (!state.drawing.hasOwnProperty(colorKey)) {
    state.drawing[colorKey] = new Path();
    state.drawing[colorKey].locked = true;
  }
  const combined = isAdd
    ? state.drawing[colorKey].unite(path)
    : state.drawing[colorKey].subtract(path);
  combined.locked = true;
  combined.fillColor = colors[colorKey].color;
  combined.insertAbove(state.drawing[colorKey]);

  state.drawing[colorKey].remove();
  path.remove();

  state.drawing[colorKey] = combined;
}

function initializeApp() {
  toolState.switchToolType(toolCategoryDefinition.terrain.type);
  updatePaintColor(colors.level1);
}
initializeApp();

// ===============================================
// HELPERS

function addObjectArray(object, key, value) {
  if (!object.hasOwnProperty(key)) {
    object[key] = [];
  }
  object[key].push(value);
}

function createRemap(inMin, inMax, outMin, outMax) {
  return function remap(x) {
    return ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  };
}

function doForCellsOnLine(x0, y0, x1, y1, setPixel) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    setPixel(x0, y0); // Do what you need to for this

    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
      x0 = Math.round(x0);
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
      y0 = Math.round(y0);
    }
  }
}

// interval = 0.2
function doForCellsOnLinePerInterval(x0, y0, x1, y1, interval, setPixel) {
  if (Math.abs(x0 - x1) + Math.abs(y0 - y1) < 0.2) {
    setPixel(x0, y0);
    return;
  }

  let p0 = new Point(x0, y0);
  const p1 = new Point(x1, y1);
  const delta = p1 - p0;
  const slope = delta.normalize() * interval;

  let prevCellPoint = null;
  const totalLength = delta.length;
  let length = 0;

  do {
    const cellPoint = p0.floor();
    if (prevCellPoint != cellPoint) {
      setPixel(cellPoint.x, cellPoint.y);
      prevCellPoint = cellPoint;
    }
    p0 += slope;
    length += interval;
  } while (length < totalLength);
}

function clamp(num, min, max) {
  return num <= min ? min : num >= max ? max : num;
}

// https://stackoverflow.com/questions/7837456/how-to-compare-arrays-in-javascript
Array.prototype.equals = function (array) {
  // if the other array is a falsy value, return
  if (!array) return false;

  // compare lengths - can save a lot of time
  if (this.length != array.length) return false;

  for (let i = 0, l = this.length; i < l; i++) {
    // Check if we have nested arrays
    if (this[i] instanceof Array && array[i] instanceof Array) {
      // recurse into the nested arrays
      if (!this[i].equals(array[i])) return false;
    } else if (this[i] != array[i]) {
      // Warning - two different object instances will never be equal: {x:20} != {x:20}
      return false;
    }
  }
  return true;
};

function objectMap(object, mapFn, allowNull) {
  return Object.keys(object).reduce((result, key) => {
    const value = mapFn(object[key], key);
    if (value != null) result[key] = value;
    return result;
  }, {});
}

function maxMagnitude(/* arguments */) {
  let maxIndex = null;
  let maxValue = -1;
  for (let i = 0; i < arguments.length; i++) {
    const abs = Math.abs(arguments[i]);
    if (abs > maxValue) {
      maxIndex = i;
      maxValue = abs;
    }
  }
  if (maxIndex == null) return null;
  return arguments[maxIndex];
}