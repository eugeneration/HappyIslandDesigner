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
import { createIncrementComponents, createVerticalIncrementControl } from './incrementControl';
import { Group, Path, Point, Rectangle, Size } from 'paper';

let brushSizeUI;
let brushPreview: paper.Path;
let brushSizeText: paper.PointText;
let drawLineButton: paper.Group;
let drawBrushButton: paper.Group;

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
  brushSizeText.content = `${getCurrentBrushSize() || '0.5'}`; // size zero brush is actually 0.5
}

function updateBrushLineButton(isBrushLine) {
  drawLineButton.data.select(isBrushLine);
  drawBrushButton.data.select(!isBrushLine);
}

export function showBrushSizeUI(isShown) {
  if (!brushSizeUI) {

    brushPreview = new Path();

    const brush = getCurrentBrush();
    if (brush) {
      brushPreview.segments = brush.segments;
    }
    brushPreview.fillColor = getCurrentPaintColor().color;
    brushPreview.strokeColor = colors.lightText.color;
    brushPreview.strokeWidth = 0.1;

    var incrementComponents = createIncrementComponents(incrementBrush, decrementBrush);

    brushSizeText = incrementComponents.text;
    brushSizeText.content = '0';
    brushSizeText.position = new Point(0, 24);

    var incrementImage = new Group();
    incrementImage.applyMatrix = false;
    incrementImage.addChildren([brushPreview, brushSizeText]);

    var incrementControl = createVerticalIncrementControl(
      incrementComponents.increment,
      incrementComponents.decrement,
      153,
      incrementImage,
      22);

    incrementControl.position = incrementControl.position.add(new Point(0, -22));

    emitter.on('updateBrush', update);
    update();

    drawLineButton = brushLineButton('static/img/menu-drawline.png', () => {
      setBrushLineForce(true);
    });

    drawBrushButton = brushLineButton('static/img/menu-drawbrush.png', () => {
      setBrushLineForce(false);
    });

    emitter.on('updateBrushLineForce', updateBrushLineButton);
    updateBrushLineButton(getCurrentBrushLineForce());

    drawLineButton.position = new Point(0, 210);
    drawBrushButton.position = new Point(0, 170);

    const backingWidth = 42;

    const brushLineBacking = new Path.Rectangle(
      new Rectangle(
        -backingWidth / 2,
        0,
        backingWidth,
        82,
      ),
      new Size(backingWidth / 2, backingWidth / 2),
    );
    brushLineBacking.strokeColor = colors.paperOverlay2.color;
    brushLineBacking.strokeWidth = 2;
    brushLineBacking.position = incrementControl.position.add(new Point(0, 136));

    const group = new paper.Group();
    group.applyMatrix = false;
    group.addChildren([
      incrementControl,
      brushLineBacking,
      drawLineButton,
      drawBrushButton,
    ]);
    group.pivot = new Point(0, 0);
    group.position = new Point(105, 55);
    brushSizeUI = group;
  }
  brushSizeUI.bringToFront();
  brushSizeUI.visible = isShown;
}
