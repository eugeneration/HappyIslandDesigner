import { state } from './state';
import { getCurrentBrushLineForce, getCurrentPaintColor } from './brush';

const paintTools = {
  grid: 'grid',
  marquee: 'marquee',
  marqueeDiagonal: 'marqueeDiagonal',
  freeform: 'freeform',
};
let paintTool = paintTools.grid;
let brushLine: boolean = false;

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
      endDrawGrid(event.point);
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
