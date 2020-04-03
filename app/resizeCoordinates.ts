import paper from 'paper';

import {
  horizontalBlocks,
  horizontalDivisions,
  verticalBlocks,
  verticalDivisions,
  verticalRatio,
} from './constants';
import { layers } from './layers';

let cellWidth = 0;
let cellHeight = 0;
let marginX = 0;
let marginY = 0;

// let remapX = function(i) {
//  return i
// };
// let remapY = function(i) {
//  return i
// };
// let remapInvX = function(i) {
//  return i
// };
// let remapInvY = function(i) {
//  return i
// };

const mapRatio =
  (horizontalBlocks * horizontalDivisions) /
  (verticalBlocks * verticalDivisions) /
  verticalRatio;

export function resizeCoordinates() {
  const screenRatio = paper.view.size.width / paper.view.size.height;
  const horizontallyContrained = screenRatio <= mapRatio;

  const viewWidth = paper.view.size.width * paper.view.scaling.x;
  const viewHeight = paper.view.size.height * paper.view.scaling.y;

  // todo - clean this up with less code duplication
  if (horizontallyContrained) {
    marginX = paper.view.size.width * 0.1;

    const width = viewWidth - marginX * 2;
    const blockWidth = width / horizontalBlocks;
    cellWidth = blockWidth / horizontalDivisions;
    cellHeight = cellWidth * verticalRatio;
    const blockHeight = cellHeight * verticalDivisions;
    const height = blockHeight * verticalBlocks;

    marginY = (viewHeight - height) / 2;

    // let xView = paper.view.size.width - marginX;
    // let xCoord = horizontalBlocks * horizontalDivisions;

    // let yView = height + marginX;
    // let yCoord = verticalBlocks * verticalDivisions;

    // remapX = createRemap(marginX, xView, 0, xCoord);
    // remapY = createRemap(marginY, yView, 0, yCoord);
    // remapInvX = createRemap(0, xCoord, marginX, xView);
    // remapInvY = createRemap(0, yCoord, marginY, yView);
  } else {
    marginY = viewHeight * 0.1;

    const height = viewHeight - marginY * 2;
    const blockHeight = height / verticalBlocks;
    cellHeight = blockHeight / verticalDivisions;
    cellWidth = cellHeight / verticalRatio;
    const blockWidth = cellWidth * horizontalDivisions;
    const width = blockWidth * horizontalBlocks;

    marginX = (viewWidth - width) / 2;
  }

  layers.mapLayer.position = new paper.Point(marginX, marginY);
  layers.mapLayer.scaling = new paper.Point(cellWidth, cellHeight);

  layers.mapOverlayLayer.position = new paper.Point(marginX, marginY);
  layers.mapOverlayLayer.scaling = new paper.Point(cellWidth, cellHeight);

  layers.mapIconLayer.position = new paper.Point(marginX, marginY);
  layers.mapIconLayer.scaling = new paper.Point(cellWidth, cellHeight);
}
