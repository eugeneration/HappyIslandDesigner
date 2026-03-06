// @ts-nocheck
import paper from 'paper';
import { layers } from '../layers';
import { colors } from '../colors';
import { emitter } from '../emitter';
import { createButton } from './createButton';
import { rotateObject, changeBridgeLength } from './createObject';
import {
  asyncConstructionDefinition,
  constructionDisplayNames,
  lengthOrder,
  rotationOrder,
} from '../tools/construction';
import { toolCategoryDefinition } from '../tools';
import { toolState } from '../tools/state';

let panelGroup: paper.Group | null = null;
let titleText: paper.PointText | null = null;
let rotateButton: paper.Group | null = null;
let lengthButton: paper.Group | null = null;
let currentObject = null;

function createRotateIcon() {
  const g = new paper.Group();
  // Circular arrow icon
  const arc = new paper.Path.Arc(
    new paper.Point(-7, -4),
    new paper.Point(0, -8),
    new paper.Point(7, -4),
  );
  arc.strokeColor = colors.text.color;
  arc.strokeWidth = 2;
  arc.strokeCap = 'round';

  const arc2 = new paper.Path.Arc(
    new paper.Point(7, 4),
    new paper.Point(0, 8),
    new paper.Point(-7, 4),
  );
  arc2.strokeColor = colors.text.color;
  arc2.strokeWidth = 2;
  arc2.strokeCap = 'round';

  // Arrowheads
  const arrow1 = new paper.Path([
    new paper.Point(5, -8),
    new paper.Point(9, -4),
    new paper.Point(5, -1),
  ]);
  arrow1.strokeColor = colors.text.color;
  arrow1.strokeWidth = 2;
  arrow1.strokeCap = 'round';
  arrow1.strokeJoin = 'round';

  const arrow2 = new paper.Path([
    new paper.Point(-5, 8),
    new paper.Point(-9, 4),
    new paper.Point(-5, 1),
  ]);
  arrow2.strokeColor = colors.text.color;
  arrow2.strokeWidth = 2;
  arrow2.strokeCap = 'round';
  arrow2.strokeJoin = 'round';

  g.addChildren([arc, arc2, arrow1, arrow2]);
  return g;
}

function createLengthIcon() {
  const g = new paper.Group();
  // Double-headed horizontal arrow
  const line = new paper.Path.Line(
    new paper.Point(-8, 0),
    new paper.Point(8, 0),
  );
  line.strokeColor = colors.text.color;
  line.strokeWidth = 2;
  line.strokeCap = 'round';

  const arrowL = new paper.Path([
    new paper.Point(-4, -4),
    new paper.Point(-8, 0),
    new paper.Point(-4, 4),
  ]);
  arrowL.strokeColor = colors.text.color;
  arrowL.strokeWidth = 2;
  arrowL.strokeCap = 'round';
  arrowL.strokeJoin = 'round';

  const arrowR = new paper.Path([
    new paper.Point(4, -4),
    new paper.Point(8, 0),
    new paper.Point(4, 4),
  ]);
  arrowR.strokeColor = colors.text.color;
  arrowR.strokeWidth = 2;
  arrowR.strokeCap = 'round';
  arrowR.strokeJoin = 'round';

  g.addChildren([line, arrowL, arrowR]);
  return g;
}

function isBridgeType(type: string): boolean {
  return type in lengthOrder;
}

function cycleActiveTool(cycleMap) {
  const tool = toolState.activeTool && toolState.activeTool.tool;
  if (!tool) return;
  const nextType = cycleMap[tool.type];
  if (!nextType) return;
  const defs = asyncConstructionDefinition.value;
  const nextDef = defs[nextType];
  if (!nextDef) return;
  const categoryDef = toolCategoryDefinition.construction;
  toolState.switchTool(toolState.toolMapValue(categoryDef, nextDef, {}));
  if (categoryDef.updateMenuButtonIcon) {
    categoryDef.updateMenuButtonIcon(nextDef);
  }
}

function showPanel(objectType: string, object) {
  currentObject = object;
  const displayName = constructionDisplayNames[objectType];
  if (!displayName) {
    hidePanel();
    return;
  }

  titleText.content = displayName;
  rotateButton.visible = true;
  lengthButton.visible = isBridgeType(objectType);

  // Re-center buttons
  const buttons = [];
  if (rotateButton.visible) buttons.push(rotateButton);
  if (lengthButton.visible) buttons.push(lengthButton);
  const spacing = 55;
  const totalWidth = (buttons.length - 1) * spacing;
  buttons.forEach((btn, i) => {
    btn.position = new paper.Point(-totalWidth / 2 + i * spacing, 26);
  });

  panelGroup.visible = true;
  positionPanel();
}

function hidePanel() {
  if (panelGroup) {
    panelGroup.visible = false;
  }
  currentObject = null;
}

function positionPanel() {
  if (!panelGroup) return;
  const viewWidth = paper.view.bounds.width * paper.view.scaling.x;
  const viewHeight = paper.view.bounds.height * paper.view.scaling.y;
  panelGroup.position = new paper.Point(viewWidth / 2, viewHeight - 65);
}

function getTypeForObject(object) {
  return object && object.data && constructionDisplayNames[object.data.type]
    ? object.data.type : null;
}

function getTypeForActiveTool() {
  const tool = toolState.activeTool && toolState.activeTool.tool;
  return tool && constructionDisplayNames[tool.type] ? tool.type : null;
}

function updatePanel() {
  // Priority 1: selected object
  const selectedIds = Object.keys(toolState.selected);
  if (selectedIds.length > 0) {
    const obj = toolState.selected[selectedIds[0]];
    const type = getTypeForObject(obj);
    if (type) {
      showPanel(type, obj);
      return;
    }
  }

  // Priority 2: active tool
  const toolType = getTypeForActiveTool();
  if (toolType) {
    // Show panel but with no object to act on (just display)
    // Only show if we have a specific tool active, not just the category
    showPanel(toolType, null);
    return;
  }

  hidePanel();
}

export function isPanelClick(event): boolean {
  if (!panelGroup || !panelGroup.visible) return false;
  // Panel lives on fixedLayer; convert event point to fixedLayer coordinates
  const localPoint = layers.fixedLayer.globalToLocal(event.point);
  return panelGroup.bounds.contains(localPoint);
}

export function initObjectPanel() {
  layers.fixedLayer.activate();

  panelGroup = new paper.Group();
  panelGroup.applyMatrix = false;

  // Panel backing - rounded rect
  const backing = new paper.Path.Rectangle(
    new paper.Rectangle(-115, -25, 230, 85),
    new paper.Size(20, 20),
  );
  backing.fillColor = colors.paper.color;

  // Title
  titleText = new paper.PointText({
    point: new paper.Point(0, -5),
    justification: 'center',
    fontSize: 13,
    fontFamily: 'TTNorms, sans-serif',
    fontWeight: 'bold',
    fillColor: colors.text.color,
    content: '',
  });

  // Rotate button
  const rotateIcon = createRotateIcon();
  rotateButton = createButton(rotateIcon, 20, () => {
    if (currentObject) {
      rotateObject(currentObject);
    } else {
      cycleActiveTool(rotationOrder);
    }
  });

  // Length button
  const lengthIcon = createLengthIcon();
  lengthButton = createButton(lengthIcon, 20, () => {
    if (currentObject) {
      changeBridgeLength(currentObject);
    } else {
      cycleActiveTool(lengthOrder);
    }
  });

  panelGroup.addChildren([backing, titleText, rotateButton, lengthButton]);
  panelGroup.visible = false;

  positionPanel();

  // Events
  emitter.on('objectSelected', () => {
    updatePanel();
  });
  emitter.on('objectDeselected', () => {
    updatePanel();
  });
  emitter.on('toolSwitched', () => {
    updatePanel();
  });
  emitter.on('resize', () => {
    positionPanel();
  });
}
