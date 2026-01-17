import paper from 'paper';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { createButton } from './createButton';
import { goBack } from './mapSelectionWizard';

let selectorUI: paper.Group | null = null;

export type OptionDirection = 'left' | 'right' | 'bottom';

export type OptionConfig = {
  label: string;
  value: number;
  imageSrc?: string;
};

export type MapOptionSelectorConfig = {
  anchorPoint: paper.Point;
  options: OptionConfig[];
  direction: OptionDirection;
  eventName: string;
  title?: string;
  spacing?: number;
  buttonSize?: number;
};

function getOptionPositions(
  anchor: paper.Point,
  count: number,
  direction: OptionDirection,
  spacing: number
): paper.Point[] {
  const positions: paper.Point[] = [];
  const totalSpan = (count - 1) * spacing;
  const startOffset = -totalSpan / 2;

  for (let i = 0; i < count; i++) {
    const offset = startOffset + i * spacing;
    let pos: paper.Point;

    switch (direction) {
      case 'left':
        // Options to the left, spread vertically
        pos = new paper.Point(anchor.x - spacing, anchor.y + offset);
        break;
      case 'right':
        // Options to the right, spread vertically
        pos = new paper.Point(anchor.x + spacing, anchor.y + offset);
        break;
      case 'bottom':
        // Options below, spread horizontally
        pos = new paper.Point(anchor.x + offset, anchor.y + spacing);
        break;
    }
    positions.push(pos);
  }

  return positions;
}

function createOptionButton(
  option: OptionConfig,
  position: paper.Point,
  eventName: string,
  buttonSize: number
): paper.Group {
  const group = new paper.Group();
  group.applyMatrix = false;
  group.position = position;

  // Store original position for reset
  const originalPosition = position.clone();

  // Shadow (offset rectangle)
  const shadowOffset = 0.5;
  const shadowRect = new paper.Path.Rectangle(
    new paper.Rectangle(-buttonSize / 2 + shadowOffset, -buttonSize / 2 + shadowOffset, buttonSize, buttonSize),
    new paper.Size(2, 2)
  );
  shadowRect.fillColor = new paper.Color(0.3, 0.2, 0.15, 0.3);
  group.addChild(shadowRect);

  // Main card background
  const bgRect = new paper.Path.Rectangle(
    new paper.Rectangle(-buttonSize / 2, -buttonSize / 2, buttonSize, buttonSize),
    new paper.Size(2, 2)
  );
  bgRect.fillColor = new paper.Color('#ffffff');
  group.addChild(bgRect);

  // Add image if provided
  if (option.imageSrc) {
    const raster = new paper.Raster(option.imageSrc);
    raster.onLoad = () => {
      // Scale image to fit within button with padding
      const scale = (buttonSize - 2) / Math.max(raster.width, raster.height);
      raster.scale(scale);
      raster.position = new paper.Point(0, 0);
    };
    raster.position = new paper.Point(0, 0);
    group.addChild(raster);
  } else {
    // Fallback to label if no image
    const label = new paper.PointText(new paper.Point(0, 1));
    label.justification = 'center';
    label.fontFamily = 'TTNorms, sans-serif';
    label.fontSize = buttonSize * 0.35;
    label.fillColor = colors.text.color;
    label.content = option.label;
    group.addChild(label);
  }

  // Hover and click handling
  group.onMouseEnter = () => {
    group.scaling = new paper.Point(1.1, 1.1);
    group.rotation = 3;
  };

  group.onMouseLeave = () => {
    group.scaling = new paper.Point(1, 1);
    group.rotation = 0;
    group.position = originalPosition;
  };

  group.onMouseDown = () => {
    group.scaling = new paper.Point(1.05, 1.05);
  };

  group.onMouseUp = () => {
    group.scaling = new paper.Point(1.1, 1.1);
  };

  group.onClick = () => {
    emitter.emit(eventName, { value: option.value });
    hideOptionSelector();
  };

  return group;
}

function createBackButton(position: paper.Point): paper.Group {
  const bgCircle = new paper.Path.Circle(new paper.Point(0, 0), 4);
  bgCircle.fillColor = colors.paper.color;

  const arrow = new paper.Path();
  arrow.strokeColor = colors.text.color;
  arrow.strokeWidth = 0.8;
  arrow.strokeCap = 'round';
  arrow.add(new paper.Point(1.5, 0));
  arrow.add(new paper.Point(-1.5, 0));
  arrow.add(new paper.Point(-0.5, -1.5));
  arrow.add(new paper.Point(-1.5, 0));
  arrow.add(new paper.Point(-0.5, 1.5));

  const button = createButton(bgCircle, 6, () => {
    hideOptionSelector();
    goBack();
  }, {
    highlightedColor: colors.paperOverlay.color,
    selectedColor: colors.paperOverlay2.color,
  });

  button.addChild(arrow);
  button.position = position;

  return button;
}

export function showOptionSelector(config: MapOptionSelectorConfig): void {
  hideOptionSelector();

  const spacing = config.spacing || 12;
  const buttonSize = config.buttonSize || 10;

  layers.mapOverlayLayer.activate();

  selectorUI = new paper.Group();
  selectorUI.applyMatrix = false;

  // Get positions for options
  const positions = getOptionPositions(
    config.anchorPoint,
    config.options.length,
    config.direction,
    spacing
  );

  // Add title label if provided
  if (config.title) {
    const label = new paper.PointText(new paper.Point(0, 0));
    label.content = config.title;
    label.justification = 'center';
    label.fontFamily = 'TTNorms, sans-serif';
    label.fontSize = 4;
    label.fillColor = colors.text.color;

    const labelBg = new paper.Path.Rectangle(
      new paper.Rectangle(
        label.bounds.x - 2,
        label.bounds.y - 1,
        label.bounds.width + 4,
        label.bounds.height + 2
      ),
      new paper.Size(2, 2)
    );
    labelBg.fillColor = colors.paper.color;
    labelBg.opacity = 0.9;

    const labelGroup = new paper.Group([labelBg, label]);
    labelGroup.applyMatrix = false;

    // Position label based on direction
    switch (config.direction) {
      case 'left':
        labelGroup.position = new paper.Point(
          config.anchorPoint.x - spacing - 8,
          config.anchorPoint.y - spacing
        );
        break;
      case 'right':
        labelGroup.position = new paper.Point(
          config.anchorPoint.x + spacing + 8,
          config.anchorPoint.y - spacing
        );
        break;
      case 'bottom':
        labelGroup.position = new paper.Point(
          config.anchorPoint.x,
          config.anchorPoint.y + spacing / 2
        );
        break;
    }
    selectorUI.addChild(labelGroup);
  }

  // Add anchor point indicator
  const anchorDot = new paper.Path.Circle(config.anchorPoint, 3);
  anchorDot.fillColor = colors.npc.color;
  anchorDot.strokeColor = colors.paper.color;
  anchorDot.strokeWidth = 1;
  selectorUI.addChild(anchorDot);

  // Add option buttons
  config.options.forEach((option, index) => {
    const button = createOptionButton(option, positions[index], config.eventName, buttonSize);
    selectorUI!.addChild(button);
  });

  // Add back button
  let backButtonPos: paper.Point;
  switch (config.direction) {
    case 'left':
      backButtonPos = new paper.Point(
        config.anchorPoint.x - spacing - 8,
        config.anchorPoint.y + spacing
      );
      break;
    case 'right':
      backButtonPos = new paper.Point(
        config.anchorPoint.x + spacing + 8,
        config.anchorPoint.y + spacing
      );
      break;
    case 'bottom':
      backButtonPos = new paper.Point(
        config.anchorPoint.x - spacing - 8,
        config.anchorPoint.y + spacing
      );
      break;
  }
  const backButton = createBackButton(backButtonPos);
  selectorUI.addChild(backButton);

  // Zoom to fit the selector and anchor
  zoomToFit(config.anchorPoint, positions, config.direction, spacing);
}

export function hideOptionSelector(): void {
  if (selectorUI) {
    selectorUI.remove();
    selectorUI = null;
  }
}

function zoomToFit(
  anchor: paper.Point,
  positions: paper.Point[],
  direction: OptionDirection,
  spacing: number
): void {
  const view = paper.view;
  const layer = layers.mapOverlayLayer;

  // Calculate bounds that include anchor and all option positions
  const allPoints = [anchor, ...positions];
  let minX = Math.min(...allPoints.map(p => p.x));
  let maxX = Math.max(...allPoints.map(p => p.x));
  let minY = Math.min(...allPoints.map(p => p.y));
  let maxY = Math.max(...allPoints.map(p => p.y));

  // Add padding
  const padding = spacing;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  const localBounds = new paper.Rectangle(minX, minY, maxX - minX, maxY - minY);

  // Transform to global coordinates
  const topLeft = layer.localToGlobal(localBounds.topLeft);
  const bottomRight = layer.localToGlobal(localBounds.bottomRight);
  const globalBounds = new paper.Rectangle(topLeft, bottomRight);

  const viewPadding = 1.5;
  const zoomX = view.viewSize.width / (globalBounds.width * viewPadding);
  const zoomY = view.viewSize.height / (globalBounds.height * viewPadding);
  const newZoom = Math.min(zoomX, zoomY, 4);

  view.zoom = newZoom;
  view.center = globalBounds.center;
}

export function isOptionSelectorVisible(): boolean {
  return selectorUI !== null && selectorUI.visible;
}
