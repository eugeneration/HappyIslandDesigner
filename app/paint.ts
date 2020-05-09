import paper from 'paper';

import { state } from './state';
import {
  getCurrentBrushLineForce,
  getCurrentPaintColor,
  getCurrentBrushPoints,
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
import { layers } from './layers';
import { colors } from './colors';

const paintTools = {
  grid: 'grid',
  marquee: 'marquee',
  marqueeDiagonal: 'marqueeDiagonal',
  freeform: 'freeform',
};
let paintTool = paintTools.grid;
let brushLine: boolean = false;
const brushSweep = true;

// Create a new paper.Path once, when the script is executed:
let myPath;

export function startDraw(event) {
  switch (paintTool) {
    case paintTools.grid:
      startDrawGrid(event.point);
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
    case paintTools.grid: {
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
    }
    case paintTools.freeform: {
      // Add a segment to the path at the position of the mouse:
      myPath.add(event.point);
      myPath.smooth({
        type: 'catmull-rom',
      });
      break;
    }
  }
}

export function endDraw(event) {
  switch (paintTool) {
    case paintTools.grid: {
      const brushLineForce = getCurrentBrushLineForce();
      const isShift = paper.Key.isDown('shift');
      if (isShift || brushLineForce) {
        drawGrid(event.point);
      }
      endDrawGrid();
      stopGridLinePreview();
      break;
    }
    case paintTools.freeform: {
      break;
    }
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

let prevDrawCoordinate: paper.Point | undefined;

function getDrawPath(coordinate) {
  const brushPoints = getCurrentBrushPoints();
  const brushSize = getCurrentBrushSize();

  var pos = getBrushCenteredCoordinate(coordinate);
  pos.x -= brushSize / 2 - 0.5;
  pos.y -= brushSize / 2 - 0.5;

  const p = new paper.Path(brushPoints);
  p.segments.forEach((coords, index) => {
    p.segments[index].point = coords.point.add(pos);
  });
  p.closed = true;
  return p;
}

export function drawLine(start: paper.Point, end: paper.Point): paper.Path {
  const drawPaths: paper.Path[] = [];
  if (brushSweep) {
    //prevDrawCoordinate = null;

    let p: paper.Point | undefined;
    let prevDelta: paper.Point | undefined;
    let prevDrawLineCoordinate: paper.Point | undefined;
    doForCellsOnLine(
      Math.round(start.x),
      Math.round(start.y),
      Math.round(end.x),
      Math.round(end.y),
      (x, y) => {
        p = new paper.Point(x, y);

        if (prevDrawLineCoordinate && p.equals(prevDrawLineCoordinate)) return;

        if (prevDrawLineCoordinate == null) {
          prevDrawLineCoordinate = p;
        }
        else if (prevDrawCoordinate) {
          const delta = p.subtract(prevDrawCoordinate);
          if (prevDelta != null && !delta.equals(prevDelta)) {
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
    if (prevDrawCoordinate && prevDrawLineCoordinate) {
      const path = getDrawPath(p);
      drawPaths.push(sweepPath(path, prevDrawLineCoordinate.subtract(prevDrawCoordinate)));
    }
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
  let linePath: paper.Path;
  if (drawPaths.length === 1) {
    linePath = drawPaths[0];
  } else {
    const compound = new paper.CompoundPath({ children: drawPaths });
    linePath = uniteCompoundPath(compound);
  }
  return linePath;
}

export function addPath(isAdd, path, colorKey) {
  layers.mapLayer.activate();
  if (!Object.prototype.hasOwnProperty.call(state.drawing, colorKey)) {
    state.drawing[colorKey] = new paper.Path();
    state.drawing[colorKey].locked = true;
  }
  const combined = isAdd
    ? state.drawing[colorKey].unite(path)
    : state.drawing[colorKey].subtract(path);
  combined.locked = true;
  combined.fillColor = colors[colorKey].color;
  combined.insertAbove(state.drawing[colorKey]);

  state.drawing[colorKey].remove();
  path.remove();

  state.drawing[colorKey] = combined;
}

export function applyDiff(isApply, diff) {
  // todo: weird location
  if (!isApply) {
    prevDrawCoordinate = undefined;
  }
  Object.keys(diff).forEach((colorKey) => {
    const colorDiff = diff[colorKey];
    let { isAdd } = colorDiff;
    if (!isApply) {
      isAdd = !isAdd;
    } // do the reverse operation
    addPath(isAdd, colorDiff.path, colorKey);
  });
}
