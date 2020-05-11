import paper from 'paper';

import { toolState } from './tools/state';
import {
  updatePaintColor,
  decrementBrush,
  incrementBrush,
  cycleBrushHead,
} from './brush';
import { colors } from './colors';
import { saveMapToFile, encodeMap } from './save';
import { loadMapFromFile } from './load';
import { toolCategoryDefinition } from './tools';
import { showMainMenu, mainMenu } from './ui/mainMenu';
import { showHelpMenu, helpMenu } from './ui/help';
import { toggleGrid } from './grid';
import { redo, undo, state } from './state';
import { toggleScreenshotVisible } from './ui/screenshotOverlay';
import { modals } from './ui/modal';

export const keys = {
  isSpaceDown: false,
};

const keyDownMap = {};

export function onKeyUp(event) {
  switch (event.key) {
    case 'space':
      keys.isSpaceDown = false;
      break;
    case '`':
      toggleScreenshotVisible();
      delete keyDownMap['`'];
      break;
  }
}

export function onKeyDown(event) {
  const shift = paper.Key.isDown('shift');
  const control = paper.Key.isDown('control') || paper.Key.isDown('meta');

  const prevActiveTool = toolState.activeTool;
  switch (event.key) {
    case 'space':
      keys.isSpaceDown = true;
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
      var isMainMenuShown = mainMenu && mainMenu.data.isShown();
      if (isMainMenuShown) {
        showMainMenu(false);
      } else {
        var otherModalShown = false;
          modals.forEach(function (modal) {
            if (modal != mainMenu && modal.data.isShown()) {
              modal.data.show(false);
              otherModalShown = true;
            }
          });
          if (!otherModalShown)
            showMainMenu(true);
      }
      break;
    case '?':
      var isHelpMenuShown = helpMenu && helpMenu.data.isShown();
      showHelpMenu(!isHelpMenuShown);
      break;
    case '\\':
      toggleGrid();
      break;
    case '/':
      console.log(encodeMap());
      navigator.clipboard.writeText(encodeMap());
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
    case '`':
      if (!keyDownMap['`'])
        toggleScreenshotVisible();
      keyDownMap['`'] = true;
      break;
  }
  if (prevActiveTool === toolState.activeTool) {
    toolState.activeTool.definition.onKeyDown(event);
  }
}
