import paper from 'paper';
import animatePaper from 'paper-animate';

import { createGrid, toggleGrid } from './grid';
import { createMenu } from './ui/createMenu';
import {
 state, redo, undo, canUndo, canRedo,
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
import { showHelpMenu } from './ui/help';
import { toolState } from './tools/state';
import { toolCategoryDefinition, init } from './tools';
import { createButton } from './ui/createButton';
import { createLeftMenu } from './ui/leftMenu';
import { showMainMenu } from './ui/mainMenu';
import { initLayers, layers } from './layers';
import { colors } from './colors';
import { loadTemplate, tryLoadAutosaveMap, loadMapFromFile } from './load';
import { backgroundInit, drawBackground } from './background';
import { saveMapToFile, encodeMap } from './save';
import { resizeCoordinates } from './resizeCoordinates';

function initializeApp() {
  toolState.switchToolType(toolCategoryDefinition.terrain.type);
  updatePaintColor(colors.level1);
}

export function drawer() {
  initLayers();

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

  layers.fixedLayer.activate();

  //  layers.cloudLayer.matrix = paper.view.matrix.inverted();
  //  layers.cloudLayer.scale(2, paper.view.projectToView(new paper.Point(0, 0)));
  //  layers.cloudLayer.bounds.topLeft = paper.view.projectToView(new paper.Point(0, 0));
  function onFrame() {
    if (!paper.view.matrix.equals(prevViewMatrix)) {
      const inverted = paper.view.matrix.inverted();
      layers.backgroundLayer.matrix = inverted;

      layers.fixedLayer.matrix = inverted;
      layers.modalLayer.matrix = inverted;
      prevViewMatrix = paper.view.matrix.clone();

      //      // clouds shift w/ parallax while scrolling
      //      layers.cloudLayer.matrix = inverted;
      //      layers.cloudLayer.scale(2, paper.view.projectToView(new paper.Point(0, 0)));
      //      layers.cloudLayer.bounds.topLeft = paper.view.projectToView(new paper.Point(0, 0));
    }
    // layers.fixedLayer.pivot = new paper.Point(0, 0);
    // layers.fixedLayer.position = paper.view.viewSize.topLeft;
    // let inverseZoom = 1 / paper.view.zoom;

    // layers.fixedLayer.scaling = new paper.Point(inverseZoom, inverseZoom);
  }
  layers.mapLayer.activate();

  // ===============================================
  // BACKGROUND

  backgroundInit();

  //  layers.cloudLayer.activate();
  //  for (let i = 0; i < 20; i ++) {
  //    let cloud = new paper.Raster('static/img/cloud1.png');
  //    cloud.position = new paper.Point((i % 2 + 2) * 120, (i % 2 + 3) * 120);
  //  }

  let isSpaceDown = false;
  tool.onMouseDown = function onMouseDown(event) {
    if (isSpaceDown) {
      return;
    }
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
    if (isSpaceDown) {
      return;
    }
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseDrag(event);
    }
  };
  tool.onMouseUp = function onMouseUp(event) {
    if (isSpaceDown) {
      return;
    }
    toolState.onUp(event);
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseUp(event);
    }
  };

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

  // ===============================================
  // UI ELEMENTS

  // highlightedColor: string
  // selectedColor: string

  // ===============================================
  // TOOLS
  createLeftMenu();

  layers.fixedLayer.activate();
  init();

  // let menuButton = new paper.Path();
  // menuButton.strokeColor = colors.selected.color;
  // //menuButton.strokeColor *= 0.9;
  // menuButton.strokeWidth = 120;
  // menuButton.strokeCap = 'round';
  // menuButton.segments = [
  //  new paper.Point(-20, 0),
  //  new paper.Point(0, 0),
  // ];

  function undoMenuButton(path, onPress) {
    const icon = new paper.Raster(path);
    icon.scaling = new paper.Point(0.45, 0.45);
    return createButton(icon, 20, onPress);
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

  function updateUndoButtonState() {
    undoButton.data.disable(!canUndo());
    redoButton.data.disable(!canRedo());
  }
  emitter.on('historyUpdate', updateUndoButtonState);
  updateUndoButtonState();

  function positionUndoMenu() {
    undoMenu.position = new paper.Point(
      paper.view.bounds.width * paper.view.scaling.x,
      0,
    ).add(new paper.Point(-50, 30));
  }
  emitter.on('resize', () => {
    positionUndoMenu();
  });
  positionUndoMenu();

  // layout for mobile version
  // let mainMenuButton = new paper.Path.Circle(new paper.Point(paper.view.center.x, 0), 40);
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

  mainMenuButton.onMouseEnter = function () {
    mainMenuButton.tweenTo({ opacity: 1 }, 150);
    mainMenuButtonIcon.tweenTo({ fillColor: colors.offWhite.color }, 150);
  };
  mainMenuButton.onMouseLeave = function () {
    mainMenuButton.tweenTo({ opacity: 0.00001 }, 150);
    mainMenuButtonIcon.tweenTo({ fillColor: colors.text.color }, 150);
  };
  mainMenuButton.onMouseDown = function () {
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
  // addToLeftToolMenu(); // spacer

  // let activeColor = new paper.Path.Circle([20, 20], 16);
  // activeColor.fillColor = paintColor;
  // addToLeftToolMenu(activeColor);

  // function updateColorTools() {
  //  activeColor
  // }

  layers.fixedLayer.activate();

  // const toolsPosition = new paper.Point(40, 80);

  // let pointerToolButton = new paper.Raster('../img/pointer.png');
  // pointerToolButton.position = toolsPosition + new paper.Point(0, 0);
  // pointerToolButton.scaling = new paper.Point(0.2, 0.2);

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
        let isMainMenuShown = !!(mainMenu != null && mainMenu.opacity > 0.8);
        showMainMenu(!isMainMenuShown);
        isHelpMenuShown = !!(helpMenu != null && helpMenu.opacity > 0.8);
        if (isHelpMenuShown === true) {
          showHelpMenu(false);
        }
        break;
      case '?':
        let isHelpMenuShown = !!(helpMenu != null && helpMenu.opacity > 0.8);
        isMainMenuShown = !!(mainMenu != null && mainMenu.opacity > 0.8);
        showHelpMenu(!isHelpMenuShown);
        if (isMainMenuShown === true) {
          showMainMenu(false);
        }
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
    if (prevActiveTool === toolState.activeTool) {
      toolState.activeTool.definition.onKeyDown(event);
    }
  }

  // layers.mapOverlayLayer.activate();
  // let tracemap = new paper.Raster('static/img/tracemap.png');
  // tracemap.locked = true;
  // tracemap.position = new paper.Point(55.85, 52.2);
  // tracemap.scaling = new paper.Point(0.082, .082);
  // tracemap.opacity = 0.3;

  // ===============================================
  // PATH DRAWING

  // ===============================================
  // SHAPE DRAWING

  // Draw a specified shape on the pixel grid

  // ===============================================
  // PIXEL COORDINATE HELPERS

  // let remapX = function(i) {
  //  return i
  // };
  // let remapY = function(i) {
  //  return i
  // };
  // let remapInvX = function(i) {
  //  return i
  // };
  // let remapInvY = function(i) {
  //  return i
  // };

  resizeCoordinates();

  layers.mapOverlayLayer.activate();
  createGrid();

  // ===============================================
  // COORDINATE LABEL

  layers.mapOverlayLayer.activate();
  // let coordinateLabel = new paper.PointText(new paper.Point(0, 0));
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

  initializeApp();
}
