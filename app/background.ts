import paper from 'paper';
import { layers } from './layers';
import { toolState } from './tools/state';
import { colors } from './colors';

let backgroundRect: paper.Path;
export function backgroundInit() {
  layers.backgroundLayer.activate();

  backgroundRect = new paper.Path();
  backgroundRect.fillColor = colors.water.color;
  backgroundRect.onMouseEnter = function () {
    toolState.focusOnCanvas(true);
  };
  backgroundRect.onMouseLeave = function () {
    toolState.focusOnCanvas(false);
  };
}

export function drawBackground() {
  backgroundRect.segments = [
    new paper.Segment(new paper.Point(0, 0)),
    new paper.Segment(new paper.Point(paper.view.size.width * paper.view.scaling.x, 0)),
    new paper.Segment(
      new paper.Point(paper.view.size.width * paper.view.scaling.x,
      paper.view.size.height * paper.view.scaling.y)
    ),
    new paper.Segment(new paper.Point(0, paper.view.size.height * paper.view.scaling.y)),
  ];
  layers.mapLayer.activate();
}
