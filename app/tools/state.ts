import { toolCategoryDefinition } from '.';
import { layers } from '../layers';
import { emitter } from '../emitter';
import { trackToolUsage, trackMiscAction } from '../analytics';

class ToolState {
  activeTool: any = null;
  toolMap = {};

  selected = {};
  isSomethingSelected() {
    return Object.keys(this.selected).length > 0;
  }
  isCanvasFocused = false;
  toolIsActive = false;
  isDown = false;
  isDevModeActive = false;
  toolMapValue(definition, tool, modifiers) {
    return {
      type: definition.type,
      definition,
      tool,
      modifiers,
    };
  }
  defaultToolMapValue(toolType) {
    const def = toolCategoryDefinition[toolType];
    return this.toolMapValue(def, def.defaultTool, def.defaultModifiers);
  }
  switchToolType(toolType) {
    if (!Object.prototype.hasOwnProperty.call(this.toolMap, toolType)) {
      this.switchTool(this.defaultToolMapValue(toolType), true);
    } else {
      this.switchTool(this.toolMap[toolType], true);
    }
  }
  switchTool(toolData, isToolTypeSwitch?: boolean) {
    const prevTool = this.activeTool;
    this.activeTool = toolData;
    this.toolMap[toolData.type] = toolData;
    if (prevTool) {
      prevTool.definition.updateTool(prevTool, toolData, isToolTypeSwitch);
    } else if (toolData) {
      toolData.definition.updateTool(prevTool, toolData, isToolTypeSwitch);
    }
    emitter.emit('toolSwitched', toolData);
    trackToolUsage(toolData.type);
  }
  deleteSelection() {
    trackMiscAction('delete');
    Object.keys(this.selected).forEach((objectId) => {
      const object = this.selected[objectId];
      object.onDelete();
    });
    this.deselectAll();
  }
  selectObject(object) {
    this.deselectAll();
    this.selected[object.data.id] = object;
    object.onSelect(true);
    emitter.emit('objectSelected', object);
  }
  deselectObject(object) {
    delete this.selected[object.data.id];
    object.onSelect(false);
    emitter.emit('objectDeselected');
  }
  deselectAll() {
    Object.keys(this.selected).forEach((objectId) => {
      const object = this.selected[objectId];
      object.onSelect(false);
    });
    this.selected = {};
    emitter.emit('objectDeselected');
  }
  onDown(event) {
    // deactivate the tool when something is selected or dragging an object
    this.isDown = true;

    // if we didn't click on one of the selected objects, deselect them
    let clickedOnSelected = false;
    Object.keys(this.selected).forEach((objectId) => {
      const object = this.selected[objectId];
      if (object.contains(layers.mapOverlayLayer.globalToLocal(event.point))) {
        clickedOnSelected = true;
      }
    });
    if (!clickedOnSelected) {
      this.deselectAll();
    }
  }
  onUp() {
    this.isDown = false;

    const isActive = this.isCanvasFocused && !this.isSomethingSelected() && !this.isDevModeActive;
    if (this.toolIsActive !== isActive) {
      this.toolIsActive = isActive;
      if (this.activeTool) {
        this.activeTool.definition.enablePreview(isActive);
      }
    }
  }
  focusOnCanvas(isFocused) {
    this.isCanvasFocused = isFocused;
    if (!this.isDown) {
      const isActive = this.isCanvasFocused && !this.isSomethingSelected() && !this.isDevModeActive;
      if (this.toolIsActive !== isActive) {
        this.toolIsActive = isActive;
        if (this.activeTool) {
          this.activeTool.definition.enablePreview(isActive);
        }
      }
    }
  }
}

export const toolState = new ToolState();
