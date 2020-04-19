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

export function drawLine(start: paper.Point, end: paper.Point): paper.Path {
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
        if (prevDrawLineCoordinate === null) {
          prevDrawLineCoordinate = p;
        } else if (p !== prevDrawCoordinate) {
          const delta = p.subtract(prevDrawCoordinate);
          if (prevDelta !== null && delta !== prevDelta) {
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
    var x = path.clone();
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
  if (!state.drawing.hasOwnProperty(colorKey)) {
    state.drawing[colorKey] = new paper.Path();
    state.drawing[colorKey].locked = true;
  }
  state.drawing[colorKey].reduce();
  console.log(path.area)
  console.log(path.children && path.children.map((p) => p.area));
  const combined = isAdd
    ? state.drawing[colorKey].unite(path)
    : state.drawing[colorKey].subtract(path);
    console.log(path?.children?.length, path.intersections.length)
    console.log(isAdd, path, 
      state.drawing[colorKey], state.drawing[colorKey].children.map((p) => p.segments.length),
      combined,combined.children.map((p) => p.segments.length));
  combined.locked = true;
  combined.fillColor = colors[colorKey].color;
  combined.insertAbove(state.drawing[colorKey]);

  state.drawing[colorKey].remove();
  path.remove();

  state.drawing[colorKey] = combined;
  state.drawing[colorKey].selected = true;
}

export function applyDiff(isApply, diff) {
  // todo: weird location
  if (isApply) {
    prevDrawCoordinate = null;
  }
  Object.keys(diff).forEach((colorKey) => {
    const colorDiff = diff[colorKey];
    let { isAdd } = colorDiff;
    if (!isApply) {
      isAdd = !isAdd;
    } // do the reverse operation
    console.log(colorDiff.path?.children?.length)
    addPath(isAdd, colorDiff.path, colorKey);
  });
}
