import paper from 'paper';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { createButton } from './createButton';
import { horizontalBlocks, verticalBlocks, horizontalDivisions, verticalDivisions } from '../constants';
import { goBack } from './mapSelectionWizard';
import { getBlockState } from './edgeTiles';
import { getMobileOperatingSystem } from '../helpers/getMobileOperatingSystem';
import { getCachedSvgContent } from '../generatedTilesCache';
import { WIZARD_MAX_BLOCK_PX, startViewAnimation, tickViewAnimation, stopViewAnimation } from './viewAnimation';

let selectorUI: paper.Group | null = null;
let fixedUI: paper.Group | null = null;
let labelGroup: paper.Group | null = null;
let subLabelText: paper.PointText | null = null;
let resizeHandler: (() => void) | null = null;
let previewGroup: paper.Group | null = null;
let selectedPositionIndex: number | null = null;
let positionButtons: paper.Group[] = [];
let currentEventName: string | null = null;
let frameHandler: ((event: { delta: number }) => void) | null = null;
let currentZoomBounds: paper.Rectangle | null = null;

const mapWidth = horizontalBlocks * horizontalDivisions; // 112
const mapHeight = verticalBlocks * verticalDivisions; // 96

export type SelectionType = 'airport' | 'peninsulaLeft' | 'peninsulaRight' | 'secretBeach' | 'leftRock' | 'rightRock';
export type RiverDirection = 'west' | 'south' | 'east';

const blockSize = 16; // Each block is 16x16

type SelectionConfig = {
  label: string;
  icon?: string;
  positions: paper.Point[];
  originalIndices?: number[]; // Maps filtered positions back to original indices
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

// Get the secret beach columns based on river direction
export function getSecretBeachColumns(riverDirection: RiverDirection): number[] {
  switch (riverDirection) {
    case 'west':
      return [3, 4, 5];
    case 'south':
      return [2, 3, 4];
    case 'east':
      return [1, 2, 3];
  }
}

// Get the block coordinates for a given secret beach selection
export function getSecretBeachBlock(
  riverDirection: RiverDirection,
  positionIndex: number
): { x: number; y: number } {
  const columns = getSecretBeachColumns(riverDirection);
  return { x: columns[positionIndex], y: 0 };
}

// Get the secret beach position point for the shape selector anchor
export function getSecretBeachPosition(
  riverDirection: RiverDirection,
  positionIndex: number
): paper.Point {
  const block = getSecretBeachBlock(riverDirection, positionIndex);
  return new paper.Point(block.x * blockSize + blockSize / 2, blockSize / 2);
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

function computePositionZoomBounds(positions: paper.Point[]): paper.Rectangle {
  const pad = blockSize; // half-block for block extent + half-block for visual padding
  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  return new paper.Rectangle(
    Math.min(...xs) - pad, Math.min(...ys) - pad,
    Math.max(...xs) - Math.min(...xs) + pad * 2,
    Math.max(...ys) - Math.min(...ys) + pad * 2
  );
}

function getSelectionConfig(type: SelectionType, riverDirection?: RiverDirection): SelectionConfig {
  switch (type) {
    case 'airport': {
      const positions = riverDirection
        ? getAirportPositions(riverDirection)
        : [
            new paper.Point(mapWidth * 0.35, mapHeight - 8),
            new paper.Point(mapWidth * 0.65, mapHeight - 8),
          ];
      return {
        label: 'Select Airport Position',
        icon: 'static/svg/amenity-airport.svg',
        positions,
        zoomBounds: computePositionZoomBounds(positions),
        eventName: 'airportSelected',
      };
    }
    case 'peninsulaLeft': {
      // Filter out positions where the left edge block is occupied by river
      const leftCandidates = [
        { point: new paper.Point(blockSize / 2, 1 * blockSize + blockSize / 2), blockY: 1, originalIndex: 0 },
        { point: new paper.Point(blockSize / 2, 2 * blockSize + blockSize / 2), blockY: 2, originalIndex: 1 },
        { point: new paper.Point(blockSize / 2, 3 * blockSize + blockSize / 2), blockY: 3, originalIndex: 2 },
        { point: new paper.Point(blockSize / 2, 4 * blockSize + blockSize / 2), blockY: 4, originalIndex: 3 },
      ].filter(p => getBlockState(0, p.blockY) === 'placeholder' || getBlockState(0, p.blockY) === undefined);

      const leftPositions = leftCandidates.map(p => p.point);
      return {
        label: 'Select Peninsula Position',
        positions: leftPositions,
        originalIndices: leftCandidates.map(p => p.originalIndex),
        zoomBounds: computePositionZoomBounds(leftPositions),
        eventName: 'peninsulaPosSelected',
      };
    }
    case 'peninsulaRight': {
      // Filter out positions where the right edge block is occupied by river
      const rightCandidates = [
        { point: new paper.Point(mapWidth - blockSize / 2, 1 * blockSize + blockSize / 2), blockY: 1, originalIndex: 0 },
        { point: new paper.Point(mapWidth - blockSize / 2, 2 * blockSize + blockSize / 2), blockY: 2, originalIndex: 1 },
        { point: new paper.Point(mapWidth - blockSize / 2, 3 * blockSize + blockSize / 2), blockY: 3, originalIndex: 2 },
        { point: new paper.Point(mapWidth - blockSize / 2, 4 * blockSize + blockSize / 2), blockY: 4, originalIndex: 3 },
      ].filter(p => getBlockState(horizontalBlocks - 1, p.blockY) === 'placeholder' || getBlockState(horizontalBlocks - 1, p.blockY) === undefined);

      const rightPositions = rightCandidates.map(p => p.point);
      return {
        label: 'Select Peninsula Position',
        positions: rightPositions,
        originalIndices: rightCandidates.map(p => p.originalIndex),
        zoomBounds: computePositionZoomBounds(rightPositions),
        eventName: 'peninsulaPosSelected',
      };
    }
    case 'secretBeach': {
      // Secret beach positions depend on river direction
      // West: columns 3, 4, 5 | South: columns 2, 3, 4 | East: columns 1, 2, 3
      const y = blockSize / 2; // Center of top row (block 0)
      let columns: number[];

      switch (riverDirection) {
        case 'west':
          columns = [3, 4, 5];
          break;
        case 'south':
          columns = [2, 3, 4];
          break;
        case 'east':
          columns = [1, 2, 3];
          break;
        default:
          columns = [2, 3, 4];
      }

      // Filter out occupied positions
      const beachCandidates = columns
        .map((col, idx) => ({
          point: new paper.Point(col * blockSize + blockSize / 2, y),
          blockX: col,
          originalIndex: idx,
        }))
        .filter(p => getBlockState(p.blockX, 0) === 'placeholder' || getBlockState(p.blockX, 0) === undefined);

      const beachPoints = beachCandidates.map(p => p.point);

      return {
        label: 'Select Secret Beach Position',
        positions: beachPoints,
        originalIndices: beachCandidates.map(p => p.originalIndex),
        zoomBounds: computePositionZoomBounds(beachPoints),
        eventName: 'secretBeachPosSelected',
      };
    }
    case 'leftRock': {
      // Left rock on column 0, rows 1-4 (excluding corners and occupied tiles)
      const leftRockCandidates = [
        { point: new paper.Point(blockSize / 2, 1 * blockSize + blockSize / 2), blockY: 1, originalIndex: 0 },
        { point: new paper.Point(blockSize / 2, 2 * blockSize + blockSize / 2), blockY: 2, originalIndex: 1 },
        { point: new paper.Point(blockSize / 2, 3 * blockSize + blockSize / 2), blockY: 3, originalIndex: 2 },
        { point: new paper.Point(blockSize / 2, 4 * blockSize + blockSize / 2), blockY: 4, originalIndex: 3 },
      ].filter(p => getBlockState(0, p.blockY) === 'placeholder' || getBlockState(0, p.blockY) === undefined);

      const leftRockPositions = leftRockCandidates.map(p => p.point);
      return {
        label: 'Select Left Rock Position',
        positions: leftRockPositions,
        originalIndices: leftRockCandidates.map(p => p.originalIndex),
        zoomBounds: computePositionZoomBounds(leftRockPositions),
        eventName: 'leftRockPosSelected',
      };
    }
    case 'rightRock': {
      // Right rock on column 6, rows 1-4 (excluding corners and occupied tiles)
      const rightRockCandidates = [
        { point: new paper.Point(mapWidth - blockSize / 2, 1 * blockSize + blockSize / 2), blockY: 1, originalIndex: 0 },
        { point: new paper.Point(mapWidth - blockSize / 2, 2 * blockSize + blockSize / 2), blockY: 2, originalIndex: 1 },
        { point: new paper.Point(mapWidth - blockSize / 2, 3 * blockSize + blockSize / 2), blockY: 3, originalIndex: 2 },
        { point: new paper.Point(mapWidth - blockSize / 2, 4 * blockSize + blockSize / 2), blockY: 4, originalIndex: 3 },
      ].filter(p => getBlockState(horizontalBlocks - 1, p.blockY) === 'placeholder' || getBlockState(horizontalBlocks - 1, p.blockY) === undefined);

      const rightRockPositions = rightRockCandidates.map(p => p.point);
      return {
        label: 'Select Right Rock Position',
        positions: rightRockPositions,
        originalIndices: rightRockCandidates.map(p => p.originalIndex),
        zoomBounds: computePositionZoomBounds(rightRockPositions),
        eventName: 'rightRockPosSelected',
      };
    }
  }
}

function getPreviewAssetIndex(type: SelectionType): number | null {
  switch (type) {
    case 'secretBeach': return 911;
    case 'peninsulaLeft': return 912;
    case 'peninsulaRight': return 913;
    case 'leftRock': return 904;
    case 'rightRock': return 905;
    case 'airport': return null; // Special handling
  }
}

function getFloatingPreviewPosition(type: SelectionType, config: SelectionConfig): paper.Point {
  const centerY = config.positions.reduce((sum, p) => sum + p.y, 0) / config.positions.length;
  const centerX = config.positions.reduce((sum, p) => sum + p.x, 0) / config.positions.length;

  switch (type) {
    case 'peninsulaLeft':
    case 'leftRock':
      return new paper.Point(-8, centerY);
    case 'peninsulaRight':
    case 'rightRock':
      return new paper.Point(mapWidth + 8, centerY);
    case 'secretBeach':
      return new paper.Point(centerX, -8);
    case 'airport':
      return new paper.Point(centerX, mapHeight + 8);
  }
}

function createTilePreview(type: SelectionType): paper.Group {
  const group = new paper.Group();
  group.applyMatrix = false;
  group.opacity = 0.7;

  if (type === 'airport') {
    // Airport: green background + two airport tile SVGs (34, 35) + airport icon
    const bgLeft = new paper.Path.Rectangle(
      new paper.Rectangle(-blockSize, -blockSize / 2, blockSize, blockSize)
    );
    bgLeft.fillColor = colors.level1.color;
    group.addChild(bgLeft);

    const bgRight = new paper.Path.Rectangle(
      new paper.Rectangle(0, -blockSize / 2, blockSize, blockSize)
    );
    bgRight.fillColor = colors.level1.color;
    group.addChild(bgRight);

    // Load airport tile SVGs
    const airportAssets = [34, 35];
    airportAssets.forEach((assetId, i) => {
      const cachedSvg = getCachedSvgContent(assetId);
      if (cachedSvg) {
        const item = paper.project.importSVG(cachedSvg, { insert: false });
        if (item) {
          const scale = blockSize / Math.max(item.bounds.width, item.bounds.height);
          item.scale(scale);
          item.position = new paper.Point((i - 0.5) * blockSize, 0);
          group.addChild(item);
        }
      }
    });

  } else {
    // Green level1 background behind the tile
    const bg = new paper.Path.Rectangle(
      new paper.Rectangle(-blockSize / 2, -blockSize / 2, blockSize, blockSize)
    );
    bg.fillColor = colors.level1.color;
    group.addChild(bg);

    const assetIndex = getPreviewAssetIndex(type);
    if (assetIndex !== null) {
      const cachedSvg = getCachedSvgContent(assetIndex);
      if (cachedSvg) {
        const item = paper.project.importSVG(cachedSvg, { insert: false });
        if (item) {
          const scale = blockSize / Math.max(item.bounds.width, item.bounds.height);
          item.scale(scale);
          item.position = new paper.Point(0, 0);
          group.addChild(item);
        }
      }
    }
  }

  return group;
}

function handlePositionTap(originalIndex: number, position: paper.Point, button: paper.Group): void {
  if (selectedPositionIndex === originalIndex) {
    // Second tap on same position — confirm
    if (currentEventName) {
      emitter.emit(currentEventName, { index: originalIndex });
    }
    hidePositionSelector();
  } else {
    // First tap — show preview at this position, deselect previous
    positionButtons.forEach(b => b.data.select(false));
    button.data.select(true);
    selectedPositionIndex = originalIndex;

    if (previewGroup) {
      previewGroup.visible = true;
      previewGroup.position = position;
    }

    // Update sub-label text
    if (subLabelText) {
      const isMobile = getMobileOperatingSystem() !== 'unknown';
      subLabelText.content = isMobile ? 'Tap again to confirm' : 'Click again to confirm';
    }
  }
}

function createTileSquareButton(index: number, position: paper.Point): paper.Group {
  const group = new paper.Group();
  group.applyMatrix = false;

  const halfSize = blockSize / 2;
  const rect = new paper.Path.Rectangle(
    new paper.Rectangle(-halfSize, -halfSize, blockSize, blockSize)
  );
  rect.strokeColor = colors.paper.color;
  rect.strokeWidth = 0.5;
  rect.dashArray = [1.5, 1.5];
  rect.fillColor = colors.invisible.color;

  group.addChild(rect);
  group.position = position;

  // Pointer finger icon at bottom-right corner, hidden until selected
  let pointer: paper.Item | null = null;
  paper.project.importSVG('static/svg/pointer.svg', {
    onLoad: (svgItem: paper.Item) => {
      svgItem.scale(6 / svgItem.bounds.width);
      svgItem.position = new paper.Point(halfSize, halfSize);
      svgItem.visible = false;
      pointer = svgItem;
      group.addChild(svgItem);
    },
    insert: false,
  });

  function updateStyle() {
    if (group.data.selected) {
      rect.strokeColor = new paper.Color('#FFD700');
      rect.strokeWidth = 0.8;
      rect.dashArray = [];
      group.bringToFront();
    } else if (group.data.hovered) {
      rect.strokeColor = colors.paper.color;
      rect.strokeWidth = 0.8;
      rect.dashArray = [1.5, 1.5];
    } else {
      rect.strokeColor = colors.paper.color;
      rect.strokeWidth = 0.5;
      rect.dashArray = [1.5, 1.5];
    }
    if (pointer) pointer.visible = group.data.selected;
  }

  group.data = {
    selected: false,
    hovered: false,
    select(isSelected: boolean) {
      group.data.selected = isSelected;
      updateStyle();
    },
  };

  group.onMouseEnter = () => { group.data.hovered = true; updateStyle(); };
  group.onMouseLeave = () => { group.data.hovered = false; updateStyle(); };
  group.onMouseUp = () => { handlePositionTap(index, position, group); };

  return group;
}

function createAirportButton(index: number, position: paper.Point, icon: string): paper.Group {
  const group = new paper.Group();
  group.applyMatrix = false;

  // Dotted outlines for the two airport tile positions (each 1 block wide)
  const outline = new paper.Path.Rectangle(
    new paper.Rectangle(-blockSize / 2, -blockSize / 2, blockSize, blockSize)
  );
  outline.strokeColor = colors.paper.color;
  outline.strokeWidth = 0.5;
  outline.dashArray = [1.5, 1.5];
  outline.fillColor = null;
  group.addChild(outline);

  // Hit area: one block (16x16) centered at the airport icon
  const rect = new paper.Path.Rectangle(
    new paper.Rectangle(-blockSize / 2, -blockSize / 2, blockSize, blockSize)
  );
  rect.strokeWidth = 0;
  rect.fillColor = colors.invisible.color;
  group.addChild(rect);

  // Airport icon
  let iconItem: paper.Item | null = null;
  paper.project.importSVG(icon, {
    onLoad: (svgItem: paper.Item) => {
      svgItem.scale(8 / svgItem.bounds.height);
      svgItem.position = new paper.Point(0, 0);
      svgItem.opacity = 0.5;
      iconItem = svgItem;
      group.addChild(svgItem);
    },
    insert: false,
  });

  // Pointer finger icon pointing toward the airplane icon
  let pointer: paper.Item | null = null;
  paper.project.importSVG('static/svg/pointer.svg', {
    onLoad: (svgItem: paper.Item) => {
      svgItem.scale(6 / svgItem.bounds.width);
      svgItem.position = new paper.Point(blockSize - 12, blockSize / 2);
      svgItem.visible = false;
      pointer = svgItem;
      group.addChild(svgItem);
    },
    insert: false,
  });

  group.position = position;

  function updateStyle() {
    if (group.data.selected) {
      rect.strokeColor = new paper.Color('#FFD700');
      rect.strokeWidth = 0.8;
      rect.dashArray = [];
      group.bringToFront();
    } else {
      rect.strokeWidth = 0;
    }
    if (pointer) pointer.visible = group.data.selected;
    if (iconItem) {
      iconItem.opacity = (group.data.selected || group.data.hovered) ? 0.8 : 0.5;
    }
  }

  group.data = {
    selected: false,
    hovered: false,
    select(isSelected: boolean) {
      group.data.selected = isSelected;
      updateStyle();
    },
  };

  group.onMouseEnter = () => { group.data.hovered = true; updateStyle(); };
  group.onMouseLeave = () => { group.data.hovered = false; updateStyle(); };
  group.onMouseUp = () => { handlePositionTap(index, position, group); };

  return group;
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

  // Store state for two-tap flow
  currentEventName = config.eventName;
  selectedPositionIndex = null;
  positionButtons = [];

  layers.mapOverlayLayer.activate();

  // Create preview tile
  previewGroup = createTilePreview(type);
  if (type === 'airport') {
    // Airport preview starts hidden, shown when a position is selected
    previewGroup.visible = false;
  } else {
    previewGroup.position = getFloatingPreviewPosition(type, config);
  }

  selectorUI = new paper.Group();
  selectorUI.applyMatrix = false;

  // Add position buttons
  config.positions.forEach((pos, index) => {
    // Use original index if available (for filtered peninsula positions)
    const originalIndex = config.originalIndices ? config.originalIndices[index] : index;
    const button = config.icon
      ? createAirportButton(originalIndex, pos, config.icon)
      : createTileSquareButton(originalIndex, pos);
    selectorUI!.addChild(button);
    positionButtons.push(button);
  });

  // Zoom to fit
  currentZoomBounds = config.zoomBounds;
  zoomToFit(config.zoomBounds);

  // Pre-select middle position for non-airport types
  if (!config.icon && positionButtons.length > 0) {
    const midIdx = Math.floor(positionButtons.length / 2);
    const midButton = positionButtons[midIdx];
    const midOriginalIndex = config.originalIndices ? config.originalIndices[midIdx] : midIdx;
    const midPosition = config.positions[midIdx];

    midButton.data.select(true);
    selectedPositionIndex = midOriginalIndex;
    if (previewGroup) {
      previewGroup.position = midPosition;
    }
  }

  // Create fixed UI (back button, label) on fixedLayer at bottom of screen
  layers.fixedLayer.activate();
  fixedUI = new paper.Group();
  fixedUI.applyMatrix = false;

  const viewWidth = paper.view.viewSize.width;
  const fixedScale = 5;

  // Back button at top-left
  const backButton = createBackButton();
  backButton.scaling = new paper.Point(fixedScale, fixedScale);
  backButton.position = new paper.Point(30, 30);
  fixedUI.addChild(backButton);

  // Label below progress bar at top
  const label = new paper.PointText(new paper.Point(0, 0));
  label.content = config.label;
  label.justification = 'center';
  label.fontFamily = 'TTNorms, sans-serif';
  label.fontSize = 16;
  label.fillColor = colors.text.color;

  const isMobile = getMobileOperatingSystem() !== 'unknown';
  const subLabel = new paper.PointText(new paper.Point(0, 18));
  // Use longest text for background sizing, then set initial text
  subLabel.content = isMobile ? 'Tap again to confirm' : 'Click again to confirm';
  subLabel.justification = 'center';
  subLabel.fontFamily = 'TTNorms, sans-serif';
  subLabel.fontSize = 11;
  subLabel.fillColor = colors.oceanText.color;
  subLabelText = subLabel;

  // Size background for longest possible text
  const combinedBounds = label.bounds.unite(subLabel.bounds);
  // Set initial text based on whether a position is pre-selected
  subLabel.content = selectedPositionIndex !== null
    ? (isMobile ? 'Tap again to confirm' : 'Click again to confirm')
    : (isMobile ? 'Tap a location' : 'Click a location');
  const labelBg = new paper.Path.Rectangle(
    new paper.Rectangle(
      combinedBounds.x - 8,
      combinedBounds.y - 4,
      combinedBounds.width + 16,
      combinedBounds.height + 8
    ),
    new paper.Size(6, 6)
  );
  labelBg.fillColor = colors.paper.color;
  labelBg.opacity = 0.9;

  labelGroup = new paper.Group([labelBg, label, subLabel]);
  labelGroup.applyMatrix = false;
  labelGroup.position = new paper.Point(viewWidth / 2, 60);
  fixedUI.addChild(labelGroup);

  // Listen for resize
  resizeHandler = () => {
    if (labelGroup) {
      labelGroup.position.x = paper.view.viewSize.width / 2;
    }
    // Recalculate zoom for new window size
    if (currentZoomBounds) {
      zoomToFit(currentZoomBounds);
    }
  };
  emitter.on('resize', resizeHandler);

  layers.mapOverlayLayer.activate();
}

export function hidePositionSelector(): void {
  if (frameHandler) {
    paper.view.off('frame', frameHandler);
    frameHandler = null;
  }
  stopViewAnimation();
  if (resizeHandler) {
    emitter.off('resize', resizeHandler);
    resizeHandler = null;
  }
  if (previewGroup) {
    previewGroup.remove();
    previewGroup = null;
  }
  if (selectorUI) {
    selectorUI.remove();
    selectorUI = null;
  }
  if (fixedUI) {
    fixedUI.remove();
    fixedUI = null;
  }
  labelGroup = null;
  subLabelText = null;
  selectedPositionIndex = null;
  positionButtons = [];
  currentEventName = null;
  currentZoomBounds = null;
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
  const globalBlockSize = globalBounds.width / bounds.width * blockSize;
  const maxZoom = WIZARD_MAX_BLOCK_PX / (globalBlockSize * padding);
  const newZoom = Math.min(zoomX, zoomY, maxZoom);

  // Animate the view transition
  startViewAnimation({ zoom: newZoom, center: globalBounds.center.clone() });

  // Set up frame handler if not already running
  if (!frameHandler) {
    frameHandler = (event: { delta: number }) => {
      tickViewAnimation(event.delta);
    };
    paper.view.on('frame', frameHandler);
  }
}

export function isPositionSelectorVisible(): boolean {
  return selectorUI !== null && selectorUI.visible;
}

// Get peninsula position coordinates by index and side
export function getPeninsulaPosition(side: 'left' | 'right', index: number): paper.Point {
  const x = side === 'left' ? blockSize / 2 : mapWidth - blockSize / 2;
  const positions = [
    new paper.Point(x, 1 * blockSize + blockSize / 2),
    new paper.Point(x, 2 * blockSize + blockSize / 2),
    new paper.Point(x, 3 * blockSize + blockSize / 2),
    new paper.Point(x, 4 * blockSize + blockSize / 2),
  ];

  return positions[index] || positions[0];
}

// Get rock position coordinates by index and side
export function getRockPosition(side: 'left' | 'right', index: number): paper.Point {
  const x = side === 'left' ? blockSize / 2 : mapWidth - blockSize / 2;
  const positions = [
    new paper.Point(x, 1 * blockSize + blockSize / 2),
    new paper.Point(x, 2 * blockSize + blockSize / 2),
    new paper.Point(x, 3 * blockSize + blockSize / 2),
    new paper.Point(x, 4 * blockSize + blockSize / 2),
  ];

  return positions[index] || positions[0];
}

// Get the block coordinates for a given rock selection
export function getRockBlock(
  side: 'left' | 'right',
  positionIndex: number
): { x: number; y: number } {
  const x = side === 'left' ? 0 : horizontalBlocks - 1;
  // Position index 0-3 corresponds to rows 1-4
  const y = positionIndex + 1;
  return { x, y };
}
