import paper from 'paper';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { createButton } from './createButton';
import { horizontalBlocks, verticalBlocks, horizontalDivisions, verticalDivisions } from '../constants';
import { goBack } from './mapSelectionWizard';

let selectorUI: paper.Group | null = null;

const mapWidth = horizontalBlocks * horizontalDivisions; // 112
const mapHeight = verticalBlocks * verticalDivisions; // 96

export type SelectionType = 'airport' | 'peninsulaLeft' | 'peninsulaRight';
export type RiverDirection = 'west' | 'south' | 'east';

const blockSize = 16; // Each block is 16x16

type SelectionConfig = {
  label: string;
  positions: paper.Point[];
  zoomBounds: paper.Rectangle;
  eventName: string;
};

// Get airport button positions based on river direction
// Airport takes 2 blocks, button is centered between them
function getAirportPositions(riverDirection: RiverDirection): paper.Point[] {
  const y = (verticalBlocks - 1) * blockSize + blockSize / 2; // Center of bottom row (block 5)

  switch (riverDirection) {
    case 'west':
      // West: blocks 2-3 or 3-4
      return [
        new paper.Point(2 * blockSize, y), // Center between blocks 2-3
        new paper.Point(3 * blockSize, y), // Center between blocks 3-4
      ];
    case 'east':
      // East: blocks 4-5 or 5-6
      return [
        new paper.Point(4 * blockSize, y), // Center between blocks 4-5
        new paper.Point(5 * blockSize, y), // Center between blocks 5-6
      ];
    case 'south':
      // South: blocks 3-4 or 4-5
      return [
        new paper.Point(3 * blockSize, y), // Center between blocks 3-4
        new paper.Point(4 * blockSize, y), // Center between blocks 4-5
      ];
  }
}

// Get the block coordinates for a given airport selection
export function getAirportBlocks(
  riverDirection: RiverDirection,
  airportIndex: number
): { x: number; y: number }[] {
  const y = verticalBlocks - 1; // Bottom row (block 5)

  switch (riverDirection) {
    case 'west':
      // note that indices start at 0, which is -1 from the displayed number
      // West: blocks 2-3 or 3-4
      return airportIndex === 0
        ? [{ x: 1, y }, { x: 2, y }]
        : [{ x: 2, y }, { x: 3, y }];
    case 'east':
      // East: blocks 4-5 or 5-6
      return airportIndex === 0
        ? [{ x: 3, y }, { x: 4, y }]
        : [{ x: 4, y }, { x: 5, y }];
    case 'south':
      // South: blocks 3-4 or 4-5
      return airportIndex === 0
        ? [{ x: 2, y }, { x: 3, y }]
        : [{ x: 3, y }, { x: 4, y }];
  }
}

function getSelectionConfig(type: SelectionType, riverDirection?: RiverDirection): SelectionConfig {
  switch (type) {
    case 'airport':
      return {
        label: 'Select Airport Position',
        positions: riverDirection
          ? getAirportPositions(riverDirection)
          : [
              new paper.Point(mapWidth * 0.35, mapHeight - 8),
              new paper.Point(mapWidth * 0.65, mapHeight - 8),
            ],
        zoomBounds: new paper.Rectangle(0, mapHeight - 30, mapWidth, 30),
        eventName: 'airportSelected',
      };
    case 'peninsulaLeft':
      return {
        label: 'Select Peninsula Position',
        positions: [
          new paper.Point(8, mapHeight * 0.2),
          new paper.Point(8, mapHeight * 0.4),
          new paper.Point(8, mapHeight * 0.6),
          new paper.Point(8, mapHeight * 0.8),
        ],
        zoomBounds: new paper.Rectangle(0, 0, 30, mapHeight),
        eventName: 'peninsulaPosSelected',
      };
    case 'peninsulaRight':
      return {
        label: 'Select Peninsula Position',
        positions: [
          new paper.Point(mapWidth - 8, mapHeight * 0.2),
          new paper.Point(mapWidth - 8, mapHeight * 0.4),
          new paper.Point(mapWidth - 8, mapHeight * 0.6),
          new paper.Point(mapWidth - 8, mapHeight * 0.8),
        ],
        zoomBounds: new paper.Rectangle(mapWidth - 30, 0, 30, mapHeight),
        eventName: 'peninsulaPosSelected',
      };
  }
}

function createPositionButton(index: number, position: paper.Point, eventName: string): paper.Group {
  const circle = new paper.Path.Circle(new paper.Point(0, 0), 4);
  circle.fillColor = colors.water.color;
  circle.strokeColor = colors.paper.color;
  circle.strokeWidth = 1;

  const label = new paper.PointText(new paper.Point(0, 2));
  label.justification = 'center';
  label.fontFamily = 'TTNorms, sans-serif';
  label.fontSize = 5;
  label.fillColor = colors.paper.color;
  label.content = `${index + 1}`;

  const button = createButton(circle, 8, () => {
    emitter.emit(eventName, { index });
    hidePositionSelector();
  }, {
    highlightedColor: colors.water.color,
    selectedColor: colors.npc.color,
  });

  button.addChild(label);
  button.position = position;

  return button;
}

function createBackButton(): paper.Group {
  const bgCircle = new paper.Path.Circle(new paper.Point(0, 0), 4);
  bgCircle.fillColor = colors.paper.color;

  const arrow = new paper.Raster('static/img/back.png');
  arrow.scale(0.09);

  const button = createButton(bgCircle, 5, () => {
    hidePositionSelector();
    goBack();
  }, {
    highlightedColor: colors.paperOverlay.color,
    selectedColor: colors.paperOverlay2.color,
  });

  button.addChild(arrow);

  return button;
}

export function showPositionSelector(type: SelectionType, riverDirection?: RiverDirection): void {
  hidePositionSelector();

  const config = getSelectionConfig(type, riverDirection);

  layers.mapOverlayLayer.activate();

  selectorUI = new paper.Group();
  selectorUI.applyMatrix = false;

  // Add label with background
  const label = new paper.PointText(new paper.Point(0, 0));
  label.content = config.label;
  label.justification = 'center';
  label.fontFamily = 'TTNorms, sans-serif';
  label.fontSize = 3.5;
  label.fillColor = colors.text.color;

  const labelBg = new paper.Path.Rectangle(
    new paper.Rectangle(
      label.bounds.x - 3,
      label.bounds.y - 2,
      label.bounds.width + 6,
      label.bounds.height + 4
    ),
    new paper.Size(3, 3)
  );
  labelBg.fillColor = colors.paper.color;
  labelBg.opacity = 0.9;

  const labelGroup = new paper.Group([labelBg, label]);
  labelGroup.applyMatrix = false;

  // Position label based on selection type
  switch (type) {
    case 'airport':
      labelGroup.position = new paper.Point(mapWidth / 2, mapHeight - 20);
      break;
    case 'peninsulaLeft':
      labelGroup.position = new paper.Point(20, mapHeight * 0.1);
      break;
    case 'peninsulaRight':
      labelGroup.position = new paper.Point(mapWidth - 20, mapHeight * 0.1);
      break;
  }
  selectorUI.addChild(labelGroup);

  // Add position buttons
  config.positions.forEach((pos, index) => {
    const button = createPositionButton(index, pos, config.eventName);
    selectorUI!.addChild(button);
  });

  // Add back button
  const backButton = createBackButton();
  switch (type) {
    case 'airport':
      backButton.position = new paper.Point(mapWidth / 2 - 20, mapHeight - 20);
      break;
    case 'peninsulaLeft':
      backButton.position = new paper.Point(20, mapHeight * 0.05);
      break;
    case 'peninsulaRight':
      backButton.position = new paper.Point(mapWidth - 20, mapHeight * 0.05);
      break;
  }
  selectorUI.addChild(backButton);

  // Zoom to fit
  zoomToFit(config.zoomBounds);
}

export function hidePositionSelector(): void {
  if (selectorUI) {
    selectorUI.remove();
    selectorUI = null;
  }
}

function zoomToFit(bounds: paper.Rectangle): void {
  const view = paper.view;
  const layer = layers.mapOverlayLayer;

  // Transform bounds from layer coordinates to global/project coordinates
  const topLeft = layer.localToGlobal(bounds.topLeft);
  const bottomRight = layer.localToGlobal(bounds.bottomRight);
  const globalBounds = new paper.Rectangle(topLeft, bottomRight);

  const padding = 1.5;
  const zoomX = view.viewSize.width / (globalBounds.width * padding);
  const zoomY = view.viewSize.height / (globalBounds.height * padding);
  const newZoom = Math.min(zoomX, zoomY, 4);

  view.zoom = newZoom;
  view.center = globalBounds.center;
}

export function isPositionSelectorVisible(): boolean {
  return selectorUI !== null && selectorUI.visible;
}

// Get peninsula position coordinates by index and side
export function getPeninsulaPosition(side: 'left' | 'right', index: number): paper.Point {
  const positions = side === 'left'
    ? [
        new paper.Point(8, mapHeight * 0.2),
        new paper.Point(8, mapHeight * 0.4),
        new paper.Point(8, mapHeight * 0.6),
        new paper.Point(8, mapHeight * 0.8),
      ]
    : [
        new paper.Point(mapWidth - 8, mapHeight * 0.2),
        new paper.Point(mapWidth - 8, mapHeight * 0.4),
        new paper.Point(mapWidth - 8, mapHeight * 0.6),
        new paper.Point(mapWidth - 8, mapHeight * 0.8),
      ];

  return positions[index] || positions[0];
}
