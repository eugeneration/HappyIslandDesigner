import paper from 'paper';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { createButton } from './createButton';
import {
  setBrushLineForce,
  getCurrentBrush,
  getCurrentPaintColor,
  incrementBrush,
  decrementBrush,
  getCurrentBrushLineForce,
  getCurrentBrushSize,
} from '../brush';

let brushSizeUI;
let brushPreview: paper.Path;
let brushSizeText: paper.PointText;
let drawLineButton: paper.Group;
let drawBrushButton: paper.Group;

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
function update() {
  const brush = getCurrentBrush();
  if (brush) {
    brushPreview.segments = brush.segments;
    brushPreview.bounds.height = Math.min(30, 5 * brushPreview.bounds.height);
    brushPreview.bounds.width = Math.min(30, 5 * brushPreview.bounds.width);
    brushPreview.position = new paper.Point(0, 0);
  }
  brushSizeText.content = `${getCurrentBrushSize()}`;
}

function updateBrushLineButton(isBrushLine) {
  drawLineButton.data.select(isBrushLine);
  drawBrushButton.data.select(!isBrushLine);
}

export function showBrushSizeUI(isShown) {
  if (!brushSizeUI) {
    const group = new paper.Group();
    group.applyMatrix = false;
    brushPreview = new paper.Path();

    const brush = getCurrentBrush();
    if (brush) {
      brushPreview.segments = brush.segments;
    }
    brushPreview.fillColor = getCurrentPaintColor().color;
    brushPreview.strokeColor = colors.lightText.color;
    brushPreview.strokeWidth = 0.1;

    brushSizeText = new paper.PointText(0, 28);
    brushSizeText.fontFamily = 'TTNorms, sans-serif';
    brushSizeText.fontSize = 14;
    brushSizeText.fillColor = colors.text.color;
    brushSizeText.justification = 'center';

    emitter.on('updateBrush', update);
    update();

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

    drawLineButton = brushLineButton('static/img/menu-drawline.png', () => {
      setBrushLineForce(true);
    });

    drawBrushButton = brushLineButton('static/img/menu-drawbrush.png', () => {
      setBrushLineForce(false);
    });

    emitter.on('updateBrushLineForce', updateBrushLineButton);
    updateBrushLineButton(getCurrentBrushLineForce());

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
