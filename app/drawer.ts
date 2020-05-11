import paper from 'paper';

import { createGrid } from './grid';
import { createMenu } from './ui/createMenu';
import { state, redo, undo, canUndo, canRedo } from './state';
import { emitter } from './emitter';
import {
  updateBrush,
  setBrushLineForce,
  initBrush,
  updatePaintColor,
} from './brush';
import { toolState } from './tools/state';
import { toolCategoryDefinition, initTools } from './tools';
import { createButton } from './ui/createButton';
import { createLeftMenu, addHelpButton } from './ui/leftMenu';
import { showMainMenu } from './ui/mainMenu';
import { initLayers, layers } from './layers';
import { colors } from './colors';
import { tryLoadAutosaveMap } from './load';
import { backgroundInit, drawBackground } from './background';
import { resizeCoordinates } from './resizeCoordinates';
import { keys } from './keyboard';

function initializeApp() {
  toolState.switchToolType(toolCategoryDefinition.terrain.type);
  updatePaintColor(colors.level1);
}

function onResize(event) {
  // Whenever the window is resized, recenter the path:
  resizeCoordinates();
  drawBackground();
  emitter.emit('resize', event);
}

let prevViewMatrix: paper.Matrix;
function onFrame() {
  if (!paper.view.matrix.equals(prevViewMatrix)) {
    const inverted = paper.view.matrix.inverted();
    layers.backgroundLayer.matrix = inverted;

    layers.fixedLayer.matrix = inverted;
    layers.modalLayer.matrix = inverted;
    prevViewMatrix = paper.view.matrix.clone();
  }
}

export function drawer() {
  initLayers();

  layers.mapLayer.activate();

  // Todo: make state use a Listener paradigm rather than triggering method calls

  // ===============================================
  // GLOBAL FUNCTIONS

  prevViewMatrix = paper.view.matrix.clone();

  layers.fixedLayer.activate();

  layers.mapLayer.activate();

  // ===============================================
  // BACKGROUND

  backgroundInit();
  drawBackground();

  paper.view.onMouseDown = function onMouseDown(event) {
    if (keys.isSpaceDown) {
      return;
    }
    toolState.onDown(event);
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseDown(event);
    }
  };
  paper.view.onMouseMove = function onMouseMove(event) {
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseMove(event);
    }
  };
  paper.view.onMouseDrag = function onMouseDrag(event) {
    if (keys.isSpaceDown) {
      return;
    }
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseDrag(event);
    }
  };
  paper.view.onMouseUp = function onMouseUp(event) {
    if (keys.isSpaceDown) {
      return;
    }
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseUp(event);
    }
    toolState.onUp();
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
  // TOOLS
  createLeftMenu();

  layers.fixedLayer.activate();
  initTools();
  addHelpButton();

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

  layers.fixedLayer.activate();

  resizeCoordinates();

  layers.mapOverlayLayer.activate();
  createGrid();

  // ===============================================
  // COORDINATE LABEL

  layers.mapOverlayLayer.activate();

  initBrush();
  updateBrush();
  setBrushLineForce(false);

  layers.mapLayer.activate();

  tryLoadAutosaveMap();

  paper.view.onResize = onResize;
  paper.view.onFrame = onFrame;
  initializeApp();
  resizeCoordinates();
}
