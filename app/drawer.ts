import paper from 'paper';
import animatePaper from 'paper-animate';

import { template } from './template';
import { objectMap } from './helpers/objectMap';
import { doForCellsOnLine } from './helpers/doForCellsOnLine';
import { createGrid, toggleGrid, getGridRaster } from './grid';
import { getColorDataFromEncodedName, colors } from './colors';
import { layerDefinition } from './layerDefinition';
import {
  horizontalBlocks,
  horizontalDivisions,
  verticalBlocks,
  verticalDivisions,
  verticalRatio,
  imgPath,
} from './constants';
import { pathDefinition } from './pathDefinition';
import { sweepPath } from './helpers/sweepPath';
import { createMenu } from './ui/createMenu';
import {
  state,
  clearMap,
  setNewMapData,
  objectCreateCommand,
  redo,
  undo,
  canUndo,
  canRedo,
} from './state';
import { emitter } from './emitter';
import {
  updateBrush,
  setBrushLineForce,
  initBrush,
  updatePaintColor,
  incrementBrush,
  decrementBrush,
  cycleBrushHead,
} from './brush';
import { modalLayer } from './ui/modal';
import { showHelpMenu } from './ui/help';
import { toolState } from './tools/state';
import { toolCategoryDefinition, init } from './tools';
import { createButton } from './ui/createButton';
import { addToLeftToolMenu, createLeftMenu } from './ui/leftMenu';
import { showMainMenu } from './ui/mainMenu';
import { getDistanceFromWholeNumber } from './helpers/getDistanceFromWholeNumber';
import { pointApproximates } from './helpers/pointApproximates';
import { initLayers, layers } from './layers';
import { uniteCompoundPath } from './helpers/unitCompoundPath';

const editor = {
  autosaveMap: null,
  clearAutosave: null,
};

export function drawer() {
  const backgroundLayer = paper.project.activeLayer;
  initLayers();
  backgroundLayer.applyMatrix = false;

  const atomicObjectId = 0;

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
        toolCategoryDefinition[encodedData.category].tools.value[
          objectData.type
        ];
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

  layers.mapLayer.activate();

  // Todo: make state use a Listener paradigm rather than triggering method calls

  // ===============================================
  // GLOBAL FUNCTIONS

  function onResize(event) {
    // Whenever the window is resized, recenter the path:
    resizeCoordinates();
    drawBackground();
    emitter.emit('resize', event);
  }

  const tool = new paper.Tool();
  tool.minDistance = 1;

  let prevViewMatrix = paper.view.matrix.clone();

  const inverted = paper.view.matrix.inverted();
  layers.fixedLayer.activate();

  //  layers.cloudLayer.matrix = paper.view.matrix.inverted();
  //  layers.cloudLayer.scale(2, paper.view.projectToView(new paper.Point(0, 0)));
  //  layers.cloudLayer.bounds.topLeft = paper.view.projectToView(new paper.Point(0, 0));
  function onFrame() {
    if (!paper.view.matrix.equals(prevViewMatrix)) {
      const inverted = paper.view.matrix.inverted();
      backgroundLayer.matrix = inverted;

      layers.fixedLayer.matrix = inverted;
      modalLayer.matrix = inverted;
      prevViewMatrix = paper.view.matrix.clone();

      //      // clouds shift w/ parallax while scrolling
      //      layers.cloudLayer.matrix = inverted;
      //      layers.cloudLayer.scale(2, paper.view.projectToView(new paper.Point(0, 0)));
      //      layers.cloudLayer.bounds.topLeft = paper.view.projectToView(new paper.Point(0, 0));
    }
    // layers.fixedLayer.pivot = new paper.Point(0, 0);
    // layers.fixedLayer.position = paper.view.viewSize.topLeft;
    // var inverseZoom = 1 / paper.view.zoom;

    // layers.fixedLayer.scaling = new paper.Point(inverseZoom, inverseZoom);
  }
  layers.mapLayer.activate();

  // ===============================================
  // BACKGROUND

  //  layers.cloudLayer.activate();
  //  for (var i = 0; i < 20; i ++) {
  //    var cloud = new paper.Raster('static/img/cloud1.png');
  //    cloud.position = new paper.Point((i % 2 + 2) * 120, (i % 2 + 3) * 120);
  //  }

  backgroundLayer.activate();
  const backgroundRect = new paper.Path();
  backgroundRect.fillColor = colors.water.color;
  backgroundRect.onMouseEnter = function (event) {
    toolState.focusOnCanvas(true);
  };
  backgroundRect.onMouseLeave = function (event) {
    toolState.focusOnCanvas(false);
  };

  tool.onMouseDown = function onMouseDown(event) {
    if (isSpaceDown) return;
    toolState.onDown(event);
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseDown(event);
    }
  };
  tool.onMouseMove = function onMouseMove(event) {
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseMove(event);
    }
  };
  tool.onMouseDrag = function onMouseDrag(event) {
    if (isSpaceDown) return;
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseDrag(event);
    }
  };
  tool.onMouseUp = function onMouseUp(event) {
    if (isSpaceDown) return;
    toolState.onUp(event);
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseUp(event);
    }
  };

  function drawBackground() {
    const topLeft = new paper.Point(0, 0); // + paper.view.bounds.topLeft;
    const center = new paper.Point(
      paper.view.bounds.width,
      (paper.view.bounds.height * paper.view.scaling.y) / 2,
    ); // + paper.view.bounds.topLeft * 2;
    const bottomRight = new paper.Point(
      paper.view.bounds.width * paper.view.scaling.x,
      paper.view.bounds.height * paper.view.scaling.y,
    ); // + paper.view.bounds.topLeft * 2;

    backgroundRect.segments = [
      new paper.Point(0, 0),
      new paper.Point(paper.view.size.width * paper.view.scaling.x, 0),
      new paper.Point(
        paper.view.size.width * paper.view.scaling.x,
        paper.view.size.height * paper.view.scaling.y,
      ),
      new paper.Point(0, paper.view.size.height * paper.view.scaling.y),
    ];
    layers.mapLayer.activate();
  }

  function jumpTween(item) {
    item.Tween();
  }

  // ===============================================
  // MAIN UI
  window.addEventListener('beforeunload', (e) => {
    if (state.actionsSinceSave === 0) {
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
      `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
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
      state.actionsSinceSave = 0;
      return true;
    }
    console.log(
      'Cannot autosave: your browser does not support local storage.',
    );
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
      false,
    );

    autosaveMap();
  }

  function loadMapFromFile() {
    const readFile = function (e) {
      const file = e.target.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = function (e) {
        const dataURL = e.target!.result as string;

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
          false,
        );
      };
      reader.readAsDataURL(file);
    };
    const fileInput = document.createElement('input');
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
      null,
    );
    elem.dispatchEvent(eventMouse);
  }

  // ===============================================
  // UI ELEMENTS

  // highlightedColor: string
  // selectedColor: string

  // ===============================================
  // TOOLS
  createLeftMenu();

  layers.fixedLayer.activate();
  init();

  // var menuButton = new paper.Path();
  // menuButton.strokeColor = colors.selected.color;
  // //menuButton.strokeColor *= 0.9;
  // menuButton.strokeWidth = 120;
  // menuButton.strokeCap = 'round';
  // menuButton.segments = [
  //  new paper.Point(-20, 0),
  //  new paper.Point(0, 0),
  // ];

  const redoButton = undoMenuButton('static/img/menu-redo.png', () => {
    redo();
  });
  const undoButton = undoMenuButton('static/img/menu-undo.png', () => {
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
    },
  );

  function undoMenuButton(path, onPress) {
    const icon = new paper.Raster(path);
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
      new paper.Point(paper.view.bounds.width * paper.view.scaling.x, 0) +
      new paper.Point(-50, 30);
  }
  positionUndoMenu();

  // layout for mobile version
  // var mainMenuButton = new paper.Path.Circle(new paper.Point(paper.view.center.x, 0), 40);
  // mainMenuButtonIcon.position = new paper.Point(paper.view.center.x, 20);

  const mainMenuButton = new paper.Path.Circle(new paper.Point(30, 30), 24);
  mainMenuButton.fillColor = colors.pink.color;
  mainMenuButton.opacity = 0.00001;
  const mainMenuButtonIcon = new paper.Group();
  mainMenuButtonIcon.applyMatrix = false;
  mainMenuButtonIcon.position = new paper.Point(30, 30);
  mainMenuButtonIcon.addChildren([
    new paper.Path.Rectangle({ point: [-10, -10], size: [20, 4] }),
    new paper.Path.Rectangle({ point: [-10, -2], size: [20, 4] }),
    new paper.Path.Rectangle({ point: [-10, 6], size: [20, 4] }),
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
    if (mainMenuButton && mainMenuButton.onMouseLeave) {
      mainMenuButton.onMouseLeave(event);
    }
  };

  // =======================================
  // TOOLS

  // =======================================
  // BASE LEVEL TOOLS
  addToLeftToolMenu(); // spacer

  const toolBtn = new paper.Raster(`${imgPath}menu-help.png`);
  toolBtn.scaling = new paper.Point(0.3, 0.3);
  toolBtn.position = new paper.Point(0, 4);
  const button = createButton(toolBtn, 20, () => {});
  button.onMouseUp = function () {
    showHelpMenu(true);
  };
  addToLeftToolMenu(button);

  // var activeColor = new paper.Path.Circle([20, 20], 16);
  // activeColor.fillColor = paintColor;
  // addToLeftToolMenu(activeColor);

  // function updateColorTools() {
  //  activeColor
  // }

  layers.fixedLayer.activate();

  const toolsPosition = new paper.Point(40, 80);

  // var pointerToolButton = new paper.Raster('../img/pointer.png');
  // pointerToolButton.position = toolsPosition + new paper.Point(0, 0);
  // pointerToolButton.scaling = new paper.Point(0.2, 0.2);

  var isSpaceDown = false;

  function onKeyUp(event) {
    switch (event.key) {
      case 'space':
        isSpaceDown = false;
        break;
    }
  }

  function onKeyDown(event) {
    const shift = paper.Key.isDown('shift');
    const control = paper.Key.isDown('control') || paper.Key.isDown('meta');

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

  // layers.mapOverlayLayer.activate();
  // var tracemap = new paper.Raster('static/img/tracemap.png');
  // tracemap.locked = true;
  // tracemap.position = new paper.Point(55.85, 52.2);
  // tracemap.scaling = new paper.Point(0.082, .082);
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
      if (pathData.length == 0) {
        p = new paper.Path();
      } else if (version == 0) {
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

  function decodeMap(json) {
    layers.mapLayer.activate();
    const { version } = json;
    return {
      version: json.version,
      drawing: decodeDrawing(json.drawing, version),
      objects: decodeObjectGroups(json.objects, version),
    };
  }

  // ===============================================
  // PATH DRAWING

  // ===============================================
  // SHAPE DRAWING

  // Draw a specified shape on the pixel grid

  // ===============================================
  // PIXEL COORDINATE HELPERS

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
    const screenRatio = paper.view.size.width / paper.view.size.height;
    const horizontallyContrained = screenRatio <= mapRatio;

    const viewWidth = paper.view.size.width * paper.view.scaling.x;
    const viewHeight = paper.view.size.height * paper.view.scaling.y;

    // todo - clean this up with less code duplication
    if (horizontallyContrained) {
      marginX = paper.view.size.width * 0.1;

      var width = viewWidth - marginX * 2;
      var blockWidth = width / horizontalBlocks;
      cellWidth = blockWidth / horizontalDivisions;
      cellHeight = cellWidth * verticalRatio;
      var blockHeight = cellHeight * verticalDivisions;
      var height = blockHeight * verticalBlocks;

      marginY = (viewHeight - height) / 2;

      // var xView = paper.view.size.width - marginX;
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

    layers.mapLayer.position = new paper.Point(marginX, marginY);
    layers.mapLayer.scaling = new paper.Point(cellWidth, cellHeight);

    layers.mapOverlayLayer.position = new paper.Point(marginX, marginY);
    layers.mapOverlayLayer.scaling = new paper.Point(cellWidth, cellHeight);

    layers.mapIconLayer.position = new paper.Point(marginX, marginY);
    layers.mapIconLayer.scaling = new paper.Point(cellWidth, cellHeight);
  }

  layers.mapOverlayLayer.activate();
  createGrid();

  // ===============================================
  // COORDINATE LABEL

  layers.mapOverlayLayer.activate();
  // var coordinateLabel = new paper.PointText(new paper.Point(0, 0));
  // coordinateLabel.fontSize = 3;

  initBrush();
  updateBrush();
  setBrushLineForce(false);

  // ===============================================
  // STATE AND HISTORY

  // command pattern
  // draw {
  //   contains delta segments for each affected layer
  // }
  //

  layers.mapLayer.activate();

  if (!tryLoadAutosaveMap()) {
    loadTemplate();
  }

  function loadTemplate() {
    console.log('on load', template);
    clearMap();
    setNewMapData(decodeMap(template));
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

  let prevDrawCoordinate;

  // start/end: lattice Point
  // return: unioned Path/CompoundPath

  // var q = [];
  // q.forEach(function(s){s.remove()});
  // q.push(drawPaths[drawPaths.length - 1].clone());
  // q[q.length - 1].selected = true;

  function drawLine(start, end) {
    const drawPaths = [];
    if (brushSweep) {
      const p = null;
      let prevDelta = null;
      var prevDrawCoordinate = null;
      let prevDrawLineCoordinate: paper.Point | null = null;
      doForCellsOnLine(
        Math.round(start.x),
        Math.round(start.y),
        Math.round(end.x),
        Math.round(end.y),
        (x, y) => {
          const p = new paper.Point(x, y);
          if (prevDrawLineCoordinate == null) {
            prevDrawLineCoordinate = p;
          } else if (p != prevDrawCoordinate) {
            const delta = p - prevDrawCoordinate;
            if (prevDelta != null && delta != prevDelta) {
              path = getDrawPath(prevDrawCoordinate);
              drawPaths.push(
                sweepPath(path, prevDrawLineCoordinate - prevDrawCoordinate),
              );
              prevDrawLineCoordinate = prevDrawCoordinate;
            }
            prevDelta = delta;
          }
          prevDrawCoordinate = p;
        },
      );
      const path = getDrawPath(p);
      drawPaths.push(sweepPath(path, prevDrawLineCoordinate - p));
    } else {
      // stamping
      doForCellsOnLine(
        Math.round(start.x),
        Math.round(start.y),
        Math.round(end.x),
        Math.round(end.y),
        (x, y) => {
          const p = new paper.Point(x, y);
          if (p != prevDrawCoordinate) {
            drawPaths.push(getDrawPath(p));
            prevDrawCoordinate = p;
          }
        },
      );
    }
    let linePath;
    if (drawPaths.length == 1) {
      linePath = drawPaths[0];
    } else if (drawPaths.length > 1) {
      const compound = new paper.CompoundPath({ children: drawPaths });
      linePath = uniteCompoundPath(compound);
    }
    return linePath;
  }

  function getDrawPath(coordinate) {
    const p = new paper.Path(brushSegments);
    p.pivot = new paper.Point(brushSize / 2 - 0.5, brushSize / 2 - 0.5);
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
    if (definition.addLayers) {
      definition.addLayers.forEach((colorKey) => {
        editLayers[colorKey] = true;
      });
    }
    if (definition.cutLayers) {
      definition.cutLayers.forEach((colorKey) => {
        editLayers[colorKey] = false;
      });
    }

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

  function correctPath(path: paper.Path, receivingPath) {
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
      const possiblePoint1 = point.subtract(
        new paper.Point(
          0.5 * Math.sign(prevPoint.x - point.x),
          0.5 * Math.sign(prevPoint.y - point.y),
        ),
      );
      const possiblePoint2 = point.subtract(
        new paper.Point(
          0.5 * Math.sign(nextPoint.x - point.x),
          0.5 * Math.sign(nextPoint.y - point.y),
        ),
      );

      if (
        pointApproximates(
          receivingPath.getNearestPoint(possiblePoint1),
          possiblePoint1,
        )
      ) {
        var crossPoint = possiblePoint2.subtract(
          new paper.Point(
            Math.sign(possiblePoint2.x - point.x),
            Math.sign(possiblePoint2.y - point.y),
          ),
        );
        path.insert(nextIndex, crossPoint);
        segment.point = possiblePoint1;
      } else {
        var crossPoint = possiblePoint1.subtract(
          new paper.Point(
            Math.sign(possiblePoint1.x - point.x),
            Math.sign(possiblePoint1.y - point.y),
          ),
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
    layers.mapLayer.activate();
    if (!state.drawing.hasOwnProperty(colorKey)) {
      state.drawing[colorKey] = new paper.Path();
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
}
