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
} from './constants';
import { pathDefinition } from './pathDefinition';
import * as structureDef from './tools/structure';
import * as amenitiesDef from './tools/amenities';
import * as constructionDef from './tools/construction';
import * as treeDef from './tools/tree';
import * as flowerDef from './tools/flower';
import { sweepPath } from './helpers/sweepPath';
import { createMenu } from './createMenu';
import {
  state,
  clearMap,
  setNewMapData,
  objectCreateCommand,
  objectDeleteCommand,
  addToHistory,
  redo,
  undo,
  canUndo,
  canRedo,
  objectPositionCommand,
  drawCommand,
} from './state';
import { emitter } from './emitter';
import { updateBrush, setBrushLineForce, initBrush } from './brush';

const editor = {
  autosaveMap: null,
  clearAutosave: null,
};
export function drawer() {
  const backgroundLayer = paper.project.activeLayer;
  const mapLayer = new paper.Layer();
  const mapIconLayer = new paper.Layer();
  const mapOverlayLayer = new paper.Layer();
  const uiLayer = new paper.Layer();
  const fixedLayer = new paper.Layer();
  const cloudLayer = new paper.Layer();
  const modalLayer = new paper.Layer();
  backgroundLayer.applyMatrix = false;
  cloudLayer.applyMatrix = false;
  fixedLayer.applyMatrix = false;
  modalLayer.applyMatrix = false;

  mapLayer.applyMatrix = false;
  mapLayer.pivot = new paper.Point(0, 0);
  mapIconLayer.applyMatrix = false;
  mapIconLayer.pivot = new paper.Point(0, 0);
  mapOverlayLayer.applyMatrix = false;
  mapOverlayLayer.pivot = new paper.Point(0, 0);

  // load assets
  const imgPath = 'static/img/';
  const toolPrefix = 'tool-';

  let brushSizeUI;
  function showBrushSizeUI(isShown) {
    if (brushSizeUI == null) {
      const group = new paper.Group();
      group.applyMatrix = false;
      const brushPreview = new paper.Path();
      if (brushSegments) {
        brushPreview.segments = brushSegments;
      }
      brushPreview.fillColor = paintColor.color;
      brushPreview.strokeColor = colors.lightText.color;
      brushPreview.strokeWidth = 0.1;

      const brushSizeText = new paper.PointText(0, 28);
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
            5 * brushPreview.bounds.height,
          );
          brushPreview.bounds.width = Math.min(
            30,
            5 * brushPreview.bounds.width,
          );
          brushPreview.position = new paper.Point(0, 0);
        }
        brushSizeText.content = brushSize;
      }
      update();

      function brushButton(path, onPress) {
        const icon = new paper.Raster(path);
        icon.scaling = new paper.Point(0.45, 0.45);
        return createButton(icon, 20, onPress, {
          highlightedColor: colors.paperOverlay.color,
          selectedColor: colors.paperOverlay2.color,
        });
      }
      function brushLineButton(path, onPress) {
        const icon = new paper.Raster(path);
        icon.scaling = new paper.Point(0.45, 0.45);
        return createButton(icon, 20, onPress, {
          highlightedColor: colors.paperOverlay.color,
          selectedColor: colors.yellow.color,
        });
      }

      const increaseButton = brushButton(
        'static/img/ui-plus.png',
        incrementBrush,
      );
      const decreaseButton = brushButton(
        'static/img/ui-minus.png',
        decrementBrush,
      );
      increaseButton.position = new paper.Point(0, 70);
      decreaseButton.position = new paper.Point(0, 110);

      const drawLineButton = brushLineButton(
        'static/img/menu-drawline.png',
        () => {
          setBrushLineForce(true);
        },
      );
      const drawBrushButton = brushLineButton(
        'static/img/menu-drawbrush.png',
        () => {
          setBrushLineForce(false);
        },
      );
      emitter.on('updateBrushLineForce', updateBrushLineButton);
      function updateBrushLineButton(isBrushLine) {
        drawLineButton.data.select(isBrushLine);
        drawBrushButton.data.select(!isBrushLine);
      }
      updateBrushLineButton(brushLineForce);

      drawLineButton.position = new paper.Point(0, 210);
      drawBrushButton.position = new paper.Point(0, 170);

      const backingWidth = 42;
      const brushSizeBacking = new paper.Path.Rectangle(
        -backingWidth / 2,
        0,
        backingWidth,
        153,
        backingWidth / 2,
      );
      brushSizeBacking.strokeColor = colors.paperOverlay2.color;
      brushSizeBacking.strokeWidth = 2;
      brushSizeBacking.position += new paper.Point(0, -22);

      const brushLineBacking = new paper.Path.Rectangle(
        -backingWidth / 2,
        0,
        backingWidth,
        82,
        backingWidth / 2,
      );
      brushLineBacking.strokeColor = colors.paperOverlay2.color;
      brushLineBacking.strokeWidth = 2;
      brushLineBacking.position += new paper.Point(0, 149);

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
      group.pivot = new paper.Point(0, 0);
      group.position = new paper.Point(105, 55);
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
      item = new paper.Group(item);
    }

    item.pivot = item.bounds.bottomCenter;
    item.pivot += objectDefinition.offset;
    item.position = new paper.Point(0, 0);

    const group = new paper.Group();

    const bound = new paper.Path.Rectangle(
      new paper.Rectangle(item.position, objectDefinition.size),
      new paper.Size(0.15, 0.15),
    );
    bound.strokeColor = new paper.Color('white');
    bound.strokeColor.alpha = 0;
    bound.strokeWidth = 0.1;
    bound.fillColor = new paper.Color('white');
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
        const icon = new paper.Raster('static/img/ui-x.png');
        icon.scaling = 0.03;

        const buttonBacking = new paper.Path.Circle(0, 0, 0.9);
        buttonBacking.fillColor = colors.offWhite.color;
        const button = createButton(icon, 0.8, (event) => {
          group.onDelete();
          event.stopPropagation();
        });
        var deleteButton = new paper.Group();
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
      // if (paper.Key.isDown('alt')) {
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

  // Todo: make state use a Listener paradigm rather than triggering method calls
  const toolState = {
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
      if (prevTool) {
        prevTool.definition.updateTool(prevTool, toolData, isToolTypeSwitch);
      } else if (toolData) {
        toolData.definition.updateTool(prevTool, toolData, isToolTypeSwitch);
      }
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
          if (this.activeTool) {
            this.activeTool.definition.enablePreview(isActive);
          }
        }
      }
    },
  };

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
  fixedLayer.activate();

  //  cloudLayer.matrix = paper.view.matrix.inverted();
  //  cloudLayer.scale(2, paper.view.projectToView(new paper.Point(0, 0)));
  //  cloudLayer.bounds.topLeft = paper.view.projectToView(new paper.Point(0, 0));
  function onFrame() {
    if (!paper.view.matrix.equals(prevViewMatrix)) {
      const inverted = paper.view.matrix.inverted();
      backgroundLayer.matrix = inverted;

      fixedLayer.matrix = inverted;
      modalLayer.matrix = inverted;
      prevViewMatrix = paper.view.matrix.clone();

      //      // clouds shift w/ parallax while scrolling
      //      cloudLayer.matrix = inverted;
      //      cloudLayer.scale(2, paper.view.projectToView(new paper.Point(0, 0)));
      //      cloudLayer.bounds.topLeft = paper.view.projectToView(new paper.Point(0, 0));
    }
    // fixedLayer.pivot = new paper.Point(0, 0);
    // fixedLayer.position = paper.view.viewSize.topLeft;
    // var inverseZoom = 1 / paper.view.zoom;

    // fixedLayer.scaling = new paper.Point(inverseZoom, inverseZoom);
  }
  mapLayer.activate();

  // ===============================================
  // BACKGROUND

  //  cloudLayer.activate();
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
      actionsSinceSave = 0;
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

    uiLayer.activate();
    const mapRaster = mapLayer.rasterize();
    const mapPositionDelta = mapLayer.globalToLocal(mapLayer.bounds.topLeft);

    const iconsRaster = mapIconLayer.rasterize();
    const iconsPositionDelta = mapIconLayer.globalToLocal(
      mapIconLayer.bounds.topLeft,
    );

    const gridRaster = getGridRaster();

    const gridClone = gridRaster.clone();

    const mapBounds = gridRaster.bounds.clone();
    mapBounds.size += saveMargins;
    mapBounds.point -= saveMargins / 2;
    const mapBoundsClippingMask = new paper.Path.Rectangle(mapBounds);

    const background = mapBoundsClippingMask.clone();
    background.fillColor = colors.water.color;

    mapBoundsClippingMask.clipMask = true;

    const text = new paper.PointText(
      mapBounds.bottomRight - new paper.Point(2, 2),
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
      false,
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

  function createButton(item, buttonSize, onClick, options?: any) {
    const highlightedColor =
      !options || options.highlightedColor == null
        ? colors.sand.color
        : options.highlightedColor;
    const selectedColor =
      !options || options.selectedColor == null
        ? colors.npc.color
        : options.selectedColor;

    const group = new paper.Group();

    const button = new paper.Path.Circle(0, 0, buttonSize);

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

  // var menuButton = new paper.Path();
  // menuButton.strokeColor = colors.selected.color;
  // //menuButton.strokeColor *= 0.9;
  // menuButton.strokeWidth = 120;
  // menuButton.strokeCap = 'round';
  // menuButton.segments = [
  //  new paper.Point(-20, 0),
  //  new paper.Point(0, 0),
  // ];

  function renderModal(name, width, height, onDismiss) {
    const topLeft = new paper.Point(0, 0); // + paper.view.bounds.topLeft;
    const center = new paper.Point(
      (paper.view.bounds.width * paper.view.scaling.x) / 2,
      (paper.view.bounds.height * paper.view.scaling.y) / 2,
    ); // + paper.view.bounds.topLeft * 2;
    const bottomRight = new paper.Point(
      paper.view.bounds.width * paper.view.scaling.x,
      paper.view.bounds.height * paper.view.scaling.y,
    ); // + paper.view.bounds.topLeft * 2;

    modalLayer.activate();

    const group = new paper.Group();

    const darkFill = new paper.Path.Rectangle(
      new paper.Rectangle(topLeft, bottomRight),
    );
    darkFill.fillColor = colors.offBlack.color;
    darkFill.fillColor.alpha = 0.3;
    darkFill.onMouseUp = onDismiss;

    const modal = new paper.Path.Rectangle(
      new paper.Rectangle(
        center.x - width / 2,
        center.y - height / 2,
        width,
        height,
      ),
      new paper.Size(60, 60),
    );
    modal.fillColor = colors.paper.color;
    modal.onMouseEnter = function (event) {
      group.data.text.content = name;
    };

    const modalContents = new paper.Group();
    modalContents.applyMatrix = false;
    modalContents.pivot = new paper.Point(0, 0);
    modalContents.position = modal.bounds.topLeft + new paper.Point(40, 120);
    modalContents.data = {
      addElement() {},
    };

    group.data = {
      width: modal.bounds.width - 40 * 2,
      height: modal.bounds.height - 120 - 40,
      contents: modalContents,
    };

    emitter.on('resize', () => {
      const topLeft = new paper.Point(0, 0); // + paper.view.bounds.topLeft;
      const center = new paper.Point(
        (paper.view.bounds.width * paper.view.scaling.x) / 2,
        (paper.view.bounds.height * paper.view.scaling.y) / 2,
      ); // + paper.view.bounds.topLeft * 2;
      const bottomRight = new paper.Point(
        paper.view.bounds.width * paper.view.scaling.x,
        paper.view.bounds.height * paper.view.scaling.y,
      ); // + paper.view.bounds.topLeft * 2;

      // var topLeft = paper.view.viewToProject(paper.view.projectToView(new paper.Point(0, 0)));// + paper.view.bounds.topLeft;
      // var center = paper.view.viewToProject(paper.view.projectToView(new paper.Point(paper.view.bounds.width / 2, paper.view.bounds.height / 2)));// + paper.view.bounds.topLeft * 2;
      // var bottomRight = paper.view.viewToProject(paper.view.projectToView(new paper.Point(paper.view.bounds.width, paper.view.bounds.height)));// + paper.view.bounds.topLeft * 2;

      darkFill.bounds = new paper.Rectangle(topLeft, bottomRight);
      modal.position = center;
      modalContents.position = modal.bounds.topLeft + new paper.Point(40, 135);
    });

    const text = new paper.PointText(
      new paper.Point(group.data.width / 2, -50),
    );
    text.justification = 'center';
    (text.content = name), (text.fontSize = 20);
    text.fontFamily = 'TTNorms, sans-serif';
    text.fillColor = colors.text.color;
    modalContents.addChild(text);

    const statusBar = new paper.Raster('static/img/ui-phonestatus.png');
    statusBar.scaling = 0.35;
    statusBar.position = new paper.Point(group.data.width / 2 - 10, -93);
    modalContents.addChild(statusBar);

    const time = new paper.PointText(
      new paper.Point(group.data.width / 2, -90),
    );
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

      const helpText = new paper.PointText(new paper.Point(80, -10));
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

      const helpText2 = new paper.PointText(new paper.Point(100, -10));
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

      const versionCode = new paper.PointText(
        helpMenu.data.width / 2,
        helpMenu.data.height,
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

      const hitSizeHalf = new paper.Point(35, 35);
      const hitSize = new paper.Size(70, 70);
      function createMenuButton(
        name,
        img,
        index,
        onMouseDown: () => void,
        onMouseEnter?: () => void,
      ) {
        const buttonGroup = new paper.Group();

        const button = new paper.Raster(img);
        button.scaling = new paper.Point(0.4, 0.4);
        button.locked = true;

        const hitTarget = new paper.Path.Rectangle(
          button.position - hitSizeHalf,
          hitSize,
        );
        hitTarget.fillColor = colors.invisible.color;

        buttonGroup.applyMatrix = false;
        buttonGroup.addChildren([hitTarget, button]);
        buttonGroup.position = new paper.Point(20 + index * 70, 0);

        buttonGroup.onMouseDown = function (event) {
          onMouseDown();
        };

        buttonGroup.onMouseEnter = function (event) {
          mainMenu.data.text.content = name;

          button.position = new paper.Point(0, 0);
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
        'static/img/menu-save.png',
        0,
        () => {
          saveMapToFile();
        },
      );
      const loadButton = createMenuButton(
        'Load Map',
        'static/img/menu-open.png',
        1,
        () => {
          loadMapFromFile();
        },
      );
      const newButton = createMenuButton(
        'New Map',
        'static/img/menu-new.png',
        2,
        () => {
          const r = confirm(
            'Clear your map? You will lose all unsaved changes.',
          );
          if (r == true) {
            loadTemplate();
          } else {
          }
        },
      );

      const twitterButton = createMenuButton(
        'Twitter',
        'static/img/menu-twitt.png',
        0,
        () => {
          window.open('https://twitter.com/island_designer', '_blank');
        },
      );
      twitterButton.position = new paper.Point(0, 210);

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

  const leftToolMenu = new paper.Group();
  leftToolMenu.applyMatrix = false;
  leftToolMenu.position = [30, 0];

  const leftToolMenuBacking = new paper.Path();
  leftToolMenuBacking.strokeColor = colors.paper.color;
  leftToolMenuBacking.strokeWidth = 120;
  leftToolMenuBacking.strokeCap = 'round';
  leftToolMenuBacking.segments = [
    new paper.Point(-30, -0),
    new paper.Point(-30, 480),
  ];
  leftToolMenu.addChild(leftToolMenuBacking);

  const leftToolMenuPosition = new paper.Point(0, 100);
  const leftToolMenuIconHeight = 50;

  function addToLeftToolMenu(icon?: any) {
    if (icon == null) {
      //      // create spacer
      //      icon = new paper.Path.Rectangle(0, 0, 40, 2);
      //      icon.fillColor = colors.lightText.color;
      //      icon.position = leftToolMenuPosition - new paper.Point(0, leftToolMenuIconHeight / 4);
      //      leftToolMenu.addChild(icon);
      leftToolMenuPosition.y += leftToolMenuIconHeight / 2;
      return;
    }

    icon.position = leftToolMenuPosition;
    leftToolMenu.addChild(icon);
    leftToolMenuPosition.y += leftToolMenuIconHeight;
  }

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
  const baseObjectCategoryDefinition = {
    base: baseToolCategoryDefinition,
    // type: 'tree', // filled in by base class
    // icon: "amenities",
    // tools: asyncTreeDefinition,
    // menuOptions: {},
    // yPos: 185
    iconMenu: null,
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
                  toolState.toolMapValue(categoryDefinition, def, {}),
                );
              });
            }),
            this.menuOptions,
          );
          this.iconMenu.data.setPointer(this.yPos);
          this.iconMenu.pivot = new paper.Point(0, 0);
          this.iconMenu.position = new paper.Point(100, 45);
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

  amenitiesDef.load();
  structureDef.load();
  constructionDef.load();
  treeDef.load();
  flowerDef.load();

  const toolCategoryDefinition = {
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
      iconMenu: null,
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
        if (paper.Key.isDown('alt')) {
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
              const paintCircle = new paper.Path.Circle(
                new paper.Point(0, 0),
                16,
              );
              paintCircle.fillColor = colorData.color;
              paintCircle.locked = true;
              return createButton(paintCircle, 20, (event, button) => {
                updatePaintColor(colorData);
                this.data.paintColorData = colorData;
              });
            }),
            { spacing: 45, extraColumns: 1 },
          );
          this.iconMenu.data.setPointer(60);
          this.iconMenu.pivot = new paper.Point(0, 0);
          this.iconMenu.position = new paper.Point(100, 45);
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
      iconMenu: null,
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
        if (paper.Key.isDown('alt')) {
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
                buttonIcon = new paper.Group();
                const eraserImg = new paper.Raster(
                  `${imgPath + toolPrefix}eraser.png`,
                );
                eraserImg.scaling = new paper.Point(0.35, 0.35);
                buttonIcon.addChildren([eraserImg]);
              } else {
                const paintCircle = new paper.Path.Circle(
                  new paper.Point(0, 0),
                  16,
                );
                paintCircle.fillColor = colorData.color;
                paintCircle.locked = true;
                buttonIcon = paintCircle;
              }

              return createButton(buttonIcon, 20, (event, button) => {
                updatePaintColor(colorData);
                this.data.paintColorData = colorData;
              });
            },
          );
          this.iconMenu = createMenu(pathColorButtons, {
            spacing: 45,
            extraColumns: 1,
            extraRows: 1,
          });
          this.iconMenu.data.setPointer(110);
          this.iconMenu.pivot = new paper.Point(0, 0);
          this.iconMenu.position = new paper.Point(100, 45);
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
      tools: structureDef.asyncStructureDefinition,
      menuOptions: { spacing: 50, perColumn: 9 },
      yPos: 160,
    }),
    amenities: Object.assign(Object.create(baseObjectCategoryDefinition), {
      type: 'amenities',
      icon: 'amenities',
      tools: amenitiesDef.asyncAmenitiesDefinition,
      menuOptions: { spacing: 50, perColumn: 8 },
      yPos: 208,
    }),

    construction: Object.assign(Object.create(baseObjectCategoryDefinition), {
      type: 'construction',
      icon: 'construction',
      tools: constructionDef.asyncConstructionDefinition,
      menuOptions: { spacing: 50, perColumn: 9 },
      yPos: 260,
    }),

    tree: Object.assign(Object.create(baseObjectCategoryDefinition), {
      type: 'tree',
      icon: 'tree',
      tools: treeDef.asyncTreeDefinition,
      menuOptions: { spacing: 50, perColumn: 8 },
      yPos: 310,
    }),
    flower: Object.assign(Object.create(baseObjectCategoryDefinition), {
      type: 'flower',
      icon: 'flower',
      tools: flowerDef.asyncFlowerDefinition,
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
          if (prevToolData && prevToolData.tool && prevToolData.tool.onSelect) {
            prevToolData.tool.onSelect(false);
          }
          if (nextToolData && nextToolData.tool && nextToolData.tool.onSelect) {
            nextToolData.tool.onSelect(true);
          }
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

  // function squircle (size){ // squircle=square+circle
  //  var hsize = size / 2; // half size
  //
  //  var squircle = new paper.Path();
  //
  //  squircle.add(
  //    new Segment(new paper.Point(0,0), new paper.Point(0,0), new paper.Point(0,hsize)),
  //    new Segment(new paper.Point(0,size), new paper.Point(0,size), new paper.Point(hsize,size)),
  //    new Segment(new paper.Point(size,size), new paper.Point(size,size), new paper.Point(size,hsize)),
  //    new Segment(new paper.Point(size,0), new paper.Point(size,0), new paper.Point(hsize,0))
  //  );
  //  squircle.closed = true;
  //
  //  return squircle;
  // }
  // fixedLayer.activate();
  // var box = squircle(100);
  // box.fillColor = colors.npc;
  // box.position = new paper.Point(300, 300);
  // box.selected = true;
  //
  // var d = new paper.Path.Rectangle(300, 300, 10, 10);
  // d.fillColor = colors.npc;

  // var activeToolIndicator = new paper.Path.Rectangle(0, 100, 5, 40);
  // var activeToolIndicator = new paper.Path.Circle(30, 120, 20);
  // activeToolIndicator.fillColor = colors.npc;

  Object.keys(toolCategoryDefinition).forEach((toolType) => {
    const def = toolCategoryDefinition[toolType];
    const tool = new paper.Raster(`${imgPath + toolPrefix + def.icon}.png`);

    const button = createButton(tool, 20, () => {
      toolState.switchToolType(toolType);
    });
    switch (def.icon) {
      case 'color':
        tool.position = new paper.Point(-8, 0);
        break;
    }
    tool.scaling = new paper.Point(0.4, 0.4);

    addToLeftToolMenu(button);
    def.icon = button;
  });
  addToLeftToolMenu(); // spacer

  const toolBtn = new paper.Raster(`${imgPath}menu-help.png`);
  toolBtn.scaling = new paper.Point(0.3, 0.3);
  toolBtn.position = new paper.Point(0, 4);
  const button = createButton(toolBtn, 20, () => {});
  button.onMouseUp = function () {
    showHelpMenu(true);
  };
  addToLeftToolMenu(button);

  // add gap
  leftToolMenuPosition.y += 60;

  // var activeColor = new paper.Path.Circle([20, 20], 16);
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

  // Create a new paper.Path once, when the script is executed:
  let myPath;

  function startDraw(event) {
    switch (paintTool) {
      case paintTools.grid:
        startDrawGrid(event.point);
        break;
      case paintTools.diagonals:
        break;
      case paintTools.freeform:
        myPath = new paper.Path();
        myPath.strokeColor = paintColor.color;
        myPath.strokeWidth = 10;
        break;
    }
  }

  function draw(event) {
    switch (paintTool) {
      case paintTools.grid:
        var isShift = paper.Key.isDown('shift');
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
        var isShift = paper.Key.isDown('shift');
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
        getObjectCenteredCoordinate(coordinate, toolState.activeTool.tool),
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
    addToHistory(
      objectPositionCommand(object.data.id, prevPos, object.position),
    );
  }

  function applyMoveCommand(isApply, moveCommand) {
    state.objects[moveCommand.id].position = isApply
      ? moveCommand.position
      : moveCommand.prevPosition;
  }

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

    mapLayer.position = new paper.Point(marginX, marginY);
    mapLayer.scaling = new paper.Point(cellWidth, cellHeight);

    mapOverlayLayer.position = new paper.Point(marginX, marginY);
    mapOverlayLayer.scaling = new paper.Point(cellWidth, cellHeight);

    mapIconLayer.position = new paper.Point(marginX, marginY);
    mapIconLayer.scaling = new paper.Point(cellWidth, cellHeight);
  }

  mapOverlayLayer.activate();
  createGrid(mapOverlayLayer, mapLayer);

  // ===============================================
  // COORDINATE LABEL

  mapOverlayLayer.activate();
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

  mapLayer.activate();

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

  let startGridCoordinate;
  let prevGridCoordinate;
  let prevDrawCoordinate;

  let diffCollection = {};

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

  // todo: merge this with the other preview code
  let drawPreview;
  function drawGridLinePreview(viewPosition) {
    const rawCoordinate = new paper.Point(mapLayer.globalToLocal(viewPosition));
    const coordinate = getBrushCenteredCoordinate(rawCoordinate);

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
    let coordinate = new paper.Point(mapLayer.globalToLocal(viewPosition));
    coordinate = getBrushCenteredCoordinate(coordinate);
    startGridCoordinate = coordinate;
    prevGridCoordinate = coordinate;
    drawGrid(viewPosition);
  }

  function drawGrid(viewPosition) {
    mapLayer.activate();
    const rawCoordinate = new paper.Point(mapLayer.globalToLocal(viewPosition));
    const coordinate = getBrushCenteredCoordinate(rawCoordinate);

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
          new paper.CompoundPath({ children: diffCollection[k].path }),
        ),
      };
    });
    diffCollection = {};
    if (Object.keys(mergedDiff).length > 0) {
      addToHistory(drawCommand(mergedDiff));
    }
  }

  function uniteCompoundPath(compound) {
    let p = new paper.Path();
    compound.children.forEach((c) => {
      const u = p.unite(c);
      p.remove();
      p = u;
    });
    compound.remove();
    return p;
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
    mapLayer.activate();
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
