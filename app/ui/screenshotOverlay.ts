import { Group, Path, Point, Raster, Rectangle, Size, view } from 'paper';
import { createIncrementComponents, createVerticalIncrementControl } from './incrementControl';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { createButton } from './createButton';
import { clamp } from '../helpers/clamp';

var screenshotOverlayUI;
function showScreenshotOverlayUI(isShown) {
  if (!screenshotOverlayUI) {
    layers.fixedLayer.activate();

    const closeIcon = new Raster('static/img/ui-x.png');
    closeIcon.scale(0.3);

    const closeButton = createButton(closeIcon, 12, stopScreenshotOverlay, {
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
    var visibilityButton = createButton(toggleIcon, 20, toggleScreenshotVisible,
      {
        // options
      });
    emitter.on('updateScreenshotVisible', function (visible) {
      toggleIcon.data.set(visible);
    });

    //var icon = new Raster('img/ui-switch.png');
    //icon.scaling = 0.5;

    var incrementComponents = createIncrementComponents(
      function () { incrementScreenshotAlpha(true) },
      function () { incrementScreenshotAlpha(false) });
    var text = incrementComponents.text;
    var incrementControl = createVerticalIncrementControl(
      incrementComponents.increment,
      incrementComponents.decrement,
      130,
      text,
      35);

    emitter.on('updateScreenshotAlpha', update);
    function update(alpha) {
      text.content = alpha * 100 + '%'
    }
    update(0.5);

    screenshotOverlayUI = container([visibilityButton, incrementControl]);
    screenshotOverlayUI.addChild(closeButton);
    closeButton.position = screenshotOverlayUI.bounds.topRight.add(new Point(-5, 5));

    emitter.on('resize', resize);
    function resize() {
      screenshotOverlayUI.bounds.bottomRight =
        screenCoordinates(1, 1, -4, -10);
    }
    resize();
  }
  screenshotOverlayUI.bringToFront();
  screenshotOverlayUI.visible = isShown;
}

var screenshot: paper.Group;
function startScreenshotOverlay() {
  if (screenshot == null) return;
  screenshot.opacity = 0.5;
  showScreenshotOverlayUI(true);
}
function stopScreenshotOverlay() {
  if (screenshot == null) return;
  showScreenshotOverlayUI(false);
  screenshot.remove();
}

function incrementScreenshotAlpha(increase, amount?: number) {
  if (screenshot == null) return;
  amount = amount ?? 0.1;
  var newOpacity = round(
    clamp(screenshot.opacity + (increase ? 1 : -1) * amount, 0, 1),
    2);
  if (newOpacity == 0) return; // don't allow 0 opacity

  screenshot.opacity = newOpacity;
  emitter.emit('updateScreenshotAlpha', newOpacity);
}

export function toggleScreenshotVisible() {
  if (!screenshot) return;
  screenshot.visible = !screenshot.visible;
  emitter.emit('updateScreenshotVisible', screenshot.visible);
}

// TODO - allow moving screenshot behind the map layer
//function swapScreenshotLayer() {
//  if (!screenshot) return;
//}


export function updateMapOverlay(raster) {
  if (screenshot) {
    screenshot.remove();
  }
  screenshot = raster;
  screenshot.locked = true;
  screenshot.opacity = 0;
  layers.mapOverlayLayer.addChild(screenshot);
  screenshot.bounds.topLeft = new Point(0, 0);

  startScreenshotOverlay();
}

function screenCoordinates(percentX, percentY, offsetX, offsetY) {
  offsetX = offsetX || 0;
  offsetY = offsetY || 0;
  return new Point(
    percentX * view.size.width * view.scaling.x + offsetX,
    percentY * view.size.height * view.scaling.y + offsetY);
}

function container(components) {
  var content = new Group();
  content.applyMatrix = false;
  content.addChildren(components);
  var size = 0;
  var spacing = 12;
  content.children.forEach(function (component) {
    component.bounds.topCenter = new Point(0, size);
    size += component.bounds.height + spacing;
  });

  var padding = 13;
  var backing = new Path.Rectangle(new Rectangle(new Point(0, 0), new Point(65, content.bounds.height + padding * 2)), new Size(30, 30));
  backing.fillColor = colors.paper.color;
  backing.bounds.topCenter = new Point(0, -padding);

  var container = new Group();
  container.applyMatrix = false;
  container.addChildren([backing, content]);

  return container;
}

function round(n, p) {
  const d = Math.pow(10, p);
  return Math.round(n * d) / d;
}
