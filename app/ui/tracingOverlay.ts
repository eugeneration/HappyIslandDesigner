import { Group, Path, Point, Raster, Rectangle, Size, view } from 'paper';
import { createIncrementComponents, createVerticalIncrementControl } from './incrementControl';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { createButton } from './createButton';
import { clamp } from '../helpers/clamp';
import { showNuxTooltip } from './nuxTooltip';
import { trackOverlayAction } from '../analytics';

let tracingOverlayUI;
function showTracingOverlayUI(isShown) {
  if (!tracingOverlayUI) {
    layers.fixedLayer.activate();

    const closeIcon = new Raster('static/img/ui-x.png');
    closeIcon.scale(0.3);

    const closeButton = createButton(closeIcon, 12, stopTracingOverlay, {
      alpha: 0.7,
      highlightedColor: colors.paperOverlay.color,
      selectedColor: colors.paperOverlay2.color,
    });

    const visibleIcon = new Raster('static/img/ui-visible.png');
    const invisibleIcon = new Raster('static/img/ui-invisible.png');
    visibleIcon.scale(0.5);
    visibleIcon.position = visibleIcon.position.add(new Point(2, 0));
    invisibleIcon.scale(0.5);
    invisibleIcon.position = invisibleIcon.position.add(new Point(2, 0));

    const toggleIcon = new Group();
    toggleIcon.applyMatrix = false;
    toggleIcon.addChildren([visibleIcon, invisibleIcon]);
    toggleIcon.data.enabled = true;
    toggleIcon.data.set = function (visible) {
      toggleIcon.children[0].visible = visible;
      toggleIcon.children[1].visible = !visible;
    };
    toggleIcon.data.set(true);
    const visibilityButton = createButton(toggleIcon, 20, toggleTracingOverlayVisible,
      {
        // options
      });
    emitter.on('updateTracingOverlayVisible', function (visible) {
      toggleIcon.data.set(visible);
    });

    //var icon = new Raster('img/ui-switch.png');
    //icon.scaling = 0.5;

    const incrementComponents = createIncrementComponents(
      function () { incrementTracingOverlayAlpha(true) },
      function () { incrementTracingOverlayAlpha(false) });
    const text = incrementComponents.text;
    const incrementControl = createVerticalIncrementControl(
      incrementComponents.increment,
      incrementComponents.decrement,
      130,
      text,
      35);

    emitter.on('updateTracingOverlayAlpha', update);
    function update(alpha) {
      text.content = alpha * 100 + '%'
    }
    update(0.5);

    tracingOverlayUI = container([visibilityButton, incrementControl]);
    tracingOverlayUI.addChild(closeButton);
    closeButton.position = tracingOverlayUI.bounds.topRight.add(new Point(-5, 5));

    emitter.on('resize', resize);
    function resize() {
      tracingOverlayUI.bounds.bottomRight =
        screenCoordinates(1, 1, -4, -10);
    }
    resize();

  }
  tracingOverlayUI.bringToFront();
  tracingOverlayUI.visible = isShown;

  if (isShown) {
    showNuxTooltip({
      id: 'overlay_controls',
      text: 'Toggle overlay on/off',
      target: tracingOverlayUI,
      layer: layers.fixedLayer,
    });
  }
}

let tracingOverlayImage: paper.Group;
function startTracingOverlay() {
  if (tracingOverlayImage == null) return;
  tracingOverlayImage.opacity = 0.5;
  showTracingOverlayUI(true);
}
function stopTracingOverlay() {
  if (tracingOverlayImage == null) return;
  if (!confirm('Remove the photo overlay? This cannot be undone.')) return;
  trackOverlayAction('close');
  showTracingOverlayUI(false);
  tracingOverlayImage.remove();
}

function incrementTracingOverlayAlpha(increase, amount?: number) {
  if (tracingOverlayImage == null) return;
  trackOverlayAction('transparency');
  amount = amount ?? 0.1;
  const newOpacity = round(
    clamp(tracingOverlayImage.opacity + (increase ? 1 : -1) * amount, 0, 1),
    2);
  if (newOpacity == 0) return; // don't allow 0 opacity

  tracingOverlayImage.opacity = newOpacity;
  emitter.emit('updateTracingOverlayAlpha', newOpacity);
}

export function toggleTracingOverlayVisible() {
  if (!tracingOverlayImage) return;
  trackOverlayAction('toggle');
  tracingOverlayImage.visible = !tracingOverlayImage.visible;
  emitter.emit('updateTracingOverlayVisible', tracingOverlayImage.visible);
}

// TODO - allow moving tracing overlay behind the map layer
//function swapTracingOverlayLayer() {
//  if (!tracingOverlayImage) return;
//}


export function updateMapOverlay(raster, options?: { startHidden?: boolean }) {
  if (tracingOverlayImage) {
    tracingOverlayImage.remove();
  }
  tracingOverlayImage = raster;
  tracingOverlayImage.locked = true;
  tracingOverlayImage.opacity = 0;
  layers.mapOverlayLayer.addChild(tracingOverlayImage);
  tracingOverlayImage.bounds.topLeft = new Point(0, 0);

  startTracingOverlay();
  if (options?.startHidden) {
    tracingOverlayImage.visible = false;
    emitter.emit('updateTracingOverlayVisible', false);
  }
}

function screenCoordinates(percentX, percentY, offsetX, offsetY) {
  offsetX = offsetX || 0;
  offsetY = offsetY || 0;
  return new Point(
    percentX * view.size.width * view.scaling.x + offsetX,
    percentY * view.size.height * view.scaling.y + offsetY);
}

function container(components) {
  const content = new Group();
  content.applyMatrix = false;
  content.addChildren(components);
  let size = 0;
  const spacing = 12;
  content.children.forEach(function (component) {
    component.bounds.topCenter = new Point(0, size);
    size += component.bounds.height + spacing;
  });

  const padding = 13;
  const backing = new Path.Rectangle(new Rectangle(new Point(0, 0), new Point(65, content.bounds.height + padding * 2)), new Size(30, 30));
  backing.fillColor = colors.paper.color;
  backing.bounds.topCenter = new Point(0, -padding);

  const container = new Group();
  container.applyMatrix = false;
  container.addChildren([backing, content]);

  return container;
}

function round(n, p) {
  const d = Math.pow(10, p);
  return Math.round(n * d) / d;
}
