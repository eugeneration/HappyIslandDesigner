import { emitter } from './emitter';
import { applyCreateObject } from './ui/createObject';
import { applyMoveCommand } from './paint';
import { autosaveMap } from './save';

/* eslint-disable default-case */
export type State = {
  index: number;
  history: any[];
  drawing: Record<string, paper.Path>;
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
let autosaveTimeout;

export function clearMap() {
  Object.keys(state.drawing).forEach((p) => {
    state.drawing[p].remove();
  });
  state.drawing = {};
  Object.keys(state.objects).forEach((p) => {
    state.objects[p].remove();
  });
  state.objects = {};
}

export function setNewMapData(mapData) {
  // state.objects = mapData.objects; // objects are loaded asynchronously
  state.drawing = mapData.drawing;
}

export function canRedo() {
  return state == null ? 0 : state.index < state.history.length - 1;
}

export function canUndo() {
  return state == null ? 0 : state.index >= 0;
}

export function applyCommand(command, isApply) {
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

export function undo() {
  if (canUndo()) {
    applyCommand(state.history[state.index], false);
    state.index -= 1;
    emitter.emit('historyUpdate', 'undo');
  } else {
    console.log('Nothing to undo');
  }
}

export function redo() {
  if (canRedo()) {
    state.index += 1;
    applyCommand(state.history[state.index], true);
    emitter.emit('historyUpdate', 'redo');
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

  emitter.emit('historyUpdate', 'add');
}
