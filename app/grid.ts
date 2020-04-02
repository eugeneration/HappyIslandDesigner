import paper from 'paper';
import {
  verticalDivisions,
  verticalBlocks,
  horizontalBlocks,
  horizontalDivisions,
} from './constants';
import { colors } from './colors';
import { layers } from './layers';

// ===============================================
// GRID overlay

let gridRaster: paper.Raster;

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
  if (gridRaster) gridRaster.remove();
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

// todo: merge this with the other preview code
let drawPreview;
function drawGridLinePreview(viewPosition) {
  const rawCoordinate = new paper.Point(
    layers.mapLayer.globalToLocal(viewPosition),
  );
  const coordinate = getBrushCenteredCoordinate(rawCoordinate);

  layers.mapLayer.activate();
  if (drawPreview) {
    drawPreview.remove();
  }
  if (startGridCoordinate == null) startDrawGrid(viewPosition);
  drawPreview = drawLine(coordinate, startGridCoordinate);
  if (drawPreview) {
    drawPreview.locked = true;
    drawPreview.opacity = 0.6;
    drawPreview.fillColor = paintColor.color;
  }
}

function stopGridLinePreview() {
  if (drawPreview) drawPreview.remove();
}

function startDrawGrid(viewPosition) {
  layers.mapLayer.activate();
  let coordinate = new paper.Point(layers.mapLayer.globalToLocal(viewPosition));
  coordinate = getBrushCenteredCoordinate(coordinate);
  startGridCoordinate = coordinate;
  prevGridCoordinate = coordinate;
  drawGrid(viewPosition);
}

function drawGrid(viewPosition) {
  layers.mapLayer.activate();
  const rawCoordinate = new paper.Point(
    layers.mapLayer.globalToLocal(viewPosition),
  );
  const coordinate = getBrushCenteredCoordinate(rawCoordinate);

  if (prevGridCoordinate == null) startDrawGrid(viewPosition);
  const path = drawLine(coordinate, prevGridCoordinate);
  if (path) {
    const diff = getDiff(path, paintColor.key);

    Object.keys(diff).forEach((colorKey) => {
      const colorDiff = diff[colorKey];
      if (!diffCollection.hasOwnProperty(colorKey)) {
        diffCollection[colorKey] = { isAdd: colorDiff.isAdd, path: [] };
      }
      diffCollection[colorKey].path.push(colorDiff.path);
      if (diffCollection[colorKey].isAdd != colorDiff.isAdd) {
        console.error(`Simultaneous add and remove for ${colorKey}`);
      }
    });
    applyDiff(true, diff);
  }

  prevGridCoordinate = coordinate;
}

function endDrawGrid(viewPosition) {
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
