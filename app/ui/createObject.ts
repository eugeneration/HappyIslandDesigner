// @ts-nocheck
import { toolCategoryDefinition } from '../tools';
import { layers } from '../layers';
import { getObjectData } from '../helpers/getObjectData';
import {
  objectCreateCommand,
  addToHistory,
  state,
  objectPositionCommand,
  objectDeleteCommand,
  applyCommand,
} from '../state';
import { toolState } from '../tools/state';
import { getObjectCenteredCoordinate } from '../brush';
import { colors } from '../colors';
import { createButton } from './createButton';

export function createObjectIcon(objectDefinition) {
  const item = objectDefinition.icon.clone({ insert: false });
  if (objectDefinition.colorData) {
    item.fillColor = objectDefinition.colorData.color;
  }
  return item;
}

export function createObjectBase(objectDefinition, itemData) {
  let item = createObjectIcon(objectDefinition);
  item.scaling = objectDefinition.scaling;

  if (item.resolution) {
    item = new paper.Group(item);
  }

  item.pivot = item.bounds.bottomCenter.add(objectDefinition.offset);
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

export function createObjectPreview(objectDefinition, itemData) {
  layers.mapOverlayLayer.activate();
  const group = createObjectBase(objectDefinition, itemData);
  return group;
}

export function createObjectPreviewAsync(objectData, callback) {
  toolCategoryDefinition[objectData.category].tools.getAsyncValue((tools) => {
    callback(createObjectPreview(tools[objectData.type], objectData));
  });
}

export function createObjectAsync(objectData, callback) {
  toolCategoryDefinition[objectData.category].tools.getAsyncValue((tools) => {
    callback(createObject(tools[objectData.type], objectData));
  });
}

export function placeObject(event) {
  const coordinate = layers.mapOverlayLayer.globalToLocal(event.point);
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

export function deleteObject(event, object) {
  const command = objectDeleteCommand(object.data, object.position);
  applyCommand(command, true);
  addToHistory(command);
}

let atomicObjectId = 0;
export function applyCreateObject(isCreate, createCommand) {
  if (isCreate) {
    createObjectAsync(createCommand.data, (object) => {
      object.position = createCommand.position;

      if (createCommand.data.id != null) {
        object.data.id = createCommand.data.id;
      } else {
        atomicObjectId += 1;
        object.data.id = atomicObjectId;
      }
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

function grabObject() {}

function dragObject() {}

function dropObject(coordinate, object, prevPos) {
  addToHistory(objectPositionCommand(object.data.id, prevPos, object.position));
}

export function createObject(objectDefinition, itemData) {
  layers.mapIconLayer.activate();

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
    let { deleteButton } = group.data;

    if (show && deleteButton == null) {
      const icon = new paper.Raster('static/img/ui-x.png');
      icon.scaling = new paper.Point(0.03, 0.03);

      const buttonBacking = new paper.Path.Circle(new paper.Point(0, 0), 0.9);
      buttonBacking.fillColor = colors.offWhite.color;
      const button = createButton(icon, 0.8, (event) => {
        group.onDelete();
        event.stopPropagation();
      });

      deleteButton = new paper.Group();
      deleteButton.applyMatrix = false;
      deleteButton.addChildren([buttonBacking, button]);
      group.addChild(deleteButton);
      deleteButton.position = this.elements.bound.bounds.topRight;
      group.data.deleteButton = deleteButton;
    }
    if (!show && deleteButton !== null) {
      deleteButton.remove();
      group.data.deleteButton = null;
    }
  };
  group.onSelect = function (isSelected) {
    if (group.state.selected !== isSelected) {
      this.state.selected = isSelected;
      this.elements.bound.strokeWidth = isSelected ? 0.2 : 0.1;
      this.elements.bound.strokeColor = isSelected
        ? colors.selection.color
        : 'white';
      this.elements.bound.strokeColor.alpha = group.state.focused ? 1 : 0;

      group.showDeleteButton(isSelected);
    }
  };
  group.onMouseEnter = function () {
    this.state.focused = true;
    this.elements.bound.strokeColor.alpha = this.state.selected ? 1 : 0.6;
  };
  group.onMouseLeave = function () {
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
    const coordinate = layers.mapOverlayLayer.globalToLocal(event.point);
    this.data.prevPosition = this.position;
    this.data.wasMoved = false;
    this.data.clickPivot = coordinate.subtract(this.pivot);
    grabObject(coordinate, this);
  };
  group.onMouseDrag = function (event) {
    const coordinate = layers.mapOverlayLayer.globalToLocal(event.point);
    this.position = (coordinate.subtract(this.data.clickPivot)).round();
    if (this.position.getDistance(this.data.prevPosition, true) > 0.1) {
      this.data.wasMoved = true;
    }
    dragObject(coordinate, this);
  };
  group.onMouseUp = function (event) {
    this.elements.bound.strokeColor.alpha = this.state.selected ? 1 : 0.6;
    const { prevPosition } = this.data;
    if (!prevPosition) {
      return;
    }
    const coordinate = layers.mapOverlayLayer.globalToLocal(event.point);

    // if the object was clicked, not dragged
    if (!this.data.wasMoved) {
      toolState.selectObject(this);
    }

    delete this.data.prevPosition;
    delete this.data.clickPivot;
    if (!prevPosition.equals(this.position)) {
      dropObject(coordinate, this, prevPosition);
    }
  };

  return group;
}
