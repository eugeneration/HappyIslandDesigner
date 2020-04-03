import paper from 'paper';
import {
  verticalDivisions,
  verticalBlocks,
  horizontalBlocks,
  horizontalDivisions,
} from './constants';
import { addToHistory, drawCommand } from './state';
import { colors } from './colors';
import { drawLine, applyDiff } from './paint';
import { getCurrentPaintColor, getBrushCenteredCoordinate } from './brush';
import { layers } from './layers';
import { uniteCompoundPath } from './helpers/unitCompoundPath';
import { getDiff } from './helpers/getDiff';

// ===============================================
// GRID overlay

let gridRaster: paper.Raster;

let startGridCoordinate;
let prevGridCoordinate;
let diffCollection = {};
let drawPreview;

export function getGridRaster() {
  return gridRaster;
}

export function toggleGrid() {
  gridRaster.visible = !gridRaster.visible;
}

function createGridLine(i, horizontal, blockEdge) {
  const gridNegativeMarginLeft = blockEdge ? 4 : 0;
  const gridNegativeMarginRight = blockEdge ? 4 : 0;
  const gridNegativeMarginTop = blockEdge ? 0 : 0;
  const gridNegativeMarginBottom = blockEdge ? 4 : 0;
  const segment = horizontal
    ? [
        new paper.Point(i, -gridNegativeMarginTop),
        new paper.Point(
          i,
          verticalBlocks * verticalDivisions +
            gridNegativeMarginTop +
            gridNegativeMarginBottom,
        ),
      ]
    : [
        new paper.Point(-gridNegativeMarginLeft, i),
        new paper.Point(
          horizontalBlocks * horizontalDivisions +
            gridNegativeMarginLeft +
            gridNegativeMarginRight,
          i,
        ),
      ];

  const line = new paper.Path(segment);
  line.strokeColor = new paper.Color('#ffffff');
  line.strokeWidth = blockEdge ? 0.2 : 0.1;
  line.strokeCap = 'round';
  // line.dashArray = blockEdge ? [4, 6] : null;
  line.opacity = blockEdge ? 0.5 : 0.2;
  return line;
}

export function createGrid() {
  layers.mapOverlayLayer.activate();
  if (gridRaster) {
    gridRaster.remove();
  }
  const grid: paper.Path[] = [];
  for (let i = 0; i < horizontalBlocks * horizontalDivisions; i++) {
    const line = createGridLine(
      i,
      true,
      i !== 0 && i % horizontalDivisions === 0,
    );
    grid.push(line);
  }
  for (let i = 0; i < verticalBlocks * verticalDivisions; i++) {
    const line = createGridLine(
      i,
      false,
      i !== 0 && i % verticalDivisions === 0,
    );
    grid.push(line);
  }
  const gridGroup = new paper.Group(grid);

  // it starts counting from the second block
  for (let i = 0; i < horizontalBlocks; i++) {
    const gridLabel = new paper.PointText(
      (i + 0.5) * horizontalDivisions,
      verticalBlocks * verticalDivisions + 4,
    );
    gridLabel.justification = 'center';
    gridLabel.fontFamily = 'TTNorms, sans-serif';
    gridLabel.fontSize = 3;
    gridLabel.fillColor = colors.oceanText.color;
    gridLabel.content = 1 + i;
    gridGroup.addChild(gridLabel);
  }

  for (let i = 0; i < verticalBlocks; i++) {
    const gridLabel = new paper.PointText(
      -4,
      (i + 0.5) * verticalDivisions + 1,
    );
    gridLabel.justification = 'center';
    gridLabel.fontFamily = 'TTNorms, sans-serif';
    gridLabel.fontSize = 3;
    gridLabel.fillColor = colors.oceanText.color;
    gridLabel.content = String.fromCharCode(65 + i); // A = 65
    gridGroup.addChild(gridLabel);
  }

  gridRaster = gridGroup.rasterize(paper.view.resolution * 10);
  gridGroup.remove();
  layers.mapLayer.activate();
  gridRaster.locked = true;
}

export function stopGridLinePreview() {
  if (drawPreview) {
    drawPreview.remove();
  }
}

export function drawGrid(viewPosition) {
  layers.mapLayer.activate();
  const rawCoordinate = new paper.Point(
    layers.mapLayer.globalToLocal(viewPosition),
  );
  const coordinate = getBrushCenteredCoordinate(rawCoordinate);

  if (!prevGridCoordinate) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    startDrawGrid(viewPosition);
  }
  const path = drawLine(coordinate, prevGridCoordinate);
  if (path) {
    const diff = getDiff(path, getCurrentPaintColor().key);

    Object.keys(diff).forEach((colorKey) => {
      const colorDiff = diff[colorKey];
      if (!diffCollection.hasOwnProperty(colorKey)) {
        diffCollection[colorKey] = { isAdd: colorDiff.isAdd, path: [] };
      }
      diffCollection[colorKey].path.push(colorDiff.path);
      if (diffCollection[colorKey].isAdd !== colorDiff.isAdd) {
        console.error(`Simultaneous add and remove for ${colorKey}`);
      }
    });
    applyDiff(true, diff);
  }

  prevGridCoordinate = coordinate;
}

export function startDrawGrid(viewPosition) {
  layers.mapLayer.activate();
  let coordinate = new paper.Point(layers.mapLayer.globalToLocal(viewPosition));
  coordinate = getBrushCenteredCoordinate(coordinate);
  startGridCoordinate = coordinate;
  prevGridCoordinate = coordinate;
  drawGrid(viewPosition);
}

export function drawGridLinePreview(viewPosition) {
  const rawCoordinate = new paper.Point(
    layers.mapLayer.globalToLocal(viewPosition),
  );
  const coordinate = getBrushCenteredCoordinate(rawCoordinate);

  layers.mapLayer.activate();
  if (drawPreview) {
    drawPreview.remove();
  }
  if (!startGridCoordinate) {
    startDrawGrid(viewPosition);
  }
  drawPreview = drawLine(coordinate, startGridCoordinate);
  if (drawPreview) {
    drawPreview.locked = true;
    drawPreview.opacity = 0.6;
    drawPreview.fillColor = getCurrentPaintColor().color;
  }
}

export function endDrawGrid() {
  const mergedDiff = {};
  prevGridCoordinate = null;
  startGridCoordinate = null;
  Object.keys(diffCollection).forEach((k) => {
    mergedDiff[k] = {
      isAdd: diffCollection[k].isAdd,
      path: uniteCompoundPath(
        new paper.CompoundPath({ children: diffCollection[k].path }),
      ),
    };
  });
  diffCollection = {};
  if (Object.keys(mergedDiff).length > 0) {
    addToHistory(drawCommand(mergedDiff));
  }
}