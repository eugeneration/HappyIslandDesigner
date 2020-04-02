import paper from 'paper';

import { state } from './state';
import {
  getCurrentBrushLineForce,
  getCurrentPaintColor,
  getCurrentBrush,
  getCurrentBrushSize,
  getBrushCenteredCoordinate,
} from './brush';
import {
  startDrawGrid,
  drawGrid,
  stopGridLinePreview,
  drawGridLinePreview,
  endDrawGrid,
} from './grid';
import { doForCellsOnLine } from './helpers/doForCellsOnLine';
import { sweepPath } from './helpers/sweepPath';
import { uniteCompoundPath } from './helpers/unitCompoundPath';

const paintTools = {
  grid: 'grid',
  marquee: 'marquee',
  marqueeDiagonal: 'marqueeDiagonal',
  freeform: 'freeform',
};
let paintTool = paintTools.grid;
let brushLine: boolean = false;
const brushSweep = false;

// Create a new paper.Path once, when the script is executed:
let myPath;

export function startDraw(event) {
  switch (paintTool) {
    case paintTools.grid:
      startDrawGrid(event.point);
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      myPath = new paper.Path();
      myPath.strokeColor = getCurrentPaintColor().color;
      myPath.strokeWidth = 10;
      break;
  }
}

export function draw(event) {
  switch (paintTool) {
    case paintTools.grid:
      const brushLineForce = getCurrentBrushLineForce();
      const isShift = paper.Key.isDown('shift');
      if (!brushLine && (isShift || brushLineForce)) {
        startDrawGrid(event.point);
      } else if (brushLine && !(isShift || brushLineForce)) {
        drawGrid(event.point);
        stopGridLinePreview();
      }
      brushLine = isShift || brushLineForce;

      if (brushLine) {
        drawGridLinePreview(event.point);
      } else {
        drawGrid(event.point);
      }
      break;
    case paintTools.marquee:
      break;
    case paintTools.marqueeDiagonal:
      break;
    case paintTools.freeform:
      // Add a segment to the path at the position of the mouse:
      myPath.add(event.point);
      myPath.smooth({
        type: 'catmull-rom',
      });
      break;
  }
}

export function endDraw(event) {
  switch (paintTool) {
    case paintTools.grid:
      const brushLineForce = getCurrentBrushLineForce();
      const isShift = paper.Key.isDown('shift');
      if (isShift || brushLineForce) {
        drawGrid(event.point);
      }
      endDrawGrid();
      stopGridLinePreview();
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      break;
  }
}

export function changePaintTool(newPaintTool) {
  paintTool = newPaintTool;
}

export function applyMoveCommand(isApply, moveCommand) {
  state.objects[moveCommand.id].position = isApply
    ? moveCommand.position
    : moveCommand.prevPosition;
}

let prevDrawCoordinate: paper.Point | null;

function getDrawPath(coordinate) {
  const brushSegments = getCurrentBrush().segments;
  const brushSize = getCurrentBrushSize();

  const p = new paper.Path(brushSegments);
  p.pivot = new paper.Point(brushSize / 2 - 0.5, brushSize / 2 - 0.5);
  p.position = getBrushCenteredCoordinate(coordinate);
  return p;
}

export function drawLine(start, end) {
  const drawPaths: paper.Path[] = [];
  if (brushSweep) {
    prevDrawCoordinate = null;

    let p: paper.Point;
    let prevDelta: paper.Point;
    let prevDrawLineCoordinate: paper.Point | null = null;
    doForCellsOnLine(
      Math.round(start.x),
      Math.round(start.y),
      Math.round(end.x),
      Math.round(end.y),
      (x, y) => {
        p = new paper.Point(x, y);
        if (prevDrawLineCoordinate == null) {
          prevDrawLineCoordinate = p;
        } else if (p !== prevDrawCoordinate) {
          const delta = p.subtract(prevDrawCoordinate);
          if (prevDelta != null && delta !== prevDelta) {
            const path = getDrawPath(prevDrawCoordinate);
            drawPaths.push(
              sweepPath(
                path,
                prevDrawLineCoordinate.subtract(prevDrawCoordinate),
              ),
            );
            prevDrawLineCoordinate = prevDrawCoordinate;
          }
          prevDelta = delta;
        }
        prevDrawCoordinate = p;
      },
    );
    const path = getDrawPath(p);
    drawPaths.push(sweepPath(path, prevDrawLineCoordinate.subtract(p)));
  } else {
    // stamping
    doForCellsOnLine(
      Math.round(start.x),
      Math.round(start.y),
      Math.round(end.x),
      Math.round(end.y),
      (x, y) => {
        const p = new paper.Point(x, y);
        if (p !== prevDrawCoordinate) {
          drawPaths.push(getDrawPath(p));
          prevDrawCoordinate = p;
        }
      },
    );
  }
  let linePath;
  if (drawPaths.length === 1) {
    linePath = drawPaths[0];
  } else if (drawPaths.length > 1) {
    const compound = new paper.CompoundPath({ children: drawPaths });
    linePath = uniteCompoundPath(compound);
  }
  return linePath;
}
