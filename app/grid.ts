import paper from 'paper';
import {
  verticalDivisions,
  verticalBlocks,
  horizontalBlocks,
  horizontalDivisions,
} from './constants';
import { colors } from './colors';

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
        verticalBlocks * verticalDivisions
            + gridNegativeMarginTop
            + gridNegativeMarginBottom,
      ),
    ]
    : [
      new paper.Point(-gridNegativeMarginLeft, i),
      new paper.Point(
        horizontalBlocks * horizontalDivisions
            + gridNegativeMarginLeft
            + gridNegativeMarginRight,
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

export function createGrid(
  mapOverlayLayer: paper.Layer,
  mapLayer: paper.Layer,
) {
  mapOverlayLayer.activate();
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
  mapLayer.activate();
  gridRaster.locked = true;
}
