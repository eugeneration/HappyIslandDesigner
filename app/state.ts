import { emitter } from './emitter';
import { applyCreateObject, applyPropertyChange } from './ui/createObject';
import { applyMoveCommand, applyDiff } from './paint';
import { autosaveMap } from './save';
import objectIsEmpty from './helpers/objectIsEmpty';
import { setEdgeTilesFromAssetIndices } from './ui/edgeTiles';
import { setMapVersion } from './mapState';
import { clearWaterfall } from './waterfall';
import { trackUndoRedo } from './analytics';

/* eslint-disable default-case */
export type State = {
  index: number;
  history: any[];
  drawing: Record<string, paper.PathItem>;
  objects: Record<string, any>;
  actionsSinceSave: number;
};

export const state: State = {
  index: -1,
  // TODO: max history
  history: [],
  drawing: {},
  objects: {},
  actionsSinceSave: 0,
};

const maxHistoryIndex = 99; // max length is one greater than this
let actionsCount = 0;
const autosaveActionsInterval = 20;
const autosaveInactivityTimer = 10000;
let autosaveTimeout: NodeJS.Timeout;

export function isMapEmpty() {
  return objectIsEmpty(state.objects) && objectIsEmpty(state.drawing);
}

export function confirmDestructiveActionAsync(message: string): Promise<boolean> {
  const empty = isMapEmpty();
  return Promise.resolve(empty || confirm(message));
}

export function clearMap() {
  Object.keys(state.drawing).forEach((p) => {
    state.drawing[p].remove();
  });
  state.drawing = {};
  Object.keys(state.objects).forEach((p) => {
    state.objects[p].remove();
  });
  state.objects = {};
  clearWaterfall();
}

export function setNewMapData(mapData) {
  // state.objects = mapData.objects; // objects are loaded asynchronously
  state.drawing = mapData.drawing;

  // todo: edgetiles and mapversion should also be saved in this state file so undo/redo works
  if (mapData.edgeTiles) {
    setEdgeTilesFromAssetIndices(mapData.edgeTiles);
  }

  // Set global map version state so V2 features (edge tool) are enabled
  setMapVersion(mapData.version);
}

export function canRedo() {
  return state.index < state.history.length - 1;
}

export function canUndo() {
  return state.index >= 0;
}

export function applyCommand(command, isApply: boolean) {
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
        case 'property':
          applyPropertyChange(isApply, command);
          break;
        case 'color':
          break;
      }
      break;
  }
}

export function undo() {
  if (canUndo()) {
    applyCommand(state.history[state.index], false);
    state.index -= 1;
    emitter.emit('historyUpdate', 'undo');
    trackUndoRedo('undo');
  } else {
    console.log('Nothing to undo');
  }
}

export function redo() {
  if (canRedo()) {
    state.index += 1;
    applyCommand(state.history[state.index], true);
    emitter.emit('historyUpdate', 'redo');
    trackUndoRedo('redo');
  } else {
    console.log('Nothing to redo');
  }
}

export function drawCommand(drawData) {
  return {
    type: 'draw',
    data: drawData,
  };
}

export function objectCommand(action, position, objectData) {
  return {
    type: 'object',
    action,
    data: objectData,
    position,
  };
}

export function objectCreateCommand(objectData, position) {
  return objectCommand('create', position.clone(), objectData);
}

export function objectDeleteCommand(objectData, position) {
  return objectCommand('delete', position.clone(), objectData);
}

export function objectPropertyCommand(oldData, oldPosition, newData, newPosition) {
  return {
    type: 'object',
    action: 'property',
    oldData,
    oldPosition: oldPosition.clone(),
    newData,
    newPosition: newPosition.clone(),
  };
}

export function objectPositionCommand(objectId, prevPosition, position) {
  return {
    type: 'object',
    action: 'position',
    id: objectId,
    position: position.clone(),
    prevPosition: prevPosition.clone(),
  };
}

export function addToHistory(command) {
  state.index += 1;
  // remove future history if went back in time and made an edit
  if (state.index < state.history.length) {
    const removeNum = state.history.length - state.index;
    state.history.splice(-removeNum, removeNum);
  }

  // limit the amount of saved history to reduce memory
  if (state.index > maxHistoryIndex) {
    const removeNum = state.index - maxHistoryIndex;
    state.history.splice(0, removeNum);
    state.index -= removeNum;
  }
  state.history[state.index] = command;

  autosaveTrigger();
  emitter.emit('historyUpdate', 'add');
}

// When a new map is loaded (from file, autosave, or wizard), reset undo history and save immediately
emitter.on('mapLoaded', () => {
  state.index = -1;
  state.history = [];
  state.actionsSinceSave = 0;
});

export function autosaveTrigger() {
  // autosave
  actionsCount += 1;
  state.actionsSinceSave += 1;
  clearTimeout(autosaveTimeout);
  if (actionsCount % autosaveActionsInterval === 0) {
    // every few actions
    autosaveMap();
  } else {
    // or if a new action hasn't been made in a while
    autosaveTimeout = setTimeout(() => {
      autosaveMap();
    }, autosaveInactivityTimer);
  }
}
