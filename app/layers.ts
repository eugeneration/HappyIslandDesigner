// @ts-nocheck
import paper from 'paper';

export const layers: Record<
  | 'backgroundLayer'
  | 'mapLayer'
  | 'mapIconLayer'
  | 'mapOverlayLayer'
  | 'uiLayer'
  | 'fixedLayer'
  | 'cloudLayer'
  | 'modalLayer',
  paper.Layer
> = {};

export function initLayers() {
  layers.backgroundLayer = paper.project.activeLayer;
  layers.mapLayer = new paper.Layer();
  layers.mapIconLayer = new paper.Layer();
  layers.mapOverlayLayer = new paper.Layer();
  layers.uiLayer = new paper.Layer();
  layers.fixedLayer = new paper.Layer();
  layers.cloudLayer = new paper.Layer();
  layers.modalLayer = new paper.Layer();

  layers.backgroundLayer.applyMatrix = false;
  layers.cloudLayer.applyMatrix = false;
  layers.fixedLayer.applyMatrix = false;
  layers.modalLayer.applyMatrix = false;

  layers.mapLayer.applyMatrix = false;
  layers.mapLayer.pivot = new paper.Point(0, 0);
  layers.mapIconLayer.applyMatrix = false;
  layers.mapIconLayer.pivot = new paper.Point(0, 0);
  layers.mapOverlayLayer.applyMatrix = false;
  layers.mapOverlayLayer.pivot = new paper.Point(0, 0);
}
