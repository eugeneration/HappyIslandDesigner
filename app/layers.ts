export const layers: Record<
  | 'mapLayer'
  | 'mapIconLayer'
  | 'mapOverlayLayer'
  | 'uiLayer'
  | 'fixedLayer'
  | 'cloudLayer',
  paper.Layer
> = {};

export function initLayers() {
  layers.mapLayer = new paper.Layer();
  layers.mapIconLayer = new paper.Layer();
  layers.mapOverlayLayer = new paper.Layer();
  layers.uiLayer = new paper.Layer();
  layers.fixedLayer = new paper.Layer();
  layers.cloudLayer = new paper.Layer();

  layers.cloudLayer.applyMatrix = false;
  layers.fixedLayer.applyMatrix = false;

  layers.mapLayer.applyMatrix = false;
  layers.mapLayer.pivot = new paper.Point(0, 0);
  layers.mapIconLayer.applyMatrix = false;
  layers.mapIconLayer.pivot = new paper.Point(0, 0);
  layers.mapOverlayLayer.applyMatrix = false;
  layers.mapOverlayLayer.pivot = new paper.Point(0, 0);
}
